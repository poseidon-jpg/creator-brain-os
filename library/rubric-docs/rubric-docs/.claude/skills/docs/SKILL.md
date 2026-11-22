---
name: docs-setup
description: Set up RUBRIC Docs - configure documentation folder, use the comment system, and manage files. Use when installing or configuring the Docs template.
---

**Note:** This skill is written for Claude Code. If the user runs a different agent framework, adapt these instructions to their setup.

## Set the Docs Root

Edit `config.json` to point at your documentation folder:

```json
{
  "brandName": "My Docs",
  "docsRoot": "./docs"
}
```

The path is relative to the template directory. The server creates the folder if it does not exist.

## Comment System

The comment system is a collaboration bridge between human and agent. Users highlight text in the browser, leave a comment, and the agent reads those comments via API.

### How It Works
1. User highlights text in a document and adds a comment (inline UI)
2. Comments are stored in `data/comments/` as JSON files (one per document)
3. Agent checks for comments via the summary endpoint

### Check for Comments on Startup

Add this to your agent's startup routine or CLAUDE.md preload:

```bash
curl -s "http://localhost:5050/api/doc-comments/summary?path=CLAUDE.md"
```

Returns plain text like:
```
Comments on CLAUDE.md:
Line 12: "old instruction" → "Should we update this?"
```

If no comments exist, returns: `No comments on CLAUDE.md`

### Get Full Comment Data

```bash
curl -s "http://localhost:5050/api/doc-comments?path=CLAUDE.md"
```

Returns JSON with all comments including resolved/unresolved state.

## Create, Edit, and Delete Files via API

```bash
# Create or update a file
curl -X POST http://localhost:5050/api/docs \
  -H 'Content-Type: application/json' \
  -d '{"path":"guides/setup.md","content":"# Setup Guide\n..."}'

# Delete a file (moves to data/.trash/)
curl -X DELETE "http://localhost:5050/api/docs?path=guides/old.md"
```

Files are served from the configured `docsRoot`. Path traversal is blocked.

## Using Comments as a Collaboration Bridge

Recommended workflow:
1. Agent writes or updates a doc via API
2. User reviews in the browser, highlights issues, leaves comments
3. Agent checks `/api/doc-comments/summary` periodically or on startup
4. Agent addresses comments and resolves them

## Start the Server

```bash
cd /path/to/docs && npm install && node server.js
```
