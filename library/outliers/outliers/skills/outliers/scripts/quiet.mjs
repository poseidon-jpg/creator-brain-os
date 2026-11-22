// Imported first by scan.mjs. node:sqlite is fine on Node 24 but emits an ExperimentalWarning
// on import, and ESM hoists imports, so the mute has to live in its own module loaded before db.mjs.
const origEmit = process.emit;
process.emit = function (name, data, ...rest) {
  if (name === 'warning' && data && data.name === 'ExperimentalWarning' && /SQLite/i.test(data.message || '')) return false;
  return origEmit.call(process, name, data, ...rest);
};
