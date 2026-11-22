# Shooting guide: film so the machine can edit

The pipeline can only cut what you give it. These habits turn one 10-minute shoot into several genuinely different videos. (Sources and evidence labels: `research/lane-d-workflow-ops.md`, `research/lane-a-creative-meta.md`.)

## One-time iPhone settings (do these once)
1. **Settings → Camera → Record Video → HDR Video: OFF.** HDR clips come out grey and washed out after editing unless they're tone-mapped, and the standard tool for that isn't in most ffmpeg installs. *(VERIFIED setting exists; the washed-out problem is a known ffmpeg issue)*
2. **Settings → Camera → Record Video → 1080p at 30 fps.** Use 4K 30 only if you want room to punch in and zoom on the product.
3. **Settings → Camera → Formats → High Efficiency.**
4. **Settings → Photos → Keep Originals** and **Photos on the Mac → Settings → iCloud → Download Originals.** Otherwise Apple may quietly convert your clips. *(VERIFIED)*

## Every take
1. **Slate it.** Clap once on camera, then say: *"product <name>, take <N>."* The clap and the words let the pipeline split and label clips automatically.
2. **Say your hooks out loud, tagged.** *"Hook one: …"*, pause, *"hook two: …"*, and so on. Do 3-5 different hooks per product, using different **shapes** (see `creative/banks/hooks.md`): result-first, problem-first, a specific number, a contrarian take, a comparison, a confession.
3. **Then the body:** what it is, why it's good, one proof moment (it working, a before/after, the texture, the sound).
4. **Then the CTA:** *"tap the cart below"* or similar. Say it on every take.
5. **Pause 1 second between sections.** Silence is where the cutter cuts cleanly.

## Shot list per product (B-roll the editor will use)
- Product in hand, rotating (3+ seconds, moving)
- Product **doing its thing** (the most important shot: real use, real result)
- Close-up of texture, label, size next to your hand
- Unboxing or first touch (one take)
- **Product held up next to your face** (the shot that sells: in a peer-reviewed study of 2,685 videos matched to sales, faces got engagement but only predicted sales when the product was in the same frame. Person-only frames hurt. Yang et al., Marketing Science 2025, M3)
- Your face reacting (people on camera win; hands-only longer than ~20s gets cut or covered with your voice) *(VERIFIED that TikTok favors people on camera; SAID for the 20s)*
- If it applies: before and after, **same light, no filters** *(VERIFIED compliance rule)*

## Light and sound minimums
- Face a window or a light. No light behind you.
- Quiet room, phone mic within arm's length, or a clip-on mic. Bad audio kills more videos than bad video.
- Wipe the lens.

## Never film
- Other creators' videos or sounds, screen recordings as the main content, or claims like "cures", "guaranteed", "lowest price". The pipeline flags these, but it's easier not to say them.

## After the shoot
Clips sync through iCloud Photos on their own. Then say **"/edit"** in Claude and pick the product.
