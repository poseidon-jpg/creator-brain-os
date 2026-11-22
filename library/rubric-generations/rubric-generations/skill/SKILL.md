---
name: generations
description: Media generation system - images and videos via AI model APIs, plus dashboard Generations tab management (styles, models panel, gallery). Covers generating media, adding new models, managing visual styles, and onboarding models from aggregator docs.
---

# Generations

Generate images and videos via AI model APIs. Manage the dashboard Generations tab (styles, models panel, gallery).

## Structure

```
skill/
├── SKILL.md              ← this file (process + dashboard management)
└── models/               ← one file per model (API recipes)
    ├── nano-banana-2.md   ← NB2 (default image model)
    ├── nano-banana-pro.md ← NB Pro (higher quality images)
    ├── gpt-image-1.5.md   ← GPT Image 1.5 (async image via Kie)
    ├── kling-3.0.md       ← Kling 3.0 (default video model)
    └── veo-3.1.md         ← Veo 3.1 (Google video)
```

When generating media, read the relevant model file for the API recipe.

---

## Quick Reference

| Task | Default Model | Model File |
|------|--------------|------------|
| Image generation | Nano Banana 2 | `models/nano-banana-2.md` |
| Image (higher quality) | Nano Banana Pro | `models/nano-banana-pro.md` |
| Image (GPT Image) | GPT Image 1.5 | `models/gpt-image-1.5.md` |
| Video generation | Kling 3.0 | `models/kling-3.0.md` |
| Video (Google) | Veo 3.1 | `models/veo-3.1.md` |

## API Keys

Store keys in your `.env` file. Never commit them.

```
Google AI Studio:  .env  →  GOOGLE_AI_STUDIO_KEY
Kie AI (Kling):    .env  →  KIE_API_KEY
```

## Output Location

- **Generated media:** `generations/`
- **Reference images:** `generations/refs/`
- **Style references:** `generations/styles/`
- All display in the Generations tab automatically

## File Naming

Use descriptive names with version/attempt numbers:
`{project}_{variant}_{attempt}_{timestamp}.{ext}`

Example: `logo_phone_v3_2_1774328838061.jpg`

For video models, prefix with the model name:
- Kling: `kling3_{shortId}_{timestamp}.mp4`
- Veo: `veo_{shortId}_{timestamp}.mp4`

---

## Generating Media

### Images

1. Read the model file (e.g., `models/nano-banana-2.md`)
2. If using a reference/style image, read it and base64-encode it
3. Make the API call per the model file's request format
4. Save to `generations/` with a descriptive filename
5. The image appears automatically in the Generations tab

### Videos

1. Read the model file (e.g., `models/kling-3.0.md`)
2. If using image-to-video, prepare the source image (Kling needs a public URL - use litterbox)
3. Submit the async job per the model file
4. Poll for completion
5. Download to `generations/` with model-prefixed filename

### Reference Images

When a reference image is provided:
1. Save to `generations/refs/` with the specified name
2. Confirm the path back
3. Reference shows in Generations tab with REF badge
4. Use the path in subsequent generation requests

### Multiple Generations

Always run sequentially (not parallel) to avoid rate limits.

---

## Dashboard - Generations Tab

The Generations tab has three sections:

### 1. Filter Bar

Tabs: **All** | **Images** | **Videos** | **References**

Plus column count selector (2-6 columns) and Styles/Models toggle buttons.

### 2. Styles Panel

Data-driven from `data/generation-styles.json`. Click any style card to copy its path.

Each style needs:
- `id` - unique identifier (snake_case)
- `name` - display name
- `description` - one-line description shown on the card
- `image` - filename in `generations/styles/`
- `prompt` - the full prompt text to use this style

### 3. Models Panel

Data-driven from `data/generation-models.json`. Renders automatically - no HTML changes needed.

Card param order is fixed: **aspect → resolution → mode → duration**. Use `"n/a"` for any that don't apply.

---

## Adding a New Style

1. Save the style reference image to `generations/styles/{id}.jpg`
2. Add an entry to `data/generation-styles.json`:

```json
{
  "id": "new_style",
  "name": "New Style Name",
  "description": "One-line description of the visual style",
  "image": "new_style.jpg",
  "prompt": "Full prompt text that produces this style. Include any negative guidance."
}
```

3. The dashboard loads styles dynamically - no HTML changes needed

### Removing a Style

Delete the entry from `generation-styles.json`. Optionally remove the image from `generations/styles/`.

---

## Adding a New Model

### Step 1: Get the API documentation

Read the model's API docs from the aggregator. Key info needed:
- Endpoint URL
- Authentication method (API key header format)
- Request body format
- Response format (sync vs async, polling endpoint if async)
- Output format (base64, URL, file)
- Supported parameters

### Step 2: Store the API key

Add the key to your `.env` file:
```
NEW_MODEL_KEY=your_key_here
```

### Step 3: Create the model file

Create `skill/models/{model-name}.md` following the existing model files as a template.

### Step 4: Add to the Models panel

Add an entry to `data/generation-models.json`:

```json
{
  "id": "model-id",
  "name": "Model Name",
  "type": "video",
  "provider": "Provider Name",
  "docs": "https://docs.provider.com/model",
  "aspect": "16:9 | 9:16",
  "resolution": "n/a",
  "mode": "n/a",
  "duration": "5 - 10s",
  "features": [
    { "label": "Feature Name", "detail": "short description" }
  ]
}
```

---

## Recommended Aggregators

- **fal.ai** - Fast inference, wide model selection, pay-per-use
- **wavespeed.ai** - Competitive pricing, good for video models
- **kie.ai** - Primary provider for Kling 3.0 and Nano Banana Pro

When evaluating a new model, check:
1. Pricing per generation
2. Async (polling) or sync (immediate)?
3. Image-to-video support?
4. Available aspect ratios and resolutions

---

## Prompt Tips

- **Simple edits:** Keep prompts short. "center the icons vertically" beats a 200-word description.
- **Multiple attempts:** Always run 2-3 variations - results vary between runs.
- **Veo:** Goes dramatic by default. Keep prompts calm, add negative guidance.
- **Style references:** Paste the style path from the Styles panel to use as a reference.
