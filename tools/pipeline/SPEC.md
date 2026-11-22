# Pipeline reference (short)

The *why* for every number below is in `research/deep-hop-pipeline-spec.md` (section numbers in brackets). Reject codes are
`studio/RUBRIC.md`'s. Run everything from the repo root: `python3 tools/pipeline/pipeline.py <cmd>`. Needs `ffmpeg`/`ffprobe`
plus Pillow (`bash tools/pipeline/setup.sh` makes `tools/pipeline/.venv`; `pipeline.py` re-executes itself in it).

## Commands

| Command | Does | Writes |
|---|---|---|
| `new <batch> --product <slug>` | scaffold; prefill product facts from `shop/products/<slug>/brief.md` | `studio/projects/<batch>/{raw,master,log,plan,cuts,build,qa}/`, `plan/product.json` |
| `ingest <batch> [--from studio/inbox]` | **move** clips inbox to `raw/`, probe, normalize, gate-check [4.5, 4.6] | `master/cNNN.mov`, `log/cNNN.probe.json`, `log/cNNN.clip.json` (source + master), `log/ingest.json` |
| `analyze <batch> [--force]` | transcript, silences, unaccounted speech, retakes, scene cuts, quality, thumbs [4.1, 4.2, 4.7] | `log/cNNN.clip.json` (full), `log/packed.md`, `log/thumbs/` |
| `compile <batch> <variant> [--reset-attempts]` | `cuts/<variant>.cutlist.json` to a frame/sample-exact plan [4.3, 4.4] | `build/<variant>/{edl.json,cut.fc,words.out.json}` |
| `render <batch> <variant> [--caption-y N]` | single-pass cut, captions, loudness, final + clean [4.8, 4.10] | `build/<variant>/{cut.mov,caps/,audio.m4a,final.mp4,clean.mp4,render.json}` |
| `qa <batch> <variant>` | every gate that needs no vision model + judge material [4.9, 4.12] | `qa/<variant>/{report.json,sheet.png,sheet.json,strips/,first25.png,safe.png}` |
| `similarity <batch>` | footage overlap per pair of variants; over 0.60 = `near-duplicate` | `qa/similarity.json` |
| `deliver <batch>` | copy variants that passed QA **and** have a judge pass | `studio/ready/<batch>/<v>.mp4`, `<v>.clean.mp4`, `<v>.caption.txt`, `POSTING-CHECKLIST.md` |
| `status <batch>` | one-screen summary | nothing |

Exit codes: 0 ok, 1 gate/compile failure, 2 usage/environment error, 3 no transcriber and no `words.json`, 4 compile refused after 3 failed repair rounds.
`ingest` and `qa` exit nonzero on any hard problem.

## Folder layout (per batch)

```
studio/projects/<batch>/
  raw/        untouched originals (moved here once, never written again)
  master/     cNNN.mov   1080x1920, 30 fps CFR, yuv420p, BT.709 tv, h264 crf12, PCM 48 kHz stereo
  log/        cNNN.clip.json  cNNN.probe.json  cNNN.words.json (optional manual transcript)  packed.md  ingest.json  thumbs/
  plan/       product.json (facts, banned claims, caption/hashtags, duration range, human approval)
  cuts/       <variant>.cutlist.json   written by the model (or a person)
  build/<v>/  edl.json cut.fc words.out.json attempts.json cut.mov caps/ audio.m4a final.mp4 clean.mp4 render.json
  qa/<v>/     report.json  judge.json (written by the judge, not the maker)  sheet.png  strips/  first25.png  safe.png
  qa/similarity.json
```

## Schemas

- **clip-log/1** (`log/<clip>.clip.json`) [4.1]: `source`, `master` (`usable_duration_s = min(video, audio)`, `hdr_detected`, `tonemap`), `audio`, `transcript.words[] {i,text,norm,start,end,type,conf}`, `phrases` (break at gap >= 0.5 s), `silences` (-35 dB, 0.25 s), `unaccounted_speech`, `retake_groups` (token Jaccard >= 0.6, candidates only), `scene_cuts`, `quality`, `thumbs`, `labels` (vision pass fills later).
- **Transcript input**: `log/<clip>.words.json` = `{"words":[{"text","start","end"}]}` is used instead of an engine (manual transcripts, tests; an empty list means "no speech"). Engines tried otherwise: `parakeet-mlx`, then `whisper-cli` + a ggml model. Cache key = master hash + words.json hash.
- **cutlist/1** [4.3]: `{schema, variant_id, target{duration_s:[min,max]}, profile?, segments[], captions{style, emphasis_words}, caption?{text,hashtags}}`.
  - speech segment: `{clip, first_word, last_word, beat, quote, reason, allow_tight?, zoom?, removed_words?, cutaway?{clip,t_in,t_out,from_word,to_word}}`
  - non-speech segment: `{clip, t_in, t_out, beat, audio: "mute"|"keep"}`
  - `emphasis_words`: `"c001:31"` (clip:word index) or a plain int (index `n` in `words.out.json`).
- **edl/1** [4.4 step 8]: `inputs[]`, `segments[] {clip, src_in_frame, src_out_frame (exclusive), out_in_frame, out_out_frame, fade_in_s, fade_out_s, warnings, beat, allow_tight}`, `cutaways[]`, `total_frames`, `beats[]`, `warnings`.
- **words-out/1**: every word fully inside a kept range: `{n, clip, i, text, norm, out_start, out_end, source_start, source_end, seg}`.
- **qa-report/1**: `passed`, `hard_fails[{gate,code,detail}]`, `warnings`, `checks[{gate,code,status: pass|warn|fail,detail}]`, `hashes`, `artifacts`, `not_run[]`.
- **judge.json** (written by the judge agent, required by `deliver`): `{"verdict":"pass"|"fail","judge":"...","report_sha256"?: "...", "scores"?:{...}}`.

## The 7 compiler rules (all are errors) [4.3]
1. Speech segments are addressed by word index only; indices valid inside the clip (`t_in/t_out` on a speech segment is an error).
2. `quote` must equal the words `first..last` after `norm` (lowercase, edge punctuation stripped).
3. A segment is contiguous speech: it may not span `removed_words`, and word lists / skips are rejected. Same-clip neighbours closer than 2 frames are merged.
4. A `cutaway` is anchored to words of its speech segment; its source window must cover the output window.
5. Non-speech segments use `{clip,t_in,t_out,audio}`.
6. `beat` in HOOK, PROBLEM, SOLUTION, PROOF, CTA. Warnings if HOOK ends after 3.5 s or CTA lasts under 3 s (SAID by the ecommerce repo, not measured by us).
7. Three rejected compiles of one variant stop the work (`build/<v>/attempts.json`); a person runs `--reset-attempts`.

## Constants [4.4, 4.8, 4.11]

| Name | Value |
|---|---|
| Master grid | 1080x1920, 30 fps, 48 kHz, 1600 samples per frame |
| Pads | in 0.050 s, out 0.100 s, guard 0.020 s (profiles `fast` 0.03/0.08, `calm` 0.08/0.15) |
| Gap classes | clean >= 0.40 s, ok 0.15-0.40 s, tight < 0.15 s (`TIGHT_HEAD/TAIL`, error unless `allow_tight` + `reason`) |
| Min segment | 0.20 s; fade 30 ms each side (clamped to segment/4 and to the pad, so a word is never faded) |
| Encodes | master crf12 (ingest), `cut.mov` crf12, final crf18 `slow` (final.mp4 + clean.mp4 in one run; `PIPELINE_FINAL_PRESET` overrides, tests use `veryfast`) |
| Loudness | target -14 LUFS, TP aim -1.5, QA: warn beyond +/-1.0, fail beyond +/-1.5 (RUBRIC) or TP > -1.0; near-silence (< -40 LUFS) is not normalized |
| Audio | measure with loudnorm, then linear loudnorm if headroom exists, else `volume` + `alimiter`; verified on the encoded AAC, repaired up to 2 times |
| Cues | 1-3 words (default 2), close on `. , ; : ! ?` or gap >= 0.3 s or a segment change, grow to 3 if shorter than 0.35 s; appear 2 frames early; hard swap |
| Caption look | uppercase bold system font (Arial Bold, then Helvetica, DejaVu; `PIPELINE_CAPTION_FONT` overrides), 72 px (shrinks to 44, then wraps to 2 lines), dark rounded box + thin light edge, accent colour on emphasis cues |

## Safe zone (1080x1920) [4.11, RUBRIC R9]

Caption box must sit inside **x 151-929, y 200-1498**; default caption centre **y 1380**. Judge overlay (`safe.png`) shades top 10 %, bottom 22 %, left 5 %, right 14 % (ffmpeg-skill fractions). All values are empirical guesses: check one frame on a real phone for each new style.

## QA gates and reject codes

| Gate (in `report.json`) | Check | RUBRIC code |
|---|---|---|
| `spec:*:res / :container` | 1080x1920, h264, +faststart (container problems map here, closest hard-spec code) | `spec-res` |
| `spec:*:fps` | 30/1 constant | `spec-fps` |
| `spec:*:color` | yuv420p, BT.709 tags, tv range | `spec-color` |
| `spec:*:audio`, `loudness:*` | AAC 48k stereo; -14 LUFS, TP <= -1.0 | `spec-audio` |
| `duration:*` | video and audio within 1 frame of the EDL; length inside the plan/cutlist range | `spec-length` |
| `frame-identity` | out frame equals its master frame (SSIM >= 0.95) at both edges of every segment and cutaway | `mid-word` (nearest code: the cut is not where the EDL says) |
| `mid-word`, `tight-cuts` | no cut inside a word; no `TIGHT_*` without `allow_tight` | `mid-word` |
| `words-whole`, `captions-match-words`, `caption-timing-meta`, `caption-pixel-timing` | words.out equals EDL + clip log; caption text equals transcript; cue timing; final vs clean pixels ON/OFF inside the box | `caption-wrong` |
| `caption-safe-zone` | every box inside the safe rectangle | `safe-zone` |
| `caption-contrast` | text vs background behind the box >= 3:1 | `caption-unreadable` |
| `banned-claims`, `disclaimer`, `ai-disclosure`, `music` | RUBRIC default patterns + `plan/product.json` terms; time-bound/before-after needs "results may vary" | `banned-claim`, `no-disclaimer`, `ai-undisclosed`, `music-license` |
| `no-master` (spec:clean) | `clean.mp4` exists and passes the same spec | `no-master` |
| `near-duplicate` | footage overlap > 0.60 with an earlier-named sibling (`similarity.json`) | `near-duplicate` |
| `dead-air` | pause over 0.4 s inside a segment (warn only) | `dead-air` |

Not run here (needs a vision model or a transcriber): ASR diff on `final.mp4`, first 2.5 s, cut strips, hook/CTA structure, product visibility, caption vs mouth overlap. The judge reads `sheet.png`, `strips/`, `first25.png`, `safe.png` and `report.json`.

## Known limits (see the research spec, section 5 and 6)
- Real transcription (Parakeet / whisper.cpp) is unverified; word-level timing precision of those engines is unmeasured.
- HLG tone-map look against Apple's own rendering of skin is unverified; film SDR when possible. PQ clips are blocked unless `zscale` exists.
- Everything is tested on synthetic clips; real iPhone footage has not been run.
