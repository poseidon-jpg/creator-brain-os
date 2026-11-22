// Every file the outlier scanner reads or writes, and where API keys are looked up.
// The block of paths below is the only part of the engine that depends on the machine: edit it to move them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = path.dirname(fileURLToPath(import.meta.url));

// Every path is inside the skill folder, so the skill works wherever it is installed.
const SKILL_DIR = path.resolve(SCRIPTS_DIR, '..');
export const ENV_FILES = [path.join(SKILL_DIR, '.env')];               // your keys (copy env.example)
export const DB_PATH = path.join(SKILL_DIR, 'data', 'outliers.db');    // all three platforms, grows every scan
export const PEERS_FILE = path.join(SKILL_DIR, 'data', 'peers.json');  // the accounts to watch, per platform
export const IDEAS_FILE = path.join(SKILL_DIR, 'data', 'ideas.json');  // the agent's angle + idea per post
export const BOARD_FILE = path.join(SKILL_DIR, 'output', 'outliers.html');   // the results page; its data sits beside it
export const TASTE_FILE = path.join(SKILL_DIR, 'taste.md');            // what you liked, saved from pasted idea carts
export const OPEN_PAGE = true;                                         // open the results page after a scan or rebuild; false = only write it
export const RING_SIDECAR = null;                                      // no bookmark file
export const RUN_FROM = 'scripts';                                     // commands run from the skill folder
export const LOCALE = undefined;                                       // your computer's date format

// Real environment variables win, then the first env file that has the key. Values are never printed.
export function getKey(name) {
  if (process.env[name]) return process.env[name].trim();
  for (const f of ENV_FILES) {
    try {
      const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*(.+)$`, 'm'));
      const v = m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
      if (v) return v;
    } catch { /* file missing: try the next one */ }
  }
  return null;
}
