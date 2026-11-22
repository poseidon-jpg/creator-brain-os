---
name: lab
description: Saves and grows the user's ideas in the idea lab (creative/lab/ideas). Use when the user types /lab, says "save this idea", "lab this", "add to the lab", "what ideas do I have about X", or riffs on a what-if they want to keep.
---

# Lab

Read `creative/lab/CLAUDE.md` for the idea file format and rules.

## /lab <riff>

1. **Look for kin.** List `creative/lab/ideas/` and grep it for the riff's key words. Also run `node "tools/rubric-second-brain/brain.js" recall "<riff>"` from the hub root to catch related ventures or facts.
2. **New or existing?** If a related idea exists, add to its file (new Log line, updated sections). Otherwise write a new file in the format.
3. **Fill what you can honestly.** Spark in the user's own words. Mechanism. "Already out there?" from what you know, labeled unverified unless you searched. Skip "Cheapest test" while it's still a riff.
4. **Pointer.** For a new idea, run:
   `node "tools/rubric-second-brain/brain.js" store "Idea: <one-line idea>. File: creative/lab/ideas/<file>.md" --type project --name idea-<slug>`
5. **Reply short.** Name the file, the one or two strongest connections (other ideas, products and shop folders), and one question or angle that would push it further. Then keep riffing if they want. Don't dump the whole file back.

## /lab (no riff)

List ideas with status, newest first, one line each.

## Going deeper

When the user wants an idea pushed hard, use `/be-ambitious` on it and write the results back into the idea file.
