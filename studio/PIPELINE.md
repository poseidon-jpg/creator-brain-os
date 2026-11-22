# The video pipeline

**In one line:** raw iPhone clips → normalized → transcribed to word timestamps → Claude picks the words, takes and hooks → a compiler turns that into frame-exact cuts → one render with captions → script checks + a separate judge → post-ready videos you post yourself.

Run it with **/edit**. This page explains why it's built this way. Every claim traces to `research/` (labels: MEASURED / VERIFIED / SAID / INFERRED / UNVERIFIED).

## Why "the model chooses, the code cuts"
- Claude reads video as **still images only**, so it can't hear audio or see motion (VERIFIED, Claude vision docs). Left to pick timestamps itself, a model blew a 5-minute target by nearly 2x and cut every line mid-sentence in one vendor test (SAID, and the vendor sells a competing editor).
- So Claude never writes seconds for speech. It writes a **cut list by word number** ("keep words 14-31 of clip 1"). A compiler snaps each cut to the frame grid with padding (50ms before, 100ms after, 30ms audio fades), refuses mid-word cuts, and checks that the quoted words match. This is the pattern behind the biggest open-source agent editor, `video-use` (31k stars, MIT, VERIFIED), with its one lip-sync weakness fixed: we cut in one pass instead of splicing copied segments (MEASURED: cuts within 0.6ms on a test clip).
- HyperFrames and Remotion are motion-graphics renderers. Neither cuts raw footage (VERIFIED). "Remotion is dead" is false: it still has about 3x HyperFrames' npm downloads (MEASURED, Nov 2026). HyperFrames skills are here for fancier graphics (`/hyperframes`, `/embedded-captions`), but v1 captions use a small built-in renderer, so the video is encoded once at the end instead of twice.

## The steps
| Step | Command | What happens | Checked by |
|---|---|---|---|
| Import | `import-from-photos.sh` | Pulls the last 2 days of videos from iCloud Photos into `studio/inbox/` | — |
| New batch | `new` | Makes `studio/projects/<batch>/` and fills the product facts | — |
| Ingest | `ingest` | Moves clips to `raw/` (never touched again), makes 1080x1920 30fps SDR masters, and fixes iPhone HDR (stock-filter HLG tone-map) and variable frame rate | Format gate per master |
| Analyze | `analyze` | Word timestamps (local Parakeet or whisper.cpp, nothing leaves the Mac), silences, retakes, scene cuts, exposure and blur | — |
| Plan + cut | (Claude) + `compile` | Picks 3-5 genuinely different variants and writes word-indexed cut lists; the compiler turns them into frame-exact edit lists | Compiler errors |
| Render | `render` | One-pass cut, captions in the safe zone, loudness to -14 LUFS, plus a clean no-caption master for GMV Max | — |
| QA | `qa`, `similarity` | Specs, frame-exact sync, loudness on the encoded file, caption boxes in the safe zone, banned-claim lint, overlap between variants | `qa.py` (separate from the maker) |
| Judge | `video-judge` agent | Looks at contact sheets, cut strips and the first 2.5s; grades against RUBRIC.md and TASTE.md | A separate agent |
| Deliver | `deliver` | Passes go to `studio/ready/<batch>/` with captions + a posting checklist | — |

## What stays yours (TikTok doesn't allow apps to do it)
1. **Post from the TikTok app and tap Add link → Products.** The posting API has no product field, and unaudited apps can only post privately (VERIFIED, TikTok developer docs). Attach the product **at post time**: adding it later only works within 30 days and only with Commercial Music Library audio (VERIFIED).
2. Turn on **Disclose commercial content**, choose only **Commercial Sounds** if you add music, and run **Video Pre-Check**.
3. Pick which variants to post. You're the taste judge, and the agent only filters hard failures.

## Originality: why it makes a few videos, not 150
TikTok penalizes near-identical uploads, reposting across accounts and passive product-only videos, and repeated violations can cost e-commerce access (SAID via policy summaries; the core rules VERIFIED on Seller University). Variety in **hook, angle and trim** is what's allowed. This hub is stricter on purpose: variants must differ in hook *and* angle, with under 60% footage overlap. That's a conservative choice, not TikTok's published rule. Loosen it only with evidence from your account.

## Known gaps (being honest)
- Real transcription engines and the HDR tone-map on real skin tones haven't been verified on a creator's own footage yet. Check the first batch by eye against the Photos app.
- Safe-zone pixels are estimates from three sources. Screenshot one real post per new caption style to confirm.
- Nobody outside TikTok knows exactly how duplicate detection works.
- There's no confirmed creator-side API for GMV per video, so the learning loop runs on your weekly exports.
