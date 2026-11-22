# Rubric Links

Centralized link hub for AI agent workspaces. One page, all your important URLs, organized by category.

## Intent Guide (for AI Agents)

This package gives you a **Links** dashboard tab where your user can see every important URL in one place. Your job as the agent:

1. **Scan the workspace** - look through CLAUDE.md, .env files, config files, package.json, docker-compose, and any project documentation for URLs the user visits regularly (localhost services, API docs, deployed apps, admin panels, repositories, etc.)
2. **Recommend links** - group what you find into logical categories and present them to the user. Ask: "What categories make sense for your workflow?" Common ones: Dashboards, Documentation, Platforms, APIs, Resources, Admin.
3. **Get confirmation** - the user approves which links to include and how to organize them.
4. **Write `data/links.json`** - populate the file with the confirmed links. You manage this file directly; the user never needs to edit it.

Each link needs a title, URL, short description, and an inline SVG icon (24x24 viewBox, stroke style, no fill). Use icons that visually distinguish each link.

## Install Prompt

> I'm giving you a toolkit called RUBRIC Links. You can get it from `{url}`. Please download it, make sure it's clean and safe, read the README, scan my workspace for important URLs, recommend which links to add, and wait for my confirmation before writing anything.

## Quick Start

```bash
node server.js
# Open http://localhost:5050
```

## Setup Steps

1. **Agent scans workspace** - the agent reads your project files to find URLs (config, docs, services, tools)
2. **Agent recommends links** - presents a grouped list of discovered URLs with suggested categories
3. **User confirms** - approves the selection and category structure
4. **Agent writes links.json** - populates `data/links.json` with the confirmed links
5. **Done** - refresh the page to see your link hub

## Configuration

### links.json structure

```json
{
  "categories": [
    {
      "id": "dashboards",
      "name": "Dashboards",
      "links": [
        {
          "title": "My App",
          "url": "http://localhost:3000",
          "description": "Local dev server",
          "icon": "<rect x='3' y='3' width='18' height='18' rx='2'/>"
        }
      ]
    }
  ]
}
```

### Adding categories

Add a new object to the `categories` array with a unique `id`, display `name`, and `links` array.

### SVG icons

Each link's `icon` field contains SVG element markup (paths, lines, circles, etc.) that gets inserted into a 24x24 viewBox SVG container with `stroke="currentColor"`, `stroke-width="1.5"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, and `fill="none"`. Design icons accordingly - use stroke-based shapes, no fills.

## Features

- Dark-mode UI with RUBRIC branding
- JSON-driven - agent edits data, no user config needed
- Categories with distinct SVG icons per link
- Hover animations on link rows
- Empty state when no links are configured
- Zero npm dependencies
- Local-only server (127.0.0.1)

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Serve the dashboard UI |
| GET | `/api/links` | Return links.json data |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5050` | Server port |
| `RUBRIC_TOKEN` | - | Optional shared secret; if set, every `/api` request must send header `x-rubric-token` with this value |

Set these in a `.env` file next to `server.js` (see `.env.example`).

## Security model

- Binds to `127.0.0.1` only (loopback); it is not exposed to your network.
- No CORS headers are sent, so other websites open in your browser cannot call the API (same-origin only).
- Optional `RUBRIC_TOKEN` shared secret: when set, every `/api` request must carry a matching `x-rubric-token` header. Set `window.RUBRIC_TOKEN` in the browser to match.
- The only API route is read-only (`GET /api/links`) and accepts no request body.
- The server reads only its local `data/links.json`; it writes nothing.
- The server itself makes no outbound network calls. Your browser does load the Outfit font from Google Fonts for display.
- No credentials are stored.

## Requirements

- Node.js 18+
- Zero npm dependencies

## Version

1.0.0

## License

CC BY 4.0 - free to use and adapt with attribution. See [LICENSE](./LICENSE).

---

## Integrating with Rubric Scaffold

If Rubric Scaffold is already installed in this workspace, this template can be embedded as a native tab (no iframe, same window). Steps for the AI agent installing this:

1. Place this folder as a sibling of `scaffold/` (typically inside `templates/`).
2. From inside this folder, run `node integrate.js`. It idempotently patches scaffold's `server.js` and `index.html` to support external templates declared via `manifest.json`. Safe to run multiple times - it checks for marker comments and skips if already applied.
3. Restart scaffold (`node server.js` in the scaffold folder).
4. The tab appears automatically in scaffold's sidebar.

The patch is one-time. Once any template in the workspace has run `integrate.js`, all future templates that ship a `manifest.json` will auto-appear without further patching.

This template's `manifest.json` declares its port, API prefix(es), panel selector, and any selectors to strip before injection (e.g. its standalone-mode header, since scaffold provides chrome).

