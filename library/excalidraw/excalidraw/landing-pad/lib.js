/**
 * Element builders for excalidraw scenes.
 * Coordinates are plain canvas pixels; every helper returns one element.
 * Colours assume a DARK canvas.
 */

const C = {
  // If your canvas runs Excalidraw's DARK MODE, it inverts lightness at render
  // time (hue survives). So excalidraw's own default black displays as white on
  // a dark board - that is the colour to reach for when you want white text.
  black:  '#1e1e1e',   // excalidraw default - DISPLAYS WHITE on a dark board
  ink:    '#d9d4c6',   // stored-light stroke + text
  muted:  '#6f6a5c',   // the "old way" / secondary
  blue2:  '#1971c2',   // LEVEL 2 accent (excalidraw stock blue)
  orange: '#f08c00',   // the highlight
  hot:    '#ff6b1a',   // strongest highlight
  green:  '#4aa85a',
  blue:   '#7ba7d4',
  gold:   '#d9a441',
  purple: '#b07ad4',
  rust:   '#e0691f',
  // dim fills that read on near-black
  fDim:  '#232320', fWarm: '#3d2a10', fCool: '#1e2c3a',
  fPlum: '#2f2038', fMoss: '#1d2f21', fRust: '#3a1f0d',
};

let _n = 0;

function base(type, props) {
  _n += 1;
  return Object.assign({
    id: `e${_n}`, type, x: 0, y: 0, width: 0, height: 0, angle: 0,
    strokeColor: C.ink, backgroundColor: 'transparent', fillStyle: 'solid',
    strokeWidth: 2, strokeStyle: 'solid', roughness: 1, opacity: 100,
    groupIds: [], frameId: null, roundness: null,
    seed: 1000 + _n * 13, version: 1, versionNonce: 5000 + _n * 17,
    isDeleted: false, boundElements: null, updated: 1, link: null, locked: false,
  }, props);
}

const shape = (type, x, y, w, h, o = {}) => base(type, {
  x, y, width: w, height: h,
  strokeColor: o.stroke || C.ink,
  backgroundColor: o.fill || 'transparent',
  fillStyle: o.hatch ? 'hachure' : 'solid',
  strokeWidth: o.sw || 2,
  strokeStyle: o.dashed ? 'dashed' : (o.dotted ? 'dotted' : 'solid'),
  roughness: o.roughness ?? 1,
  opacity: o.opacity ?? 100,
  roundness: o.sharp ? null : { type: 3 },
});

const rect    = (x, y, w, h, o) => shape('rectangle', x, y, w, h, o);
const ellipse = (x, y, w, h, o) => shape('ellipse', x, y, w, h, o);
const diamond = (x, y, w, h, o) => shape('diamond', x, y, w, h, o);

/** Measure a string the way excalidraw roughly does. */
function measure(str, size) {
  const lines = String(str).split('\n');
  return {
    w: Math.max(...lines.map(l => l.length)) * size * 0.58,
    h: lines.length * size * 1.25,
  };
}

function textEl(str, o = {}) {
  const size = o.size || 20;
  const m = measure(str, size);
  const w = o.width || m.w;
  return base('text', {
    width: w, height: m.h,
    strokeColor: o.color || C.ink,
    opacity: o.opacity ?? 100,
    text: String(str), originalText: String(str),
    fontSize: size, fontFamily: o.mono ? 3 : 1,
    textAlign: o.align || 'left', verticalAlign: 'top',
    baseline: Math.round(size * 0.85), containerId: null, lineHeight: 1.25,
  });
}

/** Centred on (cx, cy). */
function textAt(cx, cy, str, o = {}) {
  const t = textEl(str, Object.assign({ align: 'center' }, o));
  t.x = cx - t.width / 2; t.y = cy - t.height / 2;
  return t;
}
/** Left edge at x, vertically centred on cy. */
function textL(x, cy, str, o = {}) {
  const t = textEl(str, Object.assign({ align: 'left' }, o));
  t.x = x; t.y = cy - t.height / 2;
  return t;
}
/** Right edge at x, vertically centred on cy. */
function textR(x, cy, str, o = {}) {
  const t = textEl(str, Object.assign({ align: 'right' }, o));
  t.x = x - t.width; t.y = cy - t.height / 2;
  return t;
}

function arrow(x1, y1, x2, y2, o = {}) {
  return base('arrow', {
    x: x1, y: y1, width: Math.abs(x2 - x1), height: Math.abs(y2 - y1),
    points: [[0, 0], [x2 - x1, y2 - y1]], lastCommittedPoint: null,
    startBinding: null, endBinding: null,
    startArrowhead: o.startHead || null,
    endArrowhead: o.head === false ? null : 'arrow',
    strokeColor: o.stroke || C.ink,
    strokeWidth: o.sw || 2,
    strokeStyle: o.dashed ? 'dashed' : (o.dotted ? 'dotted' : 'solid'),
    opacity: o.opacity ?? 100,
    roughness: o.roughness ?? 1,
  });
}

/** Polyline / closed polygon through absolute points. */
function poly(pts, o = {}) {
  const [ax, ay] = pts[0];
  const rel = pts.map(([x, y]) => [x - ax, y - ay]);
  if (o.close) rel.push([0, 0]);
  const xs = rel.map(p => p[0]), ys = rel.map(p => p[1]);
  return base('line', {
    x: ax, y: ay,
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    points: rel, lastCommittedPoint: null,
    startBinding: null, endBinding: null, startArrowhead: null, endArrowhead: null,
    strokeColor: o.stroke || C.ink,
    backgroundColor: o.fill || 'transparent',
    fillStyle: o.hatch ? 'hachure' : 'solid',
    strokeWidth: o.sw || 2,
    strokeStyle: o.dashed ? 'dashed' : 'solid',
    opacity: o.opacity ?? 100,
    roundness: o.curvy ? { type: 2 } : null,
  });
}

/** A labelled box: returns [rect, text]. Text wraps at the box width. */
function box(x, y, w, h, label, o = {}) {
  return [
    rect(x, y, w, h, o),
    textAt(x + w / 2, y + h / 2, label, {
      size: o.size || 18, color: o.text || o.stroke || C.ink, width: w - 16,
    }),
  ];
}

/** Section title, centred. */
const title = (cx, y, str, o = {}) =>
  textAt(cx, y, str, Object.assign({ size: 30, color: C.ink }, o));

/** Small uppercase kicker. */
const kicker = (cx, y, str, o = {}) =>
  textAt(cx, y, str, Object.assign({ size: 14, color: C.muted }, o));

/* ---------------------------------------------------------------- icons
   Wordless glyphs for level illustrations. Each returns an array.          */

/** A rounded tag with a label inside - a file/name chip. */
const tag = (cx, cy, label, o = {}) => {
  const w = o.w || 160, h = o.h || 52;
  return [
    rect(cx - w / 2, cy - h / 2, w, h, { stroke: o.stroke || C.black, fill: o.fill || 'transparent' }),
    textAt(cx, cy, label, { size: o.size || 16, color: o.text || o.stroke || C.black }),
  ];
};

/**
 * A file glyph - NO words, the kind is carried by the mark inside.
 * kind: 'code' (html), 'img' (visual), 'doc' (text).
 */
const fileIcon = (cx, cy, kind = 'doc', o = {}) => {
  const s = o.stroke || C.black, k = o.scale || 1;
  const L = cx - 19 * k, R = cx + 19 * k, T = cy - 24 * k, B = cy + 24 * k, F = 12 * k;
  const out = [
    poly([[L, T], [R - F, T], [R, T + F], [R, B], [L, B]], { close: true, stroke: s }),
    poly([[R - F, T], [R - F, T + F], [R, T + F]], { stroke: s, sw: 1 }),
  ];
  if (kind === 'code') {
    out.push(poly([[cx - 2 * k, cy - 7 * k], [cx - 10 * k, cy + 2 * k], [cx - 2 * k, cy + 11 * k]], { stroke: s, sw: 1 }));
    out.push(poly([[cx + 2 * k, cy - 7 * k], [cx + 10 * k, cy + 2 * k], [cx + 2 * k, cy + 11 * k]], { stroke: s, sw: 1 }));
  } else if (kind === 'img') {
    out.push(ellipse(cx - 10 * k, cy - 8 * k, 7 * k, 7 * k, { stroke: s, sw: 1 }));
    out.push(poly([[cx - 12 * k, cy + 12 * k], [cx - 3 * k, cy + 1 * k], [cx + 2 * k, cy + 7 * k], [cx + 8 * k, cy - 1 * k], [cx + 13 * k, cy + 12 * k]],
      { stroke: s, sw: 1 }));
  } else {
    [-3, 5, 13].forEach((dy, i) =>
      out.push(poly([[cx - 11 * k, cy + dy * k], [cx + (i === 2 ? 3 : 11) * k, cy + dy * k]], { stroke: s, sw: 1 })));
  }
  return out;
};

/** A lightning bolt - the trigger mark. */
const boltIcon = (cx, cy, o = {}) => {
  const P = [[0, 0], [-13.5, 18], [-3, 18], [-4.5, 30], [10.5, 10.5], [0, 10.5]];
  return [poly(P.map(([px, py]) => [cx + px + 1.5, cy + py - 15]),
    { close: true, stroke: o.stroke || C.hot, fill: o.fill || 'transparent' })];
};

/** A tabbed folder, outline only. scale option shrinks it for tree children. */
const folderIcon = (cx, cy, o = {}) => {
  const k = o.scale || 1;
  const P = [[-36, -14], [-36, -22], [-12, -22], [-6, -14], [36, -14], [36, 22], [-36, 22]];
  return poly(P.map(([px, py]) => [cx + px * k, cy + py * k]),
    { close: true, stroke: o.stroke || C.black, sw: o.sw || 2 });
};

/** An eye - the "see it" mark for visual beats. */
const eyeIcon = (cx, cy, o = {}) => {
  const s = o.stroke || C.hot;
  return [
    poly([[cx - 15, cy + 1], [cx, cy - 9], [cx + 15, cy + 1]], { stroke: s, sw: 1 }),
    poly([[cx - 15, cy + 1], [cx, cy + 10], [cx + 15, cy + 1]], { stroke: s, sw: 1 }),
    ellipse(cx - 3.5, cy - 3, 7, 7, { stroke: s, sw: 1 }),
  ];
};

/**
 * THE LEVELS TEMPLATE - a proven layout for any "3 levels of X" beat.
 *
 * No boxes. Header + subtitle sit over column one, then three columns of
 * title / hairline / body spread wide, with connector arrows between.
 * Body copy is 2 lines max - the tightened spacing leaves no room for a third.
 *
 * COLOUR STANDARD (this is what makes the eye track "what's new" instantly):
 *   Level 1 = neutral C.black (displays white on dark), muted hairline.
 *   Level 2 = C.blue2 - title, hairline, body all blue.
 *   Level 3 = C.hot title + hairline, C.orange body.
 * Illustrations colour-code to the level that ADDS the element: whatever
 * carried over from an earlier level goes neutral (C.black strokes, C.muted
 * connector lines); only the elements new at this level wear its colour.
 */
function levelGrid({ header, sub, levels, x = 0, y = 0 }) {
  const COL = 590;           // column centre to column centre
  const RULE = 200;          // hairline width under each level title
  const INSET = 145;         // how far a connector starts from a column centre
  // Vertical rhythm: body tucks in under the rule; the illustration
  // anchor (chip/folder centre) lands at illus-60, children at illus+62.
  const Y = { head: 25, sub: 63, level: 139, rule: 165, body: 215, arrow: 193, illus: 351 };
  const TONE = [
    { head: C.black, rule: C.muted, body: C.black },
    { head: C.blue2, rule: C.blue2, body: C.blue2 },
    { head: C.hot,   rule: C.hot,   body: C.orange },
  ];
  const cx = i => x + i * COL;
  const out = [
    textAt(cx(0), y + Y.head, header, { size: 40, color: C.hot }),
    textAt(cx(0), y + Y.sub, sub, { size: 17, color: C.muted }),
  ];
  levels.forEach((lv, i) => {
    const t = TONE[i] || TONE[TONE.length - 1];
    out.push(textAt(cx(i), y + Y.level, lv.title, { size: 23, color: t.head }));
    out.push(poly([[cx(i) - RULE / 2, y + Y.rule], [cx(i) + RULE / 2, y + Y.rule]],
      { stroke: t.rule, opacity: 55 }));
    out.push(textAt(cx(i), y + Y.body, lv.body, { size: 18, color: t.body }));
    if (lv.illus) out.push(...lv.illus(cx(i), y + Y.illus));
    if (i < levels.length - 1) {
      out.push(arrow(cx(i) + INSET, y + Y.arrow, cx(i + 1) - INSET, y + Y.arrow,
        { stroke: C.ink }));
    }
  });
  return out;
}

/** Stamp one group id across every element so it pastes as a single object. */
function grouped(slug, elements) {
  elements.flat().forEach(e => { e.groupIds = [slug]; });
  return elements.flat();
}

function scene(elements, bg = '#121212') {
  return {
    type: 'excalidraw', version: 2, source: 'https://excalidraw.com',
    elements, appState: { gridSize: null, viewBackgroundColor: bg }, files: {},
  };
}

module.exports = {
  C, rect, ellipse, diamond, textEl, textAt, textL, textR,
  arrow, poly, box, title, kicker, grouped, scene, measure, levelGrid,
  tag, fileIcon, boltIcon, folderIcon, eyeIcon,
};
