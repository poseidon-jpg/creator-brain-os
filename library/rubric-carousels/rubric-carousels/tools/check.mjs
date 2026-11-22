// Checks one carousel folder (or every folder in carousels/) against the folder format in the README.
// Usage:  node tools/check.mjs [carousels/<slug>]
// Prints one line per check. Exit code 0 when nothing failed, 1 when something did. Reads only, changes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv[2];
const folders = arg ? [path.resolve(arg)]
  : fs.readdirSync(path.join(KIT, 'carousels')).filter(n => !n.startsWith('_') && !n.startsWith('.')).map(n => path.join(KIT, 'carousels', n))
      .filter(d => fs.statSync(d).isDirectory());
let failed = 0;
const say = (ok, msg) => { console.log((ok === true ? 'PASS ' : ok === 'warn' ? 'WARN ' : 'FAIL ') + msg); if (ok === false) failed++; };
const readJSON = f => { try { return [JSON.parse(fs.readFileSync(f, 'utf8')), null]; } catch (e) { return [null, e.message]; } };

for (const dir of folders) {
  const slug = path.basename(dir);
  console.log('\n' + slug);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) say('warn', 'folder name: use lowercase letters, numbers and dashes, it becomes the address');
  const engine = path.join(dir, 'index.html');
  say(fs.existsSync(engine) && fs.readFileSync(engine, 'utf8').includes('ENGINE:'), 'index.html is the card engine (copy it from template/)');
  const window = {};
  try { new Function('window', fs.readFileSync(path.join(dir, 'deck.js'), 'utf8'))(window); } catch (e) { say(false, 'deck.js loads: ' + e.message); continue; }
  const D = window.DECK;
  if (!D || !Array.isArray(D.cards) || !D.cards.length) { say(false, 'deck.js sets window.DECK with a cards list'); continue; }
  say(true, `deck.js loads: ${D.cards.length} cards`);
  say(D.cards.length <= 10 || 'warn', 'Instagram takes 10 cards at most');
  say(D.cards.filter(c => c.cover).length === 1 || 'warn', 'exactly one card has cover:true');
  const scenes = Object.assign({ blank: 1, real: 1 }, D.scenes || {});
  const missing = D.cards.filter(c => c.scene && !scenes[c.scene]).map(c => c.name || c.scene);
  say(!missing.length, 'every scene a card names exists' + (missing.length ? ': missing for ' + missing.join(', ') : ''));
  say(D.cards.every(c => c.name && c.h), 'every card has a name and a title (h)');
  for (const [k, o] of Object.entries(D.covers || {})) if (k !== 'drawn' && !(o.src && fs.existsSync(path.join(dir, o.src)))) say(false, `cover "${k}" image exists (${o.src || 'no src'})`);
  for (const c of D.cards) for (const f of [c.realClip, c.realPoster, ...(c.imgs || []).map(m => m.src)].filter(Boolean)) if (!fs.existsSync(path.join(dir, f))) say(false, `file exists: ${f}`);

  const [m, me] = readJSON(path.join(dir, 'export', 'manifest.json'));
  if (!m) say('warn', 'no snapshots yet: run node tools/export-cards.mjs ' + path.relative(KIT, dir).replace(/\\/g, '/'));
  else {
    say(m.cards && m.cards.length === D.cards.length, `export/manifest.json has ${m.cards ? m.cards.length : 0} cards (deck has ${D.cards.length})`);
    const lost = (m.cards || []).flatMap(c => [c.thumb, c.file]).concat((m.covers || []).map(c => c.thumb)).filter(f => f && !fs.existsSync(path.join(dir, f)));
    say(!lost.length, 'every snapshot file in the manifest exists' + (lost.length ? ': missing ' + lost.join(', ') : ''));
    const stale = fs.statSync(path.join(dir, 'deck.js')).mtimeMs > Date.parse(m.exportedAt || 0);
    if (stale) say('warn', 'deck.js changed after the last snapshots: export again');
  }
  if (fs.existsSync(path.join(dir, 'review.json'))) {
    const [r, re] = readJSON(path.join(dir, 'review.json'));
    say(!!r && Number.isInteger(r.version) && Array.isArray(r.comments || []), 'review.json is valid' + (re ? ': ' + re : ''));
  }
  if (fs.existsSync(path.join(dir, 'status.json'))) {
    const [s, se] = readJSON(path.join(dir, 'status.json'));
    say(!!s && ['draft', 'ready', 'scheduled', 'live'].includes(String(s.status || 'draft').toLowerCase()), 'status.json is valid (draft, ready, scheduled or live)' + (se ? ': ' + se : ''));
  }
}
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
