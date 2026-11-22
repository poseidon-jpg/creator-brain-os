#!/usr/bin/env node
/**
 * RUBRIC Storyboards (beta) · optional image tool for the final-video step. Off unless IMAGE_TOOL=on in env.local.
 *
 * A small MCP server (stdio) that gives your agent one extra ability during a final-video run: generate images with
 * GPT Image 2.5 (Flare) on fal.ai, under a hard budget. The app writes an MCP config that points here and passes its
 * path to your agent through {mcp_config} in AGENT_CMD. Your fal key stays in env.local (FAL_KEY); it is read here and
 * never written anywhere else.
 *
 * Images are saved as PNG files in <GEN_WORKDIR>/generated/, so the run can use them from its own folder. Spend is an
 * estimate from fal's price table plus a safety margin, written to GEN_LEDGER, and a call that would cross
 * GEN_BUDGET_USD is refused before anything is sent.
 *
 * Env (set by the app): GEN_WORKDIR, GEN_LEDGER, GEN_BUDGET_USD (default 10).
 * GEN_DRY_RUN=1 answers the handshake and tools/list, and refuses every call without spending (for testing).
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { CONFIG } from './config.mjs';

const WORKDIR = (process.env.GEN_WORKDIR || '').replace(/\\/g, '/');
const LEDGER = process.env.GEN_LEDGER;
const BUDGET = Number(process.env.GEN_BUDGET_USD || 10);
const DRY = process.env.GEN_DRY_RUN === '1';
const TXT = 'openai/gpt-image-2.5/flare/text-to-image';
const EDIT = 'openai/gpt-image-2.5/flare/edit';

// fal's Flare price table: $ per image by quality at three sizes. Other sizes use the next size up (rounded up).
const TABLE = [
  { px: 1920 * 1080, low: 0.004, medium: 0.010, high: 0.040, xhigh: 0.070, max: 0.158 },
  { px: 2560 * 1440, low: 0.006, medium: 0.014, high: 0.055, xhigh: 0.098, max: 0.221 },
  { px: 3840 * 2160, low: 0.011, medium: 0.026, high: 0.100, xhigh: 0.178, max: 0.400 },
];
const MARGIN_TEXT = 1.15;  // longer prompts cost a little more
const MARGIN_EDIT = 1.5;   // reference images add input cost

const log = (...a) => process.stderr.write(a.join(' ') + '\n');
function falKey() {
  if (!CONFIG.falKey) throw new Error('FAL_KEY is not set in env.local, so the image tool cannot run');
  return CONFIG.falKey;
}

function readLedger() {
  try { return JSON.parse(fs.readFileSync(LEDGER, 'utf8')); } catch { return { budget: BUDGET, spent: 0, calls: [] }; }
}
function writeLedger(l) { if (LEDGER) fs.writeFileSync(LEDGER, JSON.stringify(l, null, 1)); }

function estimate(w, h, quality, count, edit) {
  const px = w * h;
  const row = TABLE.find(r => px <= r.px) || TABLE[TABLE.length - 1];
  return +(row[quality] * count * (edit ? MARGIN_EDIT : MARGIN_TEXT)).toFixed(4);
}

function snap(v) { return Math.max(16, Math.round(v / 16) * 16); }

function inside(p) {
  const abs = path.resolve(WORKDIR, String(p)).replace(/\\/g, '/');
  if (!abs.toLowerCase().startsWith(WORKDIR.toLowerCase() + '/')) throw new Error(`reference must be inside your working folder: ${p}`);
  if (!fs.existsSync(abs)) throw new Error(`reference not found: ${p}`);
  return abs;
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

async function uploadToFal(abs, key) {
  const ext = path.extname(abs).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  if (ext === '.svg') throw new Error('SVG files cannot be sent as references; use a PNG or JPG version');
  const init = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
    method: 'POST', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_type: type, file_name: path.basename(abs) }),
  });
  const { upload_url, file_url } = await init.json();
  if (!upload_url) throw new Error('fal upload initiate failed');
  const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': type }, body: fs.readFileSync(abs) });
  if (!put.ok) throw new Error(`fal upload failed (${put.status})`);
  return file_url;
}

async function runQueue(model, body, key) {
  const headers = { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
  const sub = await (await fetch(`https://queue.fal.run/${model}`, { method: 'POST', headers, body: JSON.stringify(body) })).json();
  if (!sub.request_id) throw new Error(`submit failed: ${JSON.stringify(sub).slice(0, 300)}`);
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const st = await (await fetch(sub.status_url, { headers })).json();
    if (st.status === 'COMPLETED') break;
    if (st.status && !['IN_QUEUE', 'IN_PROGRESS'].includes(st.status)) throw new Error(`generation failed: ${JSON.stringify(st).slice(0, 300)}`);
  }
  const out = await (await fetch(sub.response_url, { headers })).json();
  if (!out.images?.length) throw new Error(`no images returned: ${JSON.stringify(out).slice(0, 300)}`);
  return out.images;
}

function pngSize(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  return [null, null];
}

async function generate(args) {
  const prompt = String(args.prompt || '').trim();
  if (!prompt) throw new Error('prompt is required');
  if (!WORKDIR) throw new Error('GEN_WORKDIR is not set');
  let w = snap(Number(args.width) || 1920), h = snap(Number(args.height) || 1080);
  if (Math.max(w, h) > 3840) { const s = 3840 / Math.max(w, h); w = snap(w * s); h = snap(h * s); }
  if (Math.max(w, h) / Math.min(w, h) > 3) throw new Error('aspect ratio can be at most 3:1');
  const quality = ['low', 'medium', 'high', 'xhigh', 'max'].includes(args.quality) ? args.quality : 'high';
  const background = ['opaque', 'transparent', 'auto'].includes(args.background) ? args.background : 'opaque';
  const count = Math.min(4, Math.max(1, Math.floor(Number(args.count) || 1)));
  const refs = Array.isArray(args.reference_images) ? args.reference_images.slice(0, 8) : [];
  const refAbs = refs.map(inside);
  const cost = estimate(w, h, quality, count, refAbs.length > 0);

  const ledger = readLedger();
  if (ledger.spent + cost > BUDGET + 1e-9) {
    return { error: true, text: `Not generated: this call would cost about $${cost.toFixed(2)}, and $${ledger.spent.toFixed(2)} of the $${BUDGET.toFixed(2)} budget is already spent ($${(BUDGET - ledger.spent).toFixed(2)} left). Use a lower quality, a smaller size or fewer images.` };
  }
  if (DRY) return { error: true, text: 'Dry run: nothing generated.' };

  const key = falKey();
  const body = { prompt, image_size: { width: w, height: h }, quality, background, num_images: count, output_format: 'png' };
  let model = TXT;
  if (refAbs.length) {
    model = EDIT;
    body.image_urls = [];
    for (const r of refAbs) body.image_urls.push(await uploadToFal(r, key));
  }
  const images = await runQueue(model, body, key);
  // fal has charged now: count it before anything else can fail
  ledger.spent = +(ledger.spent + cost).toFixed(4);
  writeLedger(ledger);

  const slug = String(args.name || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'image';
  const outDir = path.join(WORKDIR, 'generated').replace(/\\/g, '/');
  fs.mkdirSync(outDir, { recursive: true });
  const saved = [];
  for (let i = 0; i < images.length; i++) {
    const buf = Buffer.from(await (await fetch(images[i].url)).arrayBuffer());
    const base = `${slug}${images.length > 1 ? '-' + (i + 1) : ''}`;
    let local = `${outDir}/${base}.png`;
    for (let n = 2; fs.existsSync(local); n++) local = `${outDir}/${base}-v${n}.png`;
    fs.writeFileSync(local, buf);
    const [pw, ph] = pngSize(buf);
    saved.push({ rel: path.relative(WORKDIR, local).replace(/\\/g, '/'), w: pw || w, h: ph || h });
  }
  ledger.calls.push({ at: new Date().toISOString(), model, w, h, quality, background, count, refs, cost, prompt: prompt.slice(0, 300), files: saved.map(s => s.rel) });
  writeLedger(ledger);
  const list = saved.map(s => `${s.rel} (${s.w}x${s.h})`).join(', ');
  return { text: `Saved ${list}. Estimated cost $${cost.toFixed(2)}. Spent $${ledger.spent.toFixed(2)} of $${BUDGET.toFixed(2)}; $${(BUDGET - ledger.spent).toFixed(2)} left.` };
}

const TOOL = {
  name: 'generate_image',
  description: 'Generate images with GPT Image 2.5 (Flare). Each call costs money and counts against a fixed budget; ' +
    'the reply says what is left. Images are saved as PNG files in ./generated/ in your working folder. ' +
    'Strong at legible text, UI and realistic or illustrated scenes; background "transparent" gives real alpha. ' +
    'To show a real logo or icon, pass its file in reference_images (a logo described in words comes out wrong). ' +
    'Price guide at 1920x1080: low $0.005, medium $0.01, high $0.05, xhigh $0.08, max $0.18 per image; bigger sizes cost more.',
  inputSchema: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: 'What to make. Put exact on-image words in quotes.' },
      width: { type: 'integer', description: 'Pixels, rounded to a multiple of 16. Longest edge up to 3840, aspect up to 3:1. Default 1920.' },
      height: { type: 'integer', description: 'Pixels, rounded to a multiple of 16. Default 1080.' },
      quality: { type: 'string', enum: ['low', 'medium', 'high', 'xhigh', 'max'], description: 'Default high.' },
      background: { type: 'string', enum: ['opaque', 'transparent', 'auto'], description: 'Default opaque.' },
      count: { type: 'integer', minimum: 1, maximum: 4, description: 'Images from this one prompt. Default 1.' },
      reference_images: { type: 'array', items: { type: 'string' }, description: 'Up to 8 PNG/JPG/WEBP paths inside your working folder, e.g. assets/logo.png, used as references or as the image to edit.' },
      name: { type: 'string', description: 'Short file name, e.g. "hero-city".' },
    },
    required: ['prompt'],
  },
};

function reply(id, result) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }
function fail(id, code, message) { process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n'); }

const rl = readline.createInterface({ input: process.stdin });
rl.on('close', () => process.exit(0)); // the run ended or was cancelled
rl.on('line', async (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const { id, method, params } = msg;
  try {
    if (method === 'initialize') {
      reply(id, { protocolVersion: params?.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'imagegen', version: '1.0.0' } });
    } else if (method === 'tools/list') {
      reply(id, { tools: [TOOL] });
    } else if (method === 'tools/call') {
      if (params?.name !== TOOL.name) return fail(id, -32602, `unknown tool ${params?.name}`);
      try {
        const r = await generate(params.arguments || {});
        reply(id, { content: [{ type: 'text', text: r.text }], isError: !!r.error });
      } catch (e) {
        log('generate_image error:', e.message);
        const l = readLedger();
        reply(id, { content: [{ type: 'text', text: `Error: ${e.message}. Budget: $${l.spent.toFixed(2)} of $${BUDGET.toFixed(2)} spent.` }], isError: true });
      }
    } else if (method === 'ping') {
      reply(id, {});
    } else if (id !== undefined) {
      fail(id, -32601, `method not found: ${method}`);
    }
  } catch (e) {
    if (id !== undefined) fail(id, -32603, e.message);
  }
});
