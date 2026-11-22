#!/usr/bin/env node
// Instagram and TikTok outlier scanner - finds video posts beating their own account's baseline.
//
//   multiplier = post views / median views of that account's EARLIER posts
//
// Same idea and same guards as the YouTube scanner (scan.mjs), pointed at accounts the user picks instead of keywords.
// Posts and scores go in the same database as YouTube (DB_PATH in paths.mjs) in their own tables.
//
// Usage (from the folder in RUN_FROM, paths.mjs):
//   node scan-social.mjs --platform tiktok --peers                 # every account in the peers file
//   node scan-social.mjs --platform instagram --accounts handle_one,handle_two
//   node scan-social.mjs --platform all --peers --budget-usd 0.5
//   node scan-social.mjs --platform tiktok --peers --dry-run       # estimate only, spends nothing
//
// Flags: --days N (window, default from social.mjs)  --per-account N  --budget-usd N  --provider scrapecreators|apify|ytdlp
//        --refresh-days N (skip accounts scanned in the last N days, default 1, 0 = always fetch)  --min-mult N
//        --db FILE  --peers-file FILE  --fixtures DIR (read saved responses instead of calling a service; for tests)
//        --no-board (skip rebuilding the results page; tests use it)  --no-open (rebuild it without opening it)
// Settings to change (budget, window, which service) live in the marked block at the top of social.mjs.

import './quiet.mjs';
import fs from 'node:fs';
import { SETTINGS, PROVIDERS, pickProviders, cleanHandle } from './social.mjs';
import {
  openSocialDb, getAccount, saveAccount, savePosts, rescoreAccount, socialOutliers,
  socialStats, logSocialScan, PLATFORMS as ALL_PLATFORMS, METRIC, accountLabel,
} from './social-db.mjs';
import { ENV_FILES } from './paths.mjs';
import { buildReport, boardRows } from './board.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[i + 1]);
};
const has = (name) => argv.includes(`--${name}`);
const num = (name, fallback) => { const v = flag(name); return v === null || v === true ? fallback : Number(v); };

const OPTS = {
  platform: flag('platform', null),
  accounts: flag('accounts', null),
  peers: has('peers'),
  days: num('days', SETTINGS.windowDays),
  perAccount: num('per-account', SETTINGS.perAccount),
  budgetUsd: num('budget-usd', SETTINGS.budgetUsd),
  provider: flag('provider', null),
  refreshDays: num('refresh-days', 1),
  minMult: num('min-mult', 2),
  top: num('top', 10),
  db: flag('db', SETTINGS.dbFile),
  peersFile: flag('peers-file', SETTINGS.peersFile),
  fixtures: flag('fixtures', null),
  dryRun: has('dry-run'),
  noBoard: has('no-board'),
  noOpen: has('no-open'),          // write the results page but don't open it in the browser
};

const PLATFORMS = ALL_PLATFORMS;
const money = (n) => `$${n < 0.1 ? n.toFixed(4) : n.toFixed(2)}`;
const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
// A problem with one platform stops that platform only, so `--platform all` still scans the other one.
class Stop extends Error { constructor(message, code = 1) { super(message); this.code = code; } }
const stop = (msg, code = 1) => { throw new Stop(msg, code); };

function loadHandles(platform) {
  if (OPTS.accounts && OPTS.accounts !== true) {
    return [...new Set(String(OPTS.accounts).split(',').map(h => cleanHandle(h, platform)).filter(h => h && h !== 'in/'))];
  }
  if (!fs.existsSync(OPTS.peersFile)) stop(`Peers file not found: ${OPTS.peersFile}. Create it with your accounts ({ "tiktok": ["handle"], "instagram": ["handle"] }), or pass --accounts a,b,c.`);
  const peers = JSON.parse(fs.readFileSync(OPTS.peersFile, 'utf8'));
  return [...new Set((peers[platform] || []).map(h => cleanHandle(h, platform)).filter(h => h && h !== 'in/'))];
}

async function scanPlatform(db, platform, budgetUsd) {
  const all = loadHandles(platform);
  if (!all.length) { console.log(`${platform}: no accounts to scan.`); return; }

  // 1. Skip accounts scanned recently, so a repeat run costs nothing.
  const staleBefore = new Date(Date.now() - OPTS.refreshDays * 864e5).toISOString();
  const handles = [], fresh = [];
  for (const h of all) {
    const acc = getAccount(db, platform, h);
    if (OPTS.refreshDays > 0 && acc && acc.checked_at > staleBefore) fresh.push(h); else handles.push(h);
  }
  console.log(`\n== ${platform}: ${all.length} accounts, ${fresh.length} scanned recently (skipped), ${handles.length} to fetch ==`);

  // 2. Which service, and what will it cost? Refuse before spending anything if over budget.
  const { usable, skipped } = pickProviders(platform, { forced: OPTS.provider, fixtures: OPTS.fixtures });
  for (const s of skipped) console.log(`  not used - ${s}`);
  if (!usable.length) {
    const keys = (SETTINGS.order[platform] || []).map(id => PROVIDERS[id]).filter(p => p?.keyName).map(p => p.keyName);
    const free = (SETTINGS.order[platform] || []).map(id => PROVIDERS[id]).find(p => p && !p.keyName);
    const hint = free ? ` The free source (${free.label}) did not answer either: ${skipped.find(s => s.startsWith(free.label)) || 'check it is installed and reachable'}.`
      : ` ${platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} has no free source: these services are paid (each has a small free allowance to start).`;
    stop(`No source is ready for ${platform}. Add one of these keys to ${ENV_FILES[0]}: ${keys.join(' or ')}.${hint}`);
  }
  if (!handles.length) { console.log('  nothing to fetch.'); return; }
  const est = usable[0].estimate(platform, handles.length, OPTS.perAccount);
  console.log(`  source: ${usable.map(p => p.label).join(' then ')}`);
  console.log(`  estimate: about ${money(est.expectedUsd)}, worst case ${money(est.maxUsd)}, budget left ${money(budgetUsd)}`);
  if (est.maxUsd > budgetUsd) {
    stop(`Refusing to start: the worst-case estimate ${money(est.maxUsd)} is over --budget-usd ${OPTS.budgetUsd}. Scan fewer accounts, lower --per-account, or raise the budget.`, 2);
  }
  if (OPTS.dryRun) { console.log('  dry run: nothing fetched, nothing spent.'); return; }

  // 3. Fetch, failing over to the next service if one has no credit or a bad key.
  const ctx = { budgetUsd, spentUsd: 0, requests: 0, fixtures: OPTS.fixtures };
  const results = {};
  const usedBy = {};
  let remaining = handles, lastError = null;
  for (const prov of usable) {
    if (!remaining.length) break;
    let r;
    try {
      r = await prov.fetch({ platform, handles: remaining, limit: OPTS.perAccount, ctx });
    } catch (e) {
      lastError = e;
      console.log(`  ${prov.label} failed (${e.message})${prov !== usable[usable.length - 1] ? ', trying the next source' : ''}`);
      continue;
    }
    for (const [h, a] of Object.entries(r.accounts)) { results[h] = a; usedBy[h] = prov.id; }
    remaining = remaining.filter(h => !r.accounts[h]);
    if (r.abort) { lastError = r.abort; console.log(`  ${prov.label} stopped (${r.abort.message})${remaining.length ? ', trying the next source' : ''}`); }
  }
  if (!Object.keys(results).length) stop(`No source worked for ${platform}: ${lastError?.message || 'unknown error'}`);

  // 4. Save, then score every touched account against everything stored for it.
  let postsSaved = 0, newPosts = 0;
  const problems = [], quiet = [];
  for (const [h, a] of Object.entries(results)) {
    if (!a.posts?.length) { problems.push(`@${h}: ${a.error || 'no posts'}`); continue; }
    newPosts += savePosts(db, platform, h, usedBy[h], a.posts);
    saveAccount(db, { platform, handle: h, display_name: a.displayName, followers: a.followers, provider: usedBy[h] });
    rescoreAccount(db, platform, h);
    postsSaved += a.posts.length;
    const newest = a.posts.reduce((m, p) => (p.posted_at > m ? p.posted_at : m), '');
    if (new Date(newest).getTime() < Date.now() - 60 * 864e5) quiet.push(`@${h} (last post ${newest.slice(0, 10)})`);
  }
  for (const h of remaining) problems.push(`@${h}: not fetched, no source left`);

  logSocialScan(db, {
    platform, provider: [...new Set(Object.values(usedBy))].join('+'), accounts: handles.length - problems.length,
    posts: postsSaved, requests: ctx.requests, est_cost_usd: est.expectedUsd, cost_usd: ctx.spentUsd,
    note: problems.length ? problems.join('; ').slice(0, 500) : '',
  });

  console.log(`  fetched ${postsSaved} video posts (${newPosts} new) from ${handles.length - problems.length} accounts, ${ctx.requests} requests, cost about ${money(ctx.spentUsd)}`);
  for (const p of problems) console.log(`  problem - ${p}`);
  if (quiet.length) console.log(`  quiet accounts, no post in 60 days (consider removing from the peers file): ${quiet.join(', ')}`);
  return ctx.spentUsd;
}

function printTable(rows) {
  if (!rows.length) { console.log('\nNo outliers matched yet. A new account needs 5 earlier posts before a multiplier counts, and a post needs 24 hours.'); return; }
  console.log(`\n  MULT     VIEWS  BASELINE  PLATFORM   ACCOUNT                  POST`);
  if (rows.some(r => METRIC[r.platform] === 'engagement')) console.log('  (LinkedIn rows count engagement - reactions + comments + reposts - not views)');
  for (const r of rows) {
    console.log(
      `${(r.multiplier + 'x').padStart(6)} ${String(r.views).padStart(9)} ${String(r.baseline).padStart(9)}  ${r.platform.padEnd(9)}  ${accountLabel(r.platform, r.handle).slice(0, 23).padEnd(23)}  ${String(r.caption || '').split('\n')[0].slice(0, 60)}`,
    );
  }
}

async function main() {
  if (!OPTS.platform || ![...PLATFORMS, 'all'].includes(OPTS.platform)) die(`Usage: scan-social.mjs --platform ${PLATFORMS.join('|')}|all (--peers | --accounts a,b,c) [--days 14] [--per-account 30] [--budget-usd 1] [--dry-run]`);
  if (!OPTS.peers && !(OPTS.accounts && OPTS.accounts !== true)) die('Pick the accounts: --peers (the peers file) or --accounts a,b,c');
  if (OPTS.platform === 'all' && OPTS.accounts) die('--accounts names handles for one platform. Name the platform, or use --peers for all of them.');

  const db = openSocialDb(OPTS.db);
  const platforms = OPTS.platform === 'all' ? PLATFORMS : [OPTS.platform];
  let spent = 0, exitCode = 0, scanned = 0;
  for (const p of platforms) {
    try { spent += (await scanPlatform(db, p, OPTS.budgetUsd - spent)) || 0; scanned++; }
    catch (e) { if (!(e instanceof Stop)) throw e; console.error(`${p}: ${e.message}`); exitCode = Math.max(exitCode, e.code); }
  }

  if (!OPTS.dryRun && scanned) {
    const rows = socialOutliers(db, { platform: OPTS.platform === 'all' ? null : OPTS.platform, days: OPTS.days, minMult: OPTS.minMult, limit: OPTS.top });
    printTable(rows);
    const s = socialStats(db);
    console.log(`\nThis run cost about ${money(spent)} (budget ${money(OPTS.budgetUsd)}). Database: ${OPTS.db} - ${s.posts} social posts, ${s.accounts} accounts, ${s.scans} scans`);
    // The results page shows every platform, so a social scan refreshes it too. Never for a test database.
    if (!OPTS.noBoard && OPTS.db === SETTINGS.dbFile) {
      const page = buildReport(boardRows(db, { days: OPTS.days, minMult: OPTS.minMult }), { days: OPTS.days, minMult: OPTS.minMult, reportOnly: true, db, open: !OPTS.noOpen });
      console.log(`Page: ${page}`);
    }
  }
  db.close();
  if (exitCode) process.exit(exitCode);
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
