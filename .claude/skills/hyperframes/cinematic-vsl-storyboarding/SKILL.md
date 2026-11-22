---
name: cinematic-vsl-storyboarding
description: Rewrite and build long-form narrated VSLs as motion-first cinematic commercial storyboards instead of slide decks. Use when a VSL/Remotion/prompt bible contains internal scene labels, repeated card layouts, or the user complains the video looks like prompt text, section labels, or recycled slides.
metadata: { "tags": "vsl, storyboard, hyperframes, motion-first, anti-slideshow, commercial, longform" }
---

# Cinematic VSL Storyboarding

Use this before implementing or rebuilding a narrated sales video/VSL from a script, prompt bible, Remotion bible, or beat list when the quality bar is **premium motion commercial**, not presentation slides.

## Core rule

The viewer should watch demand, proof, money, time, and systems **move**. They should not read our production notes.

A beat bible may contain useful visual DNA while still being poisonous as an implementation source. Internal names like `S009_WrongDiagnosis`, macro-section labels, or `Create S012_...` prompts are production scaffolding. Never render them as viewer-facing titles.

## Rewrite prompt bibles into viewer-facing storyboard shots

Before HTML, rewrite the source into this shape:

```text
VO:
Exact phrase from script.

Viewer sees:
Physical / UI / motion event.

Motion:
Camera, transition, animation behavior.

Meaning:
What puzzle piece the viewer understands.

Allowed text:
Only text that naturally exists in-world, UI/evidence text, or earned kinetic emphasis.

Forbidden:
Scene IDs, section labels, prompt labels, explanatory slide titles, repeated card layouts.
```

## Anti-slideshow tests

A shot fails if it is mostly:

- left headline + right card/diagram;
- big section title + support boxes;
- prompt summary rendered as text;
- repeated rectangles with swapped copy;
- captions doing the job of the visual;
- a static label explaining what the animation should have shown.

A shot passes only if something physically changes because of the VO:

- intent appears;
- intent moves;
- intent stalls;
- intent leaks;
- value transfers;
- time closes;
- evidence is revealed;
- cost accumulates;
- system catches/routes/protects.

## Durable motif systems

For response-window / local-business VSLs, this motif system works:

- White pulse = buyer intent / hand raise.
- Red route = leaked demand / lost route.
- Ivory route = captured/protected route.
- Countdown/corridor = response window closing.
- Thermal receipt = cost of silence.
- Segmented shield = protection, introduced only after the leak is understood.

The viewer watches demand move through a system. That is video. A labeled beat explaining the system is a slide.

## Implementation workflow

1. Load HyperFrames skills (`hyperframes`, `general-video`, `hyperframes-core`, `hyperframes-animation`, `hyperframes-cli`, and creative references).
2. Locate the actual script/audio/transcript and use that as timing truth.
3. Treat prompt bibles as visual DNA unless they are already viewer-facing.
4. Rewrite a V3 storyboard in the shot format above.
5. Build sequences with continuous camera/motion logic, not dozens of isolated slide cards.
6. Use captions from transcript timing, but keep them bottom-safe and secondary.
7. Run `npm run check`.
8. Generate broad contact sheets before opening preview.
9. Render MP4 only after user approves preview.

## Contact-sheet audit before handoff

After snapshots, answer honestly:

1. Any internal IDs / section labels / beat labels visible?
2. Any repeated left-headline/right-card smell?
3. Any blank frames, clipping, or tiny unreadable text?
4. Are captions secondary in a safe rail?
5. If most text were removed, would the visual action still communicate the point?
6. Does each sampled frame preserve causal continuity?

If any answer fails, fix before opening preview.

## Notes

This overlaps with existing HyperFrames long-form VSL skills if installed. Prefer this skill's stricter motion-first storyboard rewrite whenever the user explicitly rejects slideshow output or internal prompt labels leaking onto the video.
