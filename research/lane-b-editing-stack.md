# Lane B: The Editing Engine (Nov 2026)

Brief: the best stack for an AI agent (Claude Code, Opus) to turn raw iPhone clips into post-ready 9:16 TikTok Shop affiliate videos, automated end to end, without quality loss.
Goal beyond the goal: more GMV per hour of filming, so the engine must be cheap per variant, repeatable, and safe to run unattended.
Research date: 2026-11-22. Label key: MEASURED (I pulled the number from an API, registry or file myself) / SAID (a vendor or blog says it) / VERIFIED (I read the primary source and it holds) / INFERRED (my reasoning from evidence) / UNVERIFIED (not checked, or sources conflict).
Gate column is my pre-score only (FIRE / INTERESTING / DEAD). The DRIFT_GUARD milestone M1 requires a separate judge agent to confirm it.

---

## 1. SPARK LOG

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| S1 | video-use (browser-use): an agent skill that edits video by reading a word-level transcript, then drives ffmpeg. Editor sub-agent writes `edl.json`; 30 ms audio fades at every cut; cuts padded 30-200 ms; never cuts inside a word; self-evaluation capped at 3 passes. Calls HyperFrames/Remotion/Manim for animation slots. | https://github.com/browser-use/video-use , https://raw.githubusercontent.com/browser-use/video-use/main/SKILL.md | It is the closest existing public design to what we want, and its hard rules read like fixes for known LLM-editing failures. 31,403 stars, MIT, created 2026-04-12, last push 2026-10-08. Needs an ElevenLabs key. No dedicated vertical workflow in the doc. | FIRE (steal the design, do not adopt wholesale) | MEASURED stars/dates; VERIFIED SKILL.md content |
| S2 | Claude API takes images only. Up to 600 images per request (100 on 200k-context models), 8000x8000 px max, 128 MB request cap. The vision page lists no video input. | https://platform.claude.com/docs/en/build-with-claude/vision | Sets the hard design constraint: Opus never "watches" a clip. It reads a transcript plus frames we choose. | FIRE | VERIFIED (absence of video on the vision page; I grepped the fetched page) |
| S3 | Gemini video understanding: native mp4/mov/webm; File API up to 20 GB paid; 1 fps default, `fps` 0-24 settable; clip with `start_offset`/`end_offset`; timestamps as MM:SS; about 100 tokens/s at low resolution, about 300 tokens/s at high. | https://aistudio.google.com/docs/video-understanding | It is the only mainstream model here that sees motion and hears audio, so it is the natural "best take" ranker. A 60 s clip is about 6k tokens low-res (INFERRED from the per-second figure). | FIRE | VERIFIED doc; token total INFERRED |
| S4 | A vendor test of "Claude Opus" cutting a 30-min interview to 5 min: reported 299.32 s, actual 578.24 s (93% over); 11 of 11 cuts landed mid-sentence. Separate test: ffmpeg flags were rarely hallucinated, wrong file paths were the main failure. | https://tryselects.com/blog/can-claude-edit-videos/ (author sells a competing editor, Selects) | The most direct evidence on the "Opus is a great editor" claim. n=1 per job, methodology not published, vendor bias. | INTERESTING (directional only) | SAID |
| S5 | media-use `transcript-cut.mjs`: a compiler that turns word timestamps plus agent decisions (`--remove`, `--remove-fillers`, `--cut-silence`, `--plan` dry run) into exact kept segments. | local: `~/.claude/skills/media-use/references/operations.md`, `~/.claude/skills/media-use/scripts/transcript-cut.mjs` | It is the deterministic layer that fixes S4's failure (the model decides, code does the arithmetic and the snapping). Already installed. | FIRE | VERIFIED (read the doc; did not run it) |
| S6 | media-use transcription defaults to Parakeet (parakeet-mlx), with whisper.cpp fallback; claims 6.05% vs 7.44% WER and 5-10x faster, ~3 s for 8 s audio on a 24 GB Mac. | local: `~/.claude/skills/media-use/references/operations.md` | Fast local word timestamps with no API key, which matters at variant volume. The numbers are the skill author's own. | INTERESTING | SAID (self-reported) |
| S7 | WhisperX: wav2vec2 forced alignment for word-level timestamps, claims 70x realtime on large-v2 (hardware unstated). README only documents CPU int8 for Mac. 25,572 stars, BSD-2, pushed 2026-11-21. | https://github.com/m-bain/whisperX | Alternative to S6 with a strong maintenance record. Scribe (video-use) drift is stated as 50-100 ms; the vendor test in S4 measured about 120 ms for Scribe v2. | INTERESTING | MEASURED stars; SAID speed |
| S8 | auto-editor (Nim, Unlicense): cuts by audio loudness or motion, `--edit` accepts combined expressions, exports Premiere/Resolve/FCP/Shotcut/Kdenlive/CMX 3600 EDL or rendered clips. 6,044 stars, pushed 2026-11-22. | https://github.com/WyattBlue/auto-editor | Cheapest first pass for dead air, and its EDL/XML export gives a human-polish escape hatch. Not installed on this machine. | INTERESTING | MEASURED stars; VERIFIED README |
| S9 | MakeMyClip/editor: MIT CLI + MCP + browser timeline over FFmpeg + local whisper.cpp. Has `remove-retakes` (cuts the earlier take of a phrase said twice), `silence`, `captions`, `reframe 9:16 --x`, `cut-words`, `loudness`, `short`, export to FCP/Resolve/Premiere. Pre-1.0. Only 26 stars, 223 commits, 965 tests claimed. | https://github.com/MakeMyClip/editor | Retake removal is exactly the raw-affiliate-clip problem (people say the pitch 3 times). Immature, so borrow the idea or test it, do not depend on it yet. | INTERESTING | MEASURED stars; SAID features (README, not run) |
| S10 | CapCut automation tools (pyJianYingDraft 4,964 stars Apache-2.0; pyCapCut; VectCutAPI 2,392 stars; capcut-mate 2,196; capcut-cli 1,248) write draft files only. Auto-export works only on Windows with CapCut 6.8 or older. CapCut 7+ has no automatic export. | https://github.com/GuanYixuan/pyJianYingDraft , https://github.com/sun-guannan/VectCutAPI , https://pypi.org/project/pycapcut/ (via search summary) | The creator-favorite editor cannot be a headless render target. Useful only as a hand-polish handoff. | DEAD for automation / INTERESTING as optional manual handoff | MEASURED stars; SAID export limits (search summary of READMEs, not tested) |
| S11 | Remotion licensing: free for individuals and companies of up to 3 people; "Remotion for Creators" $25/month per seat; Automators $0.01 per render in blocks of 1,000, $100/month minimum. | https://www.remotion.dev/docs/license/pricing.md | A solo creator pays $0 for either Remotion or HyperFrames; the difference only shows up at team size or heavy automation. | INTERESTING | VERIFIED (fetched page) |
| S12 | embedded-captions matting is CPU-only, about 2 fps at 1080p, "about 2-3 min per 10 s clip" (per the skill). CoreML is banned for matting because it corrupted face alpha. | local: `~/.claude/skills/embedded-captions/SKILL.md` lines ~264-284 | The "caption behind the subject" look is the slow step in the whole pipeline. At 30-45 s per video it is minutes per variant. Must be opt-in per hero beat, not default. | FIRE (as a constraint) | SAID (skill author), arithmetic INFERRED |
| S13 | HyperFrames render norms from the local manual: 30 s motion-heavy 1080p reel about 37 s, 80 s reel about 100 s on an M1-class machine with 6 workers; $0 per render. A HeyGen-published A/B against Remotion: 11 min 50 s vs 12 min 30 s for the same prompt (agent build plus render, "decides nothing about quality"). | local `~/.claude/skills/animate/references/production-manual.md` (~line 555); https://hyperframes.heygen.com/guides/hyperframes-vs-remotion | Overlay-only renders are cheap enough to run per variant. | INTERESTING | SAID (both) |
| S14 | Descript API (open beta 2026) can trigger Underlord edits (Studio Sound, filler removal, captions); requests return 402 when credits run out; Underlord bills for both the agent's reasoning and each tool. | https://help.descript.com/api-and-mcp/api (via search summary) | A cloud "agent editor" with an API exists, but credit economics are opaque, and source media goes to a third party. | INTERESTING | UNVERIFIED (could not open the API doc; sources conflict on maturity and price) |
| S15 | Opus Clip has a REST API plus an MCP server (mcp.opus.pro/mcp) and a Claude Code skill. Submagic API reportedly needs Business+ ($41/mo) plus about $0.10-0.15/min PAYG; Captions/Mirage reportedly $0.15/min. Sources conflict, one says Submagic has no API. | https://www.opus.pro/blog/best-video-editing-apis-for-developers (vendor) | These products cut long videos into viral clips or caption them. Our input is short raw takes where the work is take-picking and tightening, so they fit poorly. Prices unconfirmed. | DEAD as the core / INTERESTING as a caption-look benchmark | SAID / UNVERIFIED |
| S16 | Face-tracked 9:16 reframing: Google AutoFlip (MediaPipe, original no longer supported) with the maintained `pyautoflip` reimplementation; MediaPipe BlazeFace or YOLOv8 detection + exponential smoothing + dead zone, then an FFmpeg crop expression. Active-speaker cropping cost is dominated by feeding frames, not the model. | https://research.google/blog/autoflip-an-open-source-framework-for-intelligent-video-reframing/ , https://dev.to/kyle_clipspeedai/face-tracking-for-vertical-video-why-its-harder-than-it-looks-and-how-it-works-3e97 | Only matters when she films landscape. iPhone portrait clips are already 9:16 (INFERRED), so this is a fallback lane. | INTERESTING | SAID (blogs); not tested |
| S17 | FableCut: browser editor exposing the whole timeline as one JSON document with MCP + REST. 804 stars, MIT, created 2026-07-06, pushed 2026-11-21. Also OpenShot CLI headless mode, FilmCraft MCP, Eddie. | https://github.com/ronak-create/fablecut , https://github.com/MakeMyClip/editor | This is the actual "headless editor" wave, and it is small and young. | INTERESTING | MEASURED stars; SAID features |
| S18 | `reverse-any-video` skill ships in the HyperFrames repo (Pro): rebuilds an existing video file as an editable HyperFrames project, checked frame by frame. | https://github.com/heygen-com/hyperframes (README) and repo `skills/` folder listing via `gh api` | A route to study winning videos by turning them into editable templates (feeds the "what sells" loop). Pro-gated. | INTERESTING | VERIFIED listing; Pro gating SAID by README |
| S19 | iPhone ingest hazards: HDR/Dolby Vision HEVC, variable frame rate, rotation metadata. I did not research these. | none | Likely to break ffmpeg overlays or colors silently. Needs a normalization step (CFR, SDR tone-map, 1 s GOP). The HyperFrames manual itself demands a 1 s GOP re-encode or you get "seek-freeze artifacts" (local production-manual lines ~143-150). | INTERESTING (open thread) | The GOP requirement is VERIFIED locally; the HDR/VFR concern is INFERRED/UNVERIFIED |

---

## 2. CLAIM CHECKS

### Claim A: "Remotion isn't in the conversation anymore, it's mostly HyperFrames"
Verdict: PARTLY TRUE on attention, FALSE on usage. As worded, REFUTED.

Evidence (all MEASURED 2026-11-22 via `gh api` and the npm API):

| Metric | HyperFrames | Remotion |
|---|---|---|
| GitHub stars | 87,855 | 74,760 |
| Repo created | 2026-03-10 | 2020-06-23 |
| Last push | 2026-11-22 | 2026-11-20 |
| Latest release | v0.9.79, 2026-11-21 | v4.0.545, 2026-11-18 |
| npm downloads, last week | `hyperframes` 1,506,221 | `remotion` 4,728,369 |
| License | Apache-2.0 | Custom source-available (GitHub reports NOASSERTION) |

- HyperFrames has more stars than Remotion after 8 months, so "in the conversation" is fair (MEASURED).
- Remotion still has about 3x the weekly npm downloads and ships a release every few days. It is not dead (MEASURED).
- Stars are a poor usage proxy. Downloads also include CI and transitive installs (INFERRED), so neither number proves real adoption.
- HeyGen's own comparison page admits Remotion is older and more established and that HyperFrames has "fewer templates, tutorials, and answered questions" (VERIFIED, vendor page: https://hyperframes.heygen.com/guides/hyperframes-vs-remotion).
- Both are renderers, not editors. HyperFrames' own router skill says re-timing, recolor, reframe, reorder and audio edits "is NLE editing, out of scope" (VERIFIED, local `~/.claude/skills/hyperframes/SKILL.md`). A third-party page says the same of both tools (SAID, https://cutback.video/blog/hyperframes-vs-remotion-vs-selects).
- So for this brief the debate is almost irrelevant. The cut is not made by either one; the choice only matters for the overlay layer.

### Claim B: "Everyone's talking about headless editors"
Verdict: PARTLY TRUE, but mislabeled. The momentum is in agent skills over ffmpeg plus a transcript, not in headless NLEs.

- Headless/JSON-timeline editors exist: MakeMyClip/editor (26 stars), FableCut (804), OpenShot CLI, FilmCraft MCP, Eddie (MEASURED stars for the first two; the others SAID by search results). All are young. FableCut and MakeMyClip were both created in 2026 (MEASURED).
- The biggest star count in this space is video-use at 31,403 (MEASURED), which is an agent skill that writes an EDL and renders with ffmpeg, not a headless GUI editor.
- Cloud products are adding agent surfaces: Descript API open beta, Opus Clip MCP (SAID, UNVERIFIED depth).
- CapCut, the tool most TikTok creators use, cannot be driven headlessly in a supported way: drafts yes, export no on current versions (S10, SAID).
- My read (INFERRED): "headless editor" is working shorthand for "an editor an agent can drive through a text interface". The pattern that is winning on stars is transcript-as-interface plus a deterministic render step.

### Claim C: "Opus is a great video editor now"
Verdict: REFUTED as stated; TRUE as a planner when wrapped in deterministic code.

- No video input. The Claude API vision page documents images only (S2, VERIFIED). A guide to the same subject says Claude "reads text and still images, not video files" (SAID, S4 source). It cannot hear audio, and video-use's own SKILL.md says the agent reports measurements rather than judging sound (VERIFIED).
- Unwrapped, it fails on arithmetic and boundaries. In the one published test, it hit 578 s on a 300 s target while reporting 299.32 s, and every cut broke a sentence (SAID, vendor, n=1, S4). Treat as directional, not proof. Neither the model version nor the full prompt is documented.
- Wrapped, it works. video-use gets usable results by giving the model a packed transcript plus a few on-demand filmstrips, and then by enforcing word-boundary snapping, pad, fades and a 3-pass cap in code (VERIFIED SKILL.md). That is evidence that the design, not the model, carries the quality.
- My conclusion (INFERRED): use Opus for choice (which take, which hook, what overlay) and let scripts do timing, duration math, loudness and QA. Add a second look from Gemini (S3) when motion or audio matters.
- Caveat: one commit in video-use's history is co-authored by "Claude Opus 5.5" (MEASURED from the commit). That shows people build with it, not that it edits well.

---

## 3. COMPARISON TABLE

Stars and dates MEASURED 2026-11-22 unless noted. "Edits raw footage?" asks whether the tool can ingest camera clips and make cuts.

| Tool | Mechanism | License | Maturity (stars, last push) | Agent-friendliness | Render speed | Cost | Edits raw footage? | Role here |
|---|---|---|---|---|---|---|---|---|
| **HyperFrames** | HTML/CSS + seekable GSAP/Lottie/Three etc.; headless Chrome seeks each frame, FFmpeg encodes. Node 22+, FFmpeg. Local, Docker or AWS Lambda render. CLI includes `transcribe`, `tts` (local Kokoro), `remove-background` (u2net_human_seg, Apache-2.0), `lint`, `snapshot`. | Apache-2.0 ("no per-render fees" per README) | 87,855; 2026-11-22; v0.9.79; created 2026-03 | Very high: 21+ skills, router, lint/validate/snapshot loop, deterministic output | 30 s 1080p about 37 s on M1-class (SAID, local manual); no official benchmark | $0 local (VERIFIED README) | No. Plays a clip in a `<video>` element; requires 1 s GOP source | **Overlay and caption layer** |
| **Remotion** | React components, per-frame pure functions, headless Chrome render | Source-available: free up to 3 people; Creators $25/seat/mo; Automators $0.01/render, $100/mo min (VERIFIED) | 74,760; 2026-11-20; v4.0.545 | High (Claude Code skill exists, SAID); heavier setup (about 950 MB node_modules in HeyGen's test, vendor) | Similar to HyperFrames in HeyGen's A/B (12:30 vs 11:50, vendor) | $0 solo | No | Alternative overlay layer; keep as fallback if HyperFrames blocks |
| **Revideo** | Fork of Motion Canvas; TS generators; programmatic video | MIT | 4,223; 2026-07-15 (4 months quiet) | Medium | Not measured | $0 | No | Skip |
| **Motion Canvas** | TS generator animations, editor UI | MIT | 20,125; 2026-07-02 | Low-medium (aimed at human explainers) | Not measured | $0 | No | Skip |
| **editly** | Node CLI/JSON spec over ffmpeg | MIT | 5,638; last push 2025-05-12; last release 2025-01-19; npm 579/wk (MEASURED) | Low (dormant) | Not measured | $0 | Limited (clips + transitions) | Skip (stale) |
| **MoviePy** | Python compositing over ffmpeg | MIT | 15,188; 2026-08-26 | Medium (code-only) | Python frame pipeline, typically slower than raw ffmpeg (INFERRED, not measured) | $0 | Yes, but low-level | Skip; ffmpeg direct is simpler |
| **FFmpeg (filtergraphs)** | Native C pipeline; trim/concat/scale/crop/ASS subtitles/overlay/loudnorm | LGPL/GPL (GitHub shows NOASSERTION) | 67,819; 2026-11-22 | High for LLMs (zero hallucinated flags in one test; path errors were the main failure, SAID) | Fastest option here (INFERRED; no measurement run) | $0 | **Yes** | **The cut, concat, loudness and final encode** |
| **auto-editor** | Nim CLI; audio/motion thresholds; exports NLE XML/EDL | Unlicense | 6,044; 2026-11-22 | High (single CLI, agent skill available via `npx skills add WyattBlue/auto-editor`) | Fast (no benchmark stated) | $0 | **Yes** (silence and motion) | Dead-air pass; EDL export for human handoff |
| **PySceneDetect** | Shot boundary detection (adaptive, content, threshold) | BSD-3 | 5,611; 2026-11-21 | High (CLI + Python) | Not measured | $0 | Analysis only | Multi-shot or multi-take clip splitting |
| **whisperX / faster-whisper / Parakeet** | Word-timestamp ASR (forced alignment / CTranslate2 / NVIDIA TDT) | BSD-2 / MIT / (Parakeet: not checked) | whisperX 25,572; faster-whisper 26,928 (2026-11-12) | High | whisperX 70x realtime (SAID, hardware unstated); Parakeet "5-10x faster than whisper.cpp" (SAID, local skill) | $0 local; Scribe is paid (price not verified) | Analysis only | **Word timestamps (the spine of the cut)** |
| **video-use** | Transcript-first agent skill; EDL; ffmpeg render; 3-pass self-eval | MIT | 31,403; 2026-10-08 | Very high (it is a Claude Code skill) | ffmpeg-bound | ElevenLabs key; price not stated in README | **Yes** | **Design reference; lift rules and structure** |
| **MakeMyClip/editor** | CLI/MCP/browser timeline over ffmpeg + whisper.cpp | MIT | 26; 2026-11-16; pre-1.0 | High on paper | Not stated | $0, no API key | **Yes** (silence, retakes, reframe, captions) | Watch; test `remove-retakes` |
| **OpenTimelineIO / EDL** | Interchange format (clip, track, timeline) with adapters | Apache-2.0 | 2,108; 2026-11-20 | Medium (needs adapters) | n/a | $0 | Format only | Optional: write the edit as OTIO/EDL only if a human hand-polish step is wanted |
| **Shotstack** | Cloud JSON-to-render | Proprietary SaaS | n/a | High (JSON) | Cloud | Reported $0.20-0.30/min or plans from $39/mo (SAID, third-party blogs, conflicting) | Template merge, not smart cutting (INFERRED) | Skip; uploads media, per-minute cost |
| **Creatomate** | Cloud template/JSON API, credit-based | Proprietary SaaS | n/a | High | Cloud | About $41-54/mo entry, about 37 credits/min of 1080p30 (SAID, conflicting) | Template merge | Skip |
| **JSON2Video** | Cloud JSON API | Proprietary SaaS | n/a | High | Cloud | Plans reported $14.95-99.95/mo (SAID, conflicting) | Template merge | Skip |
| **CapCut + pyJianYingDraft / pyCapCut / VectCutAPI / capcut-mate / capcut-cli** | Generate CapCut draft JSON; export via desktop app | Apache-2.0 / MIT | 4,964 / 2,392 / 2,196 / 1,248 stars; all pushed within about 5 weeks | Medium (draft writing is easy) | Export is manual; auto-export only Windows + CapCut at or below 6.8 (SAID) | Free app; ToS stance on scripts UNVERIFIED | Yes inside CapCut, not headless | Optional manual polish handoff only |
| **Descript (Underlord + API)** | Cloud text-based editor with agent | Proprietary | n/a | Medium-high, API in open beta (SAID) | Cloud | Plans from about $24-50/mo plus AI credits (SAID, sonix review; UNVERIFIED) | Yes | Possible cloud fallback; credits unpredictable |
| **OpusClip** | Cloud long-to-short clipping, virality scoring; REST API + MCP | Proprietary | n/a | Medium-high | Cloud | API price not found | Yes, built for long input | Wrong shape for short raw takes |
| **Submagic** | Cloud captions/B-roll/zoom effects | Proprietary | n/a | Low-medium (API reported on Business+ only) | Cloud | About $0.10-0.15/min PAYG on top of $41/mo (SAID, VEED-published guide; one source says no API) | Light | Use as a look benchmark, not a dependency |
| **Captions.ai** | Mobile/web app; API reported | Proprietary | n/a | Low | Cloud | Reported $0.15/min vs $13-29/mo (conflicting) | Light | Look benchmark only |
| **Selects** | Vendor desktop editor with MCP; exports Premiere/Resolve/FCP | Proprietary | n/a | High (MCP) | Claims 100 variants in about 30 s (vendor, unverified) | Credits (1,800 free about 5 h, SAID) | Yes | Vendor claims only; do not rely on it |

Analysis primitives, for the record:

| Primitive | Pick | Why | Label |
|---|---|---|---|
| Word timestamps | Parakeet via media-use (local), whisperX second choice, Scribe if budget allows | Word boundaries make cuts clean; Scribe drift 50-100 ms (video-use) to 120 ms (vendor test) means pad 30-200 ms | SAID |
| Best-take selection | Rank takes with Gemini native video (S3) on short clips; Opus decides from transcript plus contact sheets | Gemini sees motion and audio, Claude cannot | VERIFIED capability; ranking quality UNVERIFIED (not tested) |
| Scene detection | PySceneDetect adaptive | Splits multi-take files, cheap | VERIFIED exists; not run |
| Beat detection | librosa-style onset/beat tracking when a music bed is used | Cut-on-beat is secondary for talking-head ads | UNVERIFIED (not researched in this pass) |
| Auto B-roll | Defer. Product close-ups the creator films are better than generated B-roll for a Shop listing | Compliance and authenticity risk is unresearched | INFERRED |
| Product-shot zoom | Do it as a HyperFrames transform or ffmpeg `zoompan`/crop at the timestamp where the product name is spoken | Word timestamps give the cue | INFERRED |
| Face-tracked reframe | Only for landscape input (S16) | Portrait iPhone clips need none | INFERRED |

---

## 4. RECOMMENDED ARCHITECTURE

One-line thesis: **the model chooses, the code cuts.** Opus writes a small decision file; deterministic tools turn it into a video and prove it is correct; HyperFrames paints captions and callouts on top; a separate judge signs off.

```
raw iPhone clips
   |
0. NORMALIZE     ffprobe -> ffmpeg: CFR 30, H.264, SDR, 1 s GOP, 1080x1920, loudness measured
   |
1. ANALYZE       Parakeet/whisperX word transcript | silencedetect or auto-editor dead-air map
   |             PySceneDetect on multi-take files | contact sheet per take (frames at word starts)
   |             Gemini video pass per take: "which take is clearest, product visible, no stumbles" (JSON score)
   |
2. DECIDE        Opus reads packed transcript + scores + contact sheets, writes edl.json
   |             in WORD INDEXES (not seconds): keep ranges, take choice, hook line, overlay cues
   |
3. COMPILE+CUT   transcript-cut.mjs-style compiler snaps to word edges, pads 30-200 ms, 30 ms fades,
   |             computes total duration itself (never trusts the model's number), ffmpeg re-encode + concat
   |             -> cut.mp4 (+ loudnorm to -14 LUFS two-pass)
   |
4. DRESS         HyperFrames composition: cut.mp4 as <video>, anchor-style caption rail from the same word list,
   |             hook title, price/CTA callouts, product zoom at cue times -> out.mp4 (9:16)
   |             (opt-in per hero beat: embedded-behind-subject caption via matte)
   |
5. VARIANTS      loop 2-4 with different hook lines, caption identity, cut length, music bed
   |
6. QA            separate judge (rubric below) -> pass, or <= 3 fix rounds, then escalate to the owner
```

### Stage notes

0. **Normalize first.** The local HyperFrames manual says sparse keyframes cause seek-freeze and the fix is a 1 s GOP re-encode (VERIFIED, local). iPhone HDR and VFR behavior is a known hazard class (INFERRED, not researched here), so tone-map to SDR and force CFR in the same pass.
1. **Analyze.** Cache everything per source file (video-use does this for transcripts). Gemini is used for ranking only. If it is down or too costly, fall back to transcript-only ranking plus contact sheets (Opus can read up to 600 images per request, S2).
2. **Decide.** Constrain the model's output to a schema: `{keep:[{take, from_word, to_word}], hook, overlays:[{at_word, type, text}]}`. Index by word, not time, because the failures in S4 were arithmetic and boundary errors.
3. **Compile and cut.** Re-encode instead of stream copy. Copy cuts land on keyframes and can freeze the first frames (SAID by an ffmpeg guide in the search results; consistent with the 1 s GOP requirement). Duration, loudness and cut count are computed, not asserted.
4. **Dress.** Render overlays with HyperFrames because it reads the same word list and already has the caption identities and the `lint`/`snapshot` loop. Use `snapshot` for seconds-level previews before paying for a full render. Pin the HyperFrames version and upgrade deliberately. The local skill pin is 0.8.34 while npm latest is 0.9.79 (MEASURED), so run the lint/snapshot suite on a bump.
5. **Variants.** Hold the cut constant and vary the cheap layers (hook, captions, music), or vary the cut and hold the dress. Render cost is local CPU, $0 (SAID, local manual).
6. **QA rubric (outside judge, not the author).** Hard checks by script: 1080x1920, 30 fps, duration within the target band, audio in -14 LUFS band, no black or frozen frames at cut points, every caption word exists in the transcript, no cut inside a word, decode passes end to end. Soft checks by a vision judge on sampled frames: product visible at the claim, captions inside TikTok-safe margins, no text collision with the face. Sound can only be measured, not judged (video-use says this itself).

### Tradeoffs

- **ffmpeg-for-the-cut vs a render framework for everything.** ffmpeg is faster, free and exact. Putting the raw clip through HyperFrames as one big composition would give one pipeline but costs Chrome-seek render time on every cut and every variant (INFERRED). Keep the cut out of Chrome.
- **HyperFrames vs Remotion for overlays.** HyperFrames wins on setup weight, agent skills and Apache-2.0, and reads word JSON easily. Remotion wins on maturity, 3x npm usage and the React ecosystem. Both are $0 for a solo creator (VERIFIED). Choose HyperFrames, keep the overlay spec in plain JSON so a swap stays cheap.
- **Matte captions vs plain rail.** The behind-the-subject look is the visual signature of the best HyperFrames caption identities, but it costs minutes per clip (S12). Default to the `anchor` rail (quiet verbatim default per the skill), spend the matte only on 1-2 hero beats where it pays.
- **Local ASR vs Scribe.** Local is free and fast on Apple Silicon, but the accuracy claim is the skill author's own and drift of 50-120 ms is already inside the pad. A 30-200 ms pad absorbs that. Keep the transcript layer swappable.
- **Gemini for ranking.** It adds a second vendor and uploads footage. The upside is real motion and audio understanding. Make it optional and cached.
- **Cloud caption/clip apps.** Fast to start, but per-minute cost, uploads, opaque styling and conflicting API availability (S15) make them poor build blocks for an owned pipeline. Use them only as a visual benchmark.
- **CapCut handoff.** If she wants to finish by hand, export EDL or XML via auto-editor/MakeMyClip-style output, not CapCut drafts. The draft route cannot be automated (S10).
- **Build-vs-borrow.** Borrow video-use's rules and skeleton (MIT) but replace Scribe with the local ASR, replace "converse with the user" with a config file, and add a vertical-first render path (video-use has none).

---

## 5. WHICH LOCAL SKILLS ARE REUSABLE

Read directly from `~/.claude/skills/*/SKILL.md`. I did not run any of them (HyperFrames is not cached for npx on this machine; auto-editor and scenedetect are not installed; ffmpeg is at /opt/homebrew/bin/ffmpeg).

| Skill | Reuse? | What to take | What breaks for this pipeline |
|---|---|---|---|
| **media-use** | **Yes, most directly** | `transcribe.mjs` (Parakeet with whisper fallback), `transcript-cut.mjs` (the compiler we need, with `--plan` dry run), `audio-duck.mjs`, two-pass loudnorm recipe at -14 LUFS, `resolve` for BGM/SFX with a project ledger | Defaults lean on a `heygen` CLI and its catalogs, and it sends **anonymous telemetry to PostHog** (opt out with `HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1`). Set the opt-out in any shipped repo. The skill states `transcript-cut` re-encodes; I did not verify cut quality. |
| **embedded-captions** | **Yes, for captions (with limits)** | `scripts/prepare.sh` (matte, transcribe and audio-envelope in parallel), the caption catalog (the `anchor` rail as default), `preview-frames.cjs` (about 2 s/frame preview, no render), render gates (timing, overflow, occlusion) | Matting about 2 fps on CPU (S12); needs a single clear subject; refuses clips with burned-in captions and clips under 3 s or near-silent; the skill's "recommend, let the user pick" step must become a config default for unattended runs. Large (32 KB SKILL.md plus 32 identities); ship a short list. |
| **talking-head-recut** | **Partly** | Card timing model (word-array transcript to `storyboard.json` to HTML card fragments), lower-third, callout and picture-in-picture cards for price, "link in bio", feature bullets | The clip plays in full and untouched, so it never cuts. It is a 64 KB skill that expects the agent to hand-write each card in conversation, which is token-heavy per variant. Convert 4-6 cards to parameterized templates before using it at volume. |
| **animate** | **Mostly no (borrow checklists)** | The footage-prep recipe (1 s GOP re-encode, speech-safe boundaries), the render verification list (dimensions, fps, full decode, audio peaks, two-word subtitle cap), the "scene-local time only" determinism rules, render-time norms | Built around one owner's reel template and element library (library path, brand wave, presenter-plate layouts). Its `LOCAL-SETUP.md` and templates carry owner-specific paths and branding, so it cannot ship in a public repo without a scrub. Pinned to HyperFrames 0.8.34. Its vertical layout (infographic above, square presenter plate below) is a different genre from a UGC affiliate video. |
| **hyperframes / hyperframes-core / hyperframes-cli** | **Yes (required deps)** | Composition contract, lint/validate/snapshot/render loop, Docker and Lambda render paths | Router correctly says footage re-timing and cutting is out of scope, which is why stage 3 lives outside. |
| **remotion-to-hyperframes** | No | Only if a Remotion template is ever imported | n/a |

---

## 6. OPEN THREADS

1. **Nothing here was run.** No clip was cut, captioned or rendered in this pass. Every speed and quality figure is SAID or INFERRED. A dry run on one real raw iPhone clip (M4 in the DRIFT_GUARD) is the first test, and it should include a transcript-cut accuracy check against hand-marked cut points.
2. **Take-ranking quality.** Is Gemini's per-take score any good against the owner's own picks? Needs a small labeled set (10-20 takes). Until then, ranking is UNVERIFIED.
3. **TikTok-side rules.** I did not research safe-zone margins, length sweet spots, Shop disclosure labels, or AI-content labeling. The QA rubric's "safe margins" must use TikTok's own published numbers, which Lane A or the ops lane should supply. Do not hard-code guesses.
4. **iPhone ingest specifics.** HDR/Dolby Vision tone-mapping, VFR to CFR, rotation tags, ProRes vs HEVC. INFERRED hazard, unresearched.
5. **Matte cost at volume.** A 45 s clip could take minutes of CPU for matting alone (S12 arithmetic). Check whether the current hyperframes `remove-background` has a faster path, or restrict embedded captions to under 5 s windows.
6. **Remotion license edge.** Free up to 3 people (VERIFIED), but if a manager or editor joins, the Creators or Automators terms apply. Also the HyperFrames README says "no per-render fees or commercial-use thresholds" (VERIFIED), which favors it for a scaled affiliate team.
7. **MakeMyClip `remove-retakes`.** Worth a hands-on test; it may beat a hand-written heuristic for repeated pitches. 26 stars means high abandonment risk.
8. **Cloud API prices conflict across sources** (Shotstack, Creatomate, JSON2Video, Submagic, Captions). I did not open any vendor pricing page. Do not use those numbers in a shipped doc.
9. **HyperFrames version pin.** Local skill pins 0.8.34; npm latest is 0.9.79 and registry shows rapid releases (MEASURED). Decide a pin policy and a smoke test before upgrading.
10. **Pro-gated features.** `reverse-any-video` is Pro per the README; check whether the free tier is enough for the "study a winner, template it" loop.
11. **Beat detection and auto B-roll** were not researched in depth in this pass. Side idea, not blocking.
12. **Side idea (logged, not built):** feed the QA judge's failure reasons back into the Opus decision prompt as a per-creator "do not do" list, so the same mistake is not repeated across variants.

### Source list (primary pages I actually fetched)
- https://github.com/heygen-com/hyperframes (README via raw.githubusercontent.com; stars and release via `gh api`)
- https://hyperframes.heygen.com/guides/hyperframes-vs-remotion (vendor)
- https://www.remotion.dev/docs/license/pricing.md
- https://github.com/browser-use/video-use and its raw SKILL.md
- https://platform.claude.com/docs/en/build-with-claude/vision
- https://aistudio.google.com/docs/video-understanding
- https://tryselects.com/blog/can-claude-edit-videos/ and https://cutback.video/blog/hyperframes-vs-remotion-vs-selects (same vendor)
- https://github.com/MakeMyClip/editor , https://github.com/WyattBlue/auto-editor , https://github.com/m-bain/whisperX
- GitHub and npm registry numbers: `gh api repos/...` and `api.npmjs.org/downloads/point/last-week/...`, pulled 2026-11-22
- Search summaries only (not opened by me): CapCut automation tools, Descript API, Shotstack/Creatomate/JSON2Video, Submagic/OpusClip/Captions pricing, face-tracking reframe articles

---
Drift check: depth 1, vision 2, truth 2, complete 1, specific 2, focus 2, craft 2. Gaps: nothing was executed, several vendor docs and prices were not opened, and beat detection plus TikTok rules were not researched.
