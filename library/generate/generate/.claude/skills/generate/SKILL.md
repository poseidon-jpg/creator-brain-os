---
name: generate
description: Media generation system for /generate - images and videos via AI model APIs. Covers generating media, adding new models, and managing visual styles. Triggers on /generate, generate image, generate video, create image, thumbnail, animate, nano banana, gpt image, kling, veo, seedance.
---

# /generate

Generate images and videos via AI model APIs. One command, routed to the cheapest capable model, saved into one folder, with every prompt logged.

## Structure

```
generate/
├── SKILL.md              <- this file (process + rules)
├── log-gen.mjs           <- sidecar prompt logger (call after every save)
└── models/               <- one file per model (API recipes)
    ├── nano-banana-2.md   <- NB2 + NB2 Lite (default cheap image model)
    ├── gpt-image-2.md     <- GPT Image 2 (best for typography and text-in-image)
    ├── kling-3.0.md       <- Kling 3.0 (default video model)
    ├── veo-3.1.md         <- Veo 3.1 (Google video, higher quality, slower)
    └── seedance-2.0-fast.md  <- Seedance 2.0 Fast (reference-to-video)
```

When generating media, read the relevant model file for the API recipe first.

## Quick Reference

| Task | Default Model | Model File |
|------|--------------|------------|
| Image generation (cheap/default) | Nano Banana 2 Lite | `models/nano-banana-2.md` |
| Image generation (balanced quality) | Nano Banana 2 | `models/nano-banana-2.md` |
| Image (typography / fine text) | GPT Image 2 | `models/gpt-image-2.md` |
| Video generation (default) | Kling 3.0 | `models/kling-3.0.md` |
| Video (higher quality, slower) | Veo 3.1 | `models/veo-3.1.md` |
| Video (animate reference images) | Seedance 2.0 Fast | `models/seedance-2.0-fast.md` |

## Provider Routing

Default preference is cost first, then reliability.

1. Check the aggregators when useful: **Kie AI**, **fal.ai**, and **WaveSpeed AI**.
2. Use the cheapest working API first when quality is acceptable and the key exists.
3. If the cheapest route is missing docs, lacks the model, or fails auth, fall back to **fal.ai**.
4. If fal.ai rejects, lacks the model, or has a known policy issue, fall back to **WaveSpeed AI**.
5. Never hide a provider swap. Say which route was used and why.

## API Keys

Store keys in a `.env` file at your workspace root. Never commit them.

```
GOOGLE_AI_STUDIO_KEY=   (Nano Banana 2, Veo 3.1)
KIE_API_KEY=            (Kling 3.0, file uploads)
FAL_KEY=                (GPT Image 2, Seedance 2.0)
WAVESPEED_API_KEY=      (fallback provider)
```

## Output Location

**All generated media goes to one flat folder** - `generations/` at your workspace root (create it once). **No subfolders for outputs.** One flat folder means any gallery, script, or tool can read your whole media library with zero setup.

- Generated media: `generations/`
- Reference images: `generations/refs/`

## Hard Rules for Paid Video Generation

1. **Always quote cost and wait for an EXPLICIT go before submitting. Quoting alone is not approval.** Post the quote (model, resolution, duration, aspect, expected cost), ask "OK to run?", then stop and wait for a clear yes. A change request ("do it in 720p instead") is direction, not approval - re-quote at the new settings and wait again.
2. **One video run = one approval.** Approval for run #1 does not authorize run #2 or a retry.
3. **Never silently fall back to a different generation mode.** If a reference-to-video call is rejected, stop and report the exact reason, then propose options. Text-to-video loses the visual anchor that reference-to-video exists to provide.

## Reference Images (CRITICAL)

**Never generate media containing logos or branded elements by describing them in the prompt.** Text descriptions of logos produce garbage - wrong shapes, wrong colors, hallucinated details. Always pass the actual logo/icon as a reference image.

**If you do not have the logo file:** STOP. Ask the user for it or download it first. Save it to `generations/refs/` before generating.

**Before generating, always:**
1. Check which logos/brands/faces appear in the scene
2. Verify the ref images exist in `generations/refs/`
3. If missing, ask the user for the file. Do not skip this step.
4. Pass refs into the API call and reference them by number in the prompt ("Image 1", "Image 2")

**Smart ref selection - only include what the scene needs.** Passing unnecessary refs muddies the output.

## Iterative Edits - Element Preservation Rule

When iterating on an image ("change X", "make Y bigger"), the prompt MUST list every required element first, then specify the change. A partial prompt gets interpreted as "regenerate around this change" and silently drops elements you did not mention.

**Prompt skeleton:**
> Edit Image 1. The final image MUST contain ALL of these elements: (a) ..., (b) ..., (c) ... unchanged. Now make these changes only: [change list]. Do not remove or alter any other element.

## Prompting Tips

- **Prompt like a cinematographer, not a UI designer.** Describe a moment, a mood, a scene. Never write structured layouts ("LEFT side shows X, RIGHT side shows Y") - that produces infographics, not scenes.
- **Background minimalism.** Listing decor items leaks unwanted colors into the render. Name 1-2 background elements max. When in doubt: less prompt, darker scene.
- **Simple edits: keep prompts short.** "center the icons vertically" beats a 200-word description.
- **Run 2-3 variations** - results vary between runs.
- **Multiple generations always run sequentially** (not parallel) to avoid rate limits.

## Content-Policy Gotchas (hit in production)

- Some providers reject reference-to-video jobs containing human likenesses. Do not retry the same input - switch vendor and tell the user why.
- Detailed skin-texture prompts combined with young-sounding age words can trip image moderation. Prefer "woman in her late twenties" over "early-twenties young woman", and keep texture cues light.
- Destruction verbs ("crush", "smash", "throw") can trip content checkers. Avoid them.
- When a rejection happens, report the exact error message and propose a vendor swap - never reword and silently retry.

## File Upload (Public URLs)

Some APIs need reference images as public URLs. Pick the host based on which API will fetch the URL:

| Job provider | Use this host |
|--------------|---------------|
| **fal.ai** (Seedance, GPT Image 2 edit) | **Fal storage** (below). Fal rejects most third-party file hosts with `file_download_error`. |
| **Kie AI / other** | Kie AI upload (below). |

### Fal storage (for any Fal job)

```js
// 1. Initiate
const initRes = await fetch('https://rest.alpha.fal.ai/storage/upload/initiate', {
  method: 'POST',
  headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ content_type: 'image/png', file_name: 'ref.png' }),
});
const { upload_url, file_url } = await initRes.json();

// 2. PUT bytes
await fetch(upload_url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/png' },
  body: fs.readFileSync(localPath),
});

// 3. Use file_url in image_urls / video_urls
```

### Kie AI upload (for non-Fal jobs)

```bash
curl -s -X POST "https://kieai.redpandaai.co/api/file-stream-upload" \
  -H "Authorization: Bearer {KIE_API_KEY}" \
  -F "file=@/path/to/image.jpg" \
  -F "uploadPath=generations" \
  -F "fileName=my-ref.jpg"
```

**Use `data.downloadUrl`** from the response as the public URL. Do NOT use `fileUrl` - that field is not returned, and passing `undefined` to an image-to-video call silently falls back to text-to-video. Files expire after 3 days.

## Prompt Logging (MANDATORY for every gen)

**Every image and video generation MUST write a sidecar JSON with its prompt, model, refs, and params.** This is what lets you (and your agent) recover exactly what produced any file in `generations/`, weeks later.

Call the shared helper at the end of every gen script:

```js
import { logGen } from './log-gen.mjs'; // adjust the relative path from your script

// after fs.writeFileSync(outputPath, buffer):
logGen({
  outputPath,                    // e.g. 'generations/hero_banner_<ts>.jpg'
  model: 'nano-banana-2-lite',
  prompt,                        // the full text prompt sent to the API
  refs: [refPath1, refPath2],    // every ref image/video path passed to the API
  params: { aspectRatio: '16:9', imageSize: '1K' },
});
```

This writes `hero_banner_<ts>.json` next to the media file with the same basename. Same basename + `.json` is the contract.

Rules:
- ALWAYS call `logGen()` after saving. Never skip it "for a quick one-off" - those are the ones you need later.
- For batches, call `logGen()` once per output file, each with its own prompt variant if they differ.

## File Naming

- Images: `{project}_{description}_{timestamp}.{ext}` - e.g. `launch_hero_1774912000.jpg`
- Videos: `{model}_{description}_{timestamp}.mp4` - e.g. `kling3_product_orbit_1774912000.mp4`

## Adding a New Model

1. **Read the model's API docs** on the aggregator (check Kie AI, fal.ai, WaveSpeed AI - prefer the cheapest working route). Collect: endpoint URL, auth method, request body format, sync vs async (and the polling endpoint if async), output format, supported parameters.
2. **Add the key** to `.env` if it is a new provider.
3. **Create `models/{model-name}.md`** with: a one-line description, a field table (Model ID, Provider, Method, Type, API Key, Docs, Cost), Request Format, Endpoint, Response Handling, Parameters, and Notes (gotchas, rate limits).
4. **Add the model name** to the `description` frontmatter at the top of this file so it triggers correctly.

## License

CC BY 4.0. See LICENSE at the package root.
