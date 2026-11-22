# Extras

## theme-mod: "night studio" backdrop for the Claude desktop app
An animated backdrop (ASCII cave, monolith, fog, drifting ash) drawn behind the Code tab. It's purely cosmetic.

To use it, ask Claude in the desktop app: "install the theme mod in extras/theme-mod". Claude uses the `plugin-authoring` skill to load it as a local mod. To make your own look, ask Claude to change the palette in `hooks/make-colors.js` or the scene in `hooks/register.ts` ("make it pink chrome and soft clouds").
