# Line Art - build notes


- A single gold line enters from the left, sprouts a seedling, runs through a skyline, curls up and closes as a moon. The moon fills with gold from the point where the pen stops, the city's doorways and stars light up, and SONNET / 5.5 settle in. Silent, 1920x1080, 30 fps, 5.0 s.
- Built in `index.html` (canvas 2D, `renderAt(t)` contract). One SVG path is sampled once and drawn by arc length. Tip speed is keyed per segment: slow sprout, fast city, whip around the moon.
- Left out: no facts or numbers about Sonnet 5.5 (price, speed, score), no audio, no generated images. Cost: 0 USD.
- Re-render: `python3 record.py` (about 2 to 3 minutes). Stills: `python3 record.py --stills 1.0,2.7,4.6`.
