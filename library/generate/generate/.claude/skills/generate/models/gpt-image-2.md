# GPT Image 2 (ChatGPT Images 2.0)

OpenAI's latest image model. **Best-in-class for fine typography and text-in-image generation.** Excels at detailed scenes with legible text: signs, posters, menus, UI mockups, packaging. Sync API via fal.ai - submit and get image URLs back in one call.

**Two endpoints:**
- **Text-to-image** (`openai/gpt-image-2`) - generate from a prompt
- **Image edit** (`openai/gpt-image-2/edit`) - modify reference image(s), with optional mask

| Field | Value |
|-------|-------|
| Model ID | `openai/gpt-image-2` (T2I) · `openai/gpt-image-2/edit` (Edit) |
| Provider | fal.ai |
| Method | Sync (POST -> response with image URLs) |
| Type | Image generation + editing |
| API Key | `.env` -> `FAL_KEY` |
| Docs | https://fal.ai/models/openai/gpt-image-2 |

## Endpoints

```
POST https://fal.run/openai/gpt-image-2          <- text-to-image
POST https://fal.run/openai/gpt-image-2/edit     <- image edit (requires image_urls)
Authorization: Key {FAL_KEY}
Content-Type: application/json
```

## Request Format

### Text-to-image

```json
{
  "prompt": "A vintage diner menu chalkboard, warm tungsten lighting, hand-lettered text reads 'TODAY'S SPECIAL - Lobster Roll $24'",
  "image_size": "landscape_4_3",
  "quality": "medium",
  "num_images": 1,
  "output_format": "png"
}
```

### Image edit

```json
{
  "prompt": "Same workers, same beam - but everyone is on phones now. One taking a selfie.",
  "image_urls": ["https://v3b.fal.media/files/b/.../original.png"],
  "image_size": "auto",
  "quality": "medium",
  "mask_url": "https://.../mask.png"
}
```

For the edit endpoint, `image_size: "auto"` infers dimensions from the input - usually what you want. `mask_url` is an optional black/white image (white = edit, black = keep) for region-specific edits.

**Image URLs must be publicly accessible.** Use the Fal storage upload pattern from SKILL.md to host local files, or pass back any previous Fal output URL. Fal rejects most third-party file hosts with `file_download_error`.

## Response Handling

Response is JSON with an `images` array:

```json
{
  "images": [
    { "url": "https://v3b.fal.media/files/b/0a869129/xxx.png", "width": 1024, "height": 1024 }
  ]
}
```

Download `images[i].url` to `generations/` immediately - Fal URLs may expire.

File naming: `gpt2_{description}_{timestamp}.png`

## Parameters

| Param | Required | Options | Default |
|-------|----------|---------|---------|
| `prompt` | Yes | string | - |
| `image_size` | No | preset name OR `{width, height}` object | `"landscape_4_3"` |
| `quality` | No | `"low"`, `"medium"`, `"high"` | `"medium"` - the cost/quality sweet spot |
| `num_images` | No | 1 - 4 | `1` |
| `output_format` | No | `"jpeg"`, `"png"`, `"webp"` | `"png"` |
| `image_urls` | Edit only | array of public image URLs | - |
| `mask_url` | Edit only | URL of B/W mask | - |

Common `image_size` presets: `square_hd`, `square`, `portrait_4_3`, `portrait_16_9`, `landscape_4_3`, `landscape_16_9`. Custom `{width, height}`: multiples of 16, max edge 3840px, aspect ratio up to 3:1.

## Pricing

Quality affects cost significantly. `medium` is the sweet spot at roughly $0.05/image. `high` is roughly $0.18/image (about 3.5x) - reserve it for finals where typography/detail really matters. `low` is roughly $0.02/image for cheap drafts.

## Notes

- **No transparent background support** on this endpoint. Prompting for "transparent bg" makes the model paint a fake checkerboard. If you need real alpha, chain a background remover (`fal-ai/imageutils/rembg` or `fal-ai/birefnet`) on the output URL.
- **Sync model** - single POST gets you the image. No polling, no task id.
- **Fal uses `Authorization: Key` header (not Bearer).**
- **Edit endpoint preserves more when you describe the change**, not the whole scene. "Same workers, but on phones now" beats re-describing everything.
- **For tight style preservation across refs, use Nano Banana instead** - GPT Image 2 edit tends to reinterpret.
- Up to 4 images per call via `num_images` - cost scales linearly.

## Prompt Examples Library

For style/category inspiration, the community **awesome-gpt-image-2** library has 700+ structured prompts (CC BY 4.0):

- Gallery: https://youmind.com/gpt-image-2-prompts
- Raw markdown for agents: https://raw.githubusercontent.com/YouMind-OpenLab/awesome-gpt-image-2/main/README.md

Pattern worth adopting from it: for any multi-element scene (poster, infographic, app mockup), pass the prompt as a **structured JSON object** with explicit slots (`type`, `subject`, `style`, `background`, `header`, `layout`, `footer`). Notably better than prose for complex layouts. Credit the library + original author when reusing a prompt verbatim.

## Request Pattern (bash)

Use a temp JSON file to avoid shell-escape pain:

```bash
cat > /tmp/gpt2_body.json << 'ENDJSON'
{
  "prompt": "A vintage diner chalkboard, hand-lettered: TODAY'S SPECIAL - Lobster Roll $24",
  "image_size": "landscape_4_3",
  "quality": "medium",
  "num_images": 1,
  "output_format": "png"
}
ENDJSON
source .env && curl -s -X POST "https://fal.run/openai/gpt-image-2" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/gpt2_body.json
```
