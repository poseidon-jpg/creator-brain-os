# Deep hop: fire-repo mechanics and the spec for OUR pipeline scripts

Researched 2026-11-21 (system clock). Anchor read first: `DRIFT_GUARD.md` (goal beyond the goal: more GMV per hour of filming; raw iPhone clips in, many on-meta variants out; no personal strings; no invented stats). Lane B and Lane C skimmed for context.

Label key: MEASURED = I ran it or counted it here, this session. VERIFIED = I read the primary source file (code or doc) in the shallow clone. SAID = a repo/author claims it, unproven. INFERRED = my reasoning from evidence. UNVERIFIED = not checked or not runnable here.

Clone commits read (shallow, nothing executed from them): video-use `43cfc56`, herk-edit-kit `10511e5`, ffmpeg-skill `39b9143`, ecommerce-video-skills `96c49b3`.

Privacy note for whoever publishes this file: it contains no personal strings by design. Test footage used for measurements was a real iPhone 4K HLG clip on the author's disk; it is not included and not named here.

---

## 0. Findings that change our design (read these first)

1. **Single-pass trim/concat beats per-segment extract + `-c copy` concat.** video-use and media-use both extract each segment separately and `-c copy` concat them (VERIFIED in `render.py` and `transcript-cut.mjs`). herk-edit-kit says that pattern drifted lip sync "by about a frame at half the joins" and its own cutters use one `trim/atrim + concat` filtergraph (SAID in its playbook; VERIFIED that `cut-silences.mjs` and `apply-cuts.mjs` build that graph). I built the single-pass version with frame- and sample-integer cut points on a synthetic flash+beep clip: 6 flashes and 6 beeps landed at the expected output times within 0.6 ms, 180 frames, 288000 samples exactly (MEASURED, section 5). We adopt single-pass and reject video-use hard rule 2.
2. **This Mac's ffmpeg cannot do what the fire repos assume.** Homebrew ffmpeg 8.1.1 has no `zscale`, no `libplacebo`, no `drawtext`, no `subtitles`/`ass` (no libass, no freetype) (MEASURED via `ffmpeg -filters`). video-use's HDR tone-map chain and its subtitle burn-in both fail here; so does ffmpeg-skill's HDR path and contact-sheet timecodes. I built and tested replacements that use only stock filters (section 4.6, 4.9). A one-line fix exists: `brew install ffmpeg-full` lists libass, libplacebo, zimg, freetype, fontconfig as dependencies (MEASURED via `brew info`; not installed, filter presence therefore UNVERIFIED).
3. **A real iPhone clip here is HLG HDR, 10-bit HEVC, 4K, rotated, with variable-ish frame rate and 5 extra data tracks** (MEASURED with `ffprobe`: `hevc Main 10`, `arib-std-b67`, `bt2020nc`, 3840x2160 with `rotation=-90`, `r_frame_rate=30/1`, `avg_frame_rate=54025/1801` = 29.9972, streams 2..6 are `codec_type=data`). So HDR handling is not optional. Our tone-map path is a LUT chain that reproduces the BT.2100 HLG math (matches an independent Python calculation to within 1 code value on a 9-level gray ramp). Whether it matches Apple's own look on a real face is UNVERIFIED; the cheap, certain fix is to film SDR (see 4.6).
4. **Quick Look (`qlmanage -t`) is NOT a valid HDR reference.** I tried it as ground truth: for an HLG gray ramp it returns 22 40 56 72 88 105 130 161 203 255 (levels 0.1..1.0), which fits "inverse OETF only, no OOTF, no tone map", and `sips` reports the PNG as nclc (9,1,9). Do not use it to judge tone-mapping (MEASURED; interpretation INFERRED).
5. **Local ASR will probably not give us fillers.** video-use's anti-pattern list says local Whisper "normalizes fillers" and it insists on hosted ElevenLabs Scribe `scribe_v1` verbatim (VERIFIED in SKILL.md and `transcribe.py`). media-use defaults to local Parakeet and cuts fillers by matching word text (VERIFIED). Whether Parakeet emits "um/uh" is UNVERIFIED (not installed here). Our fix: detect "speech energy with no word" from `silencedetect` and flag it in the clip log, so the model can cut it by time even if the ASR dropped the word.
6. **The `embedded-captions` skill, as shipped, will refuse our edited videos and cannot run on this Mac today.** Its decision gate says refuse "Multiple speakers / hard cuts" (VERIFIED, SKILL.md), its scripts need a built HyperFrames checkout at `$HYPERFRAMES_ROOT` (`packages/cli/dist/cli.js`, built with `bun install && bun run build`, VERIFIED in `render-and-composite.sh`), and neither the checkout nor `bun` exists here (MEASURED). Its `anchor` rail sits 96 px from the bottom of the frame, inside TikTok's covered zone (VERIFIED in `themes/anchor.json`), and `theme.json` defaults to 1280x720 (VERIFIED, `make-theme.cjs` line 49-50). Section 4.10 gives the exact commands to try, plus our own fallback that needs only ffmpeg and Pillow (alpha PNG track overlay, tested on synthetic input).
7. **Caption zone numbers disagree across repos; ours takes the tightest.** TikTok bottom UI covers 22 percent in two repos (ffmpeg-skill, ecommerce-video-skills), herk reserves less (y up to 1600). We use y <= 1498 (section 4.11). All are empirical guesses; the repos themselves say "verify on a real phone".
8. **Loudness: -14 LUFS is not always reachable with a true-peak cap.** On a test clip (input -16.65 LUFS, TP -3.17) both linear and dynamic `loudnorm` with TP -1.5 stopped at -15.0 LUFS; `volume=+2.65dB,alimiter=limit=-1.5dB` reached -14.1 LUFS (MEASURED). The spec uses measure, gain, limiter, then verify (4.8).

---

## 1. Per-repo mechanics (primary sources read)

### 1.1 browser-use/video-use (MIT, Copyright 2026 Browser Use)

**How it packs the transcript for the model** (`helpers/pack_transcripts.py`, VERIFIED). Input: cached Scribe JSON `edit/transcripts/<clip>.json` with `words[]` of `type` in `word | spacing | audio_event` and `speaker_id`. It breaks a phrase on any gap >= 0.5 s (default `--silence-threshold 0.5`) or a speaker change. Output `takes_packed.md`, one `## <clip> (duration: …, N phrases)` header per clip, then one line per phrase:

```
  [002.52-005.36] S0 Ninety percent of what a web agent does is completely wasted.
```

Times are `NNN.NN` seconds; audio events are kept as `(laughs)`. The model addresses cuts by those seconds. Its README/SKILL claims this is about a tenth of the tokens of raw Scribe JSON (SAID).

**What the model reads in total:** `takes_packed.md` plus on-demand filmstrip+waveform PNGs from `helpers/timeline_view.py <video> <start> <end>` (8 evenly spaced 320 px frames, waveform with word labels and shaded silences; stated "not a scan tool"). Everything else (filler tagging, retake detection, shot classification) is derived by the model at decision time; the SKILL lists pre-computed codec formats and moment-scoring functions as anti-patterns (VERIFIED).

**Exact cut-list format** (SKILL.md "EDL format", VERIFIED). The editor sub-agent returns a JSON array `[{"source","start","end","beat","quote","reason"}]`; it is saved as:

```json
{"version":1,
 "sources":{"C0103":"/abs/C0103.MP4"},
 "ranges":[{"source":"C0103","start":2.42,"end":6.85,"beat":"HOOK","quote":"...","reason":"..."}],
 "grade":"warm_cinematic","overlays":[{"file":"...render.mp4","start_in_output":0.0,"duration":5.0}],
 "subtitles":"edit/master.srt","total_duration_s":87.4}
```

Times are seconds, not word indices. The model is told to put `start/end` on word boundaries and pad them; **`render.py` does no snapping or padding itself** (MEASURED by reading: `start = float(r["start"])`, used verbatim). So the "never cut inside a word" guarantee depends on the model obeying a rule, which is exactly the failure Lane B's vendor test measured (S4). Our compiler moves that guarantee into code.

**The 12 hard rules, complete list (SKILL.md, VERIFIED), with our decision:**

| # | Rule | Ours |
|---|---|---|
| 1 | Subtitles applied LAST in the filter chain, after every overlay | Adopt (captions overlay is the last video op) |
| 2 | Per-segment extract then lossless `-c copy` concat, not one filtergraph | **Reject.** Single-pass trim/concat (finding 1) |
| 3 | 30 ms audio fades at every segment boundary (`afade=t=in:st=0:d=0.03,afade=t=out:st={dur-0.03}:d=0.03`) | Adopt, clamped for short segments |
| 4 | Overlays use `setpts=PTS-STARTPTS+T/TB` so overlay frame 0 lands at its window start | Adopt for cutaways |
| 5 | Master SRT in output-timeline offsets: `output_time = word.start - segment_start + segment_offset` | Adopt, done by frame mapping |
| 6 | Never cut inside a word; snap every edge to a word boundary | Adopt, enforced by compiler |
| 7 | Pad every cut edge, working window 30-200 ms (Scribe drifts 50-100 ms) | Adopt: 50 ms in, 100 ms out |
| 8 | Word-level verbatim ASR only; never SRT/phrase mode; never normalized fillers | Partly: local ASR, plus unaccounted-speech detection |
| 9 | Cache transcripts per source; never re-transcribe unless the file changed | Adopt, keyed by master hash |
| 10 | Parallel sub-agents for multiple animations | N/A v1 (no animation slots); we parallelise variants |
| 11 | Strategy confirmation before execution | Modify: one human approval per product (hook list + claims), then variants run unattended |
| 12 | All outputs in `<videos_dir>/edit/`, never inside the skill dir | Adopt (`work/<shoot>/`) |

**How it snaps/pads/fades/concatenates** (`helpers/render.py`, VERIFIED):
- Per segment: `ffmpeg -ss {start} -i src -t {dur} -vf "{[tonemap],}scale=-2:1920 (portrait){,grade}" -af "afade in 0.03 + afade out at dur-0.03" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r {one rate for the whole render} -c:a aac -b:a 192k -ar 48000 -movflags +faststart`. One output frame rate for all segments is resolved once because `-c copy` concat needs uniform rates (preview preset medium crf 22, draft 720p ultrafast crf 28).
- Concat: concat demuxer, `-c copy`.
- Compositing only if overlays or subtitles exist: overlays with `setpts` shift and `overlay=enable='between(t,a,b)'`, then `subtitles='…':force_style='…'` last, libx264 crf 18.
- HDR: `is_hdr_source` checks `color_transfer in {smpte2084, arib-std-b67}` and prepends `zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p`. **Needs zscale: fails on this Mac.**
- Portrait detection reads rotation side data so scaling picks the right axis (tests `test_render_orientation.py`, `test_render_fps.py`).
- Master SRT: caption chunks of 2 words (max 3), UPPERCASE, a cue closes on trailing punctuation or a gap >= 0.3 s, a cue shorter than 0.35 s grows to 3 words (`chunk_words`, constants `CHUNK_WORDS=2, CHUNK_MAX_WORDS=3, CHUNK_MIN_S=0.35, CHUNK_PAUSE_S=0.3`). Style `Helvetica,FontSize=18,Bold=1,Outline=2,Shadow=0,Alignment=2,MarginV=90`. The code comment says MarginV 90 lands the baseline about 30 percent up from the bottom because libass scales to PlayResY=288 (INFERRED: 90/288 = 31 percent, about 600 px from the bottom of 1920).
- Loudness: two-pass `loudnorm=I=-14:TP=-1:LRA=11` with `measured_*` and `linear=true`, then AAC 192k; preview uses one pass.

**How it verifies** (SKILL.md self-eval, VERIFIED): `timeline_view` on the rendered output at every cut boundary (+/-1.5 s) looking for a visual jump, a waveform spike at the boundary, subtitles hidden by an overlay, misaligned overlays; sample first 2 s, last 2 s and 2-3 midpoints; `ffprobe` duration vs EDL; `ffmpeg -af ebur128=peak=true` for loudness and true peak plus per-section RMS; for anything published, a separate critic sub-agent briefed to roast, with ranked problems and timecodes; **cap 3 self-eval passes**, then flag to the human.

**Things we may not copy:** nothing blocks ideas (MIT). Do not copy: `skills/manim-video/` (vendored; the README carries no license line, provenance UNVERIFIED), the "Browser Use" name/banner/poster assets, prose from SKILL.md beyond short excerpts. Scribe is a hosted paid API: audio leaves the machine, needs `ELEVENLABS_API_KEY`; make it opt-in only. The repo's code says `scribe_v1` while Lane B's table cites a vendor measuring "Scribe v2"; do not conflate (MEASURED: grep).

### 1.2 nateherkai/herk-edit-kit (MIT for original kit material, plus a custom grant)

**License detail** (VERIFIED: `LICENSE`, `THIRD_PARTY_NOTICES.md`, `licenses/PIPELINE-USE-PERMISSION.txt`). `LICENSE` is MIT (Copyright 2026 Nate Herk) for original kit material. The notices file says imported pipeline resources (added pipeline skills, style library, templates, shared editing tools, short-form workflow) retain a separate "Use Permission": recipients may use, copy, modify and share the teaching-kit code, templates and docs and produce personal or commercial videos, **must retain the notice when redistributing**, and no rights to third-party marks or likenesses. Bundled HyperFrames skills are Apache-2.0 (license file included). Example showcase videos, `assets/` brand files (AIS logo/background/guideline), fonts, style names (Vox, Kallaway, Infinite) are not licensed to us. **Flag: do not copy `assets/`, `examples/showcase/`, `style-library/`, `style-templates/`, or `docs/EDITING-PLAYBOOK.md` wording. We restate the numbers in our own words and credit them as the author's measurements.**

**Style numbers** (`docs/EDITING-PLAYBOOK.md`, VERIFIED text; measured by the author on 27 of his own Instagram Reels, Mar-Sep 2026, so SAID, single creator, tech-education content, domain mismatch for TikTok Shop; use as A/B starting points, not law):
- Speech starts within 0.1 s; the file ends right after the last word; no intro or outro card.
- Pauses between phrases stay under about 0.2 s; natural beats after a comma or list marker 0.2-0.4 s stay. Median word gap 0.04 s, 90th percentile 0.1 s, 4.0-4.7 words per second.
- Shots average 1.1-1.4 s, none over about 2.8 s; first cut lands at 0.6-1.0 s on the first charged word.
- Layout mix at 1080x1920, every change a hard cut: split (B-roll top y 0-880, speaker below) 30-42 percent; full B-roll 50-55 percent; punch-in (tight speaker shot) 5-15 percent; speaker on screen about 45 percent and never gone more than about 3.5 s.
- Story: hook in first 3 s; one line credibility; show list items early; resolution calls back to the hook visual; CTA = show the resource then a punch-in with the comment keyword.
- Captions: 1-3 words per chunk split on phrase boundaries, hard swap (no pop), appear 2 frames before the first word; Montserrat ExtraBold, all caps, about 62-64 px; a heavy serif accent (Abril Fatface) on 5-20 percent of chunks, never two in a row; colour on 25-45 percent of chunks, whole chunk only (red wrong/loss, teal concept, green action/payoff); one look for the whole reel (dark box with a thin light edge); never white on light (measure pixels behind each caption); never over the mouth or chin, least of all in the first second; a caption running across a cut moves to the new shot's spot on the cut frame.
- Audio: music bed about 11 dB under the voice (range 9-14); SFX follow visible actions, not every cut; master near -14 LUFS with true peak at or below -1.5 dBTP; measure the final encoded stereo file (a mono file reads 3 dB low); never fade the last spoken word.
- Safe region for text on 1080x1920 (`short-form-edit/SKILL.md`): x 90-930, y 200-1600 as a starting point, reserving right edge and bottom.

**Cut mechanics it ships** (VERIFIED code): `cut-silences.mjs` defaults gap 0.55 s, head pad 0.22, tail pad 0.34; trimmed pauses keep a breath of 0.24 s (pause >= 2 s), 0.20 s (after `. ! ?`), else 0.14 s; ranges merged then complemented; render via `trim/atrim + concat` filtergraph written to a filter script, libx264 crf 18 medium, aac 192k. `cut-mistakes` finds candidate stutter/retake (Jaccard similarity)/false_start mechanically, then **requires a human or agent review in context** ("zero candidates can miss an obvious retake"; emphatic repetition looks like a stutter). Cuts between two spoken words are hard joins with an optional 20-30 ms fade.

**The feedback to rule loop** (VERIFIED: it is documentation, not code; grep found no automation). Mechanics: (1) agent edits and renders a draft; (2) human gives notes in plain words; (3) agent fixes the edit AND writes the fix into the skill as a rule, a check, or a script change, explicitly prompted ("Fix it, then add this to the skill so it never happens again"); (4) next edit starts from the improved skill. `short-form-edit/SKILL.md` says to "offer to write the note into the relevant skill or reference... record the note and the resulting rule together". Real examples in its table became validators and checks: caption contrast pixel check, "AI still image as B-roll is a build error", per-cut sync check against the raw. Its quality-gates file adds a discipline we should copy: **calibrate every new validator with negative controls** (a caption shifted 0.3 s, a one-frame scene gap, an omitted word must each fail).

**Validators worth re-implementing** (VERIFIED existence, not run): `validate-plan.mjs`, `validate-footage.mjs` (footage ledger with hashes to prevent reusing the same scene), `validate-beat-sync.mjs` (anchors must be an exact transcript phrase), `preflight.mjs`, `build-edl-review.mjs`.

### 1.3 kajisho5/ffmpeg-skill (MIT, Copyright 2026 kajisho5)

**Probe, edit, verify loop** (`SKILL.md`, VERIFIED). Order: probe real numbers (`probe.py`) -> prefer lossless -> plan with `--dry-run --json` -> chain colour, cut, join, silence, fit, caption/overlay, sync, audio, loudness, export -> `check.py OUTPUT --platform X --expect-identity S:M` -> verify from the writer's own `--json` probe (exit 0 and the requested numbers) -> keep originals -> `look.py OUTPUT --tiles 3x2` and view the PNG. Report format is fixed (`Done / Steps / Check / Look / Notes`) and every number must come from `--json` or a probe. It says: never run raw ffmpeg (its own philosophy; we do not adopt it).

**Contact sheet:** `look.py` builds a sheet with `select='isnan(prev_selected_t)+gte(t-prev_selected_t\,STEP*0.98)',scale=TILE_W:-2,drawtext(timecode),tile=CxR:padding=2:margin=2:color=0x202020`, sampling the middle of each slice so the first and last tiles are not black lead-in frames (VERIFIED code). It falls back to no timecode if the build lacks `drawtext` (and says Homebrew's plain ffmpeg is such a build); this Mac is exactly that case (MEASURED). `look.py --safe tiktok` shades the UI zones.

**Loudness commands** (`loudness.py`, VERIFIED): pass 1 `aresample=async=1:min_hard_comp=0.01,loudnorm=I=-14:TP=…:LRA=11:print_format=json -f null -`; pass 2 `loudnorm=…:measured_I=:measured_TP=:measured_LRA=:measured_thresh=:offset=<target_offset>:linear=true`; then it re-measures the encoded file because AAC overshoots, and if true peak lands above the cap it lowers the loudnorm ceiling by the overshoot and re-encodes; it also detects when loudnorm silently falls into dynamic mode and says so. Platform table for TikTok (`_platforms.py`): 1080x1920, 30 fps, h264/hevc, aspects 9:16 or 1:1, min height 1080, fps max 60, LUFS -14 with tolerance 2.0, TP -1.0, SDR only, safe fractions top 0.10, bottom 0.22, left 0.05, right 0.14. Upload limits (duration, size) are marked guidance "as of 2026-10-30", not verified rules.

**Other mechanics worth borrowing:** VFR is conformed with the `fps` filter, not `-fps_mode cfr` alone ("let a frame run up to two frames late against the sound"); `cut.py` decides VFR from packet timestamps sampled in up to five windows; HDR is detected from the transfer tag and a BT.2020 SDR file still needs a gamut conversion; "a file can pass every check row and still be unreadable because the caption sits under the description"; do not normalise ambience or near-silence (a clip measured below about -40 LUFS is room tone); iPhone `.mov` has timecode/metadata tracks, only the first audio track is used.

**Copy flags:** MIT, but `references/scripts.md` is about 190 KB and `brand/` holds logos; copy nothing. It tells agents to never run raw ffmpeg, which conflicts with our style.

### 1.4 xianyu110/ecommerce-video-skills (MIT, Copyright 2026 xianyu110)

**The 5-beat template** (`skills/viral-remake/SKILL.md`, VERIFIED; the numbers are the repo's own and unproven, SAID). Beats: Hook (0-3 s) stop the scroll with scene plus pain/contrast; Problem (3-5 s) amplify the pain or show the old way failing (may merge into hook); Solution (5-8 s) product reveal plus one line of what it is; Proof (8-13 s) one or two visible proofs (demo, comparison, close detail); CTA (13-15 s+) action plus sticker, `min >= 3 s` so it can be tapped. Default 15 s. Shot counts by length (`selling-point-storyboard`): 15 s = 5-6 shots, 30 s = 8-10, 60 s = 14-18; rule "one shot, one piece of information"; every selling point needs a proof shot; voice-over budget about 4.5 characters per second (Chinese) so cut words, never speed up beyond +20 percent. Its 8-dimension breakdown (hook type, first-3-s frame, beat timeline, emotional temperature, caption rhythm, proof method, CTA form, reusable vs not reusable) is a ready-made schema for our "swipe breakdown" files (Lane C territory).

**Caption safe-zone pixel numbers** (VERIFIED code; its own text says empirical, verify on a real phone). On 1080x1920: top status bar about 9 percent (172 px); right action rail from 85 percent of width (x >= 918) spanning y 35-80 percent (672-1536); bottom caption/product-card/cart block from 78 percent of height (y >= 1498); left/right text margin 70 px. `make_subs.py` sizes by canvas height: subtitle font 0.037 x H = 71 px, hook title 0.058 x H = 110 px, tag 0.022 x H = 42 px, CTA 0.040 x H = 77 px; subtitle `MarginV` 26 percent of height (499 px) and hook title at 13 percent (250 px).

**Other:** it assembles with `xfade` between stills (Ken Burns), two-pass loudnorm to -14 with `TP=-1.5`, `crf 17` intermediates, `crf 20` final. Its pipeline is stills plus generic TTS (Microsoft Edge voices through `edge-tts`, LGPL-3.0, an online service whose commercial terms the user must check). Lane C records TikTok Shop penalising generic TTS plus text overlays (SAID). So we borrow only the beat template, the breakdown schema and the safe-zone numbers. Its compliance checklist is built around Chinese advertising law (absolute claims banned); ours must be built around FTC disclosure and TikTok Shop policy, which this hop did not research (gap, UNVERIFIED).

### 1.5 Local skill: media-use (`~/.claude/skills/media-use`)

- **License:** no LICENSE file in the directory (MEASURED), so UNVERIFIED; treat as not ours to copy into an MIT repo. It sends anonymous PostHog usage events by default (`scripts/lib/telemetry.mjs`; opt out with `HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1`), VERIFIED. Set the opt-out for her.
- **Transcription path:** `scripts/transcribe.mjs --input <audio|video> --out <file> [--engine auto|parakeet|whisper] [--model mlx-community/parakeet-tdt-0.6b-v3]`. Engine `auto` prefers `parakeet-mlx` (looked up via `$HYPERFRAMES_PARAKEET`, then `~/.venvs/parakeet/bin/parakeet-mlx`, then PATH) and falls back to `npx hyperframes transcribe` (whisper.cpp, 99 languages). The Parakeet call is `parakeet-mlx <input> --model mlx-community/parakeet-tdt-0.6b-v3 --output-format json --output-dir <tmp>`; its JSON has `sentences[].tokens[]` with `text,start,end`; `parakeet-words.mjs` merges sub-word tokens into words (a token that begins with a space starts a new word; punctuation stays attached, e.g. `"Hello,"`). Output: `{ text, words:[{text,start,end}] }`. Install (from the skill): `uv venv ~/.venvs/parakeet && VIRTUAL_ENV=~/.venvs/parakeet uv pip install parakeet-mlx`. Parakeet covers English plus 25 European languages; accuracy claim "6.05 vs 7.44 percent WER, 5-10x faster" is the skill author's own (SAID).
- **`transcript-cut.mjs`:** `node transcript-cut.mjs --input in.mp4 --transcript t.json (--remove "a-b,c-d" | --remove-words "12-18" | --remove-fillers "um,uh,like" | --cut-silence 0.8 | --keep "a-b,…") [--copy] [--plan] --out out.mp4 [--json]`. `compileCutList` (VERIFIED): merges removals, inverts to kept ranges, drops kept ranges shorter than 0.2 s, rounds to ms; `--cut-silence N` removes the gap beyond a 0.15 s pad on each side; `--remove-words` maps word-index ranges to `words[a].start .. words[b].end` with no padding and no snap; filler matching strips punctuation and case. Render is per-segment `-ss before -i`, libx264 veryfast crf 18 + aac, then `-c copy` concat (the pattern we reject). `--plan` prints the kept-segment JSON and is a useful dry run.
- **Word-indexed precedent:** `--remove-words` is the only word-index addressing in any repo we read; our cut-list generalises it.

### 1.6 Local skill: embedded-captions (`~/.claude/skills/embedded-captions`)

- **License:** no LICENSE file in the directory (MEASURED), UNVERIFIED; invoke it, do not copy it. Its matte model is `u2net_human_seg`, said to be Apache-2.0 (SAID, SKILL.md).
- **`anchor`** is the quiet rail default: verbatim lower-third rail with 2-frame fade-ups plus one "settle" climax word behind the subject. DNA (`themes/anchor.json`, VERIFIED): font Sora, body `#F2EFE9`, accent `#D9B98C`, rail `fontPx 46`, **`bottomPx 96`**, hero `settle` at 150 px, plate `{dim 0.16, pushIn 0.012, grain 5}`. The rail is positioned `top = H - bottomPx` (VERIFIED, `make-theme.cjs` line 681). The skill's own `references/rail.md` says portrait should sit "about 600-700 px from the bottom", so the shipped DNA is a landscape default. `theme.json` cannot override `body.bottomPx`; DNAs are read only from the skill's `themes/<name>.json` (`make-theme.cjs` reads `path.join(SKILL,"themes",theme.dna+".json")`), so a vertical variant needs a forked DNA file.
- **Plate reaction changes the footage** in Theme mode (dim, push-in, grain applied in `_postfx.sh`), contrary to the "video is delivered untouched" line that holds for the other two modes. Product colour fidelity matters for affiliate content, so fork the DNA with zero plate values or ship `final.mp4` (pre-plate) not `final_fx.mp4` (INFERRED from the code paths; not run).
- **Verbatim gate:** the compiler refuses a theme whose `lines` do not cover the transcript in order (compile-time "verbatim-completeness gate", VERIFIED in `render-theme.sh` comments).
- **Transcript shortcut:** `transcribe.cjs` skips transcription when `<project>/transcript.json` already has a word-shaped `words[]` (`text|word`, finite `start`/`end` under 36000) and a `language_code` (VERIFIED). So we can feed it our own retimed words and never run its WhisperX/whisper.cpp path.
- **Exact commands for a 9:16 clip** are in 4.10.

---

## 2. What is installed on this Mac, and what she must install

All MEASURED on this machine (`uname -m` = arm64) unless marked.

| Tool | State here | Needed for | Action |
|---|---|---|---|
| ffmpeg / ffprobe | 8.1.1, Homebrew, GPL, libx264 libx265 libsvtav1 libopus libvmaf videotoolbox | everything | keep |
| ffmpeg filters present | `tonemap colorspace scdet loudnorm ebur128 silencedetect xfade tile drawbox blurdetect freezedetect blackdetect signalstats lutrgb colorchannelmixer showwavespic psnr ssim libvmaf` | our tested path | none |
| ffmpeg filters **absent** | `zscale libplacebo drawtext subtitles ass` (no libass, no freetype) | video-use HDR chain, ffmpeg-skill HDR/timecodes, any ffmpeg caption burn-in | we avoid them (4.6, 4.9, 4.10); optional `brew install ffmpeg-full` (keg-only, 9.0.2; dependencies include libass, libplacebo, zimg, freetype, fontconfig, whisper.cpp; filter presence UNVERIFIED until installed) |
| node | v22.23.1 at `~/.local/bin`, Homebrew also lists node 26.0.0 | HyperFrames needs Node 22+ (video-use SKILL, SAID) | fine |
| python3 | 3.15.2 | our scripts (stdlib only) | fine for scripts; **do not** build parakeet-mlx on 3.15 (wheel availability UNVERIFIED) |
| jq, git, yt-dlp, npx | present | helpers | fine |
| whisper / whisper-cpp / whisper-cli / mlx_whisper / parakeet-mlx | **none** | ASR | install below |
| uv, pipx | **none** | ASR env | `brew install uv` |
| Pillow, numpy | **none** | our caption renderer (Pillow) | `uv pip install pillow` in the repo venv |
| bun, HyperFrames checkout | **none** (`npx hyperframes` would download 0.9.79; the skill needs a built checkout) | embedded-captions only | optional, see 4.10 |

**Homebrew list for her (minimum):**

```bash
brew install uv                     # then:
uv venv --python 3.12 ~/.venvs/parakeet
VIRTUAL_ENV=~/.venvs/parakeet uv pip install parakeet-mlx   # install line from media-use; python 3.12 pin is my addition (INFERRED safe)
uv venv --python 3.12 .venv && VIRTUAL_ENV=.venv uv pip install pillow    # repo venv for our scripts
brew install whisper-cpp            # fallback ASR; formula "whisper.cpp" (alias whisper-cpp) 1.9.5 per brew info; model file download is a separate step (UNVERIFIED)
```

Optional upgrades: `brew install ffmpeg-full` (zscale, libass, drawtext; then set `FFMPEG=$(brew --prefix ffmpeg-full)/bin/ffmpeg`), `brew install oven-sh/bun/bun` plus a HyperFrames checkout only if she wants the embedded-captions styles. Parakeet needs Apple Silicon (this Mac is arm64).

Capability probe the pipeline must run first (`scripts/doctor.py`): `ffmpeg -hide_banner -filters | grep -E " (zscale|libplacebo|drawtext|subtitles) "`, `which parakeet-mlx whisper-cli`, `ffprobe` version; write the result to `work/doctor.json` and choose paths from it (HDR path: zscale if present else LUT chain; captions: Pillow track always).

---

## 3. Directory layout (all outputs outside the repo and outside `raw/`)

```
work/<shoot>/
  raw/                         untouched iPhone files; the pipeline never writes here (rule 12)
  master/<clip>.mov            normalized 1080x1920, 30 fps CFR, SDR bt709, PCM 48k
  log/<clip>.clip.json         clip log (4.1)
  log/packed.md                the model's reading view (4.2)
  plan/product.json            verified product facts, banned claims, hook list (human-approved)
  cuts/<variant>.cutlist.json  written by the model (4.3)
  build/<variant>/edl.json  cut.fc  cut.mov  words.out.json  caps/  final.mp4
  qa/<variant>/report.json  sheet.png  strips/  safe.png
```

---

## 4. The spec

### 4.1 Clip log: `log/<clip>.clip.json` (one per master, cached by hash)

Written by `scripts/ingest.py` (probe + normalize) and `scripts/analyze.py` (silences, scenes, quality, ASR). Seconds are floats rounded to ms; frame numbers are integers on the 30 fps master grid.

```json
{
  "schema": "clip-log/1",
  "clip_id": "c001",
  "source": {
    "path": "raw/IMG_0001.MOV", "size_bytes": 304329116, "sha256_head_tail": "…",
    "ffprobe": {"codec":"hevc","profile":"Main 10","w":3840,"h":2160,"rotation":-90,
                "pix_fmt":"yuv420p10le","color_transfer":"arib-std-b67","color_primaries":"bt2020",
                "color_space":"bt2020nc","r_frame_rate":"30/1","avg_frame_rate":"54025/1801",
                "audio":{"codec":"aac","channels":2,"sample_rate":48000},"data_streams":5}
  },
  "master": {
    "path": "master/c001.mov", "w":1080, "h":1920, "fps":30, "frames":1234,
    "sample_rate":48000, "channels":2, "audio_samples":1974400,
    "video_duration_s":41.133, "audio_duration_s":41.133, "usable_duration_s":41.133,
    "hdr_detected": true, "tonemap": "lut-hlg | zscale | none-sdr",
    "vfr_source": true, "conform": "fps=30 (nearest frame)", "aspect_fix": "crop-center | none"
  },
  "audio": {"integrated_lufs":-17.2, "true_peak_db":-3.1, "mean_volume_db":-24.0, "noise_floor_db":-52.0,
            "speech_ratio":0.74},
  "transcript": {
    "engine":"parakeet-mlx", "model":"mlx-community/parakeet-tdt-0.6b-v3", "language":"en",
    "text":"…",
    "words":[{"i":0,"text":"Ninety","norm":"ninety","start":2.52,"end":2.88,"type":"word","conf":null}]
  },
  "phrases": [{"id":"p0","first":0,"last":9,"start":2.52,"end":5.36,"text":"Ninety percent …","gap_before_s":2.52}],
  "silences": [{"start":0.0,"end":2.4,"dur":2.4,"kind":"head"}],
  "unaccounted_speech": [{"start":12.10,"end":12.48,"peak_db":-31.0,"between_words":[41,42],"note":"energy with no word: filler, breath, laugh or ASR drop"}],
  "retake_groups": [{"phrases":["p3","p7"],"similarity":0.82,"method":"token-jaccard","note":"candidate only; model decides"}],
  "scene_cuts": [{"t":0.5,"score":85.5}],
  "quality": {"yavg_mean":128.6,"yavg_min":119,"yavg_max":140,"blur_mean":9.5,
              "freeze":[],"black":[],"flags":[],"notes":[]},
  "thumbs": [{"t":0.0,"path":"log/thumbs/c001_000.jpg"}],
  "labels": {"kind":null,"product_visible":null,"face_box":null}
}
```

Field rules:
- `words[].i` is the stable word index the cut-list uses. `text` keeps the engine's punctuation; `norm` is lowercase with leading/trailing punctuation stripped (same rule as media-use `bareToken`). `type` is `word` or `audio_event` (video-use convention). `conf` is null when the engine gives none.
- `usable_duration_s = min(video_duration_s, audio_duration_s)`. Real sources have unequal stream lengths (my fixture: video 2.100 s vs audio 2.017 s after stream copy, MEASURED), so every cut clamps to this.
- `phrases` break on gap >= 0.5 s (video-use default) or end of clip.
- `silences` come from `silencedetect=noise=-35dB:d=0.25` on the master audio (embedded-captions uses `-35dB:d=0.6` only for tail detection). `kind` is `head | tail | inter`.
- `unaccounted_speech` = intervals where `silencedetect=noise=-35dB:d=0.12` inverted shows sound, minus every word interval widened by 50 ms, kept if >= 0.15 s. This is the fix for local ASR dropping fillers (finding 5). Algorithm INFERRED; threshold values need calibration on real clips.
- `retake_groups`: token-Jaccard on `norm` sequences of adjacent phrases (herk `find-cut-candidates` uses Jaccard; stutter and false-start detection is the same family). Candidates only, never auto-cut (herk: "judgment, not a formula").
- `quality.flags` from measured numbers, starting thresholds to be calibrated: `underexposed` if `yavg_mean < 60`, `overexposed` if mean > 200, `soft` if `blur_mean` above a threshold calibrated on her phone (I measured 9.5 on one sharp clip, so no threshold yet), `frozen` and `black` from the detectors. `labels` are filled later by the vision pass (thumbs, 270 px wide), never by ffmpeg.
- Cache key: `sha256(master) + engine + model`; if the master hash is unchanged, skip re-transcription (video-use rule 9).

### 4.2 Packed view for the model: `log/packed.md`

Same idea as video-use (phrase lines with times) but each line carries the word-index range the cut-list needs, the gap before it, and the flags. Example:

```
# packed v1  (30 fps master; times are master seconds; w = word index)
## c001  dur 41.1s  words 118  phrases 9  lufs -17.2  flags: none
  [w000-w009 | 002.52-005.36 | gap 2.52] Ninety percent of what a web agent does is completely wasted.
  [w010-w013 | 006.08-006.74 | gap 0.72] We fixed this.  ⚠ unaccounted 0.38s @012.10 (between w041,w042)
  ↺ retake group: p3 ~ p7 (0.82)
```

Token cost: not measured here (no tokenizer run); video-use says about 12 KB for its own job (SAID). Rough estimate for a 40 s clip of 118 words: under 2 KB (INFERRED). The model also gets `thumbs` contact sheets only on request, as in video-use's "drill down at decision points, not a scan".

### 4.3 Cut-list the model writes: `cuts/<variant>.cutlist.json` (word-indexed)

```json
{
  "schema": "cutlist/1",
  "variant_id": "v03",
  "product_ref": "plan/product.json#sku-123",
  "target": {"duration_s": [24, 32], "aspect": "9:16", "beats": ["HOOK","PROBLEM","SOLUTION","PROOF","CTA"]},
  "segments": [
    {"seg": 1, "clip": "c001", "first_word": 14, "last_word": 31, "beat": "HOOK",
     "quote": "Ninety percent of what …", "reason": "cleanest take; stops before the slip at w32",
     "allow_tight": false, "zoom": 1.0},
    {"seg": 2, "clip": "c004", "first_word": 5, "last_word": 22, "beat": "PROOF",
     "quote": "…", "reason": "…",
     "cutaway": {"clip": "c006", "t_in": 3.20, "t_out": 5.60, "from_word": 8, "to_word": 15}}
  ],
  "captions": {"style": "default-v1", "emphasis_words": [31, 77]},
  "expected_duration_s": 29.4
}
```

Rules (compiler errors, not warnings):
1. Addressing is by word index only. `first_word <= last_word`, both inside the clip. The model never writes seconds for speech segments, which removes the mid-word failure by construction.
2. `quote` must equal the words `first_word..last_word` joined with spaces after `norm`; mismatch is an error (this catches the model indexing the wrong words, a failure the Lane B vendor test suggests is common).
3. A segment may not span a removed interval: `first_word..last_word` is contiguous speech. To drop a middle part, write two segments of the same clip; the compiler merges them if the gap is under 2 frames.
4. `cutaway` (B-roll over a speech segment, voice continues) addresses the output through the speech segment's words (`from_word`/`to_word`), and its source window `t_in/t_out` is seconds on its own master, frame-snapped. This mirrors herk's rule that every overlay needs an exact transcript anchor.
5. Non-speech segments (product close-ups with no voice) use `{"clip","t_in","t_out","audio":"mute|keep"}` instead of word indices.
6. `beat` is one of `HOOK, PROBLEM, SOLUTION, PROOF, CTA` (the repo's 5 beats; `PROBLEM` may merge into `HOOK`). The compiler reports the realised beat timeline and warns if HOOK ends after 3.5 s or the CTA lasts under 3 s (both numbers SAID by the ecommerce repo, not measured by us).
7. Max 3 repair rounds: if the compiler rejects the model's list three times, stop and hand to the human (global "three fix rounds" rule; video-use caps self-eval at 3 for the same reason).

### 4.4 Compile rules: snapping, padding, fading (`scripts/compile_cutlist.py`)

Constants (all stdlib, FPS=30, SR=48000, so 1600 samples per frame; integer cut points on both tracks):

| Constant | Value | Source |
|---|---|---|
| `PAD_IN` | 0.050 s before the first kept word | video-use example 50 ms; inside its 30-200 ms window |
| `PAD_OUT` | 0.100 s after the last kept word | video-use example 80 ms; herk: transcripts end words 40-80 ms before the consonant dies, so cut after it decays |
| `GUARD` | 0.020 s kept clear of the neighbouring word | mine, INFERRED |
| `GAP_CLEAN` | 0.40 s | video-use: silences >= 400 ms are the cleanest cut points |
| `GAP_TIGHT` | 0.15 s | video-use: under 150 ms is unsafe (mid-phrase) |
| `MIN_SEG` | 0.20 s | media-use `MIN_SEGMENT_SECONDS` |
| `FADE` | 0.030 s each side, clamped to segment/4 | video-use rule 3 |
| profiles | `fast` 0.03/0.08, `default` 0.05/0.10, `calm` 0.08/0.15 | all inside video-use's 30-200 ms window |

Algorithm per speech segment (words `a..b`, clip `usable_duration_s = D`):
1. `prev_end = words[a-1].end or 0`, `next_start = words[b+1].start or D`; `head_gap = words[a].start - prev_end`, `tail_gap = next_start - words[b].end`.
2. `t_in = max(words[a].start - PAD_IN, prev_end + GUARD)`; `t_out = min(words[b].end + PAD_OUT, next_start - GUARD)` (first/last word of the clip use 0 and D as limits).
3. Snap outward to the frame grid: `f_in = floor(t_in*30 + 1e-6)`, `f_out = ceil(t_out*30 - 1e-6)` (more room tone, never less). Then re-clamp: if `f_in/30 < prev_end + 0.005` use `ceil((prev_end+0.005)*30)`; if `f_out/30 > next_start - 0.005` use `floor((next_start-0.005)*30)`. Clamps emit `HEAD_CLAMPED_TO_PREV_WORD` / `TAIL_CLAMPED_TO_NEXT_WORD`. `f_out` never exceeds `floor(D*30)`.
4. Gap classes: `gap >= 0.40` clean, `0.15 <= gap < 0.40` OK (visual check in QA), `gap < 0.15` emits `TIGHT_HEAD`/`TIGHT_TAIL`; the segment passes only if `allow_tight: true` with a reason (herk: "drop a filler only when there is silence on both sides").
5. Fades: `fade = min(0.030, duration/4)`; `afade=in` at 0, `afade=out` at `duration - fade`. The last segment of the video keeps its fade inside the tail pad only, so the last spoken word is never faded (herk rule).
6. Drop segments under `MIN_SEG`; merge same-clip neighbours whose gap is under 2 frames.
7. Hard cuts only. No `xfade` (herk: every layout change is a hard cut). Optional `zoom` 1.00-1.15 on alternate segments of the same clip to disguise jump cuts; implemented as `scale=1080*Z:1920*Z:flags=lanczos,crop=1080:1920`; softness cost is real because the master is 1080 wide (INFERRED), so default off.
8. Output `edl.json`: per segment `clip, src_in_frame, src_out_frame (exclusive), out_in_frame, out_out_frame, warnings[], beat`; plus `total_frames`.
9. Output `words.out.json` for captions: every word fully inside a kept range, `out_start = (word.start - src_in_frame/30) + out_in_frame/30`, with `source_start/source_end` kept (herk's `edit-decisions.json` also carries both); words clipped by a boundary are dropped and reported.

Reference implementation of steps 1-8 (stdlib only), run on synthetic input in section 5. It is a sketch, not production code:

```python
FPS, SR = 30, 48000; SPF = SR // FPS            # 1600
PAD_IN, PAD_OUT, GUARD, FADE = 0.05, 0.10, 0.02, 0.030
def compile_segment(w, a, b, D):
    prev_end = w[a-1]["end"] if a else 0.0
    next_start = w[b+1]["start"] if b+1 < len(w) else D
    t_in  = max(w[a]["start"] - PAD_IN,  prev_end + GUARD if a else 0.0)
    t_out = min(w[b]["end"]   + PAD_OUT, next_start - GUARD if b+1 < len(w) else D)
    f_in, f_out = math.floor(t_in*FPS+1e-6), math.ceil(t_out*FPS-1e-6)
    # re-clamp against neighbour words, then min(f_out, int(D*FPS)); tight-gap warnings omitted here
    return f_in, f_out
# per segment i (input n):
#  [n:v]trim=start_frame=F0:end_frame=F1,setpts=PTS-STARTPTS[v_i];
#  [n:a]atrim=start_sample=F0*1600:end_sample=F1*1600,asetpts=PTS-STARTPTS,
#       afade=t=in:st=0:d=0.030,afade=t=out:st=DUR-0.030:d=0.030[a_i];
#  ...  [v_0][a_0]...[v_k][a_k]concat=n=k+1:v=1:a=1[v][a]
```

### 4.5 Normalize + probe commands (clip ingest)

Probe (JSON, one call per file; read the rotation too):

```bash
ffprobe -v error -print_format json -show_format -show_streams -show_entries stream_side_data raw/IMG_0001.MOV > log/c001.probe.json
```

Detection and branching:
- HDR if `color_transfer` is `arib-std-b67` (HLG) or `smpte2084` (PQ). iPhone HLG is what I measured. PQ: the LUT chain below is HLG-only; for PQ warn and require the `zscale` path (`ffmpeg-full`) or ask her to re-export SDR; UNVERIFIED that any iPhone mode produces PQ.
- `vfr_source` true when `r_frame_rate != avg_frame_rate` (my fixture: 30/1 vs 29.9972). Conform with the `fps` filter (nearest frame), not `-fps_mode cfr` alone.
- Always map only the first video and first audio stream: `-map 0:v:0 -map 0:a:0`. The five `data` streams on iPhone `.mov` break some muxers (MEASURED existence).
- ffmpeg autorotates by the display matrix before filters, so a 3840x2160 file with `rotation=-90` enters the filter graph as 2160x3840 portrait; my normalized output was exactly 1080x1920 (MEASURED).
- A landscape or odd-aspect source gets `force_original_aspect_ratio=increase,crop=1080:1920` (centre crop) and the log records `aspect_fix: crop-center` so the vision pass can flag a cropped-out subject. 16:9 to 9:16 crop drops about 70 percent of the width (ffmpeg-skill, SAID), so warn.

### 4.6 Normalize: iPhone HEVC/VFR to 1080x1920, 30 fps CFR, SDR

**SDR source (or HDR path disabled), the simple case:**

```bash
ffmpeg -hide_banner -y -i raw/c.MOV -map 0:v:0 -map 0:a:0 \
  -vf "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,fps=30,format=yuv420p" \
  -af "aresample=48000:async=1:first_pts=0" \
  -c:v libx264 -preset fast -crf 12 -g 30 -pix_fmt yuv420p \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a pcm_s16le -movflags +faststart master/c.mov
```

Intermediate quality is crf 12 (we encode three times in total: this, the cut, the final); the PCM audio avoids AAC priming offsets at joins (INFERRED from herk's drift report; the single-pass cut is the main fix).

**HLG HDR source, no zscale (works on this Mac; tested).** Use the generator below to produce the `-vf` string, then substitute it above for the SDR `-vf`. Chain logic: scale and conform on 10-bit YUV (cheap), label the frame as BT.2020/HLG, convert YUV to full-range 16-bit RGB with the BT.2020 matrix, apply the HLG inverse OETF and the BT.2100 OOTF (system gamma 1.2 at Lw = 1000 nit) per channel in a `lutrgb`, convert primaries BT.2020 to BT.709 in linear light with `colorchannelmixer`, scale so 203-nit diffuse white (HLG 75 percent) equals 1.0, soft-roll highlights above 0.8, apply the BT.709 OETF in a second `lutrgb`, then convert to BT.709 limited YUV.

```python
def hlg_to_sdr_vf(w=1080, h=1920, fps=30, knee=0.8, ootf_gamma=1.2, ref_white_nits=203.0, lw=1000.0):
    a, b, c = 0.17883277, 0.28466892, 0.55991073            # BT.2100 HLG OETF constants
    inv = f"st(0,val/maxval); pow(if(lte(ld(0),0.5), ld(0)*ld(0)/3, (exp((ld(0)-{c})/{a})+{b})/12),{ootf_gamma})*maxval"
    k = knee
    sdr = (f"st(1,val/maxval*{lw/ref_white_nits:.4f}); "
           f"st(2,if(lte(ld(1),{k}), ld(1), {k}+{1-k:.3f}*(ld(1)-{k})/((ld(1)-{k})+{1-k:.3f}))); "
           f"clip(if(lt(ld(2),0.018), 4.5*ld(2), 1.099*pow(ld(2),0.45)-0.099),0,1)*maxval")
    rgb = lambda e: f"lutrgb=r='{e}':g='{e}':b='{e}'"
    return ",".join([
        f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,crop={w}:{h},fps={fps}",
        "setparams=color_primaries=bt2020:color_trc=arib-std-b67:colorspace=bt2020nc:range=tv",
        "scale=in_color_matrix=bt2020:in_range=tv:out_range=pc:flags=bicubic,format=gbrp16le",
        rgb(inv),
        "colorchannelmixer=rr=1.6605:rg=-0.5876:rb=-0.0728:gr=-0.1246:gg=1.1329:gb=-0.0083:br=-0.0182:bg=-0.1006:bb=1.1187",
        rgb(sdr),
        "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd,format=yuv420p",
        "setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"])
```

Do not put comments or newlines in a filter script file; `-filter_script:v` rejected a commented version (MEASURED). Pass the generated one-liner with `-vf`.

Test evidence for this chain (all MEASURED, synthetic HLG gray ramp, 10 levels 0.1-1.0 as 10-bit limited-range HEVC tagged HLG/BT.2020): ffmpeg output matches an independent Python implementation of the same formulas to within 1 code value at every level (after accounting for the limited-to-full gray conversion); levels 0.50 and 0.75 land at 48 percent and about 95 percent signal (SDR diffuse white just under peak). On a real 4K iPhone HLG clip the chain ran at essentially the same speed as a plain SDR scale path (3.1 s vs 3.5 s for 2.0 s of 4K, decode-bound) and produced 1080x1920 BT.709 output with correct tags. Saturation measured higher than a naive "retag as SDR" output (SATAVG 35.6 vs 17.3), consistent with proper BT.2020 to BT.709 gamut conversion rather than a washed-out retag; whether it matches Apple's rendering on skin is **UNVERIFIED**: validate once by viewing one normalized frame next to the same moment in the Photos app, and tune `knee` and `ootf_gamma` if needed. The per-channel OOTF is an approximation of BT.2100's luminance-based OOTF (INFERRED: it slightly raises saturation).

Cheaper and certain: tell her to film SDR. In the iPhone Camera settings, Record Video has an "HDR Video" toggle on recent models and a "Most Compatible" format option; exact menu names vary by iOS version and are UNVERIFIED here.

Normalized-file checks (the gate before the clip log is written):

```bash
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,avg_frame_rate,nb_frames,pix_fmt,color_space,color_transfer,color_primaries,color_range,sample_rate,channels -of default=nw=1 master/c.mov
```

Pass if: 1080x1920, `r_frame_rate = avg_frame_rate = 30/1`, `yuv420p`, all three colour tags `bt709`, range `tv`, 48000 Hz, and `video_duration` equals `nb_frames/30`. (My test master: h264 1080x1920 30/1, bt709 tags, PCM 48k, 63 frames = 2.1 s, MEASURED.)

### 4.7 Analysis commands (clip log fill)

```bash
# ASR input
ffmpeg -y -i master/c.mov -vn -ac 1 -ar 16000 -c:a pcm_s16le log/c.asr.wav
# primary engine (not installed here; flags from media-use, VERIFIED reading, UNVERIFIED running)
parakeet-mlx log/c.asr.wav --model mlx-community/parakeet-tdt-0.6b-v3 --output-format json --output-dir log/asr/
# fallback: whisper.cpp; optional hosted verbatim engine: ElevenLabs Scribe (opt-in, key, audio leaves the machine)

# silences / speech energy
ffmpeg -hide_banner -i master/c.mov -af silencedetect=noise=-35dB:d=0.25 -vn -f null - 2>&1 | grep -E "silence_(start|end)"
ffmpeg -hide_banner -i master/c.mov -af silencedetect=noise=-35dB:d=0.12 -vn -f null - 2>&1 | grep -E "silence_(start|end)"   # for unaccounted_speech
# scene cuts (prints lavfi.scd.score / lavfi.scd.time)
ffmpeg -hide_banner -i master/c.mov -vf "scdet=threshold=10:sc_pass=0" -an -f null - 2>&1 | grep -i scd
# exposure + sharpness + freeze/black
ffmpeg -hide_banner -i master/c.mov -vf "signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-" -an -f null - 2>/dev/null | grep YAVG
ffmpeg -hide_banner -i master/c.mov -vf "blurdetect=block_pct=80,metadata=print:key=lavfi.blur:file=-" -an -f null - 2>/dev/null | grep lavfi.blur
ffmpeg -hide_banner -i master/c.mov -vf "freezedetect=n=-60dB:d=0.5,blackdetect=d=0.2:pix_th=0.1" -an -f null - 2>&1 | grep -E "freeze_|black_"
# loudness of the raw master (for the log)
ffmpeg -hide_banner -nostats -i master/c.mov -vn -af "ebur128=peak=true:framelog=quiet" -f null - 2>&1 | sed -n '/Summary/,$p'
```

All of the above ran on the normalized fixture (MEASURED): `scdet` fires on the synthetic flashes (score 85.5 at 0.5, 1.5, 2.0 s), so on real footage treat scene cuts as candidates only; `blurdetect` output looked like `lavfi.blur=9.53`; `silencedetect` printed nothing on a continuously noisy clip. Parakeet and whisper.cpp could not be run here, so the ASR JSON shapes are as read from media-use code, not observed. Parakeet's token timestamps are likely coarse (about 80 ms steps for a transducer encoder, INFERRED, UNVERIFIED), which our 50/100 ms pads and 20 ms guard are chosen to survive; embedded-captions' own comment says WhisperX forced alignment gives "far tighter" word timings than whisper.cpp (SAID in code). If boundary errors show in QA, add a v2 step that moves each cut to the lowest-RMS frame within +/-40 ms.

### 4.8 Concat (cut), loudnorm, final encode

**Cut: one pass, frame- and sample-integer** (generator in 4.4 writes `cut.fc`):

```bash
ffmpeg -hide_banner -y -i master/c001.mov -i master/c004.mov \
  -filter_complex_script build/v03/cut.fc -map "[v]" -map "[a]" \
  -c:v libx264 -preset fast -crf 12 -pix_fmt yuv420p -r 30 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a pcm_s16le -ar 48000 build/v03/cut.mov
```

`cut.fc` has one `[n:v]trim=start_frame=F0:end_frame=F1,setpts=PTS-STARTPTS[v_i];` and one `[n:a]atrim=start_sample=…:end_sample=…,asetpts=PTS-STARTPTS,afade…[a_i];` per segment, then `concat=n=K:v=1:a=1[v][a]`. Cutaways: after concat, overlay the cutaway clip trimmed and PTS-shifted (video-use rule 4): `[c]trim=start_frame=…:end_frame=…,setpts=PTS-STARTPTS+T/TB[cw];[v][cw]overlay=enable='between(t,T0,T1)'[v2]`. The voice track is untouched, so a cutaway is an L/J-cut by construction.

**Captions: after the cut, last in the video chain** (4.10), then:

**Loudnorm (two-pass with limiter fallback; verified end to end on a test clip):**

```bash
# pass 1: measure the stereo mix of the cut (mono sources are duplicated to stereo first; a mono file reads 3 dB low, herk)
ffmpeg -hide_banner -nostats -i build/v03/captioned.mov -vn -af "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p' > build/v03/ln1.json
# pass 2, case A: headroom exists (input_tp + (-14 - input_i) <= -1.5): pure linear gain
ffmpeg -y -i build/v03/captioned.mov -c:v copy -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=…:measured_TP=…:measured_LRA=…:measured_thresh=…:offset=…:linear=true,aresample=48000" -c:a aac -b:a 192k -ar 48000 -movflags +faststart build/v03/final.mp4
# pass 2, case B: no headroom: explicit gain then limiter (reached -14.1 LUFS where both loudnorm modes stopped at -15.0)
ffmpeg -y -i build/v03/captioned.mov -c:v copy -af "volume=<-14 - input_i>dB,alimiter=limit=-1.5dB:level=false,aresample=48000" -c:a aac -b:a 192k -ar 48000 -movflags +faststart build/v03/final.mp4
# verify the ENCODED file
ffmpeg -hide_banner -nostats -i build/v03/final.mp4 -vn -af "ebur128=peak=true:framelog=quiet" -f null - 2>&1 | sed -n '/Summary/,$p'
```

Pass criteria: integrated within +/-1.0 LU of -14 and true peak <= -1.0 dBTP (aim -1.5; AAC overshoots, MEASURED -1.4 dBFS after the limiter case). Do not normalise near-silence: if `integrated_lufs < -40` skip and flag (ffmpeg-skill). Warn if the limiter applies more than 3 dB of gain. The -14 target is from three repos plus the platform table (SAID); TikTok's own loudness handling was not checked (UNVERIFIED).

**Final video encode:** the captioned composite is the third and last video encode: `-c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart`. Bitrate ceiling not set; TikTok accepts h264/hevc, 1080x1920, 30 fps (ffmpeg-skill table, SAID).

### 4.9 Judge material: contact sheet, cut strips, safe-zone overlay, frame identity

All of these ran here (MEASURED) with no `drawtext`; timestamps go in a sidecar JSON instead of burning them in.

```bash
# 4x3 contact sheet, 12 evenly spaced frames; K = nb_frames // 12; sidecar maps tile i -> time i*K/30
ffmpeg -y -i build/v03/final.mp4 -vf "select='not(mod(n\,K))',scale=270:-2,tile=4x3:padding=4:margin=4:color=0x202020" -frames:v 1 -fps_mode passthrough qa/v03/sheet.png
# strip across a cut at output frame F (10 frames: F-5 .. F+4), one per boundary from edl.json
ffmpeg -y -i build/v03/cut.mov -vf "select='between(n\,F-5\,F+4)',scale=144:-2,tile=10x1:padding=2:margin=2:color=0x202020" -frames:v 1 -fps_mode passthrough qa/v03/strips/cut_03.png
# first 2.5 s every 3rd frame (25 frames), where herk says the viewer decides: nothing over the mouth
ffmpeg -y -i build/v03/final.mp4 -t 2.5 -vf "select='not(mod(n\,3))',scale=216:-2,tile=5x5:padding=2:margin=2:color=0x202020" -frames:v 1 -fps_mode passthrough qa/v03/first25.png
# safe-zone overlay on one frame (TikTok fractions: top .10, bottom .22, left .05, right .14)
ffmpeg -y -ss 1 -i build/v03/final.mp4 -frames:v 1 -vf "drawbox=x=0:y=0:w=iw:h=ih*0.10:color=red@0.35:t=fill,drawbox=x=0:y=ih*0.78:w=iw:h=ih*0.22:color=red@0.35:t=fill,drawbox=x=iw*0.86:y=0:w=iw*0.14:h=ih:color=red@0.35:t=fill,drawbox=x=0:y=0:w=iw*0.05:h=ih:color=red@0.35:t=fill,scale=360:-2" qa/v03/safe.png
# frame identity (lip-sync proxy): out frame OUT must equal master frame SRC (from edl.json); SSIM ~1.0 expected
ffmpeg -i build/v03/cut.mov -i master/c001.mov -filter_complex "[0:v]select='eq(n\,OUT)',setpts=N/TB[a];[1:v]select='eq(n\,SRC)',setpts=N/TB[b];[a][b]ssim" -f null -
```

Sizes measured: sheet 1100x1456 for a 4x3 of 270 px tiles; strip 1462x260 for ten 144 px tiles. The frame-identity check returned SSIM 1.000 for correct pairs and 0.424 for an off-by-one pair on the flash fixture; on real moving footage an off-by-one is much less separable, so use it as a regression gate on the first and last frame of every segment, not as a proof of sync. Claude's API takes images only (Lane B S2), so the judge reads these PNGs plus `report.json`, never the video.

### 4.10 Captions on a 9:16 clip

**A. Our own renderer (recommended v1, needs only ffmpeg and Pillow).** Chunking: 1-3 words per cue, close a cue on trailing punctuation or a gap >= 0.3 s, grow a cue under 0.35 s (video-use `chunk_words`); show 2 frames before the first word (herk); hard swap. Render each cue to a transparent 1080x1920 RGBA PNG with Pillow (rounded dark box with a thin light edge, uppercase, bold sans), then build one alpha track and overlay it last:

```bash
# list.txt is an ffconcat file: file X.png / duration D lines, blank.png between cues, last file repeated once
ffmpeg -y -f concat -safe 0 -i caps/list.txt -vf "fps=30,format=yuva444p10le" -c:v prores_ks -profile:v 4444 -t <total_s> caps/captions_alpha.mov
ffmpeg -y -i build/v03/cut.mov -i caps/captions_alpha.mov -filter_complex "[0:v][1:v]overlay=0:0:eof_action=pass[v]" -map "[v]" -map 0:a -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy build/v03/captioned.mov
```

I tested the ffmpeg half on synthetic input: a 90-frame alpha mov built from two RGBA PNGs and a blank, overlaid on a cut clip; luma at the caption box was 0 at 0.2 s, 231 at 0.8 s, 204 at 1.8 s and 0 at 2.8 s, as designed (MEASURED). I did not test Pillow text rendering (Pillow is not installed here), fonts, or the contrast check. Pitfall found in testing: `drawbox` on a fully transparent RGBA canvas leaves alpha 0; build the transparent canvas with `pad=…:color=0x00000000` instead (Pillow does not have this problem).

**B. `embedded-captions` with the `anchor` identity (optional, needs a HyperFrames checkout; UNVERIFIED end to end).** Because the skill refuses hard-cut sources and always mattes the subject, use it per continuous shot only if we want its styles; for jump-cut affiliate edits our renderer in A is the safer v1. If she still wants it, the exact sequence for a 9:16 clip:

```bash
export HYPERFRAMES_ROOT=~/Developer/hyperframes        # git clone https://github.com/heygen-com/hyperframes ; cd it ; bun install && bun run build
SK=~/.claude/skills/embedded-captions ; P=work/<shoot>/build/v03/caps ; mkdir -p "$P"
cp build/v03/cut.mov "$P/source.mp4"                    # the CUT video (it carries the retimed audio), not the master
# our script writes $P/transcript.json = { "text":…, "language_code":"en", "words":[{"text","start","end","type":"word"}] } from words.out.json  -> transcribe.cjs sees it and skips ASR
node "$HYPERFRAMES_ROOT/packages/cli/dist/cli.js" init "$P" --non-interactive --video "$P/source.mp4"   # per SKILL.md step 1; skip if the dir already holds the video
bash "$SK/scripts/prepare.sh" "$P"                      # matte + envelope + safe-zones (matte is wasted work for rail-only; first run downloads ~168 MB, model load 1-2 min, SAID in matte.cjs comments)
# fork the DNA: cp "$SK/themes/anchor.json" "$SK/themes/anchor-vertical.json"; set body.fontPx 64, body.bottomPx 560, plate {dim:0, pushIn:0, grain:0}; set "name":"anchor-vertical"
# write $P/theme.json:
#   {"dna":"anchor-vertical","width":1080,"height":1920,"lines":[["FIRST","THREE"],["WORDS"],…],"hero":{"match":"<one word>"}}
bash "$SK/scripts/render-theme.sh" "$P"                 # -> $P/final_fx.mp4 (deliverable; final.mp4 is pre plate reaction)
node "$SK/scripts/preview-frames.cjs" "$P"              # QA BEFORE the render; sheet at $P/preview/sheet.png
```

Notes: `lines` must cover the transcript verbatim in order (compile-time gate) so our script generates them from `words.out.json`; the rail is single-line `nowrap`, so keep each line to about 20 characters at 64 px (INFERRED from 778 px safe width and about 0.55 em per glyph); whether `hero` is optional is UNVERIFIED; first-run behaviour with the dna fork is UNVERIFIED. `bottomPx 560` puts the rail top at y=1360 and its bottom near y=1424, inside the safe box below.

### 4.11 Caption and text safe zone (1080x1920) and style defaults

Sources (pixel values computed from the stated fractions):

| Source | Top | Bottom | Left | Right |
|---|---|---|---|---|
| ffmpeg-skill, TikTok | 10 percent (192 px) | 22 percent (422 px, y >= 1498) | 5 percent (54 px) | 14 percent (151 px, x >= 929) |
| ecommerce-video-skills | 9 percent (172 px) | y >= 1498 | 70 px margin | x >= 918 for y 672-1536 |
| herk short-form-edit | y 200 | y 1600 | x 90 | x 930 |
| video-use caption baseline | n/a | about 600 px up (MarginV 90 at PlayResY 288, INFERRED) | n/a | n/a |

**Our box: x 151-929 (centred text, so half-width 389, max 778 px), y 200-1498.** Caption centre near y = 1380 by default; the vision pass may move it up in 5 percent steps when it would cover a mouth, a product, or on-screen text (herk: never over the mouth or chin; in a talking head put it on the chest, not the jaw). Font about 72 px bold uppercase (ecommerce 71 px, herk 62-64 px, video-use about 120 px by the libass scaling; I pick 72 and let the judge test legibility at phone size). Colour accents on 25-45 percent of cues, whole cue only, at most one serif accent in a row (herk numbers, SAID). A deterministic gate: the renderer writes each cue's bounding box to `caps/boxes.json`, and the QA script fails any box outside the safe rectangle without needing a vision model. All of these are empirical; all three sources say to verify on a real phone, so QA includes one screenshot from her actual phone per new style.

### 4.12 QA report and the judge (outside the maker)

`qa/<variant>/report.json` is written by `scripts/qa.py`, not by the cut-writing agent; gate edits are flagged and audited (global rule). Checks, with pass criteria:

| Gate | Method | Pass |
|---|---|---|
| spec | `ffprobe` on `final.mp4` | 1080x1920, 30/1, yuv420p, bt709 tags, h264, AAC 48k stereo, `+faststart` |
| duration | `edl.json total_frames/30` vs video and audio stream duration | within 1 frame |
| frame identity | 4.9 SSIM on first and last frame of every segment | >= 0.95 |
| no mid-word cut | compiler warnings; `TIGHT_*` only with `allow_tight` | zero unexplained |
| words whole | run ASR on `final.mp4`, diff against `words.out.json` | every kept word present at every cut (herk: a transcript alone is not proof, so also listen or sample) |
| loudness | `ebur128` on encoded file | I within +/-1 of -14, TP <= -1.0 |
| captions | `boxes.json` inside safe rectangle; contrast of pixels behind each box | no violation; never white on light |
| first 2.5 s | `first25.png` for the vision judge | nothing over the mouth; first frame meaningful |
| cuts | `strips/*.png` for the vision judge | no flash, black frame, or jump unexplained |
| claims | judge reads `plan/product.json` banned claims against `words.out.json` | no banned or unverified claim |

The vision judge is a separate agent with a rubric and these PNGs; it does not see the cut-list reasoning. Failing after three fix rounds stops and goes to the human. Negative controls to keep in `tests/`: a caption shifted 0.3 s, a cut one frame off, a dropped word, a caption outside the safe box, and a mid-word index must each fail (herk's discipline).

### 4.13 Feedback to rule loop for her setup (from herk, mapped onto this hub)

Each human note becomes four artefacts in one change: (1) the fix, (2) a one-line rule in `rules/editing.md`, (3) a check or constant in `scripts/qa.py` or `compile_cutlist.py`, (4) a negative-control test. The existing `/note` skill is the intake (parks a note, applies nothing until told); the loop's value comes from requiring the check and the negative control, not just prose. Record note and rule together (herk). Keep the rule file short enough to read first every run.

---

## 5. What I ran (evidence) and what I could not

MEASURED here, all in a scratch directory, nothing from the cloned repos executed:
- Filter inventory and absence of `zscale`, `libplacebo`, `drawtext`, `subtitles`, `ass` on ffmpeg 8.1.1.
- Real iPhone clip probe: HEVC Main 10, HLG/BT.2020, 3840x2160, `rotation=-90`, `r_frame_rate 30/1`, `avg_frame_rate 54025/1801`, 7 streams (1 video, 1 audio, 5 data).
- HLG to SDR LUT chain vs an independent Python calculation on a 10-step gray ramp: within 1 code value everywhere. Generated chain string from `hlg_to_sdr_vf()` re-tested and identical in output.
- Real-clip normalize: output 1080x1920, 30/1, bt709 tags, 63 frames, PCM 48 kHz.
- Single-pass `trim/atrim + concat` on a synthetic flash+beep clip: flashes at output 0.5, 1.5, 2.0, 3.0, 4.0, 5.5 s (expected same); beep onsets within 0.6 ms; 180 frames and 288000 samples exactly. Reference compiler run on synthetic words: 3 segments, 94 frames, a `TIGHT_HEAD` warning raised for a 0.150 s gap as designed.
- Loudnorm two-pass and the limiter fallback; ebur128 verification of the encoded AAC.
- Contact sheet, cut strip, safe-zone overlay, SSIM frame identity, scdet, silencedetect, signalstats, blurdetect, freezedetect/blackdetect commands run without error.
- Alpha PNG track overlay behaviour on synthetic input.

NOT run or UNVERIFIED: Parakeet and whisper.cpp (not installed; JSON shape from code only); whether Parakeet keeps "um/uh"; real-face tone-map match vs Apple's rendering; Pillow caption text; embedded-captions end to end (no HyperFrames checkout, no bun); `ffmpeg-full` filter presence; iPhone SDR menu wording; TikTok's real UI overlay pixels; TikTok's own loudness handling; all pacing and style numbers are the source authors' (SAID) and none were tested against sales.

---

## 6. Risks and gaps to log (not shrinking scope, just recorded)

1. Compliance research gap: FTC disclosure and TikTok Shop content policy were not part of this hop; the ecommerce repo's compliance list is for Chinese ad law. Needs its own lane.
2. Hosted ASR (Scribe) would give verbatim fillers and tighter alignment but sends her voice and product footage to a third party; keep opt-in.
3. The `anchor` rail and any `embedded-captions` identity are third-party, unlicensed-in-directory skills (no LICENSE file); the MIT repo must not vendor them, only document the invocation.
4. The 12 variants-per-shoot goal multiplies encodes; at crf 12 intermediates, disk use per clip is large (not measured); add cleanup of `build/` after QA passes.
5. `lutrgb` per-channel OOTF slightly oversaturates compared with the true luminance-based OOTF (INFERRED). A real-face side-by-side is the one human check this spec needs.
6. The jump-cut `zoom` option is soft because masters are 1080 wide; a 4K-sourced punch-in would be sharper but needs the normalize step to keep a 2160-wide master (not specced).

---

## 7. Drift check

Drift check: depth 2, vision 2, truth 2, complete 2, specific 2, focus 2, craft 2. Remaining gaps I could not fix and have labelled in the text: Parakeet/whisper.cpp not installed so ASR shapes and filler behaviour are UNVERIFIED; no HyperFrames checkout so the `anchor` command sequence is UNVERIFIED end to end; the tone-map look vs Apple on real skin is UNVERIFIED; compliance (FTC/TikTok Shop) was out of scope and is logged as a gap.
