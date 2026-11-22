// Writes the results page: assets/results.html with the run's data, the bundled fonts and the taste count put inside,
// so the page works offline and opens from any folder. board.mjs calls fillPage after every scan; it also runs alone:
//
//   node fill.mjs <results.json> [out.html] [--no-open]
//
// Opening: openPage opens the page in the default browser. RESULTS_NO_OPEN=1 in the environment turns it off everywhere.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const TEMPLATE = path.join(HERE, 'assets', 'results.html');
const FONTS = path.join(HERE, 'assets', 'fonts');

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF';
const FONT_FACES = [   // family, file, weight, characters it covers
  ['Outfit', 'outfit-latin.woff2', '400 600', LATIN],
  ['Outfit', 'outfit-latin-ext.woff2', '400 600', LATIN_EXT],
  ['Doto', 'doto-latin.woff2', '900', LATIN],
];
// Characters built from their codes, so this file itself never holds them.
const EM_DASH = String.fromCharCode(0x2014), LINE_SEP = String.fromCharCode(0x2028), PARA_SEP = String.fromCharCode(0x2029);

// How many picks a taste file holds: one line each under its "## Picks" heading.
export function tastePicks(file) {
  if (!file || !fs.existsSync(file)) return 0;
  const part = fs.readFileSync(file, 'utf8').split('## Picks');
  return part.length < 2 ? 0 : part[1].split('\n').filter(l => l.startsWith('- ')).length;
}

// Hard problems stop the write; soft ones come back as warnings and the page is still written.
export function checkData(data) {
  const errors = [], warnings = [];
  const isUrl = (u) => /^https?:\/\//i.test(String(u || ''));
  if (!['latest', 'outliers'].includes(data.kind)) errors.push('"kind" must be "latest" or "outliers"');
  if (!Array.isArray(data.items)) errors.push('"items" must be a list');
  if (!data.run || !data.run.topic) warnings.push('run.topic is empty, so the header has no topic');
  (data.items || []).forEach((it, i) => {
    const n = `item ${i + 1}`;
    if (!it || typeof it.title !== 'string' || !it.title.trim()) { errors.push(`${n} has no title`); return; }
    if (!isUrl(it.url)) errors.push(`${n} ("${it.title.slice(0, 40)}") needs a real http(s) link`);
    if (data.kind === 'outliers') {
      for (const k of ['multiplier', 'views', 'normal']) if (!Number.isFinite(Number(it[k]))) errors.push(`${n} needs a number in "${k}"`);
    } else {
      if (it.title.length > 100) warnings.push(`${n} title is over 100 characters`);
      if (!it.angle) warnings.push(`${n} has no angle`);
      if (!it.why) warnings.push(`${n} has no why`);
    }
  });
  if (JSON.stringify(data).includes(EM_DASH)) warnings.push('the data holds an em dash; swap it for " - " or a comma');
  return { errors, warnings };
}

// The bundled fonts as inline @font-face rules, or null when a file is missing (the page then falls back to Google Fonts).
function fontCss() {
  const rules = [];
  for (const [family, file, weight, range] of FONT_FACES) {
    const p = path.join(FONTS, file);
    if (!fs.existsSync(p)) return null;
    rules.push(`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(p).toString('base64')}) format('woff2');unicode-range:${range};}`);
  }
  return `<style>${rules.join('')}</style>`;
}

// Writes the page and returns { file, warnings }. Throws on a broken shape, so nothing half-written lands.
export function fillPage(data, outFile, { tasteFile = null } = {}) {
  const { errors, warnings } = checkData(data);
  if (errors.length) throw new Error('Not written. Fix these first:\n- ' + errors.join('\n- '));
  data.run = data.run || {};
  const picks = tastePicks(tasteFile);
  if (picks && !data.run.taste) data.run.taste = { picks, file: tasteFile };
  let html = fs.readFileSync(TEMPLATE, 'utf8');
  const block = /(<script id="results" type="application\/json">)[\s\S]*?(<\/script>)/;
  if (!block.test(html)) throw new Error(`The template has no results data block: ${TEMPLATE}`);
  // "<" is escaped so no title can close the script tag early; the two separators break some older parsers.
  const json = JSON.stringify(data).replace(/</g, '\\u003c').split(LINE_SEP).join('\\u2028').split(PARA_SEP).join('\\u2029');
  const title = `${data.kind === 'outliers' ? 'Outliers' : 'Latest'}: ${data.run.topic || 'results'}`.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  html = html.replace(block, (_, open, close) => open + json + close).replace(/<title>[\s\S]*?<\/title>/, () => `<title>${title}</title>`);
  const fonts = fontCss();
  if (fonts) html = html.replace(/<!--fonts:start-->[\s\S]*?<!--fonts:end-->/, () => fonts);
  else warnings.push(`font files missing in ${FONTS}; the page falls back to Google Fonts (needs internet)`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  return { file: outFile, warnings };
}

// Opens a file in the default browser without waiting for it. Returns false when opening is switched off.
export function openPage(file) {
  if (process.env.RESULTS_NO_OPEN === '1') return false;
  const url = pathToFileURL(path.resolve(file)).href;
  if (process.env.RESULTS_OPEN_DRYRUN === '1') { console.log(`Would open: ${url}`); return true; }
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try { spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref(); return true; }
  catch { return false; }
}

// ---------- command line ----------
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2).filter(a => a !== '--no-open');
  if (!args[0]) { console.error('Usage: node fill.mjs <results.json> [out.html] [--no-open]'); process.exit(1); }
  let data;
  try { data = JSON.parse(fs.readFileSync(args[0], 'utf8')); }
  catch (e) { console.error(`Could not read ${args[0]}: ${e.message}`); process.exit(1); }
  const out = path.resolve(args[1] || args[0].replace(/\.json$/i, '') + '.html');
  try {
    const { warnings } = fillPage(data, out);
    for (const w of warnings) console.warn('warning: ' + w);
    console.log(`Wrote ${out} (${data.kind}, ${data.items.length} items)`);
    if (!process.argv.includes('--no-open') && openPage(out)) console.log('Opened it in your browser.');
  } catch (e) { console.error(e.message); process.exit(1); }
}
