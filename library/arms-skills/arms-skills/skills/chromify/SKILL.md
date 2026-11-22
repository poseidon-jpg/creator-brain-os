---
name: chromify
description: Builds, scaffolds, debugs and iterates on Chrome extensions (Manifest V3) for the user, and keeps a registry of every extension they own so nothing gets built twice. Covers the scaffold, the load-unpacked install loop, the five extension shapes (popup, icon click, content script, right-click menu, local bridge server) and the fixes that keep extensions working on sites that change. Use when the user says "/chromify", "chromify", "chrome extension", "browser extension", "build an extension", "MV3", "manifest v3", "content script", "my extension stopped working", or names one of their own extensions.
---

# Chromify

**Check the registry before you build.** Open [registry.md](registry.md) first. The thing you're about to build may already exist, and half-building a second copy wastes an hour that one look would save. A fix can go to the wrong extension the same way, so match the name the user says against the registry before you touch code.

Every extension you build or fix gets a row there in the same turn, so the next session can find it.

## Where extensions live

One folder for all of them, `extensions/` at the root of the user's workspace unless they name another. Write it in the registry's header. If the user already has extensions in another folder, list that folder in the registry too. A name that isn't in the main folder may be in the other one, so look there before saying it's missing. Never put extension code in a scratch or output folder.

## Scaffold (Manifest V3)

```
extensions/<name>/
├── manifest.json     MV3
├── popup.html/.js    only if it has a toolbar popup
├── background.js     service worker, only if needed
├── content.js        only if it touches the page
├── server.js         only for bridge tools (shape E)
├── icon16/48/128.png always
└── README.md         install steps + how it works
```

Minimum manifest: `manifest_version: 3`, `name`, `description`, `version`, `icons`, and `action` (with `default_icon` and `default_title`).

- **Always ship icons.** A missing icon shows as a grey square nobody can tell apart once Chrome unpins it. Draw a 128 px master and downsize it to 48 and 16. A simple glyph on a dark square is enough. If you have no image tool, run `python scripts/make_icons.py extensions/<name>` from this skill's folder. It uses only Python's standard library and writes all three sizes (a dark rounded square with a coloured dot; pass two hex colours to change them).
- **Ask for the fewest permissions.** Every permission is a warning at install. `<all_urls>` shows the scary "read and change all your data" warning, so narrow `matches` to the sites the extension needs.
- **Ask the user for the site address.** When `matches` or `host_permissions` needs a site, ask which site and use the address they give (for example `https://www.example.com/*`). Never invent one, because a wrong pattern makes the extension silently do nothing.

## Install and iterate

1. Build in `extensions/<name>/`.
2. Tell the user: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick the folder, then pin it from the puzzle icon.
3. After an edit: click reload on the extension's card, then refresh the target tab. Content-script edits need both, because reloading alone doesn't swap the copy already running in the page.
4. Bump `version` in the manifest on every fix, so the card proves the reload took.
5. Update the extension's row in the registry, and log any bug you fixed in its README (newest first). The fix log is what saves the next session from repeating a dead end.

## Pick your shape

| Shape | How it fires | Manifest bits | Example use |
|---|---|---|---|
| **A. Popup does the work** | click the icon, the popup opens, popup.js runs at once | `action.default_popup`, `activeTab` (+ `scripting` to read the page) | screenshot the page and save it with a note |
| **B. Icon click, no popup** | `chrome.action.onClicked` in background.js | `background.service_worker`, `activeTab` | toggle a tool on the current tab, or send the page URL somewhere |
| **C. Content script on a site** | runs on matching URLs, adds buttons, covers or rewrites | `content_scripts.matches` narrowed to the site | a floating "copy this data" button on one site |
| **D. Right-click menu** | a context menu item | `contextMenus` + `background.service_worker` | right-click a link to save it to a list |
| **E. Bridge-backed** | any shape above, plus a small local server | `host_permissions: ["http://127.0.0.1:PORT/*", "http://localhost:PORT/*"]` | the extension hands the page to a local script or your agent, which does the heavy work |

Shapes combine: a right-click menu plus an icon click plus a bridge is common.

### Bridge rules (shape E)

The bridge pattern lets an extension do things a browser can't: run scripts, call your agent, write files. The extension sends the page to a small local server, and the server does the work.

- **One port per tool.** Pick a free one and record it in the registry, so two bridges never fight over a port.
- **Keep the server alive** with a process manager (pm2 is a common one: `pm2 start server.js --name <tool>-bridge`, then `pm2 save` so it survives reboots).
- **Allow the extension to call it:** send `Access-Control-Allow-Origin: *` and answer `OPTIONS` requests.
- **Give the popup a clear "bridge isn't running" state** with the exact command to start it, so a dead server never looks like a broken extension.
- **A restart kills running jobs silently.** If the server keeps jobs in memory, they vanish on restart and the job page looks stuck rather than failed. Before restarting, check for running work and wait, or tell the user which jobs will drop.
- **If the server calls your agent's command-line mode,** some agents refuse to start inside another agent's session. Clear the environment variables that mark the parent session before you spawn it. If your agent is Claude Code, those are `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT`.
- **Write output as a plain static folder** (index.html, assets, a data file), so it can be hosted anywhere later without changes.

## Laws by job

**Sites that change (content scripts):**
1. **Match by visible text, never by class names.** Many sites generate class names that change on every release. Labels drift too ("Members" becomes "Member"), so match loosely.
2. **Scope every search to something unique.** An unscoped text match can hit a sidebar link and navigate away. Anchor on an element only that panel has, never the whole page.
3. **Act before the first paint** (styles at `document_start`, or in a microtask), or the original content flashes before your change.
4. **Re-apply with a MutationObserver**, debounced to one pass, with a flag on each element you've handled. Sites built on React and similar frameworks re-render and strip injected nodes.
5. **Every injected button gets a fallback** (a floating button) so a site redesign moves the button instead of killing the feature. Log `console.log('[name] loaded vX')` at the top: no line means the extension isn't running, a line but no button means detection failed.

**Text fields (inside any input):** listen in the capture phase (`addEventListener("input", fn, true)`) so the page can't swallow the event. In a contenteditable, edit the text node's `nodeValue` and rebuild the selection range to keep the caret; never set `innerHTML`, which wipes links, mentions and formatting. After a programmatic edit, dispatch `new Event("input", {bubbles: true})` so the page notices.

**Page tools (act on the page in view):** `chrome.tabs.captureVisibleTab(null, {format: "jpeg", quality: 82})` needs `activeTab` and captures exactly the visible area, so scroll first. A function passed to `chrome.scripting.executeScript({func})` must be fully self-contained, because it's copied into the page with no access to outside variables. A popup can't load web fonts (the extension's security policy blocks them), so bundle font files in the extension folder. `chrome://` pages, the Web Store and `file://` pages are off limits; show a clean "can't run on this page" state.

**Blockers and timers (make the user wait):** the wait must survive the obvious escapes: closing the popup, opening a new tab, reloading. Store timers in `chrome.storage`, never in a variable.

## Gotchas

- **"It disappeared" with no code change is Chrome, not code.** Chrome can unpin, disable or drop unpacked extensions after updates and restarts. Fix it at `chrome://extensions` (enable, reload, or Load unpacked again), then re-pin.
- **Service workers stop at any moment.** Keep no state in variables; use `chrome.storage` for anything that must survive.
- **Content scripts only reach tabs opened or refreshed after the extension loads.** If a feature needs one in an open tab, inject it on install and startup (`scripting` plus host permission, guarded against running twice).
- **Show every result on the page** (a small toast), never only through system notifications. Some systems mute those, and the click then looks like it did nothing.
- **File names in the manifest are case-sensitive** on Mac and Linux. Keep them lowercase.
- **Write extension files with your agent's file-writing tool,** not shell heredocs. JavaScript template strings with apostrophes break heredocs.
- **Publishing:** personal tools can stay unpacked forever. To share one on the Chrome Web Store, zip the folder contents (no parent folder), pay the one-time developer fee, and allow a few days for review.

## Adding an extension

1. Check [registry.md](registry.md) for one that already does the job, or one you could extend.
2. Build in `extensions/<name>/` with the shape table above.
3. Add its row to the registry: name, folder, shape, permissions, port if it has a bridge, and one line on what it does.
4. For a bridge tool, start it under the process manager and record the port.
