---
name: search-connectors
description: Find ways to connect to any application - official connectors first, then community CLI > API > MCP in that order. Quick pass, best 1-2 per category, reported inline with links and install commands, ends with a rec and an install offer. Triggers on "/search-connectors [app]", "search connectors", "find connectors for X", "how do I connect to X", "is there an MCP for X", "does X have a CLI", "is there an API for X", "any MCP server for X".
---

# Search Connectors

Given an app or service, find the best ways to hook into it. Quick pass, not an audit.

## Workflow

1. **Identify the app.** From `/search-connectors [app]` or the natural ask ("is there an MCP for Notion?"). If the natural ask names one category (only asked about MCP), still run all three but lead with the one asked.
2. **Official first.** Web search + the vendor's docs/GitHub org: does the maker ship a CLI, a public API, or an MCP server? These outrank everything community-made.
3. **Community pass, in order: CLI, then API (SDKs/wrappers), then MCP.** GitHub is the main source:
   - `gh search repos "<app> cli" --sort stars --limit 5` (same for `api`, `sdk`, `mcp`)
   - MCP: also check the list at github.com/modelcontextprotocol/servers and a web search for "<app> MCP server"
   - Try name variants before concluding nothing exists - a "no" needs harder checking than a "yes"
4. **Keep the best 1-2 per category.** Health check each pick: last commit date, stars, archived or not. Skip anything dead (no commits in ~a year) unless it is the only option, then flag it.
5. **Report inline** using the format below. No file output.
6. **End with one rec + the install offer.** Stated flat, not as a question. If the user says go, install and verify it runs (version check or one harmless read command).

## Report format

```
Connectors for <App>

Official (<vendor>)
- CLI: <name> - <link> - `<install cmd>` - one line on what it covers
- API: <REST/GraphQL> - <docs link> - auth in 3 words
- MCP: <name> - <link>

Community
- CLI: <name> - <link> - `<install cmd>` - stars / last commit
- API/SDK: <name> - <link>
- MCP: <name> - <link> - stars / last commit

Rec: <one pick + why, one line>.
I can install <pick> now if you want it.
```

Rules for the report:
- If a category has nothing, say so in one line ("no official CLI exists") - only after step 3's variant search.
- Links are real URLs, install commands are copy-pasteable.
- Cap the whole report at ~12 lines. This is a quick scan, not research.
