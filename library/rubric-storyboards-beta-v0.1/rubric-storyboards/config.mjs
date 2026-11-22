/**
 * RUBRIC Storyboards (beta) · settings.
 *
 * env.local (a copy of env.example) fills in anything the real environment doesn't set. Every setting is optional:
 * with none at all, the app runs, the sample pitch opens, and boards, comments and shot times all work. Only the two
 * agent steps (wireframe and final video) need AGENT_CMD.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');
export const VERSION = '0.1';

function loadEnvFile(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return false; }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // a value wrapped whole in one pair of quotes loses them; quotes inside a value (AGENT_CMD flags) stay
    if (val.length >= 2 && ((val[0] === '"' && val.endsWith('"') && val.indexOf('"', 1) === val.length - 1) ||
                            (val[0] === "'" && val.endsWith("'") && val.indexOf("'", 1) === val.length - 1))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
  return true;
}
export const HAS_ENV_FILE = loadEnvFile(path.join(HERE, 'env.local'));

const env = k => String(process.env[k] ?? '').trim();
const on = k => /^(1|on|yes|true)$/i.test(env(k));
const abs = p => path.resolve(HERE, p).replace(/\\/g, '/');

/** A model list: "id" or "id=Label", comma separated. Ids go to your agent's command, so only plain characters pass. */
function modelList(key) {
  const skipped = [];
  const list = env(key).split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const eq = s.indexOf('=');
    const id = (eq < 0 ? s : s.slice(0, eq)).trim();
    const label = (eq < 0 ? '' : s.slice(eq + 1).trim()) || id;
    if (!/^[\w.:/@+-]{1,100}$/.test(id)) { skipped.push(id); return null; }
    return [id, label.slice(0, 60)];
  }).filter(Boolean);
  if (skipped.length) console.warn(`  ${key}: skipped ${skipped.join(', ')} (a model id may use letters, digits and . _ - : / @ + only)`);
  return list;
}

export const CONFIG = {
  port: Number(env('PORT')) || 5303,
  projectsDir: abs(env('PROJECTS_DIR') || 'projects'),
  // each agent run gets a fresh folder here, outside the app and outside your own projects
  workDir: path.join(os.tmpdir(), 'rubric-storyboards').replace(/\\/g, '/'),
  agentCmd: env('AGENT_CMD'),
  models: { wireframe: modelList('WIREFRAME_MODELS'), final: modelList('FINAL_MODELS') },
  timeoutMs: Math.max(1, Number(env('AGENT_TIMEOUT_MINUTES')) || 90) * 60000,
  envUnset: env('AGENT_ENV_UNSET').split(',').map(s => s.trim()).filter(Boolean),
  dryRun: on('AGENT_DRY_RUN'),
  python: env('PYTHON') || (process.platform === 'win32' ? 'python' : 'python3'),
  token: env('RUBRIC_TOKEN'),
  imageTool: on('IMAGE_TOOL'),
  falKey: env('FAL_KEY'),
};
