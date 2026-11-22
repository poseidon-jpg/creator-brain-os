# Making thumbnails

How a set gets planned, generated and handed over. What each thumbnail should say comes from the principles in SKILL.md and the library; this file is the method.

## Contents
- The set, step by step
- Layout thinking: a layout plus fields
- Briefing your image model
- Before every generation
- Fixing a miss
- Reference locks
- A new style from a reference image
- The user's face
- Handing over

## The set, step by step

```text
Thumbnail set progress:
- [ ] 1 Layouts picked from the library
- [ ] 2 Wildcards sketched
- [ ] 3 Generated, every result looked at
- [ ] 4 Handed over with paths and prompts
```

1. **Layouts from the library.** Pick 2 or 3 layouts from `library.md` whose entries fit this video. Name the layout on every concept.
2. **Wildcards.** Add 2 to 4 concepts that use a composition no library layout covers, each different from the others. The idea is free; the look stays within the user's principles. Wildcards are how new winning layouts get found.
3. **Generate and look.** Make each concept once. Then look at every result at phone size for the idea, spelling, likeness and anything odd before showing it. A miss gets one small fix (below), not a new concept.
4. **Hand over** (last section).

Every concept in a set is a different shot, never two versions of one thumbnail. Different shots give the best odds that one is right first time, and the user can tweak a near-miss by hand faster than the agent can regenerate it.

A sensible default is 6 to 10 images. If your image model charges per image, say the count and the estimated cost before generating.

## Layout thinking: a layout plus fields

Treat each layout as a fixed template with a few blanks, not a fresh prompt every time. A layout is:

- **Zones**: where each element sits ("left third: the host pointing right; right two thirds: one screenshot; bottom band: empty for the headline").
- **Fields**: the blanks that change per video (the headline, the logo, the screenshot).
- **Fonts and refs**: the font images and reference images that always go with it.

Writing the prompt the same way every time keeps results consistent: numbered images with one job each, one line per zone, one style paragraph, and the exact text with its font.

What tends to hold:
- **Fonts come from pictures.** Pass an image of the font, because a font name alone rarely makes the model draw it.
- **A reference thumbnail only helps when its content is generic.** If it shows specific objects (a monitor, a car, two websites), the model copies them and ignores your layout. Describe those layouts in words instead.
- **Tiny text inside a screenshot can garble.** Pick frames with big type.

## Briefing your image model

1. **Describe what is in the frame, never what is not.** Naming an exclusion ("no logo in the corner") often makes the model add it. Say "the headline fills the entire left half", not "nothing else there". The one useful negation swaps a model default for a positive: "flat white paper, not glossy".
2. **Close the text list.** End with "The ONLY text anywhere in the image is ...", because models invent extra captions.
3. **Write the literal text, not its category.** "Three words on the board: PLAN, BUILD, SHIP", never "three steps".
4. **Look at every reference before describing it.** Describe what you see, not what you remember. A logo that must be right goes in as an image AND in words. When a result looks wrong, look at the reference again before rewriting the prompt; the bug is usually the description.
5. **Logos keep their real brand colours**, sampled from the logo file, in every treatment.
6. **Edits keep the base and name one change.** Pass the image being fixed as Image 1, and never re-describe what it already shows, because the model regenerates whatever you describe. Shape: "Keep Image 1's entire scene exactly as it is. Make ONE change only: [the change]. Keep everything else identical to Image 1. The ONLY text anywhere in the image is [list]."

## Before every generation

a. **Say what you are using** in the first line: the layout, the references and the model, so the user never has to ask.
b. **Check every reference path exists.** Never type a filename from memory.
c. **Sketch a new layout first.** A multi-zone layout the library doesn't cover gets a quick text wireframe in chat and the user's yes before any paid generation, because a wrong layout found after the run costs money.
d. **If the base shows the user, keep them** in every variant unless they say otherwise.

## Fixing a miss

"Same prompt, just change X" means swap only that fragment and keep every other word, reference and their order identical, because each rewrite is a chance to lose what made the last one work. A fix on one named thumbnail is one image, never two.

## Reference locks

- **"Use X from this image" makes that image the spec.** Pass it as a reference; never hunt for a different asset.
- **"In this style" locks the look, not the scene.** Copy the art direction (characters, material, palette, background, type), then invent a new scene for this video, because a clone with swapped logos gets rejected. Copy the composition only on "same layout" or "same scene".
- **A favourite becomes the reference.** Once the user picks a winner in a round, pass it as the style reference for the rest of that round.

## A new style from a reference image

When the user sends a thumbnail to copy as a style, describe its texture, proportions, render quality, composition, lighting and text placement as you see them. Note the pattern of props rather than each prop. The user confirms, then it goes into `library.md` as a new layout.

## The user's face

If the user appears on thumbnails, their face always comes from real photos listed under Setup in `library.md`. Use the photo itself where you can, or pass 2 or 3 photos first with a line saying the person in the scene is the one in those images. Never invent a likeness.

## Handing over

List every image with its absolute path, the layout name, the exact prompt, the references used and the cost if any. Don't open the images; let the user review them in their own viewer. Then log their verdict in `library.md` as SKILL.md describes.
