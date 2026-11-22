# Aurora Glassmorphism - build notes


- Story: a "What's new in 5.5?" chat card answers "Faster than Opus 5.5. At half the price." Speed counts to 139 tokens/s (Opus 5.5: 92). Price slides from Opus 5.5's $4 / $20 to Sonnet's $2 / $10 with a liquid-glass knob. A glass lens sweeps the answer, the cards fold into a glass orb, and the orb lands as the o of "Sonnet" with a glass 5.5 tag and "Faster. Half the price."
- Facts used (Artificial Analysis, 30 Sep 2026): $2 / $10 vs $4 / $20, 139 vs 92 tokens/s. The Intelligence Index (56 vs 58) is left out on purpose.
- Render: `python3 record.py` (hidden Chrome, frames read from the WebGL buffer, piped to ffmpeg, BT.709 tagged, crf 14). `sink.js` is the frame receiver. Fonts (Inter, Outfit) are local in `assets/`.
- Left out: the original's toggle and chip content (replaced by the price slider and result chips), and the Chinese tagline line.
