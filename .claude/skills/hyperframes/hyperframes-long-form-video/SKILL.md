---
name: hyperframes-long-form-video
description: Build long-form narrated HyperFrames videos/VSLs without crushing Studio or collapsing into a slide deck. Use when a HyperFrames composition is roughly 5+ minutes, has continuous voiceover, or contains dozens/hundreds of storyboard beats.
metadata:
  tags: hyperframes, long-form, vsl, storyboard, segmentation, preview, render
---

# HyperFrames Long-Form Video

Use this skill when a HyperFrames video is too large to treat like a normal short promo: long VSLs, narrated sales letters, multi-act explainers, or any project with dozens/hundreds of beat-level scenes.

## Core rule

**Do not build the whole long-form video as one giant `index.html`.**

A monolithic composition can pass `lint`, `validate`, and `inspect` but still be unusable in Studio: thumbnail generation times out, preview playback stalls, and render capture workers cancel. Checks passing proves technical validity, not operational usability.

Default to **segment projects** first, then polish.

## Recommended architecture

Split into 3–5 minute chunks or narrative acts:

```text
segments/
  part-01-hook-to-mechanism/
    index.html
    assets/voiceover.mp3
    storyboard/beats.json
    storyboard/STORYBOARD.md
  part-02-shield-to-offer/
  part-03-bonuses-to-cta/
```

Each segment gets:

1. Its own trimmed voiceover starting at local time `0`.
2. Its own local storyboard files.
3. Its own `npm run check` gate.
4. Its own preview session.
5. Its own render approval.

Stitch approved renders only after each segment works.

## Storyboard-first discipline

For every beat, include a pointer back to the storyboard:

```html
<section
  id="beat-001"
  class="clip scene"
  data-start="0"
  data-duration="6.2"
  data-storyboard-ref="storyboard/beats.json#beat-001"
  data-storyboard-md="storyboard/STORYBOARD.md#beat-001"
>
```

After authoring each beat, check the storyboard again. The goal is not “a nice frame.” The goal is: **the beat visually executes the exact causal action in the storyboard.**

## Anti-slideshow quality gate

Before calling a segment ready, generate a contact sheet and audit it brutally:

- Does every beat have its own visual event?
- Are layouts repeating with only swapped text?
- Is the image showing the claim, or is text doing all the work?
- Are captions/kinetic text separate from metadata/CTA/footer zones?
- Does the piece look like a forensic cinematic VSL, not a deck?
- Are repeated motifs used as payoff, not as a lazy template?

If the contact sheet looks like the same frame wearing different words, stop and rebuild the weakest beats before moving on.

## Workflow

1. Parse/author the master storyboard.
2. Split the master into segment storyboards.
3. Trim the audio per segment.
4. Build only Segment 1.
5. Run checks and snapshots.
6. Preview Segment 1.
7. Fix creative sameness before touching Segment 2.
8. Repeat.
9. Render approved segments.
10. Stitch final video.

## Verification commands

Per segment:

```bash
npm run check
npx --yes hyperframes@<version> snapshot --at 5,30,60,120,180,240
npm run dev
```

Do not render the full VSL until segment previews are approved.

## Reference

See `references/long-form-vsl-segmentation.md` for the detailed pitfall, storyboard-reference pattern, and segmentation checklist.
