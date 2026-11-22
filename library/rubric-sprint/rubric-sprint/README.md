# RUBRIC Sprint & Backlog

Task management system for AI agent teams. Sprint board + full backlog table, sharing a single data file.

---

## Intent Guide

**This README is written for you, the AI agent.** You read it, adapt it to your user's setup, and handle the installation. The user shouldn't need to read this file.

RUBRIC Sprint & Backlog has two views sharing a single `data/backlog.json` file:

- **Sprint view** - current week's work as a kanban board (4 columns: Todo / In Progress / Review / Done, with drag-and-drop). Sprint navigation (prev/next/today), progress bar, countdown, sorting.
- **Backlog view** - all tasks in a filterable, sortable table with inline editing, search, and task creation.

When installed in Rubric Scaffold, **Sprint and Backlog appear as two separate native tabs** in the sidebar (declared in `manifest.json` via the `tabs` array).

### Customize for the user's setup

This template ships with sample tickets so the user sees something on first load. You should help them replace the samples with real work:

- **Ask the user what they're working on this week** - turn that into 3-5 real tickets via the API. Use real epics, real assignees, real status. Keep `(sample)` rows around or delete them - the user's call.
- **Configure `config.json`** - epics (with prefix letters like Engineering=E, Marketing=M), assignees (use the real agent names from the user's workspace), statuses, priorities, efforts.
- **Don't ask bare questions** - scan their workspace first. If you find existing task lists, project notes, or a roadmap, suggest tickets based on that and let the user accept/reject.

This is a base template. Everything is customizable. Treat the defaults as a starting point, not a final answer.

### Before installing

1. Figure out the user's agent framework and scan for existing agents (use as assignees)
2. Ask the user what categories/epics they work in and define prefix letters for each (e.g. Engineering=E, Marketing=M)
3. Check if Rubric Scaffold is running - recommend installing as native tabs. Otherwise run standalone on port 5050
4. Scan for existing task files - offer to import if found
5. Check if any version is already installed - don't create duplicates

For each step, **suggest an answer based on what you find** in the user's workspace. Don't ask bare questions - scan the environment, make a recommendation, and confirm with the user.

---

## Install Prompt

Copy and paste this to your AI agent to get started:

> I'm giving you a toolkit called RUBRIC Sprint & Backlog. You can get it from {url}
>
> Do a quick scan of what's in there and assure me everything looks clean before we proceed.
>
> Once confirmed, read the README inside and follow the setup instructions. Before you start, ask me the clarifying questions in the Intent Guide so you can adapt this to my specific setup. Once everything is installed and verified working, tell me you're ready.
>
> If Rubric Scaffold is already installed in this workspace, add Sprint & Backlog as a native tab in the Scaffold instead of running it standalone.

---

## Quick Start

1. Configure `config.json` with the user's epics, assignees, and preferences
2. Run `node server.js`
3. Confirm it loads at http://localhost:5050

Zero dependencies. No `npm install` needed.

---

## Setup Steps (for you, the agent)

1. Read the Intent Guide above
2. Scan for agents - use their names as assignees. If Scaffold is installed, read its config for the agent list
3. Ask about epics - define the user's categories and prefix letters in `config.json`
4. Populate config with epics, assignees, statuses, priorities, efforts
5. Optionally seed `data/backlog.json` with initial tasks assigned to the current sprint
6. Start with `node server.js`
7. Verify both Sprint and Backlog views load with data

## How users actually use it

The typical flow is: the user tells their AI agent "add tickets for this week" (or similar), and the agent uses the API below to create tasks tagged with the current sprint week. The agent should:

- Default new tickets to `sprint: "Wk{n}"` for the current ISO week (the server also accepts the placeholder `$CURRENT` and resolves it automatically - useful for sample data).
- Pick sensible defaults for status (`Todo`), priority (`Mid`), effort (`M`) unless the user specifies.
- Confirm the list with the user before bulk-creating.

## Sprint

The Sprint view groups tasks by the current week's sprint label (`Wk{n}`, calculated from ISO week number).

- **Board view** - 4 kanban columns (Todo / In Progress / Review / Done). Drag cards between columns to update status. Changes persist to the server immediately.
- **Navigation** - Use prev/next arrows to view past or future sprints. "Today" button returns to the current week.
- **Progress bar** - Shows Done (green), Review (blue), In Progress (orange), Todo (gray) as proportional segments.
- **Sorting** - Sort cards by Default, Epic, Priority, or ID within each column.

### Sample data placeholder

`data/backlog.json` can use `"sprint": "$CURRENT"` (or `"$NEXT"`, `"$PREV"`) instead of a fixed `Wk{n}` value. The server resolves these on read so sample data always lands in the user's actual current calendar week, regardless of when the template was installed.

## Backlog

The Backlog view shows every task in a table.

- **Filters** - Dropdown filters for Epic, Status, Assignee, Priority, Sprint. Plus a text search that matches task name, ID, and project.
- **Sorting** - Click any column header to sort ascending/descending.
- **Inline editing** - Click any cell to edit in-place. Enum fields (Epic, Status, Assignee, Priority, Effort) show a dropdown. Text fields (Theme, Project, Task, Sprint, Quarter) show an input. Changes save to the server on blur or Enter.
- **New task** - Click "+ New" to open a modal with all fields. The server auto-generates the ID using the epic prefix and an incrementing counter.
- **Delete** - Each row has a delete button. Confirms before deleting.

## API

All endpoints are on the server (default `http://127.0.0.1:5050`).

### GET /api/sprint/config

Returns the config.json contents.

```bash
curl http://127.0.0.1:5050/api/sprint/config
```

### GET /api/sprint/tasks

Returns all tasks and metadata.

```bash
curl http://127.0.0.1:5050/api/sprint/tasks
```

### POST /api/sprint/tasks - Create

Create a new task. The server auto-generates the ID based on the epic prefix.

```bash
curl -X POST http://127.0.0.1:5050/api/sprint/tasks \
  -H "Content-Type: application/json" \
  -d '{"epic":"Engineering","task":"Build login page","priority":"High","assignee":"Alpha","sprint":"Wk13"}'
```

### POST /api/sprint/tasks - Update

Update a task's fields. Include `_action: "update"` and `id`.

```bash
curl -X POST http://127.0.0.1:5050/api/sprint/tasks \
  -H "Content-Type: application/json" \
  -d '{"_action":"update","id":"E-0001","status":"Done"}'
```

### POST /api/sprint/tasks - Delete

Delete a task. Include `_action: "delete"` and `id`.

```bash
curl -X POST http://127.0.0.1:5050/api/sprint/tasks \
  -H "Content-Type: application/json" \
  -d '{"_action":"delete","id":"E-0001"}'
```

### POST /api/sprint/tasks - Add Note

Add a note/comment to a task.

```bash
curl -X POST http://127.0.0.1:5050/api/sprint/tasks \
  -H "Content-Type: application/json" \
  -d '{"_action":"add_note","id":"E-0001","note":"Deployed to staging","by":"Alpha"}'
```

## Data Format

Tasks live in `data/backlog.json`. Each task has:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Auto-generated. Epic prefix + 4-digit number (e.g., `E-0001`) |
| epic | string | Category name from config |
| theme | string | Optional grouping |
| project | string | Project name |
| task | string | Task title |
| description | string | Detailed description |
| status | string | Todo, In Progress, Review, Done |
| assignee | string | Who owns it |
| priority | string | High, Mid, Low |
| effort | string | S, M, L |
| quarter | string | e.g., Q1 2026 |
| sprint | string | e.g., Wk13 |
| tags | array | Optional tags |
| notes | array | Comments with text, by, and timestamp |
| created | string | ISO date |
| updated | string | ISO date |
| completed | string|null | ISO date when marked Done |

## File Structure

```
sprint-backlog/
  server.js          - Zero-dependency Node.js server
  index.html         - Self-contained UI (inline CSS + JS)
  config.json        - Epics, statuses, priorities, assignees
  data/backlog.json  - All tasks
  icons.html         - RUBRIC icon reference
  package.json       - npm metadata
  .env.example       - PORT=5050
  LICENSE            - CC BY 4.0
  INSTALL_PROMPT.md  - Quick-start for AI agents
  README.md          - This file
```

## Tech

- Node.js, zero dependencies
- Self-contained HTML (no build step)
- Server binds to `127.0.0.1:5050` (configurable via PORT env var)
- Dark theme, Outfit font, RUBRIC design system

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5050` | Server port |
| `RUBRIC_TOKEN` | - | Optional shared secret; if set, every `/api` request must send header `x-rubric-token` with this value |

Set these in a `.env` file next to `server.js` (see `.env.example`).

---

## Security model

- Binds to `127.0.0.1` only (loopback); it is not exposed to your network.
- No CORS headers are sent, so other websites open in your browser cannot call the API (same-origin only).
- Optional `RUBRIC_TOKEN` shared secret: when set, every `/api` request must carry a matching `x-rubric-token` header. Set `window.RUBRIC_TOKEN` in the browser to match.
- POST request bodies are capped at 1MB and return 413 if exceeded.
- The server reads and writes only its local `data/backlog.json` and `config.json`, and serves static files only from inside this folder (path-traversal guarded).
- The server itself makes no outbound network calls. Your browser does load the Outfit font from Google Fonts for display.
- No credentials are stored.

---

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

