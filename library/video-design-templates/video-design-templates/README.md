# Video Design Templates

![Video Design Templates](assets/banner.png)

Ten motion styles your agent can build videos in. Each one is a finished 5 second, 1080p animation made as a web page, with a style spec your agent reads first. Ask for a video about anything, in any of the ten looks, and your agent builds it and renders an MP4 on your own computer. No AI video model is involved.

## What is in the zip

- `skills/video-design-templates/` - the whole kit as one folder your agent can use:
  - `SKILL.md` - the instructions your agent follows
  - `index.html` - the library: open it to watch all ten styles
  - `templates/` - ten folders, one per style, each with the animation page, a style spec (`DESIGN.md`), build notes, a preview clip and a thumbnail
  - `tools/record.py` - turns any template, or your own page, into an MP4
- `LICENSE.txt` - members only

## Set it up (your agent does this)

1. Copy the folder `skills/video-design-templates/` into your agent's skills folder, so your agent can find `SKILL.md`. If your agent has no skills folder, keep the folder anywhere and tell your agent its path.
2. Install the recorder's tools once: Python 3, then `pip install playwright` and `playwright install chromium`. Install ffmpeg and make sure it is on your PATH.
3. Open `skills/video-design-templates/index.html` in your browser to see the ten styles.

Then ask your agent something like:

> Use the video design templates. Make me a 5 second animation about [your topic] in the Isometric style, and show me the frames before you render.

## The ten styles

- **01 Frame by Frame** - A match scrapes the Sonnet matchbox in the dark, a little flame hops off, dances, spins and bursts into a red Sonnet 5.5 stamp that a spark writes by hand.
- **02 Isometric 2.5D** - A navy seed drops onto a blueprint grid, a clay city builds itself tile by tile, bursts into colour with three stat cards for Sonnet 5.5, then signs its name on the floor.
- **03 Flat Vector** - One coral dot bounces into the sun over a pop-up city, dives into a lit window where a ping arrives, snaps into four fact panels, then lands as the o of Sonnet 5.5.
- **04 Line Art** - One gold line grows from a seed into a city, loops up into a golden moon with an S, and signs off as Sonnet 5.5 while the city's doorways light up.
- **05 3D Render** - Puffy pink balloon letters spell Sonnet onto a carpet of glossy peach beads, a chrome ball smashes in as the full stop and a lavender wave flips the whole carpet before SONNET 5.5 lands.
- **06 Shape Morph** - One shape keeps becoming the next, an ink drop, a pen nib, a half-filled coin and a paper plane, until it lands as the Sonnet wordmark with a coral dot.
- **09 Collage / Cut-out** - A halftone gentleman has his head snipped open, a book of verse, a stopwatch and a rocket burst out, a ransom-note band spells SONNET 5.5, then the red circle floods the frame into a magazine cover.
- **10 Aurora Glassmorphism** - Frosted glass cards over a flowing aurora show Sonnet 5.5 beating Opus 5.5 on speed and price, then fold into a glass orb that becomes the o of the Sonnet wordmark.
- **11 Geometric Bauhaus** - A Bauhaus poster for Sonnet 5.5 snaps together on a 120 BPM grid, swings 90 degrees about a dot, bursts into tiles, shows its three numbers on a black plate and lands as a vertical SONNET poster.
- **14 Liquid Motion** - A glossy drop falls with a flipped Sonnet inside it, splashes, stretches into seven taffy beads and flows into the jelly word Sonnet 5.5.

## Make your own look

A template is a plain web page. Your agent changes the words, the colors and the beats, checks frames, and renders. The page contract is three lines (`window.DURATION`, `window.renderAt(t)`, optional `window.ready`), so you can also point `tools/record.py` at any page of your own that follows it.

## Credit

The ten looks come from Vincent Wei's motion style showcase: https://x.com/VincentWei93/status/2104957548797604116. These are fresh remakes about a model release, not his clips.

## License

Members only. See `LICENSE.txt`.
