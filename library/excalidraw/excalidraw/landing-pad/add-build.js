#!/usr/bin/env node
/**
 * Add (or replace) a build on the Excalidraw Landing Pad.
 *
 *   node add-build.js <scene.excalidraw> <id> "<title>" "<note>" [project]
 *
 * Example:
 *   node add-build.js ../scenes/quarterly-plan.excalidraw \
 *     quarterly-plan "Quarterly Plan" "the 3 phases on one line" planning
 *
 * Re-running with the same id overwrites that entry, so iterating on a scene
 * never leaves duplicates on the pad.
 */
const fs = require('fs');
const path = require('path');

const [scenePath, id, title, note, project] = process.argv.slice(2);
if (!scenePath || !id || !title) {
  console.error('usage: node add-build.js <scene.excalidraw> <id> "<title>" "<note>" [project]');
  process.exit(1);
}

const BUILDS_FILE = path.join(__dirname, 'builds.js');
const PREFIX = 'window.EXCALIDRAW_BUILDS = ';

function loadBuilds() {
  if (!fs.existsSync(BUILDS_FILE)) return [];
  const raw = fs.readFileSync(BUILDS_FILE, 'utf8');
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try { return JSON.parse(raw.slice(start, end + 1)); }
  catch (e) { console.error('could not parse builds.js:', e.message); process.exit(1); }
}

const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));
const elements = (scene.elements || []).filter(e => !e.isDeleted);
if (!elements.length) { console.error('scene has no elements'); process.exit(1); }

// Carry embedded images: keep only the files that live image elements reference.
const usedIds = new Set(elements.filter(e => e.type === 'image' && e.fileId).map(e => e.fileId));
const files = {};
for (const [fid, f] of Object.entries(scene.files || {})) {
  if (usedIds.has(fid)) files[fid] = f;
}

const d = new Date();
const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const builds = loadBuilds().filter(b => b.id !== id);
const entry = { id, title, note: note || '', project: project || '', date, elements };
if (Object.keys(files).length) entry.files = files;
builds.push(entry);

const payload = PREFIX + JSON.stringify(builds, null, 0) + ';\n';
fs.writeFileSync(BUILDS_FILE, payload, 'utf8');
console.log(`landing pad: ${builds.length} build(s), added "${title}" (${elements.length} elements)`);
