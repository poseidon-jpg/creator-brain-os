#!/usr/bin/env node
// Saves the picks a user pasted back from a results page into this skill's taste file.
//
//   node taste.mjs add -      # the pasted idea cart on standard input (or a file path instead of -)
//   node taste.mjs like -     # the rewritten "What you like" list on standard input, one line each
//   node taste.mjs show       # print the taste file
//   add [--skill /outliers]   # which skill's picks to keep; picks for another skill are left for it
//
// The cart is the text the page's "Copy for my agent" button made (it starts with "Idea cart:"). The script does every
// write, because agents often guard their own skills folder: it keeps the log and the counts, and "like" swaps in the
// list the agent wrote (topics, formats, accounts and angles, 8 lines at most).
import fs from 'node:fs';
import path from 'node:path';
import { TASTE_FILE } from './paths.mjs';

const HEAD = `# Taste

What you liked, saved from the idea carts you pasted back. Your agent reads this before every run of this skill: it marks the outliers that fit and writes "Your version" around them. Edit it freely.

## What you like
<!-- The agent rewrites this list after each paste: topics, formats, sources and angles, in plain words, 8 lines at most. -->
- Nothing saved yet.
`;
const FIELDS = ['From', 'Source', 'Numbers', 'Link', 'Angle', 'Why it helps', 'Your version', 'Fit my taste file', 'My note'];

// The pasted cart text as a list of picks.
export function parseCart(text) {
  const picks = [];
  let cur = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = /^(\d+)\.\s+(.+)$/.exec(raw.trimEnd());
    if (m && !raw.startsWith(' ')) { cur = { title: m[2].trim() }; picks.push(cur); continue; }
    if (!cur) continue;
    const s = raw.trim();
    const f = FIELDS.find(k => s.startsWith(k + ':'));
    if (f) cur[f] = s.slice(f.length + 1).trim();
  }
  return picks.filter(p => p.Link);
}

const clean = (s) => String(s || '').replace(/\|/g, '/').trim();
const fields = (line) => { const p = line.slice(2).split(' | ').map(s => s.trim()); while (p.length < 6) p.push(''); return p; };   // date | where | who | title | link | note

function readTaste(file) {
  if (!fs.existsSync(file)) return { like: HEAD, lines: [] };
  const text = fs.readFileSync(file, 'utf8');
  const like = text.split('## Counts')[0].split('## Picks')[0].trimEnd() + '\n';
  const lines = text.includes('## Picks') ? text.split('## Picks')[1].split('\n').filter(l => l.startsWith('- ')) : [];
  return { like, lines };
}

function writeTaste(file, like, lines) {
  const rows = lines.map(fields);
  const count = (i) => {
    const c = new Map();
    rows.forEach(r => { if (r[i]) c.set(r[i], (c.get(r[i]) || 0) + 1); });
    return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(', ') || 'none yet';
  };
  const last = rows.map(r => r[0]).sort().pop();
  const counts = `## Counts\n- Picks saved: ${rows.length}${last ? `, last on ${last}` : ''}\n- Platforms and formats: ${count(1)}\n- Sources: ${count(2)}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${like.trimEnd()}\n\n${counts}\n## Picks\n${lines.join('\n')}${lines.length ? '\n' : ''}`, 'utf8');
}

// Text from standard input when src is "-", else from the file.
const readInput = (src) => fs.readFileSync(src === '-' ? 0 : src, 'utf8');

// Swaps the "What you like" list for the lines given, 8 at most.
export function setLike(src, file = TASTE_FILE) {
  const items = readInput(src).split(/\r?\n/).map(l => l.trim().replace(/^[-*]\s*/, '').trim()).filter(Boolean).slice(0, 8);
  if (!items.length) throw new Error('No lines given. Send the list one line per item.');
  const { like, lines } = readTaste(file);
  const intro = (like.includes('## What you like') ? like : HEAD).split('## What you like')[0];
  const comment = '<!-- The agent rewrites this list after each paste: topics, formats, sources and angles, in plain words, 8 lines at most. -->';
  writeTaste(file, `${intro.trimEnd()}\n\n## What you like\n${comment}\n${items.map(i => '- ' + i).join('\n')}\n`, lines);
  return items.length;
}

export function addPicks(cartFile, skill = '/outliers', file = TASTE_FILE) {
  const picks = parseCart(readInput(cartFile));
  if (!picks.length) throw new Error("No picks found. Paste the whole text from Copy for my agent (it starts with 'Idea cart:').");
  const mine = picks.filter(p => String(p.From || '').split(',')[0].trim().toLowerCase() === skill.toLowerCase());
  const { like, lines } = readTaste(file);
  const saved = new Set(lines.map(l => fields(l)[4]));
  const today = new Date().toISOString().slice(0, 10);
  const fresh = [];
  for (const p of mine) {
    if (saved.has(p.Link)) continue;
    const [where = '', who = ''] = String(p.Source || '').split('|').map(s => s.trim());
    const note = clean(p['My note']);
    lines.push(`- ${today} | ${clean(where)} | ${clean(who)} | ${clean(p.title)} | ${p.Link}${note ? ` | note: ${note}` : ''}`);
    saved.add(p.Link);
    fresh.push(p);
  }
  writeTaste(file, like, lines);
  const current = like.split('## What you like').pop().split('\n').filter(l => l.startsWith('- '));
  return { fresh, mine: mine.length, others: picks.length - mine.length, total: lines.length, current };
}

// ---------- command line ----------
const argv = process.argv.slice(2);
let skill = '/outliers';
const si = argv.indexOf('--skill');
if (si !== -1) { skill = argv[si + 1] || skill; argv.splice(si, 2); }
if (argv[0] === 'add' && argv[1]) {
  try {
    const r = addPicks(argv[1], skill);
    console.log(`Saved ${r.fresh.length} new ${skill} pick(s) to ${TASTE_FILE} (${r.mine - r.fresh.length} already saved${r.others ? `, ${r.others} for another skill left for it` : ''}). ${r.total} picks in total.`);
    if (r.fresh.length) {
      console.log("\nNew picks, for rewriting the 'What you like' list:");
      for (const p of r.fresh) {
        console.log(`- ${p.title}\n  Source: ${p.Source || ''}\n  Angle: ${p.Angle || ''}`);
        for (const f of ['Your version', 'Why it helps', 'My note']) if (p[f]) console.log(`  ${f}: ${p[f]}`);
      }
    }
    console.log(`\nThe 'What you like' list now:\n${r.current.join('\n')}`);
    console.log("\nNext: rewrite that list from the picks (topics, formats, accounts and angles they share, merged with what is there, 8 lines at most) and send it to: node scripts/taste.mjs like -");
  } catch (e) { console.error(e.message); process.exit(1); }
} else if (argv[0] === 'like' && argv[1]) {
  try { console.log(`Saved the 'What you like' list (${setLike(argv[1])} lines) to ${TASTE_FILE}.`); }
  catch (e) { console.error(e.message); process.exit(1); }
} else if (argv[0] === 'show') {
  console.log(fs.existsSync(TASTE_FILE) ? fs.readFileSync(TASTE_FILE, 'utf8') : `No taste file yet. It starts at ${TASTE_FILE} on the first paste.`);
} else {
  console.log('Usage: node taste.mjs add - [--skill /outliers]   |   node taste.mjs like -   |   node taste.mjs show   (or a file path instead of -)');
  process.exit(1);
}
