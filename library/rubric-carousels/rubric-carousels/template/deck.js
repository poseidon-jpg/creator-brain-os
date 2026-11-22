// Starter deck. Make a new folder carousels/<your-slug>/, copy the two files in template/ (index.html and deck.js) into it,
// then change this file only. 10 cards at most, the cover included.
// index.html beside it is the card engine: keep it the same in every carousel.
// Then make the snapshots:  node tools/export-cards.mjs carousels/<your-slug>   and refresh RUBRIC Carousels.
window.DECK = {
  page: 'My first carousel',                       // the title in the app (a trailing " carousel" is dropped there)
  lede: 'One line on what this carousel is.',      // shown under the title on the storyboard page
  handle: '@yourhandle',                           // the account name on every card and on the phone mock
  keyword: 'GUIDE',                                // optional: the comment keyword the homepage shows
  caption: 'Comment "GUIDE" and I will send it to you.\n\n- Point one\n- Point two\n\n#yourtag',
  coverDefault: 'drawn',                           // which cover option starts chosen
  covers: {
    drawn: { label: 'Drawn cover' }                // 'drawn' = the cover card's own scene. Image covers: key: { label, src:'cover/my-cover.png', dark:false }
  },

  // One object per card, in order. Fields:
  //   cover:true    the first card (big two-line title, swipe pill). h is the title, <br> splits the two lines.
  //   num           optional short text in orange above the title ('01', '02' ...). Leave it out and the card shows no number;
  //                 the app then labels the card by its position
  //   name          short label the app shows under the card
  //   h             the title (HTML: <b> bold, <b class="acc"> orange, <br> new line)
  //   p             one or two short sentences under the title
  //   scene         a drawing in scenes below ('blank' draws nothing)
  //   style         '32bit' (pixel) or 'dot' (dot matrix)
  //   dark          true for a black card
  //   kind          'photo' for a still card, 'video' for a card with a clip
  //   anim          true to redraw the scene every frame (scene gets the time t in seconds)
  //   imgs          optional pictures: [{ src:'items/logo.png', cls:'logo' | 'icon' | 'book', css:'left:60%;top:40%;width:25%' }]
  //   labels        optional text on the art: [{ x:50, y:70, t:'TEXT', hot:1, big:1 }]   (x, y in percent)
  //   item, real, realClip, realPoster   optional real footage: real:'video' with realClip:'items/clip.mp4' plays in the box set by DECK.realBox
  cards: [
    { cover: true, scene: 'spark', style: '32bit', kind: 'photo', name: 'Cover',
      h: 'Your big<br>idea <b class="acc">here</b>' },
    { num: '01', scene: 'spark', style: 'dot', kind: 'photo', name: 'First tip',
      h: 'The <b class="acc">first</b> tip', p: 'Say it in one short sentence. Add a second if it helps.' },
    { num: '02', scene: 'stack', style: '32bit', dark: true, kind: 'photo', name: 'Second tip',
      h: 'The <b class="acc">second</b> tip', p: 'Dark cards flip the drawing to cream on black.' },
    // a closing card is a common habit, not a rule
    { scene: 'wave', style: '32bit', kind: 'photo', anim: true, name: 'Call to action',
      h: 'Comment <b class="acc">GUIDE</b><br>to get it', p: 'Save this post for later.' }
  ],

  // Each scene is called as scene(t, api) and draws on a 540 x 675 canvas. Keep the top third clear for the title.
  // t = time in seconds (it moves only on cards with anim:true; a snapshot uses the card's still, or 0). api.sprite places a pixel sprite.
  // Helpers:
  //   box(x, y, w, h, r, fill, stroke, lineWidth)    circ(x, y, r, fill, stroke, lineWidth)
  //   ln([x1, y1, x2, y2, ...], colour, lineWidth)   poly([x1, y1, x2, y2, ...], fill)
  //   win(x, y, w, h, fill, barColour)               shBox(x, y, w, h, r)  shCirc(x, y, r)  shPoly([points])   (hard shadows, draw first)
  //   lg(x0, y0, x1, y1, [colours])                  rgr(x, y, r, [colours], offsetX, offsetY)   (gradients to use as a fill)
  //   pxText(text, x, y, cell, colour)   (pixel letters A D F M O P S only)   g = the canvas 2D context for anything else
  //   api.sprite('bot' | 'heart', x, y, cell, colour, bob)
  // Colours: C.INK C.D2 C.MID C.LT C.CR C.SAND C.OR (orange) C.ORD C.ORL. C.BG paints a hole.
  scenes: {
    spark() {
      shCirc(282, 462, 120);
      circ(270, 450, 120, C.OR, C.INK, 10);
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ln([270 + Math.cos(a) * 150, 450 + Math.sin(a) * 150, 270 + Math.cos(a) * 190, 450 + Math.sin(a) * 190], C.INK, 10); }
    },
    // three stacked boxes with hard shadows
    stack() {
      for (let k = 0; k < 3; k++) { shBox(162 + k * 30, 492 - k * 60, 200, 56, 10); box(150 + k * 30, 480 - k * 60, 200, 56, 10, k === 2 ? C.OR : C.CR, C.INK, 8); }
    },
    // uses t and api: a bar that grows with time, and two sprites that hop on an animated card
    wave(t, api) {
      box(90, 560, 360 * (0.4 + 0.6 * Math.abs(Math.sin(t))), 22, 8, C.OR);
      api.sprite('bot', 150, 400, 10, C.INK, true);
      api.sprite('heart', 310, 400, 10, C.OR, true);
    }
  }
};
