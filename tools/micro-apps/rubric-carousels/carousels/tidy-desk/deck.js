// Sample carousel: 5 ways to keep your desk tidy. A cover, five tips and a save card, all drawn by the engine (no photos).
// Everything about this carousel lives here. index.html beside it is the engine, the same file in every carousel.
window.DECK = {
  page: 'Tidy desk carousel',
  lede: '7 cards: a drawn cover, five tips and a save card. A sample to try the review app on.',
  handle: '@yourhandle',
  keyword: 'TIDY',
  caption: "Comment \"TIDY\" and I'll send you the one-page desk checklist 👇\n\n- One tray for loose paper\n- Clip every cable\n- A home for each pen\n- Clear it at 5pm\n- Only today on top\n\n#desksetup #productivity #workspace",
  coverDefault: 'drawn',
  covers: {
    drawn: { label: 'Drawn desk' },
    sun:   { label: 'Orange sunrise', src: 'cover/cover-sun.png' }
  },

  cards: [
    { cover: true, scene: 'desk', style: '32bit', kind: 'photo', name: 'Cover',
      h: '5 ways to keep<br>your desk <b class="acc">tidy</b>' },

    { num: '01', scene: 'tray', style: 'dot', kind: 'photo', name: 'One tray',
      h: 'One <b class="acc">tray</b><br>for loose paper', p: 'Every sheet goes in the tray, never on the desk. Empty it once a week.' },
    { num: '02', scene: 'cables', style: '32bit', dark: true, kind: 'photo', name: 'Cable clips',
      h: '<b class="acc">Clip</b> every cable', p: 'Run them along one edge and clip them down. The desk looks clear at once.' },
    { num: '03', scene: 'pens', style: 'dot', kind: 'photo', name: 'Pen cup',
      h: 'A <b class="acc">home</b><br>for each pen', p: 'One cup, four pens. When the cup is full, one pen has to go.' },
    { num: '04', scene: 'clock', style: '32bit', kind: 'photo', name: 'Clear at 5pm',
      h: 'Clear it at <b class="acc">5pm</b>', p: 'Two minutes at the end of the day. Tomorrow starts on a clean desk.' },
    { num: '05', scene: 'notes', style: 'dot', dark: true, kind: 'photo', name: 'Today on top',
      h: 'Only <b class="acc">today</b><br>on top', p: 'One note for today. Everything else goes in a drawer.' },

    { scene: 'save', style: '32bit', kind: 'photo', name: 'Save card', anim: true,
      h: '<b>Save</b> this for your<br>next <b class="acc">clean-up</b>', p: 'Comment TIDY and I will send you the checklist.' }
  ],

  // Each scene draws on a 540 x 675 canvas with the engine's helpers (box, circ, ln, poly, win, lg, shBox, shCirc, shPoly, pxText, sprites).
  // Keep the top third clear: the card's title sits there. C holds the palette; C.BG paints a hole (it shows the card behind).
  scenes: {
    desk() {
      shBox(52, 488, 460, 24, 6);
      box(40, 476, 460, 24, 6, C.D2, C.INK, 8);                        // the desk top
      box(72, 500, 22, 140, 4, C.INK); box(446, 500, 22, 140, 4, C.INK);
      win(176, 300, 236, 150);                                          // a screen with a short list
      box(282, 450, 24, 28, 2, C.INK); box(246, 466, 96, 12, 4, C.INK);
      box(200, 362, 22, 22, 5, C.OR); box(236, 366, 136, 13, 5, C.MID);
      box(200, 400, 22, 22, 5, C.OR); box(236, 404, 100, 13, 5, C.MID);
      box(66, 452, 76, 24, 7, C.INK);                                   // the lamp
      ln([104, 456, 84, 372, 142, 330], C.INK, 11);
      poly([122, 306, 182, 330, 150, 362], C.OR);
      box(428, 410, 42, 66, 7, C.OR, C.INK, 8);                         // a mug
      circ(476, 440, 13, null, C.INK, 8);
    },
    tray() {
      ln([270, 270, 270, 340], C.OR, 14); poly([244, 330, 296, 330, 270, 366], C.OR);   // into the tray
      box(150, 400, 240, 70, 4, C.CR, C.INK, 6);                        // the papers inside
      box(166, 384, 240, 70, 4, C.CR, C.INK, 6);
      box(186, 400, 150, 10, 3, C.MID); box(186, 420, 110, 10, 3, C.MID);
      shBox(132, 452, 290, 110, 12);
      box(120, 440, 290, 110, 12, lg(0, 440, 0, 550, [C.SAND, C.LT]), C.INK, 10);   // the tray front
      box(150, 480, 230, 14, 6, C.MID);
    },
    cables() {
      for (let k = 0; k < 3; k++) ln([96 + k * 30, 290, 96 + k * 30, 420 + k * 30, 430, 420 + k * 30], C.INK, 10);   // three cables, one route
      box(80, 344, 92, 26, 7, C.OR);                                    // clips
      box(286, 404, 26, 92, 7, C.OR);
      shBox(442, 392, 64, 132, 10);
      box(430, 380, 64, 132, 10, C.D2, C.INK, 8);                       // the power strip
      for (let k = 0; k < 3; k++) box(446, 408 + k * 30, 32, 16, 4, C.LT);
      box(40, 560, 460, 18, 6, C.MID);                                  // the desk edge
    },
    pens() {
      [[-0.32, C.OR], [-0.1, C.INK], [0.1, C.MID], [0.3, C.OR]].forEach(([a, col]) => {
        g.save(); g.translate(266, 520); g.rotate(a); box(-8, -236, 16, 206, 7, col, C.INK, 5); g.restore();
      });
      shBox(198, 400, 160, 190, 18);
      box(186, 388, 160, 190, 18, lg(186, 0, 346, 0, [C.SAND, C.CR]), C.INK, 10);   // the cup
      box(191, 448, 150, 26, 0, C.OR);
      box(60, 596, 420, 16, 6, C.MID);
    },
    clock() {
      const cx = 270, cy = 450, r = 138;
      shCirc(cx + 12, cy + 12, r);
      circ(cx, cy, r, C.CR, C.INK, 12);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ln([cx + Math.sin(a) * 104, cy - Math.cos(a) * 104, cx + Math.sin(a) * 120, cy - Math.cos(a) * 120], i % 3 ? C.MID : C.INK, 8); }
      ln([cx, cy, cx, cy - 92], C.INK, 10);                             // minute hand on 12
      const h = 5 / 12 * Math.PI * 2; ln([cx, cy, cx + Math.sin(h) * 70, cy - Math.cos(h) * 70], C.OR, 16);   // hour hand on 5
      circ(cx, cy, 13, C.INK);
    },
    notes() {
      g.save(); g.translate(270, 460); g.rotate(-0.12); box(-120, -120, 240, 240, 8, C.MID); g.restore();   // the rest of the pile, behind
      shBox(170, 338, 220, 220, 8);
      box(158, 326, 220, 220, 8, C.OR, C.INK, 8);                       // today's note
      ln([186, 384, 200, 398, 226, 368], C.INK, 9);
      box(240, 374, 110, 14, 5, C.INK);
      box(186, 424, 164, 14, 5, C.INK);
      box(186, 464, 120, 14, 5, C.INK);
    },
    save(t, api) {
      shPoly([212, 312, 352, 312, 352, 590, 282, 530, 212, 590]);
      poly([200, 300, 340, 300, 340, 578, 270, 518, 200, 578], C.OR);   // a bookmark
      ln([200, 300, 340, 300, 340, 578, 270, 518, 200, 578, 200, 300], C.INK, 9);
      api.sprite('heart', 382, 360, 8, C.OR, true);                     // a small pixel heart that hops
      api.sprite('bot', 96, 470, 8, C.INK, true);
    }
  }
};
