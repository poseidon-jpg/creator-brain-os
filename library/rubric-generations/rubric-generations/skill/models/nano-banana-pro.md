# Nano Banana Pro (NB Pro)

Higher quality image generation via Kie AI.

| Field | Value |
|-------|-------|
| Model ID | `nano-banana-pro-preview` |
| Provider | Kie AI |
| Method | `generateContent` |
| Type | Image generation |
| API Key | `.env` → `KIE_API_KEY` |

## Request Format

Same as NB2 - uses the `generateContent` method with `contents` array.

```javascript
const body = {
  contents: [{
    parts: [
      { inlineData: { mimeType: 'image/jpeg', data: '<base64>' } },
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
POST https://generativelanguage.googleapis.com/v1beta/models/nano-banana-pro-preview:generateContent?key={API_KEY}
```

## Parameters

- **Aspect ratio:** 9:16, 16:9, 1:1
- **Resolution:** 1K, 2K, 4K
- Reference images supported (style + composition guide)

## Dashboard

- Aspect: 9:16 | 16:9 | 1:1
- Resolution: 1K | 2K | 4K
- Mode: n/a
- Duration: n/a
- Features: Ref Images (style + composition guide)
