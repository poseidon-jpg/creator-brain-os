# Rubric Docs

File browser, markdown editor, and comment system for AI agent workspaces. Browse, edit, and annotate your documentation - then let your agents read your comments via API.

---

## Intent Guide

**This README is written for you, the AI agent.** You read it, adapt it to your user's setup, and handle the installation. The user shouldn't need to read this file.

Rubric Docs is a documentation hub where your user reads, writes, and leaves comments on markdown files. The goal: one place for all documentation that both humans and AI agents can work with. Comments are how the user talks to you through the docs - they highlight text, leave a note, and you pick it up via the API. Your job is to check for comments and act on them.

This template is based on Jay's setup using **Claude Code**. If your user runs **OpenClaw**, **Antigravity**, or any other agent framework, the concepts apply - but the implementation details will differ. Before installing anything, you should:

1. Figure out what agent framework your user is on - then adapt the hook setup and API access accordingly
2. Scan the workspace for existing documentation folders (`docs/`, `shared/`, `notes/`, etc.) and suggest the best one as the docs root
3. Check if Rubric Docs (or a previous version) is already installed - don't create duplicates
4. If Rubric Scaffold is already running, add Docs as a native tab there by default. Otherwise run standalone and pick an open port

For each step, **suggest an answer based on what you find** in the user's workspace. Don't ask bare questions - scan the environment, make a recommendation, and confirm with the user.

This is a base template that Jay uses. The whole point is that it becomes *their* docs hub. Everything is customizable - the user just tells you what to change and you edit it. Treat the defaults as a starting point, not a final answer.

---

## Install Prompt

Copy and paste this to your AI agent to get started:

> I'm giving you a toolkit called Rubric Docs. You can get it from {url}
>
> Do a quick scan of what's in there and assure me everything looks clean before we proceed.
>
> Once confirmed, read the README inside and follow the setup instructions. Before you start, ask me the clarifying questions in the Intent Guide so you can adapt this to my specific setup. Once everything is installed and verified working, tell me you're ready.

---

## Quick Start

**If Rubric Scaffold is already installed** (recommended - gives Docs a native tab in the user's existing dashboard, no extra port):

1. Place this folder as a sibling of `scaffold/` (e.g. inside `templates/`)
2. From inside this folder: `node integrate.js`
3. Restart scaffold (`node server.js` from `scaffold/`)
4. Open scaffold's URL - the **Docs** tab is now native, no iframe

**Standalone (no scaffold):**

1. Set `docsRoot` in `config.json` to the user's documentation folder
2. Run `node server.js`
3. Confirm it loads at http://localhost:5050 (or whatever port you picked)

Zero dependencies. No `npm install` needed. If Node.js isn't available, figure out how to get it running in the user's environment.

---

## Integrating with Scaffold

This template ships `manifest.json` + `integrate.js`. Together they let scaffold absorb Docs as a native tab - same window, same port, no iframe.

### What `integrate.js` does

It idempotently patches the user's existing `scaffold/server.js` and `scaffold/index.html` to add a generic external-template loader. Once that loader is in place:

- Scaffold scans for sibling folders that contain a `manifest.json`
- For each one, it spawns the template's `server.js` as a child process on the manifest's declared port
- It reverse-proxies the template's API and static assets through scaffold's main port
- It injects the template's UI as a tab panel with scoped CSS - no iframe

The patch is one-time. After the first external template runs `integrate.js`, scaffold supports any future template that ships a `manifest.json` - no further patching needed.

### Safety

- Checks for marker comments and skips if already applied - safe to run twice
- Writes `.bak` backups of every file it modifies
- If anchors can't be found (heavily customized scaffold), exits cleanly without partial writes

### Usage

```bash
cd <this-template-folder>
node integrate.js
# optional:  node integrate.js --scaffold ../path/to/scaffold
```

Then restart scaffold.

### `manifest.json` reference

Single-tab template (this one):

```json
{
  "name": "docs",
  "label": "Docs",
  "port": 5055,
  "apiPrefixes": ["/api/docs", "/api/doc-comments"],
  "panelSelector": ".docs-container",
  "stripSelectors": [".header"]
}
```

Multi-tab template (one repo → multiple scaffold tabs, sharing one child server). Use `tabs` instead of single `panelSelector`:

```json
{
  "name": "sprint",
  "port": 5060,
  "apiPrefixes": ["/api/sprint"],
  "tabs": [
    { "id": "sprint",  "label": "Sprint",  "panelSelector": "#sprint" },
    { "id": "backlog", "label": "Backlog", "panelSelector": "#backlog" }
  ],
  "stripSelectors": [".gen-rubric-brand"],
  "auxSelectors": ["#new-task-modal", "#toast"]
}
```

| Field | Description |
|---|---|
| `name` | Folder name; also the default tab id for single-tab templates |
| `label` | Display name in the sidebar (single-tab only - for multi-tab use `tabs[].label`) |
| `port` | Port the child server runs on (must be free) |
| `apiPrefixes` | Path prefixes scaffold reverse-proxies to the child |
| `panelSelector` | CSS selector - only this part of the template's HTML is injected as the panel (single-tab) |
| `tabs` | Array of `{id, label, panelSelector}` - register multiple tabs in scaffold from one repo. The same HTML is fetched once and split between tabs. |
| `stripSelectors` | Selectors removed from the parsed HTML before injection (e.g. the template's own header, since scaffold provides chrome) |
| `auxSelectors` | Selectors for elements that aren't part of any tab but must exist in the DOM (modals, toast hosts, etc.). Injected once into a hidden host. |

---

## Setup Steps (for you, the agent)

1. Read the Intent Guide above - understand what this is and what you're setting up
2. Scan the user's workspace for existing docs folders and suggest the best `docsRoot`
3. Check if Rubric Scaffold is running - if yes, add Docs as a tab there. If not, pick an open port for standalone
4. Check if a previous version of Rubric Docs exists - don't duplicate
5. Copy this template to the right location, edit `config.json` with the values you determined
6. Start with `node server.js` (standalone) or embed in Scaffold
7. Verify it loads, then test the comment system: open a file, select text, add a comment, and verify it shows via `/api/doc-comments/summary`
8. Tell the user you're ready and show them where to access it

**Reading comments (your main use case):**

```bash
curl http://localhost:5050/api/doc-comments/summary?path=Getting%20Started.md
```

This returns a plain-text summary of all unresolved comments. Check this on startup or periodically to pick up instructions the user left in their docs.

---

## Configuration

Edit `config.json` to customize:

```json
{
  "brandName": "My Docs",
  "docsRoot": "./docs"
}
```

| Field | Default | Description |
|---|---|---|
| `brandName` | `"My Docs"` | Displayed in the header bar |
| `docsRoot` | `"./docs"` | Path to the folder containing your documentation files |

The `docsRoot` can be a relative path (relative to server.js) or an absolute path.

---

## Features

- **File tree sidebar** - browse folders and files with expand/collapse
- **Grid view** - toggle to a card-based grid layout
- **File search** - fuzzy search across all file and folder names
- **Markdown rendering** - full formatting with styled headers, code blocks, tables, blockquotes
- **In-browser editing** - rich text editor with toolbar (bold, italic, headings, lists, links, code)
- **Keyboard shortcuts** - Ctrl+S to save, Escape to cancel while editing
- **Create files and folders** - from the sidebar or via right-click context menu
- **Rename and delete** - delete moves files to a `.trash` folder (recoverable)
- **Download files** - download any file directly from the browser
- **Set home doc** - right-click any file to set it as the default landing page
- **Comments system** - highlight any text to leave a comment
- **Comment highlights** - commented text is visually marked with amber underlines
- **Resolve/reopen comments** - mark comments as resolved; they hide from the view but are preserved
- **Edit comments** - update comment text after creation
- **Agent-readable comment summary** - plain text endpoint for AI agents to consume
- **Context menu** - right-click files/folders for quick actions
- **Dark theme** - matches the Rubric design system
- **Zero dependencies** - runs on Node.js built-in modules only

---

## API Endpoints

All docs operations go through `POST /api/docs` with a JSON body containing an `_action` field.

### File Operations

| Action | Body | Description |
|---|---|---|
| `tree` | `{ "_action": "tree" }` | Get the full recursive file tree |
| `list` | `{ "_action": "list", "path": "folder" }` | List contents of a directory (with previews) |
| `read` | `{ "_action": "read", "path": "file.md" }` | Read a file's content |
| `write` | `{ "_action": "write", "path": "file.md", "content": "..." }` | Write/update a file |
| `create` | `{ "_action": "create", "path": "new-file.md" }` | Create a new file |
| `mkdir` | `{ "_action": "mkdir", "path": "new-folder" }` | Create a new folder |
| `rename` | `{ "_action": "rename", "from": "old.md", "to": "new.md" }` | Rename a file or folder |
| `delete` | `{ "_action": "delete", "path": "file.md" }` | Move a file to trash |

**Download:** `GET /api/docs/download?path=file.md` - download a file as an attachment.

### Examples

```bash
# Get file tree
curl -X POST http://localhost:5050/api/docs \
  -H "Content-Type: application/json" \
  -d '{"_action": "tree"}'

# Read a file
curl -X POST http://localhost:5050/api/docs \
  -H "Content-Type: application/json" \
  -d '{"_action": "read", "path": "Getting Started.md"}'

# Write a file
curl -X POST http://localhost:5050/api/docs \
  -H "Content-Type: application/json" \
  -d '{"_action": "write", "path": "notes.md", "content": "# Notes\n\nSome content here."}'

# Create a new file
curl -X POST http://localhost:5050/api/docs \
  -H "Content-Type: application/json" \
  -d '{"_action": "create", "path": "projects/roadmap.md"}'
```

### Comment Endpoints

Comments let you annotate specific text selections in documents. They are stored as separate JSON files in `data/comments/`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/doc-comments/summary?path=file.md` | **Plain text summary of unresolved comments (for agents)** |
| `GET` | `/api/doc-comments?path=file.md` | Get all comments for a document (JSON) |
| `POST` | `/api/doc-comments` | Add a new comment |
| `PUT` | `/api/doc-comments/:id` | Update a comment (resolve, edit text) |
| `DELETE` | `/api/doc-comments/:id` | Delete a comment |

### Comment Examples

```bash
# Get agent-readable comment summary (plain text)
curl http://localhost:5050/api/doc-comments/summary?path=Getting%20Started.md

# Get all comments as JSON
curl http://localhost:5050/api/doc-comments?path=Getting%20Started.md

# Add a comment
curl -X POST http://localhost:5050/api/doc-comments \
  -H "Content-Type: application/json" \
  -d '{
    "path": "Getting Started.md",
    "selection": "Browse files and folders",
    "lineStart": 8,
    "comment": "Add a note about keyboard shortcuts here"
  }'

# Resolve a comment
curl -X PUT http://localhost:5050/api/doc-comments/abc123 \
  -H "Content-Type: application/json" \
  -d '{"resolved": true}'

# Delete a comment
curl -X DELETE http://localhost:5050/api/doc-comments/abc123
```

### How Agents Should Use Comments

The `/api/doc-comments/summary` endpoint is designed specifically for AI agents. It returns plain text like:

```
Comments on Getting Started.md:
Line 8: "Browse files and folders" → "Add a note about keyboard shortcuts here"
Line 15: "Your agent reads comments" → "Update the port number in this example"
```

Your agent can poll this on startup or periodically to pick up instructions left in the documentation.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5050` | Port the server listens on |
| `RUBRIC_TOKEN` | - | Optional shared secret; if set, every `/api` request must send header `x-rubric-token` with this value |

Set these in a `.env` file next to `server.js` (see `.env.example`).

---

## Security model

- Binds to `127.0.0.1` only (loopback); it is not exposed to your network.
- No CORS headers are sent, so other websites open in your browser cannot call the API (same-origin only).
- Optional `RUBRIC_TOKEN` shared secret: when set, every `/api` request must carry a matching `x-rubric-token` header. Set `window.RUBRIC_TOKEN` in the browser to match.
- All request bodies are capped at 1MB and return 413 if exceeded.
- The server reads and writes only the Markdown docs and comment files inside this folder; path-traversal guards keep every request inside the docs root.
- The server itself makes no outbound network calls. Your browser loads the Outfit font (Google Fonts) and the `marked` Markdown library (jsDelivr CDN) for display.
- No credentials are stored.

---

## Requirements

- Node.js 18+ (if not installed, help the user get it set up)
- Zero npm dependencies

---

## Version

1.0.0

---

## License

CC BY 4.0 - free to use and adapt with attribution. See [LICENSE](./LICENSE).
