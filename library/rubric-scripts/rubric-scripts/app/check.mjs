// Checks data/scripts.json (and data/state.json if it exists) before you open the app.
// Your agent runs it after every write:  node check.mjs        (add --server to also check the running app)
// Prints OK, or one line per problem with the script and the field, and exits 1 so the agent knows to fix it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(process.env.RUBRIC_SCRIPTS_DATA || path.join(HERE, 'data'));
const PORT = Number(process.env.RUBRIC_SCRIPTS_PORT) || 50011;
const CHANNELS = ['tiktok', 'instagram', 'threads', 'youtube-shorts'];
const DASH = String.fromCharCode(0x2014);              // the long dash: AI tell, never in copy
const problems = [], warnings = [];
const bad = (where, msg) => problems.push(where + ': ' + msg);

let raw;
try { raw = JSON.parse(fs.readFileSync(path.join(DATA, 'scripts.json'), 'utf8')); }
catch (e) { console.log('PROBLEM data/scripts.json: ' + (e.code === 'ENOENT' ? 'missing' : 'not valid JSON (' + e.message + ')')); process.exit(1); }
if (!raw || !Array.isArray(raw.scripts)) { console.log('PROBLEM data/scripts.json: needs a "scripts" list'); process.exit(1); }

const ids = new Set();
raw.scripts.forEach((s, i) => {
  const w = 'script ' + (i + 1) + (s && s.id ? ' (' + s.id + ')' : '');
  if (!s || typeof s !== 'object') return bad(w, 'not an object');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s.id || '')) bad(w, 'id must be lowercase letters, numbers and dashes');
  if (ids.has(s.id)) bad(w, 'id used twice'); ids.add(s.id);
  ['keyword', 'title', 'body', 'caption'].forEach(f => { if (!String(s[f] || '').trim()) bad(w, f + ' is empty'); });
  if (!Array.isArray(s.hooks) || !s.hooks.length) bad(w, 'needs hooks (1 to 5)');
  else {
    if (s.hooks.length > 5) bad(w, 'at most 5 hooks');
    const hid = new Set();
    s.hooks.forEach((h, j) => {
      if (!/^h\d+$/.test(h.id || '')) bad(w, 'hook ' + (j + 1) + ' id must be h1, h2, h3...');
      if (hid.has(h.id)) bad(w, 'hook id ' + h.id + ' used twice'); hid.add(h.id);
      if (!String(h.text || '').trim()) bad(w, 'hook ' + (h.id || j + 1) + ' has no text');
    });
    if (s.hook && !hid.has(s.hook)) bad(w, '"hook" names ' + s.hook + ', which is not one of its hooks');
  }
  if (/^\s*comment\s+["'“]/i.test(s.caption || '')) bad(w, 'caption starts with a Comment "KEYWORD" line; leave it out (the app hides it)');
  if (/^\s*hook\b|\n\s*hook:/i.test(s.body || '')) warnings.push(w + ': body looks like it repeats the hook; the hook lives in "hooks" only');
  const icon = String(s.icon || '');
  if (!icon.trim()) bad(w, 'icon is empty (draw 1 to 4 stroked shapes on a 48 x 48 grid that show THIS idea)');
  if (/<\s*(script|foreignObject|iframe|style)|\son\w+=|javascript:/i.test(icon)) bad(w, 'icon may only hold drawing tags (path, circle, rect, line, polyline)');
  if (/\s(fill|stroke)=/.test(icon)) warnings.push(w + ': icon sets fill or stroke; the app styles them, mark the one orange part with class="a"');
  (s.references || []).forEach((r, k) => { if (!r.url && !r.note) bad(w, 'reference ' + (k + 1) + ' needs a url or a note'); if (r.url && !/^https?:\/\//.test(r.url)) bad(w, 'reference ' + (k + 1) + ' url must start with http'); });
  (s.channels || []).forEach(c => { if (!CHANNELS.includes(c)) bad(w, 'unknown channel "' + c + '" (use ' + CHANNELS.join(', ') + ')'); });
  if (s.created && isNaN(Date.parse(s.created))) bad(w, 'created is not a date');
  const text = JSON.stringify(s);
  if (text.includes(DASH)) bad(w, 'has a long dash character; use " - " or a comma');
});

const stFile = path.join(DATA, 'state.json');
if (fs.existsSync(stFile)) {
  try {
    const st = JSON.parse(fs.readFileSync(stFile, 'utf8'));
    if (typeof st.rev !== 'number') bad('state.json', '"rev" must be a number (add 1 to it whenever you change this file)');
    Object.keys(st.items || {}).forEach(id => { if (!ids.has(id)) warnings.push('state.json: work saved for "' + id + '", which is no longer in scripts.json'); });
  } catch (e) { bad('state.json', 'not valid JSON (' + e.message + ')'); }
}

if (process.argv.includes('--server')) {
  try { const r = await fetch('http://localhost:' + PORT + '/api/health'); const d = await r.json(); console.log('Server: running on http://localhost:' + d.port + ' with ' + d.scripts + ' scripts'); }
  catch (e) { warnings.push('server: not running on port ' + PORT + '. Start it with: node server.mjs'); }
}

warnings.forEach(x => console.log('NOTE ' + x));
if (problems.length) { problems.forEach(x => console.log('PROBLEM ' + x)); process.exit(1); }
console.log('OK ' + raw.scripts.length + ' scripts, ' + raw.scripts.reduce((a, s) => a + s.hooks.length, 0) + ' hooks');
