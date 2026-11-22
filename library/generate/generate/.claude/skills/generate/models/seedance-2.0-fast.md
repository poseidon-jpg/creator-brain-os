# Seedance 2.0 Fast (Reference to Video)

**Reference-to-video.** Multi-modal input: up to 9 images, 3 videos, 3 audio files. Native audio + lip-sync. Feed it reference images and it animates them into one clip.

| Field | Value |
|-------|-------|
| Model ID | `bytedance/seedance-2.0/fast/reference-to-video` |
| Provider | fal.ai |
| Method | Sync (POST -> response with video URL) |
| Type | Video generation (reference-to-video) |
| API Key | `.env` -> `FAL_KEY` |
| Docs | https://fal.ai/models/bytedance/seedance-2.0/fast/reference-to-video |

## Request Format

```bash
curl -s -X POST https://fal.run/bytedance/seedance-2.0/fast/reference-to-video \
  -H "Authorization: Key {FAL_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A man walks through a neon-lit city at night. @Image1 is the character reference.",
    "image_urls": ["https://example.com/ref.jpg"],
    "resolution": "720p",
    "duration": "auto",
    "aspect_ratio": "16:9",
    "generate_audio": true
  }'
```

## Endpoint

`https://fal.run/bytedance/seedance-2.0/fast/reference-to-video`

## Response Handling

```json
{
  "video": { "url": "https://storage.googleapis.com/.../output.mp4" },
  "seed": 42
}
```

Download the video URL to `generations/` immediately - URLs may expire.

File naming: `seedance2f_{description}_{timestamp}.mp4`

## Parameters

| Param | Required | Options | Default |
|-------|----------|---------|---------|
| `prompt` | Yes | string (reference images as @Image1, @Image2, etc.) | - |
| `image_urls` | No | array of URLs, up to 9 (JPEG/PNG/WebP, max 30MB each) | - |
| `video_urls` | No | array of URLs, up to 3 (MP4/MOV, 2-15s combined, <50MB, 480p-720p) | - |
| `audio_urls` | No | array of URLs, up to 3 (MP3/WAV, <15s combined, <15MB each) | - |
| `resolution` | No | `"480p"`, `"720p"` | `"720p"` |
| `duration` | No | `"auto"`, `"4"` - `"15"` | `"auto"` |
| `aspect_ratio` | No | `"auto"`, `"21:9"`, `"16:9"`, `"4:3"`, `"1:1"`, `"3:4"`, `"9:16"` | `"auto"` |
| `generate_audio` | No | boolean | `true` |
| `seed` | No | integer | random |

**Total files across all modalities must not exceed 12.**

### Reference Syntax in Prompts

- Images: `@Image1`, `@Image2`, ... `@Image9`
- Videos: `@Video1`, `@Video2`, `@Video3`
- Audio: `@Audio1`, `@Audio2`, `@Audio3`

If audio is provided, at least one reference image or video is also required.

## Pricing

- **$0.24/sec** at 720p (no video input) - a 5s clip is ~$1.21, a 10s clip is ~$2.42
- **$0.15/sec** at 720p (with video input - 0.6x multiplier)

Quote the cost and get an explicit go before every run (see SKILL.md hard rules).

## Sweet Spot (tested)

**Best results: 10s duration, 5 reference images (1 image per 2 seconds).**

- Fewer refs = model focuses better on each one
- More refs (6-7+) = model blends too loosely, loses clarity
- Describe each image's role in the prompt: "@Image1 is X, @Image2 is Y"
- Audio may trigger content policy on abstract visuals - default to `generate_audio: false`

### Motion-Graphics Prompt Pattern (glossy glass promo)

A proven structure for app/product promo clips:

```
Design a motion-graphics style ad using glossy liquid glass design
language. Pure black background. @Image1 is [describe what it shows].
@Image2 is [describe]. @Image3 is [describe]. The [element] from
Image 1 becomes translucent glass [describe transformation].
[Continue for each image]. Multiple camera angles: close-up on glass
reflections, pull back to reveal the full scene. Style: liquid glass
morphism, premium 3D depth, self-luminous forms on absolute black,
[accent color] accent lighting.
```

Key rules:
- **LOGO REF FIRST:** before writing ANY prompt, get the app/brand logo file. Save to `generations/refs/`. Pass as one of the @Image refs. The model mangles logos described in text - always pass the actual image.
- Describe each @Image by number and what it contains
- End with a style line including the accent color
- "Multiple camera angles" helps keep it dynamic
- Keep it under ~200 words - too long and the model ignores parts

### Request Pattern

Always use a temp JSON file to avoid shell escaping issues:

```bash
cat > /tmp/seedance_body.json << 'ENDJSON'
{
  "prompt": "...",
  "image_urls": ["url1", "url2", "url3", "url4", "url5"],
  "resolution": "720p",
  "duration": "10",
  "aspect_ratio": "16:9",
  "generate_audio": false
}
ENDJSON
source .env && curl -s -X POST "https://fal.run/bytedance/seedance-2.0/fast/reference-to-video" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/seedance_body.json
```

## Notes

- Images must be publicly accessible URLs - **upload via Fal storage** (see SKILL.md, File Upload section). Fal rejects most third-party file hosts.
- Video refs must be 480p-720p resolution
- Results may vary slightly even with the same seed
- Fal uses `Authorization: Key` (not Bearer)
- Max resolution is 720p - no 1080p option on Seedance
- Reference-to-video jobs containing human likenesses can be rejected by the content checker. If that happens, stop and report - do not silently retry or fall back to text-to-video.
