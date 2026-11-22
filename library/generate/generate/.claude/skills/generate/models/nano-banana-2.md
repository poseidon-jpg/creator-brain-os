# Nano Banana 2 (NB2)

**Default image family.** Nano Banana 2 Lite is the cost-first route for drafts, A/B variants, simple edits, and high-volume images. Regular NB2 is the step up when you need better quality, stronger instruction following, more complex refs, or higher-res hero assets.

| Field | Value |
|-------|-------|
| Model ID | `gemini-3.1-flash-image-preview` (NB2) · `gemini-3.1-flash-lite-image` (NB2 Lite) |
| Provider | Google AI Studio (also on fal.ai) |
| Method | Sync (`generateContent`) |
| Type | Image generation |
| API Key | `.env` -> `GOOGLE_AI_STUDIO_KEY` (or `FAL_KEY` for the fal route) |

## Availability

- **Google Gemini API:** `gemini-3.1-flash-lite-image` (Lite) and `gemini-3.1-flash-image-preview` (NB2).
- **fal.ai:** `google/nano-banana-2-lite`.
- **Kie AI / WaveSpeed AI:** the Nano Banana 2 family is listed on both - check for a specific Lite model ID and price before using.

## Provider Ranking

Cheapest first:

1. Use the cheapest working route with an existing key and good enough quality. Google direct is the price anchor at about `$0.034` per 1K-resolution image.
2. Fall back to **fal.ai** using `google/nano-banana-2-lite`.
3. Fall back to **WaveSpeed AI** only if fal fails or lacks a route.

Always say which provider was used and why.

## Direct Google Lite Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key={API_KEY}
```

```javascript
const fs = require('fs');

const API_KEY = process.env.GOOGLE_AI_STUDIO_KEY;
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${API_KEY}`;

const body = {
  contents: [{
    parts: [
      // Optional reference image first:
      // { inlineData: { mimeType: 'image/png', data: fs.readFileSync(refPath).toString('base64') } },
      { text: '<prompt>' }
    ]
  }],
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: { aspectRatio: '16:9', imageSize: '1K' }
  }
};
```

## fal.ai Lite Endpoint

```javascript
import { fal } from '@fal-ai/client';

fal.config({ credentials: process.env.FAL_KEY });

const result = await fal.subscribe('google/nano-banana-2-lite', {
  input: {
    prompt: '<prompt>',
    aspect_ratio: '16:9',
    output_format: 'png'
  },
  logs: true
});

const imageUrl = result.data?.images?.[0]?.url || result.data?.image?.url;
```

## Request Format (NB2, with refs)

```javascript
const body = {
  contents: [{
    parts: [
      // Reference images (optional, as many as needed)
      { inlineData: { mimeType: 'image/jpeg', data: '<base64>' } },
      // Prompt (always last part)
      { text: '<prompt>' }
    ]
  }],
  generationConfig: {
    responseModalities: ['TEXT', 'IMAGE']
  }
};
```

Endpoint:

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key={API_KEY}
```

## Response Handling

```javascript
const parts = json.candidates?.[0]?.content?.parts || [];
for (const part of parts) {
  if (part.inlineData) {
    const ext = part.inlineData.mimeType.includes('png') ? 'png' : 'jpg';
    fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));
  }
}
```

## Parameters

- **Aspect ratio:** `generationConfig.imageConfig.aspectRatio` - "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9" (fal also lists "auto", "4:1", "1:4", "8:1", "1:8")
- **Image size:** `generationConfig.imageConfig.imageSize` - "512", "1K", "2K", "4K" (uppercase K required). Default to "1K"; go higher only when cost is acceptable.
- Reference images go as `inlineData` parts BEFORE the text prompt
- One image per response - to get multiple, make sequential requests
- Keep prompts simple for edits. Over-engineering often makes results worse
- Temperature not needed - omit or leave default

## When to use which tier

- **Lite:** drafts, variants, volume work, simple edits.
- **NB2:** complex multi-ref work, strict identity preservation, hero assets, better text rendering.
- For scenes where readable text is the point (signs, posters, menus), use GPT Image 2 instead - see `gpt-image-2.md`.

## Multiple Generations

Run sequentially (not parallel) to avoid rate limits.
