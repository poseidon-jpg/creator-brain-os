---
name: long-form-hyperframes-vsl
description: Build long-form narrated HyperFrames VSLs from a script/storyboard/audio source without turning them into broken slide decks. Use for 3+ minute VSLs, especially 10–20 minute sales videos with beat bibles, voiceover timing, kinetic subtitles, proof/evidence scenes, and segmented previews/renders.
metadata:
  tags: hyperframes, vsl, long-form-video, storyboard, captions, timing, sales-video
---

# Long-form HyperFrames VSL

Use this when building a narrated VSL or sales film longer than ~3 minutes in HyperFrames, especially when the user supplies a beat bible / Remotion prompt bible / storyboard and a finished voiceover.

## Non-negotiable principle

A beat bible is **not copy for the screen**. It is the source of visual intent.

For every beat:

1. Read the beat’s storyboard/prompt.
2. Identify the **actual visual result** requested.
3. Build that result as a scene.
4. Check the scene against the storyboard before moving on.
5. Do **not** paste the prompt text, implementation notes, or long VO paragraph into a side panel and call it done.

If the frame looks like “headline + prompt paragraph + generic graphic,” stop. That is a slide deck smell.

## Required workflow

### 1. Segment the project first

Do **not** build a 10–20 minute / 100+ beat VSL as one giant `index.html`.

Split into reviewable/renderable chunks, usually:

- Part 1: hook → mechanism
- Part 2: product/mechanism → offer
- Part 3: objections/guarantee/CTA

Each segment should have its own:

```text
index.html
assets/voiceover.mp3
storyboard/beats.json
storyboard/STORYBOARD.md
```

Why: Studio thumbnails, preview, and render can choke on a single huge timeline even when `npm run check` passes. Segmenting also forces creative quality control instead of hiding weak beats inside a 15-minute monster.

### 2. Time beats from real audio/transcript

Never evenly distribute beats across the total duration unless it is only a temporary placeholder.

Preferred timing order:

1. Use Whisper/word-level transcript if available.
2. Fuzzy-match each beat’s `VO span` to transcript words.
3. Set each beat start to the matched word timestamp.
4. Set duration from next beat’s start.
5. Manually bridge visual-only beats and lines that do not match exactly.
6. Trim segment audio with `ffmpeg -ss <start> -t <duration>`.

Bad timing makes the whole VSL feel fake even if the visuals are good.

### 3. Build a storyboard manifest before HTML

Create/maintain:

```text
storyboard/beats.json
storyboard/STORYBOARD.md
```

Each beat should include:

- beat number
- scene/component name
- VO span
- local start/duration/end
- required visual action
- visual family/treatment
- caption/kinetic text plan

In the HTML, add a stable reference on each beat scene:

```html
<section
  id="beat-026"
  class="clip scene"
  data-storyboard-ref="storyboard/beats.json#beat-026"
  data-start="..."
  data-duration="..."
  data-track-index="10"
>
```

### 4. Build the visual result, not a template

Every beat must have a distinct visual event. Reusing motifs is good; reusing the same layout is not.

Acceptable recurring motifs:

- white pulse = hand raise
- red route line = lost demand
- thermal receipt = cost of silence
- segmented shield = protection
- call log / CRM / chat / calendar interfaces as evidence

Unacceptable repeated structure:

```text
big headline left + generic panel right + prompt paragraph + chips
```

For VSL beats, use concrete scene types:

- simulated phone/truck footage
- search result UI
- forensic call log
- evidence board
- thermal receipt
- route map
- split-screen ad spend vs competitor booking
- chat death
- form decay
- CRM archive
- calendar booking
- countdown corridor
- shield/product reveal
- decision corridors

### 5. Captions need a dedicated safe rail

Long VSLs benefit from dynamic captions, but captions must not fight footer/metadata.

Rules:

- Use a dedicated bottom-safe caption rail.
- Do not place footer notes, CTA notes, or section metadata in that same band.
- Caption chunks should be timed from transcript words, usually 4–7 words per chunk.
- Give captions stable IDs (`cap-001`, etc.) so Studio has editable targets.
- Keep captions below primary visual evidence, not on top of it.

### 6. Validate and visually audit every segment

Run inside the segment directory:

```bash
npm run check
npx --yes hyperframes@0.7.38 snapshot --at <many timestamps across the segment>
```

Passing `check` is not enough. Inspect contact sheets for:

- prompt text accidentally appearing on screen
- repeated-template smell
- missing dynamic subtitles
- caption/footer overlap
- blank frames
- important text clipped or too small
- visuals not matching VO causality
- timing drift against the voiceover

### 7. Preview/render discipline

Preview one segment at a time. Do not ask the user to review the full VSL until each segment is strong.

Do not render the whole VSL until:

1. Part 1 is approved.
2. Part 2 is approved.
3. Part 3 is approved.
4. Segments are stitched or rendered in sequence.

## Pitfalls this skill exists to prevent

- Building one huge 15-minute HTML file that technically passes but Studio cannot preview/export reliably.
- Populating frames with the prompt/bible text instead of the intended graphic result.
- Evenly distributing beats over audio and creating obvious VO drift.
- Treating a storyboard as a list of slide titles.
- Making every beat the same layout with swapped text.
- Adding “cool dynamic subtitles” that collide with footers/metadata.
- Calling the work done after `npm run check` without visual contact-sheet review.

## Supporting references

- `references/storyboard-first-vsl.md` — condensed lessons and implementation recipe from a long-form VSL rebuild/debug session.
