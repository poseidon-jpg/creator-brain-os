// Makes the snapshots of one carousel through the engine's single-card mode (index.html?solo=N&still=1), headless.
// Writes <carousel>/export/: card-01.png ... at 1080x1350 (the Instagram size), thumb-01.jpg ... at 432x540,
// cover-<key>.jpg thumbs for every cover option, and manifest.json (what RUBRIC Carousels reads).
// Video cards export their poster frame as the still; the live card (with motion) is the carousel's own page.
//
// Usage:  node tools/export-cards.mjs <carousel folder> [--cover <key>] [--thumbs-only]
// Needs Playwright, once, in the kit folder:  npm install playwright-core   (drives the Chrome or Edge you already have)
//                                       or:  npm install playwright && npx playwright install chromium
// Exit codes: 0 done, 1 bad folder or deck, 2 Playwright or a browser is missing, 3 a card failed to render.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const runArg = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--cover');
const run = runArg && path.resolve(runArg);
if (!run || !fs.existsSync(path.join(run, 'deck.js')) || !fs.existsSync(path.join(run, 'index.html'))) {
  console.error('Usage: node tools/export-cards.mjs <carousel folder with deck.js and index.html> [--cover <key>] [--thumbs-only]'); process.exit(1);
}
const flag = n => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : null; };

// Playwright: the full package (its own Chromium) first, then playwright-core with the Chrome or Edge already installed
async function launch() {
  const req = createRequire(path.join(KIT, 'package.json'));
  let pw = null, core = false;
  try { pw = req('playwright'); } catch (e) { try { pw = req('playwright-core'); core = true; } catch (e2) {} }
  if (!pw) { console.error('Snapshots need Playwright. In the kit folder run: npm install playwright-core   (then run this again)'); process.exit(2); }
  const tries = core ? [{ channel: 'chrome' }, { channel: 'msedge' }] : [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  for (const o of tries) { try { return await pw.chromium.launch({ headless: true, ...o }); } catch (e) {} }
  console.error('Playwright found no browser. Install Google Chrome, or run: npx playwright install chromium');
  process.exit(2);
}

// read deck.js the way the page does: it only assigns window.DECK, its scenes run later in the browser
const window = {};
try { new Function('window', fs.readFileSync(path.join(run, 'deck.js'), 'utf8'))(window); }
catch (e) { console.error('deck.js has an error: ' + e.message); process.exit(1); }
const DECK = window.DECK;
if (!DECK || !Array.isArray(DECK.cards) || !DECK.cards.length) { console.error('deck.js must set window.DECK with a cards list'); process.exit(1); }
const review = (() => { try { return JSON.parse(fs.readFileSync(path.join(run, 'review.json'), 'utf8')); } catch (e) { return {}; } })();
const coverKey = flag('--cover') || review.cover || DECK.coverDefault || Object.keys(DECK.covers || {})[0] || 'drawn';
const thumbsOnly = !!flag('--thumbs-only');
const outDir = path.join(run, 'export');
fs.mkdirSync(outDir, { recursive: true });
const pageUrl = q => pathToFileURL(path.join(run, 'index.html')).href + '?' + q;
const strip = s => String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();   // a line break is a space in a plain title
const pad = n => String(n + 1).padStart(2, '0');

const b = await launch();
async function shoot(q, w, file, type) {
  const page = await b.newPage({ viewport: { width: w, height: Math.round(w * 1.25) } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(u => !/^(file|data|blob):/i.test(String(u)), r => r.abort());   // a card never reaches the internet while it is snapped
  await page.goto(pageUrl(q));
  try { await page.waitForSelector('html[data-ready="1"]', { timeout: 15000 }); }
  catch (e) { await b.close(); console.error('A card did not render (' + q + '). ' + (errors[0] || 'Open the carousel page to see the error.')); process.exit(3); }
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);   // posters and images settle
  await page.screenshot({ path: file, type, quality: type === 'jpeg' ? 86 : undefined, clip: { x: 0, y: 0, width: w, height: Math.round(w * 1.25) } });
  await page.close();
}

// where a video card's footage sits, so RUBRIC Carousels can play it over the snapshot (same box and fit as the engine)
const RB = DECK.realBox || { x: 48, y: 274, w: 444, h: 333 }, CW = 540, CH = 675;
const RECT = { x: +(RB.x / CW * 100).toFixed(3), y: +(RB.y / CH * 100).toFixed(3), w: +(RB.w / CW * 100).toFixed(3), h: +(RB.h / CH * 100).toFixed(3) };
const isStill = f => /\.(png|jpe?g|webp)$/i.test(f || '');
function mediaOf(c) {
  if (!c.item || c.real !== 'video') return null;
  if (c.realClip && !isStill(c.realClip)) return { src: c.realClip, fit: 'contain', rect: RECT };
  return { src: `${DECK.realDir || 'items'}/${c.item}.mp4`, fit: 'cover', rect: RECT };
}

const cards = [];
for (let i = 0; i < DECK.cards.length; i++) {
  const c = DECK.cards[i];
  const q = `solo=${i}&still=1&cover=${encodeURIComponent(coverKey)}`;
  if (!thumbsOnly) await shoot(q, 1080, path.join(outDir, `card-${pad(i)}.png`), 'png');
  await shoot(q, 432, path.join(outDir, `thumb-${pad(i)}.jpg`), 'jpeg');
  cards.push({ i, num: c.num || null, name: c.name || `Card ${i + 1}`, title: strip(c.h).replace(/^(.{60}).+/, '$1...'), cover: !!c.cover, dark: !!c.dark,
    kind: c.cover ? 'photo' : (c.item ? (c.real || c.kind) : c.kind), style: c.style, clip: c.realClip || null, media: mediaOf(c),
    file: thumbsOnly ? null : `export/card-${pad(i)}.png`, thumb: `export/thumb-${pad(i)}.jpg` });
  process.stdout.write(`card ${i + 1}/${DECK.cards.length}\r`);
}
// one thumb per cover option, so the app can switch covers without a new export
const covers = [];
const coverIdx = DECK.cards.findIndex(c => c.cover);
if (coverIdx >= 0) for (const [key, o] of Object.entries(DECK.covers || {})) {
  const f = `cover-${key.replace(/[^a-z0-9_-]/gi, '_')}.jpg`;
  await shoot(`solo=${coverIdx}&still=1&cover=${encodeURIComponent(key)}`, 432, path.join(outDir, f), 'jpeg');
  covers.push({ key, label: o.label || key, thumb: `export/${f}` });
}
await b.close();

const manifest = { title: strip(DECK.page) || path.basename(run), lede: strip(DECK.lede), caption: DECK.caption || '', keyword: DECK.keyword || null,
  coverKey, coverIndex: coverIdx, covers, cards, exportedAt: new Date().toISOString() };
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1));
console.log(`\nexported ${cards.length} cards and ${covers.length} cover thumbs to ${outDir.replace(/\\/g, '/')}`);
