#!/usr/bin/env node
// Idempotent scaffold patcher for Rubric external templates.
// Run from inside this template folder when it sits as a sibling of scaffold/.
// Usage:  node integrate.js  [--scaffold ../scaffold]
//
// What it does:
//   1. Finds scaffold/ (sibling, or via --scaffold)
//   2. Backs up scaffold/server.js and scaffold/index.html (.bak)
//   3. Inserts external-template support: manifest scan, child-process spawn,
//      reverse proxy, dynamic tab/panel injection (no iframes)
//   4. Idempotent - safe to run twice; detects markers and skips
//
// After running: restart scaffold ( node server.js ).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- arg parsing ---
const argv = process.argv.slice(2);
let scaffoldDir = path.resolve(__dirname, '..', 'scaffold');
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--scaffold' && argv[i+1]) scaffoldDir = path.resolve(argv[++i]);
}

if (!fs.existsSync(path.join(scaffoldDir, 'server.js'))) {
  console.error('\n  ✗ Could not find scaffold/server.js at: ' + scaffoldDir);
  console.error('    Place this folder as a sibling of scaffold/, OR pass --scaffold <path>\n');
  process.exit(1);
}

console.log('\n  Patching scaffold at: ' + scaffoldDir);

// =====================================================================
// PATCH 1 - server.js top-level (external template loader + proxy fn)
// =====================================================================
// Loader version - bump on breaking changes. integrate.js detects older
// versions via the marker (e.g. RUBRIC_EXT_PATCH_BEGIN_V1) and replaces
// the patch block instead of skipping. Same/newer markers are left alone.
const PATCH_VERSION = 2;

const SERVER_TOP_PATCH = `// >>> RUBRIC_EXT_PATCH_BEGIN_V2 (external template support)
const { spawn: __extSpawn } = await import('node:child_process');

const EXTERNAL_TEMPLATES = (() => {
  const out = [];
  const parent = path.join(__dirname, '..');
  let entries = [];
  try { entries = fs.readdirSync(parent, { withFileTypes: true }); } catch { return out; }
  for (const d of entries) {
    if (!d.isDirectory()) continue;
    if (typeof TEMPLATE_CHECKS !== 'undefined' && TEMPLATE_CHECKS[d.name]) continue;
    const mPath = path.join(parent, d.name, 'manifest.json');
    if (!fs.existsSync(mPath)) continue;
    try {
      const m = JSON.parse(fs.readFileSync(mPath, 'utf8'));
      m._dir = path.join(parent, d.name);
      m.apiPrefixes = m.apiPrefixes || (m.apiPrefix ? [m.apiPrefix] : []);
      m.assetsPrefix = m.assetsPrefix || ('/ext/' + m.name);
      out.push(m);
      console.log('  External template: ' + m.name + ' (port ' + m.port + ')');
    } catch (e) {
      console.warn('  Bad manifest in ' + d.name + ': ' + e.message);
    }
  }
  return out;
})();

for (const __m of EXTERNAL_TEMPLATES) {
  const __ids = (__m.tabs && __m.tabs.length) ? __m.tabs.map(t => t.id) : [__m.name];
  for (const __id of __ids) {
    if (!INSTALLED_TABS.includes(__id)) {
      const __i = INSTALLED_TABS.indexOf('icons');
      INSTALLED_TABS.splice(__i >= 0 ? __i : INSTALLED_TABS.length, 0, __id);
    }
  }
}

const __extChildren = [];
for (const __m of EXTERNAL_TEMPLATES) {
  const child = __extSpawn(process.execPath, ['server.js'], {
    cwd: __m._dir,
    env: { ...process.env, PORT: String(__m.port) },
    stdio: 'pipe',
  });
  child.stdout.on('data', d => process.stdout.write('  [' + __m.name + '] ' + d));
  child.stderr.on('data', d => process.stderr.write('  [' + __m.name + '!] ' + d));
  __extChildren.push({ name: __m.name, child });
}
const __extKill = () => __extChildren.forEach(c => { try { c.child.kill(); } catch {} });
process.on('exit', __extKill);
process.on('SIGINT', () => { __extKill(); process.exit(0); });
process.on('SIGTERM', () => { __extKill(); process.exit(0); });

function __extProxy(req, res, port, targetPath) {
  const opts = {
    hostname: '127.0.0.1',
    port,
    path: targetPath,
    method: req.method,
    headers: { ...req.headers, host: '127.0.0.1:' + port },
  };
  const proxy = http.request(opts, (pr) => {
    res.writeHead(pr.statusCode, pr.headers);
    pr.pipe(res);
  });
  proxy.on('error', (e) => { try { res.writeHead(502); res.end('Proxy error: ' + e.message); } catch {} });
  req.pipe(proxy);
}
// >>> RUBRIC_EXT_PATCH_END_V2

`;

// =====================================================================
// PATCH 2 - server.js inside request handler (proxy + /api/external)
// =====================================================================
const SERVER_PROXY_PATCH = `  // >>> RUBRIC_EXT_PROXY_BEGIN_V2
  for (const __m of EXTERNAL_TEMPLATES) {
    for (const __pfx of __m.apiPrefixes) {
      if (pathname === __pfx || pathname.startsWith(__pfx + '/') || pathname.startsWith(__pfx + '?')) {
        return __extProxy(req, res, __m.port, req.url);
      }
    }
    if (pathname === __m.assetsPrefix || pathname.startsWith(__m.assetsPrefix + '/')) {
      const __sub = pathname.slice(__m.assetsPrefix.length) || '/';
      return __extProxy(req, res, __m.port, __sub + (url.search || ''));
    }
  }
  if (pathname === '/api/external' && req.method === 'GET') {
    sendJSON(res, EXTERNAL_TEMPLATES.map(m => ({
      name: m.name,
      label: m.label,
      icon: m.icon || null,
      apiPrefixes: m.apiPrefixes,
      assetsPrefix: m.assetsPrefix,
      panelSelector: m.panelSelector || 'body',
      stripSelectors: m.stripSelectors || [],
      auxSelectors: m.auxSelectors || [],
      tabs: m.tabs || null,
    })));
    return;
  }
  // >>> RUBRIC_EXT_PROXY_END_V2

`;

// =====================================================================
// PATCH 3 - index.html JS function (loadExternalTemplates + scopeCss)
// =====================================================================
const INDEX_FN_PATCH = `/* RUBRIC_EXT_TABS_BEGIN_V2 */
  async function loadExternalTemplates() {
    let exts = [];
    try { exts = await (await fetch('/api/external')).json(); } catch { return; }
    if (!exts.length) return;
    const mainEl = document.querySelector('.main');
    const navContainer = document.getElementById('nav-tabs');

    for (const ext of exts) {
      const tabs = (ext.tabs && ext.tabs.length)
        ? ext.tabs
        : [{ id: ext.name, label: ext.label, panelSelector: ext.panelSelector || 'body' }];
      const extScope = '[data-ext="' + ext.name + '"]';

      // Create panels and nav buttons for each tab in this ext
      for (const tab of tabs) {
        if (document.getElementById('tab-' + tab.id)) continue;
        const panel = document.createElement('div');
        panel.id = 'tab-' + tab.id;
        panel.className = 'tab-panel';
        panel.style.padding = '0';
        const wrapper = document.createElement('div');
        wrapper.className = 'ext-content';
        wrapper.dataset.ext = ext.name;
        wrapper.style.cssText = 'flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;';
        panel.appendChild(wrapper);
        mainEl.appendChild(panel);

        if (tab.label) TAB_LABELS[tab.id] = tab.label;
        const btn = navContainer.querySelector('.nav-tab[data-tab="' + tab.id + '"]');
        if (btn) {
          btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg> ' + tab.label;
        }
      }

      // Shared loader: fetch HTML once, distribute parts to each tab's wrapper
      let loaded = false;
      const loadOnce = async () => {
        if (loaded) return;
        loaded = true;
        try {
          const html = await (await fetch(ext.assetsPrefix + '/')).text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          for (const sel of (ext.stripSelectors || [])) {
            doc.querySelectorAll(sel).forEach(el => el.remove());
          }
          // Inject styles ONCE per ext, scoped to all wrappers belonging to this ext
          doc.querySelectorAll('style').forEach(styleEl => {
            const scoped = scopeCss(styleEl.textContent, extScope);
            const s = document.createElement('style');
            s.dataset.extOwner = ext.name;
            s.textContent = scoped;
            document.head.appendChild(s);
          });
          doc.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
            const href = l.getAttribute('href');
            if (!href || document.querySelector('link[href="' + href + '"]')) return;
            const clone = document.createElement('link');
            clone.rel = 'stylesheet';
            clone.href = href;
            document.head.appendChild(clone);
          });
          // Inject aux elements (modals, toasts, etc.) into a hidden host on document.body
          if (ext.auxSelectors && ext.auxSelectors.length) {
            let auxHost = document.querySelector('[data-ext-aux="' + ext.name + '"]');
            if (!auxHost) {
              auxHost = document.createElement('div');
              auxHost.dataset.extAux = ext.name;
              auxHost.dataset.ext = ext.name;
              document.body.appendChild(auxHost);
            }
            for (const sel of ext.auxSelectors) {
              const el = doc.querySelector(sel);
              if (el) auxHost.appendChild(el);
            }
          }
          // Place each tab's content
          for (const tab of tabs) {
            const root = doc.querySelector(tab.panelSelector || 'body') || doc.body;
            if (!root) continue;
            root.querySelectorAll('[src]').forEach(el => {
              const v = el.getAttribute('src');
              if (v && !/^(https?:|data:|\\/)/.test(v)) el.setAttribute('src', ext.assetsPrefix + '/' + v);
            });
            root.querySelectorAll('[href]').forEach(el => {
              const v = el.getAttribute('href');
              if (v && !/^(https?:|data:|#|\\/)/.test(v)) el.setAttribute('href', ext.assetsPrefix + '/' + v);
            });
            const wrapper = document.querySelector('#tab-' + tab.id + ' .ext-content');
            if (wrapper) wrapper.appendChild(root);
          }
          // Execute scripts AFTER all elements are in live DOM
          for (const oldScript of doc.querySelectorAll('script')) {
            const s = document.createElement('script');
            if (oldScript.src) {
              const src = oldScript.getAttribute('src');
              s.src = /^(https?:|\\/)/.test(src) ? src : (ext.assetsPrefix + '/' + src);
            } else {
              s.textContent = oldScript.textContent;
            }
            document.body.appendChild(s);
          }
        } catch (e) {
          for (const tab of tabs) {
            const wrapper = document.querySelector('#tab-' + tab.id + ' .ext-content');
            if (wrapper) wrapper.innerHTML = '<div style="padding:32px;color:#888;">Failed to load ' + tab.label + ': ' + e.message + '</div>';
          }
        }
      };

      window.__onTabShow = window.__onTabShow || {};
      for (const tab of tabs) {
        window.__onTabShow[tab.id] = loadOnce;
      }
    }
  }

  function scopeCss(css, scope) {
    let out = '';
    let i = 0, depth = 0, buf = '';
    const flush = () => {
      const block = buf.trim();
      buf = '';
      if (!block) return;
      if (block.startsWith('@')) {
        const open = block.indexOf('{');
        if (open === -1) { out += block + ' '; return; }
        const head = block.slice(0, open);
        const last = block.lastIndexOf('}');
        const inner = block.slice(open + 1, last);
        if (/^@(keyframes|font-face|charset|import|supports)/.test(head.trim())) {
          out += block + '\\n';
        } else {
          out += head + '{ ' + scopeCss(inner, scope) + ' }\\n';
        }
        return;
      }
      const open = block.indexOf('{');
      if (open === -1) return;
      const last = block.lastIndexOf('}');
      const sels = block.slice(0, open).split(',').map(s => s.trim()).filter(Boolean);
      const decls = block.slice(open + 1, last);
      const scoped = sels.map(s => {
        if (s === ':root' || s === 'html' || s === '*' || s === 'body') return scope;
        if (s.startsWith(scope)) return s;
        return scope + ' ' + s;
      }).join(', ');
      out += scoped + ' { ' + decls + ' }\\n';
    };
    while (i < css.length) {
      const ch = css[i++];
      buf += ch;
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) flush(); }
    }
    return out;
  }
  /* RUBRIC_EXT_TABS_END_V2 */

  `;

// =====================================================================
// Patch utility
// =====================================================================
// Detect existing patch block (any version) and remove it if older than current.
// Returns { content, removedVersion } where removedVersion is null if nothing was removed.
function removeOldPatchBlock(content, p) {
  if (!p.markerPrefix) return { content, removedVersion: null };
  // Match BEGIN with optional _V<n>; capture version (default 1 if absent)
  const escapedPrefix = p.markerPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const beginRe = new RegExp(escapedPrefix + '_BEGIN(_V(\\d+))?');
  const m = content.match(beginRe);
  if (!m) return { content, removedVersion: null };
  const oldVersion = m[2] ? parseInt(m[2]) : 1;
  if (oldVersion >= PATCH_VERSION) {
    return { content, removedVersion: oldVersion, sameOrNewer: true };
  }
  // Find matching END (BEGIN -> END at same position in marker)
  const oldBeginMarker = m[0];
  const oldEndMarker = oldBeginMarker.replace('_BEGIN', '_END');
  const startIdx = m.index;
  const endIdx = content.indexOf(oldEndMarker, startIdx);
  if (endIdx === -1) return { content, removedVersion: null, error: 'BEGIN found but no END (' + oldEndMarker + ')' };
  // Walk to end of line containing the end marker (to remove trailing newline cleanly)
  let removeEnd = endIdx + oldEndMarker.length;
  while (removeEnd < content.length && content[removeEnd] !== '\n') removeEnd++;
  if (content[removeEnd] === '\n') removeEnd++;
  // Walk start back to beginning of its line
  let removeStart = startIdx;
  while (removeStart > 0 && content[removeStart - 1] !== '\n') removeStart--;
  return {
    content: content.slice(0, removeStart) + content.slice(removeEnd),
    removedVersion: oldVersion,
  };
}

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.error('  ✗ Missing: ' + filePath);
    process.exit(2);
  }
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const p of patches) {
    // Versioned patches use markerPrefix; init-call style replacements use markerStart
    if (p.markerPrefix) {
      const r = removeOldPatchBlock(content, p);
      if (r.error) {
        console.warn('  ! ' + path.basename(filePath) + ': ' + p.label + ': ' + r.error + ' - skipping');
        continue;
      }
      if (r.sameOrNewer) {
        console.log('  · ' + path.basename(filePath) + ': ' + p.label + ' already at v' + r.removedVersion + ', skipping');
        continue;
      }
      if (r.removedVersion) {
        content = r.content;
        console.log('  ↻ ' + path.basename(filePath) + ': removed v' + r.removedVersion + ' block for ' + p.label);
        changed = true;
      }
    } else if (p.markerStart && content.includes(p.markerStart)) {
      console.log('  · ' + path.basename(filePath) + ': ' + p.label + ' already patched, skipping');
      continue;
    }
    const idx = content.indexOf(p.anchor);
    if (idx === -1) {
      console.error('  ✗ ' + path.basename(filePath) + ': anchor not found for ' + p.label);
      console.error('    Looking for: ' + JSON.stringify(p.anchor.slice(0, 80)));
      process.exit(3);
    }
    if (p.replace) {
      content = content.slice(0, idx) + p.payload + content.slice(idx + p.anchor.length);
    } else {
      content = content.slice(0, idx) + p.payload + content.slice(idx);
    }
    changed = true;
    console.log('  + ' + path.basename(filePath) + ': inserted ' + p.label + ' (v' + PATCH_VERSION + ')');
  }
  if (changed) {
    const bak = filePath + '.bak';
    if (!fs.existsSync(bak)) {
      fs.writeFileSync(bak, fs.readFileSync(filePath));
      console.log('    backup saved: ' + path.basename(bak));
    }
    fs.writeFileSync(filePath, content);
  }
}

patchFile(path.join(scaffoldDir, 'server.js'), [
  {
    label: 'top-level external loader',
    markerPrefix: 'RUBRIC_EXT_PATCH',
    anchor: '// FLOWS - state and helpers (only loaded if flows is installed)',
    payload: SERVER_TOP_PATCH,
  },
  {
    label: 'request handler proxy',
    markerPrefix: 'RUBRIC_EXT_PROXY',
    anchor: '  // --- Static: serve index.html ---',
    payload: SERVER_PROXY_PATCH,
  },
]);

patchFile(path.join(scaffoldDir, 'index.html'), [
  {
    label: 'loadExternalTemplates function',
    markerPrefix: 'RUBRIC_EXT_TABS',
    anchor: '  async function pollAgentStatus() {',
    payload: INDEX_FN_PATCH,
  },
  {
    label: 'init() call site',
    markerStart: '/* RUBRIC_EXT_INIT_CALL */',
    anchor: '    buildNavTabs(tabs);',
    payload: '    buildNavTabs(tabs);\n    /* RUBRIC_EXT_INIT_CALL */ await loadExternalTemplates();',
    replace: true,
  },
]);

console.log('\n  ✓ Patch complete. Restart scaffold to load:  node server.js\n');
