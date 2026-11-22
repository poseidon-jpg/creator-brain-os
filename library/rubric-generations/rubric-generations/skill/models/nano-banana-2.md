# Nano Banana 2 (NB2)

Default image model. Fast and good quality for most use cases.

| Field | Value |
|-------|-------|
| Model ID | `gemini-3.1-flash-image-preview` |
| Provider | Google AI Studio |
| Method | `generateContent` |
| Type | Image generation |
| API Key | `.env` → `GOOGLE_AI_STUDIO_KEY` |

## Request Format

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

## Endpoint

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

- **Aspect ratio:** `generationConfig.imageConfig.aspectRatio` - "1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"
- **Image size:** `generationConfig.imageConfig.imageSize` - "512", "1K", "2K", "4K" (uppercase K required)
- Reference images go as `inlineData` parts BEFORE the text prompt
- One image per response - to get multiple, make sequential requests
- Keep prompts simple for edits. Over-engineering often makes results worse

## Multiple Generations

Run sequentially (not parallel) to avoid rate limits.

## Dashboard

- Aspect: 1:1 | 2:3 | 3:2 | 3:4 | 4:3 | 4:5 | 5:4 | 9:16 | 16:9 | 21:9
- Resolution: 512 | 1K | 2K | 4K
- Mode: n/a
- Duration: n/a
- Features: Ref Images (style + composition guide)
