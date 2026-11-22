# Kling 3.0

**Default video model.** Faster and cheaper than Veo. Use unless the user specifically asks for another model.

| Field | Value |
|-------|-------|
| Model ID | `kling-3.0/video` |
| Provider | Kie AI |
| Method | Async (createTask -> poll recordInfo) |
| Type | Video generation |
| API Key | `.env` -> `KIE_API_KEY` |
| Docs | https://docs.kie.ai/market/kling/kling-3-0 |

## Step 1: Submit Task

```bash
curl -s -X POST https://api.kie.ai/api/v1/jobs/createTask \
  -H "Authorization: Bearer {KIE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kling-3.0/video",
    "input": {
      "mode": "std",
      "prompt": "<your prompt>",
      "duration": "5",
      "aspect_ratio": "16:9",
      "multi_shots": false,
      "sound": true
    }
  }'
```

**Response:** `{"code":200,"data":{"taskId":"<id>"}}`

### Required Fields (422 if any missing)

`mode`, `prompt`, `duration`, `aspect_ratio`, `multi_shots`, `sound`

### Parameter Options

- `mode`: `"std"` (720p) or `"pro"` (1080p, costs more)
- `duration`: `"3"` to `"15"` (seconds, as string)
- `aspect_ratio`: `"16:9"`, `"9:16"`, or `"1:1"`
- `multi_shots`: always `false` for single-shot
- `sound`: `true` for audio

## Step 2: Poll for Result

```bash
curl -s "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>" \
  -H "Authorization: Bearer {KIE_API_KEY}"
```

Poll every 15 seconds. States: `waiting` -> `success` / `fail`. Takes ~2 min.

**Success response:**
```json
{
  "data": {
    "state": "success",
    "resultJson": "{\"resultUrls\":[\"https://tempfile.aiquickdraw.com/r/<id>.mp4\"]}"
  }
}
```

## Step 3: Download

```bash
curl -L -o "generations/kling3_<shortid>_$(date +%s).mp4" "<resultUrl>"
```

File naming: `kling3_{shortId}_{timestamp}.mp4`

## Image-to-Video

Pass 1-2 URLs in `image_urls` (index 0 = first frame, index 1 = last frame).

**`image_urls` must be publicly accessible URLs** - upload via the Kie AI file upload (see SKILL.md, File Upload section). Use the returned `data.downloadUrl` as `image_urls[0]` in the createTask request. Upload URLs expire after 3 days.

**Upload response field (IMPORTANT):** the public URL is in `data.downloadUrl`, NOT `data.fileUrl`. Passing `undefined` silently falls back to text-to-video without using your image. Read defensively: `json.data?.downloadUrl || json.data?.fileUrl`.

## Notes

- `tempfile.aiquickdraw.com` result URLs expire - download immediately
- Multi-shot mode only supports first frame (no last frame)
- **Always test-submit one task first** before batching. An expired/invalid API key returns `{"code":401}` - catch this early instead of wasting a full polling loop on undefined taskIds
- **Check taskId is not undefined** after submission before polling. If `data.taskId` is undefined, the submission failed - log the full response and fix before continuing

## Animation Prompting Tips

- **Reliable premium motion:** "Slow cinematic camera pan/orbit" - smooth, keynote energy
- **Good motion verbs:** orbit, pan, push-in, drift, dolly. Avoid: zoom, shake, snap, jump
- **Keep prompts short and atmospheric.** Describe the camera move and 2-3 subtle environmental motions (light shifting, particles drifting). Don't over-choreograph.
- **Good example:** "Slow cinematic camera orbit around two glass icons. Light refracts through surfaces, casting shifting reflections. Particles drift. Dark void, smooth, premium."
- **Bad example:** "Camera moves from left to right, first showing icon A which glows, then panning past the connection point where energy pulses, then arriving at icon B which rotates 45 degrees clockwise." (Too rigid, too many instructions)
