# Your extensions

Every extension the user owns, one row each. Read this before building anything new: the job may already be done, or one row may be a better place to add the feature. Add or update a row in the same turn you build or fix an extension.

**Main folder:** `extensions/` (change this if the user keeps extensions somewhere else)
**Other folders:** none yet (list any older folder that also holds extensions)

| Name | Folder | Shape | Permissions | Bridge port | What it does |
|---|---|---|---|---|---|

Shapes: A popup, B icon click, C content script, D right-click menu, E bridge (see the shape table in SKILL.md). Write combinations like `C + E`.

## Ports in use

One port per bridge, so two servers never collide.

| Port | Bridge | Process name |
|---|---|---|
