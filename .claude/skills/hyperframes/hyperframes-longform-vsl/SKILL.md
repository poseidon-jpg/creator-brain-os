---
name: hyperframes-longform-vsl
description: Build or rebuild long-form cinematic HyperFrames VSLs from a beat bible/storyboard without collapsing into a slide deck. Use for 3+ minute narrated sales videos, Remotion prompt bibles, beat-by-beat VSLs, storyboard-driven HyperFrames compositions, and any task where the user complains the video feels like repeated slides.
metadata: { "tags": "hyperframes, vsl, storyboard, longform, beat-bible, cinematic, validation" }
---

# HyperFrames Long-Form VSLs

Use this when authoring a long narrated VSL in HyperFrames from a script, prompt bible, Remotion bible, or beat list.

The core danger: **accidentally making a dressed-up slide deck** — same layout, swapped headline, repeated footer, generic cards. Do not do that. A long VSL needs beat-level visual causality.

## Non-negotiable workflow

1. **Load the HyperFrames base skills first**
   - `/hyperframes`
   - `/general-video`
   - `/hyperframes-core`
   - `/hyperframes-animation`
   - `/hyperframes-cli`
   - `/hyperframes-creative` references when picking look/density.

2. **Find the locked creative source**
   - If the user references a bible/prompt/storyboard, locate and read it before writing HTML.
   - Do not infer the creative direction from the existing rejected composition.
   - Treat prior rejected work as an environment smoke test, not as the deliverable.

3. **Create a beat-level storyboard artifact before final HTML**
   Minimum files:
   - `storyboard/beats.json`
   - `storyboard/STORYBOARD.md`

   Each beat should map:
   - beat number
   - scene/component name
   - VO span or phrase
   - approximate start/duration/end
   - visual family/type
   - visual action from the bible
   - motion language
   - on-screen text
   - motifs/assets/SFX notes where available

4. **Reference the storyboard while building every beat**
   To keep the build honest, embed a direct reference on each scene/clip, e.g.
   ```html
   <section
     id="beat-042"
     class="clip scene"
     data-storyboard-ref="storyboard/beats.json#beat-042"
     data-storyboard-md="storyboard/STORYBOARD.md#beat-042"
     data-start="..."
     data-duration="..."
     data-track-index="..."
   >
   ```

   This is not decorative bookkeeping. It prevents the exact failure mode where the composition drifts away from the beat bible and becomes same-template slop.

5. **Make every beat a visual event**
   Adjacent beats must not all be `headline + paragraph + chips + phone/card`.
   Rotate scene families such as:
   - simulated phone/truck footage
   - forensic evidence board
   - local search UI
   - call log autopsy
   - thermal receipt
   - countdown corridor
   - chat death
   - CRM memory/archive
   - route map
   - split-screen demand transfer
   - shield/product mechanism
   - pricing/contract card
   - final CTA/end-card callback

6. **Captions/metadata rule**
   Never stack captions on top of footers/metadata. Prefer:
   - top metadata tag for beat/section/time
   - center-safe kinetic emphasis text
   - no persistent bottom footer when captions/kinetic text are present

7. **Validate before handoff**
   Run:
   ```bash
   npm run check
   ```
   Then snapshot many timestamps across the whole runtime, not just macro sections:
   ```bash
   npx --yes hyperframes@0.7.38 snapshot --at 5,15,30,60,90,130,180,240,300,360,430,500,560,620,700,760,830,890,930
   ```
   Visually inspect contact sheets for:
   - repeated slide smell
   - caption/footer overlap
   - clipped text
   - tiny illegible text
   - generic SaaS look
   - missing visual causality

8. **Preview before render**
   Start Studio:
   ```bash
   npm run dev
   ```
   Open the Studio URL for the user. Do not render MP4 until the user approves the preview.

## Implementation pitfalls and fixes

- **Tiny track-overlap lint errors from rounded timestamps:** alternate visual `data-track-index` values or calculate durations from starts carefully. Root audio stays on its own track.
- **Multiple root compositions:** move old `index*.html` backups outside discovery or rename them to non-HTML extensions.
- **Root missing start:** root needs `data-start="0"` in addition to `data-composition-id`, width, height, and duration.
- **Font lint:** add deterministic `@font-face` declarations or use embeddable fonts. For local system fonts, `src: local("Exact Font Name")` satisfies the check.
- **GSAP target warnings:** do not call GSAP on empty NodeLists. Wrap animation helpers so they no-op when a beat lacks that selector.
- **Inspect false/real overflows from entrance transforms:** layout is checked at sampled times. Avoid large pre-reveal transforms that push whole scenes off-canvas, or mark only intentional decorative overflow with `data-layout-allow-overflow`.
- **Large monolithic file warnings:** not fatal if checks pass, but for real maintainability modularize into section sub-compositions once the beat storyboard is accepted.

## Quality bar

A passing lint/validate/inspect result means the composition works technically. It does **not** mean the VSL is good.

A good long-form VSL is authored like a film:
- every claim gets a causal visual
- motifs return and pay off
- problem sections feel unstable/noisy
- mechanism sections become locked/precise
- CTA resolves the opening problem

If the viewer can describe it as “same slide, different text,” rebuild the structure.