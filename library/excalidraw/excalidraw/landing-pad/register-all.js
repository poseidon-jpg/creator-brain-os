/** Registers every scene in manifest.json onto the landing pad. */
const { execFileSync } = require('child_process');
const path = require('path');
const manifest = require('./manifest.json');

for (const m of manifest) {
  const out = execFileSync(process.execPath,
    [path.join(__dirname, 'add-build.js'), m.file, m.slug, m.title, m.note, m.project || ''],
    { encoding: 'utf8' });
  process.stdout.write(out.split('\n')[0] + '\n');
}
