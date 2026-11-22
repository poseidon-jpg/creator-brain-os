# Your thumbnail library

Every thumbnail the user shipped, liked or rejected, so each new set starts from proof instead of a guess. Read the entries whose layout fits the video before planning a set.

Keep it lean. When a layout has more than 3 or 4 entries, keep the strongest and remove the rest. Images live in the `library/` folder beside SKILL.md.

## Setup

Filled on the first run.

- **Image model**: (empty) the model name, how your agent calls it, and the price per image if it has one. If your agent has no image model yet, connect one that accepts reference images and can edit an existing image, then write it here. Until the user picks one, the skill still plans the set and writes every brief; only generation waits.
- **Your face on thumbnails**: (empty) yes or no. If yes, the path to 2 or 3 real photos of the user to pass as references.
- **Brand marks**: (empty) logos or mascots that should appear, with their file paths and exact colours.
- **Fonts**: (empty) the fonts you use, and a path to an image of each, because an image model draws a font far better from a picture than from its name.

## Layouts

A layout is a reusable composition, like "face on the left pointing at a screenshot on the right" or "before and after, red X and green check". Name each one as it appears in the library, with a one-line description. Entries below point to these names.

- (empty)

## Entries

Copy this block, one per thumbnail:

```
### <video title>

- Image: <the filename the script saved in library/, or a link>
- Video: <link, if there is one>
- Layout: <layout name from the list above>
- Status: shipped | liked | reference from another channel
- Text on it: "<the exact words>"
- Why it worked: <one or two lines: what reads first, why someone would click>
```

(empty)

## Rejected

Thumbnails the user turned down, with their reason in their own words. These teach as much as the winners.

```
### <short label>

- Image: <path>
- Why rejected: "<the user's words>"
- Principle it changed: <the line in SKILL.md this updated>
```

(empty)
