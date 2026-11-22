---
name: sync-os
description: Refreshes the Inbox & Calendar panel of the Command Center (localhost:5210) from the Gmail and Google Calendar connectors. Use when the user types /sync-os, says "sync my OS", "refresh my dashboard", or "update inbox and calendar on the command center".
---

# Sync the Command Center

The Command Center page can't read Gmail or Google Calendar itself. Only Claude can, through the connectors. This skill takes a small snapshot and writes it to a file the page reads.

## Steps

1. **Calendar:** list events on the primary calendar from now through the next 7 days, ordered by start time (max 15).
2. **Inbox:**
   - Search `in:inbox is:unread` with metadata only, to get the unread count estimate.
   - Search `in:inbox newer_than:7d -category:promotions` with the minimal view, max 15.
3. **Flag what needs attention.** Set `attention: true` only for threads about failed or declined payments, account deletion or suspension, expiring services, legal or collections notices, or a real person waiting on a reply. Add a one-line `note` saying what's at stake and by when. Newsletters and promos are never "attention".
4. **Write** `tools/rubric-second-brain/data/snapshot.json` (create `data/` if it's missing) in exactly this shape:

```json
{
  "syncedAt": "<ISO timestamp now>",
  "syncedBy": "Claude (Gmail + Google Calendar connectors)",
  "timeZone": "<calendar time zone>",
  "calendar": { "events": [ { "title": "", "start": "YYYY-MM-DD or ISO datetime", "allDay": true, "url": "<htmlLink>" } ] },
  "inbox": {
    "unreadEstimate": 0, "unreadLabel": "e.g. 200+",
    "threads": [ { "from": "<sender display name>", "subject": "", "date": "<ISO>", "url": "<viewUrl>", "attention": false, "note": "" } ]
  }
}
```

## Rules

- **Store only:** sender display names, subjects, dates, links, and your one-line notes. Never store message bodies, snippets beyond the note, addresses of third parties, or any codes, amounts or account numbers.
- **Keep it local:** the file stays in `data/`, which is git-ignored. Never send it anywhere.
- **Don't act on the email:** reading it is the whole job. Don't reply, label, archive or delete.
- **Finish:** tell the user, in a few lines, how many unread there are, the attention items, and the next calendar event. The page picks up the new file on its next refresh. Reloading it works too.
