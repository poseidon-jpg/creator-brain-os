#!/usr/bin/env node
// Self-test for the Instagram, TikTok, X and LinkedIn scanners. No key, no network, no spend, and it never touches the real
// database: it builds synthetic saved responses in a temp folder (fixtures/make-fixtures.mjs), scans them into a
// temp database through every provider, and checks the results through top.mjs.
//
//   node tools/youtube/outliers/selftest-social.mjs
//
// This proves the plumbing (parsing, scoring, guards, budget refusal, the --json shape). It does not prove a live
// service still answers the way its docs say: that needs a real key and a real scan.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'outliers-selftest-'));
const fx = path.join(tmp, 'fixtures');
execFileSync(process.execPath, [path.join(HERE, 'fixtures', 'make-fixtures.mjs'), fx], { stdio: 'ignore' });

const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  -> ${detail}`}`); };
const run = (script, args) => spawnSync(process.execPath, [path.join(HERE, script), ...args], { encoding: 'utf8' });
const scan = (db, args) => run('scan-social.mjs', ['--db', db, '--fixtures', fx, ...args]);
const top = (db, args) => { const r = run('top.mjs', ['--db', db, '--json', ...args]); return { r, doc: r.status === 0 ? JSON.parse(r.stdout) : null }; };

const KEYS = ['platform', 'id', 'url', 'title', 'author', 'followers', 'posted', 'views', 'multiplier', 'baseline', 'thumb'];
const shapeOk = (it) => KEYS.every(k => k in it) && Object.keys(it).length === KEYS.length
  && typeof it.url === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.posted) && typeof it.multiplier === 'number' && it.title.length <= 140;

const cases = [
  { provider: 'scrapecreators', platform: 'instagram', accounts: 'fixture_ig_one,fixture_ig_two,fixture_ig_new,fixture_ig_photo', hit: 'fixture_ig_one' },
  { provider: 'scrapecreators', platform: 'tiktok', accounts: 'fixture_tt_one,fixture_tt_two,fixture_tt_new', hit: 'fixture_tt_one' },
  { provider: 'apify', platform: 'instagram', accounts: 'fixture_ig_one,fixture_ig_two,fixture_ig_new,fixture_ig_photo', hit: 'fixture_ig_one' },
  { provider: 'apify', platform: 'tiktok', accounts: 'fixture_tt_one,fixture_tt_two,fixture_tt_new', hit: 'fixture_tt_one' },
  { provider: 'ytdlp', platform: 'tiktok', accounts: 'fixture_tt_one,fixture_tt_two,fixture_tt_new', hit: 'fixture_tt_one' },
  { provider: 'fxtwitter', platform: 'x', accounts: 'fixture_x_one,fixture_x_two,fixture_x_new', hit: 'fixture_x_one' },
  { provider: 'xapi', platform: 'x', accounts: 'fixture_x_one,fixture_x_two,fixture_x_new', hit: 'fixture_x_one' },
  { provider: 'apify', platform: 'x', accounts: 'fixture_x_one,fixture_x_two,fixture_x_new', hit: 'fixture_x_one' },
  { provider: 'apify', platform: 'linkedin', accounts: 'fixture-li-one,fixture-li-two,fixture-li-new', hit: 'in/fixture-li-one' },
  { provider: 'scrapecreators', platform: 'linkedin', accounts: 'fixture-li-one,fixture-li-two,https://www.linkedin.com/in/fixture-li-new/', hit: 'in/fixture-li-one' },
];
const authorOf = (c) => (c.platform === 'linkedin' ? c.hit : `@${c.hit}`);

for (const c of cases) {
  const db = path.join(tmp, `${c.provider}-${c.platform}.db`);
  const s = scan(db, ['--platform', c.platform, '--accounts', c.accounts, '--provider', c.provider, '--days', '14']);
  const label = `${c.provider} ${c.platform}`;
  check(`${label}: scan exits 0`, s.status === 0, (s.stderr || s.stdout).slice(-300));
  const { r, doc } = top(db, ['--platform', c.platform, '--days', '14']);
  check(`${label}: top.mjs prints one JSON document`, !!doc && r.stdout.trim().startsWith('{'), r.stderr.slice(0, 200));
  if (!doc) continue;
  const items = doc.items;
  check(`${label}: the planted outlier is found, about 8x`, items.length === 1 && items[0].author === authorOf(c) && items[0].multiplier > 6 && items[0].multiplier < 11,
    JSON.stringify(items.map(i => [i.author, i.multiplier])));
  check(`${label}: no normal, thin, photo-only, reply or repost post leaks in`, items.every(i => i.author === authorOf(c)));
  check(`${label}: item matches the contract shape`, items.length > 0 && items.every(shapeOk), JSON.stringify(items[0]));
  check(`${label}: platform field is right`, items.every(i => i.platform === c.platform));
}

// Budget: a scan whose worst-case estimate is over the budget must refuse before fetching anything.
{
  const db = path.join(tmp, 'budget.db');
  const s = scan(db, ['--platform', 'instagram', '--accounts', 'fixture_ig_one,fixture_ig_two', '--provider', 'apify', '--budget-usd', '0.001']);
  check('budget: refuses to start when the estimate is over --budget-usd (exit 2)', s.status === 2 && /Refusing to start/.test(s.stderr), `${s.status} ${s.stderr.slice(0, 200)}`);
  const t = top(db, ['--platform', 'instagram']);
  check('budget: nothing was fetched or saved', t.doc && t.doc.items.length === 0);
}

// Dry run spends and saves nothing.
{
  const db = path.join(tmp, 'dry.db');
  const s = scan(db, ['--platform', 'tiktok', '--accounts', 'fixture_tt_one', '--provider', 'scrapecreators', '--dry-run']);
  check('dry run: prints an estimate and stops', s.status === 0 && /dry run/.test(s.stdout) && /estimate/.test(s.stdout), s.stdout.slice(-200));
}

// Repeat scan inside the refresh window costs nothing.
{
  const db = path.join(tmp, 'scrapecreators-tiktok.db');
  const s = scan(db, ['--platform', 'tiktok', '--accounts', 'fixture_tt_one,fixture_tt_two,fixture_tt_new', '--provider', 'scrapecreators']);
  check('repeat scan: accounts scanned a moment ago are skipped', /3 scanned recently/.test(s.stdout), s.stdout.slice(0, 300));
}

// YouTube alone still works on a database with no social tables, and --platform all works with them.
{
  const db = path.join(tmp, 'plain.db');
  const { DatabaseSync } = await import('node:sqlite');
  new DatabaseSync(db).close();   // an empty file: top.mjs creates the YouTube tables itself
  const t = top(db, ['--platform', 'youtube']);
  check('youtube only: top.mjs works with no social tables (empty items, exit 0)', t.r.status === 0 && Array.isArray(t.doc?.items) && t.doc.items.length === 0, t.r.stderr.slice(0, 200));
  const all = top(path.join(tmp, 'apify-tiktok.db'), ['--platform', 'all']);
  check('all platforms: items still sorted by multiplier, biggest first', all.doc && all.doc.items.every((it, i, a) => i === 0 || a[i - 1].multiplier >= it.multiplier));
}

// LinkedIn is measured in engagement, so "all" (what an ideas tool reads as views) leaves it out unless it is named.
{
  const db = path.join(tmp, 'apify-linkedin.db');
  const all = top(db, ['--platform', 'all']);
  check('linkedin: left out of --platform all (its numbers are engagement, not views)', all.doc && all.doc.items.length === 0);
  const named = top(db, ['--platform', 'x,linkedin']);
  check('linkedin: listed when named in a platform list', named.doc && named.doc.items.length === 1 && named.doc.items[0].platform === 'linkedin');
  const table = run('top.mjs', ['--db', db, '--platform', 'linkedin']);
  check('linkedin: the table says it counts engagement', /engagement/.test(table.stdout), table.stdout.slice(0, 200));
}

// No long dash character in anything printed.
{
  const t = top(path.join(tmp, 'apify-tiktok.db'), ['--platform', 'all']);
  check('output has no em dash character', !t.r.stdout.includes(String.fromCharCode(8212)));
}

fs.rmSync(tmp, { recursive: true, force: true });
const failed = results.filter(r => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed.`);
process.exit(failed ? 1 : 0);
