---
name: sprint-backlog-setup
description: Set up RUBRIC Sprint & Backlog - configure epics, assignees, create tasks, and manage sprints. Use when installing or configuring the Sprint & Backlog template.
---

**Note:** This skill is written for Claude Code. If the user runs a different agent framework, adapt these instructions to their setup.

## Define Epics and Prefix Letters

Edit `config.json`. Each epic maps to a single-letter prefix used for task IDs:

```json
{
  "epics": {
    "Engineering": "E",
    "Marketing": "M",
    "Operations": "O"
  }
}
```

Task IDs auto-generate as `{prefix}-{0001}` (e.g., E-0001, M-0003).

## Set Up Assignees

Match agent names from your Scaffold or Team config:

```json
{
  "assignees": ["Robo", "Devo", "Eddo"]
}
```

## Create Tasks via API

```bash
curl -X POST http://localhost:5050/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"epic":"Engineering","task":"Set up CI/CD","assignee":"Devo","priority":"High","effort":"L","sprint":"Wk13"}'
```

The server auto-increments the ID. No need to supply one.

## Update Task Status via API

```bash
curl -X POST http://localhost:5050/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"_action":"update","id":"E-0001","updates":{"status":"In Progress"}}'
```

Updatable fields: epic, theme, project, task, description, status, assignee, priority, effort, quarter, tags, notes, sprint.

## Sprint Cadence

Sprints default to weekly, labeled as `Wk{number}` (e.g., Wk13, Wk14). Set in config:

```json
{ "sprintCadence": "weekly" }
```

## Auto-Increment IDs

Counters live in `data/backlog.json` under `meta.counters`. The server syncs counters with existing max IDs before creating, preventing duplicates.

## Backlog Data Format

All tasks live in `data/backlog.json`. Structure: `meta` (version, counters, lastUpdated) + `tasks` array. Each task has: id, epic, theme, project, task, description, status, assignee, priority, effort, quarter, tags, notes, sprint, created, updated, completed.

## Start the Server

```bash
cd /path/to/sprint-backlog && npm install && node server.js
```
