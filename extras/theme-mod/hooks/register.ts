import type { Register, ThemeSetArgs } from 'claude-code'
import { makeColors } from './make-colors.js'

// night studio look v4: the studio at night. Brutalist concrete, black on dust, ASCII stalactites, a dithered monolith
// with a slit of light, swaying chains, low fog, falling ash and a few bats drifting through. Slow and calm.

const SCENE = 'night-studio-cave'
const W = 1920, H = 1080
let seed = 13
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280)
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const MONO = 'SF Mono, Menlo, Monaco, monospace'
let css: string[] = []
let cid = 0
function cls(rule: string): string { const n = `a${cid++}`; css.push(`.${n}{${rule}}`); return n }

function bayer(id: string, color: string, px: number): string {
  const M = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]
  let c = ''
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++)
    c += `<rect x="${x * px}" y="${y * px}" width="${px}" height="${px}" fill="${color}" opacity="${((M[y]![x]! + 1) / 17).toFixed(3)}"/>`
  return `<pattern id="${id}" width="${4 * px}" height="${4 * px}" patternUnits="userSpaceOnUse">${c}</pattern>`
}

// The tape: a reel of ASCII rings that turns slowly.
function reel(cx: number, cy: number, r: number, dur: number, dir: number): string {
  const rings: string[] = []
  const glyph = ['=', '-', ':', '.', '=', '#']
  for (let k = 0; k < 6; k++) {
    const rr = r * (0.32 + k * 0.13), n = Math.floor((2 * Math.PI * rr) / 9)
    let row = ''
    for (let i = 0; i < n; i++) row += glyph[(i + k) % glyph.length]
    rings.push(`<circle r="${rr.toFixed(1)}" fill="none" stroke="${k === 5 ? 'url(#chrome)' : '#7d776e'}" stroke-width="${k === 5 ? 2 : 1.2}" stroke-dasharray="${[2, 6, 1, 3, 4, 2][k]} ${[5, 3, 4, 6, 2, 3][k]}" opacity="${(0.45 + k * 0.08).toFixed(2)}"/>`)
  }
  const spokes = [0, 120, 240].map(a => `<rect x="-3" y="${-r * 0.3}" width="6" height="${r * 0.3}" fill="#b9b2a6" opacity=".55" transform="rotate(${a})"/>`).join('')
  return `<g transform="translate(${cx} ${cy})"><g class="${cls(`animation:${dir > 0 ? 'spin' : 'spinr'} ${dur}s linear infinite`)}">${rings.join('')}${spokes}
    <circle r="${r * 0.12}" fill="#0c0b0a" stroke="#d8d2c8" stroke-opacity=".5"/></g></g>`
}

// The spectrogram waterfall: columns of density glyphs scrolling down, bass on the left of the band.
function waterfall(x0: number, w: number): string {
  const fs = 13, cw = fs * 0.6, cols = Math.floor(w / cw), rows = Math.ceil(H / fs) + 2
  const ramp = ' .:-=+*#%@'
  const lines: string[] = []
  for (let y = 0; y < rows; y++) {
    let l = ''
    const beat = (y % 16) < 2 ? 1 : (y % 8) < 1 ? 0.6 : 0
    for (let x = 0; x < cols; x++) {
      const f = x / cols
      let v = 0.55 * Math.exp(-f * 4) * (0.6 + 0.4 * beat) + 0.25 * Math.exp(-Math.pow((f - 0.35 - 0.05 * Math.sin(y * 0.3)) / 0.06, 2)) + 0.12 * rnd() * (1 - f)
      if (beat && f < 0.15) v += 0.4
      l += ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length)))]
    }
    lines.push(l)
  }
  const block = (dy: number) => lines.map((l, i) => `<tspan x="${x0}" y="${dy + (i + 1) * fs}">${esc(l)}</tspan>`).join('')
  const h = rows * fs
  css.push(`@keyframes rows${cid}{from{transform:translateY(0)}to{transform:translateY(${h}px)}}`)
  css.push(`@keyframes scan{from{transform:translateY(-200px)}to{transform:translateY(${H}px)}}`)
  return `<text font-family="${MONO}" font-size="${fs}" fill="url(#heat)" opacity=".55" xml:space="preserve">${block(0)}</text><rect class="${cls('animation:scan 14s linear infinite')}" x="${x0}" y="0" width="${w}" height="200" fill="url(#scanGlow)"/>`
}

// The terrain: chrome wire ridgelines gliding toward the viewer.
function terrain(): string {
  const rows = 12, out: string[] = []
  for (let r = 0; r < rows * 2; r++) {
    const t = r / rows, y = 760 + 40 * r, amp = 18 + 40 * (r % rows) / rows
    let pts = ''
    for (let x = -40; x <= W + 40; x += 60) {
      const n = Math.sin(x * 0.006 + r * 0.9) * 0.6 + Math.sin(x * 0.017 + r * 2.1) * 0.3 + Math.sin(x * 0.041 + r) * 0.1
      const mid = Math.abs(x - W / 2) / (W / 2)
      pts += `${x},${(y - amp * n * (0.3 + 0.7 * mid)).toFixed(1)} `
    }
    out.push(`<polyline points="${pts}" fill="none" stroke="url(#chrome)" stroke-width="${(0.6 + t * 0.4).toFixed(2)}" opacity="${(0.3 + 0.6 * ((r % rows) / rows)).toFixed(2)}"/>`)
  }
  return `<g mask="url(#mGround)"><g class="glide">${out.join('')}</g></g>`
}

// The oscilloscope: one bright trace across the top, redrawn as it scrolls.
function scope(): string {
  let pts = ''
  for (let x = 0; x <= W * 2; x += 16) pts += `${x},${(70 + 26 * Math.sin(x * 0.011) * Math.sin(x * 0.0023) + 6 * Math.sin(x * 0.07)).toFixed(1)} `
  return `<g class="scope"><polyline points="${pts}" fill="none" stroke="#e8e3da" stroke-width="1.2" opacity=".55"/><polyline points="${pts}" fill="none" stroke="#b8404a" stroke-width="4" opacity=".12"/></g>`
}

// Ash: small specks drifting down slowly.
function ash(n: number): string {
  const g = ['.', '`', ',', "'", '.']
  let o = ''
  for (let i = 0; i < n; i++) {
    const x = rnd() * W, dur = 60 + rnd() * 80, del = -rnd() * dur, d = (rnd() - 0.5) * 120
    const c = rnd() < 0.08 ? '#b8404a' : rnd() < 0.5 ? '#d8d2c8' : '#6d675f'
    o += `<text x="${x.toFixed(0)}" y="-20" font-family="${MONO}" font-size="${(9 + rnd() * 8).toFixed(0)}" fill="${c}" class="${(() => { const k = `f${cid}`; css.push(`@keyframes ${k}{0%{opacity:0;transform:translate(0,0)}10%{opacity:.6}90%{opacity:.4}100%{opacity:0;transform:translate(${d.toFixed(0)}px,1120px)}}`); return cls(`animation:${k} ${dur.toFixed(0)}s linear ${del.toFixed(1)}s infinite`) })()}">${esc(g[Math.floor(rnd() * g.length)]!)}</text>`
  }
  return o
}

// XY scope: a Lissajous figure that draws itself, with two fading phosphor trails behind it.
function lissajous(cx: number, cy: number, R: number): string {
  let d = '', L = 0, px = 0, py = 0
  for (let i = 0; i <= 480; i++) {
    const t = (i / 480) * Math.PI * 2
    const x = cx + R * 1.35 * Math.sin(3 * t + Math.PI / 4), y = cy + R * Math.sin(4 * t)
    d += (i ? ' L ' : 'M ') + x.toFixed(1) + ' ' + y.toFixed(1)
    if (i) L += Math.hypot(x - px, y - py)
    px = x; py = y
  }
  const seg = (L * 0.22).toFixed(0), gap = (L * 0.78).toFixed(0)
  css.push(`@keyframes xy{from{stroke-dashoffset:0}to{stroke-dashoffset:${(-L).toFixed(0)}}}`)
  const trail = (op: number, w: number, delay: number, col: string) =>
    `<use href="#xyp" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${seg} ${gap}" opacity="${op}" class="${cls(`animation:xy 26s linear ${delay}s infinite`)}"/>`
  return `<defs><path id="xyp" d="${d}"/></defs><use href="#xyp" fill="none" stroke="#d8d2c8" stroke-width=".6" opacity=".05"/>` +
    trail(0.1, 7, -0.9, '#b8404a') + trail(0.22, 2.5, -0.45, '#d8d2c8') + trail(0.75, 1.3, 0, '#f4f0e8')
}

// Demoscene tunnel: faceted square rings drifting out of the vanishing point.
function tunnel(cx: number, cy: number, n: number): string {
  css.push('@keyframes tun{0%{transform:scale(.04) rotate(0deg);opacity:0}20%{opacity:.22}100%{transform:scale(1.7) rotate(45deg);opacity:0}}')
  let o = ''
  for (let i = 0; i < n; i++)
    o += `<g transform="translate(${cx} ${cy})"><rect x="-420" y="-420" width="840" height="840" fill="none" stroke="#9aa3ad" stroke-width="2" class="${cls(`animation:tun 22s linear ${(-(22 / n) * i).toFixed(1)}s infinite;transform-origin:0 0`)}"/></g>`
  return o
}

// Cyber sigil: barbed, mirrored spokes in chrome, pulsing slowly.
function sigil(cx: number, cy: number, r: number, delay: number): string {
  let p = ''
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4, L = k % 2 ? r * 0.6 : r
    const ex = Math.cos(a) * L, ey = Math.sin(a) * L
    p += `M 0 0 L ${ex.toFixed(1)} ${ey.toFixed(1)} `
    for (const f of [0.45, 0.7]) {
      const bx = Math.cos(a) * L * f, by = Math.sin(a) * L * f, b = r * 0.12
      p += `M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + Math.cos(a + 2.4) * b).toFixed(1)} ${(by + Math.sin(a + 2.4) * b).toFixed(1)} M ${bx.toFixed(1)} ${by.toFixed(1)} L ${(bx + Math.cos(a - 2.4) * b).toFixed(1)} ${(by + Math.sin(a - 2.4) * b).toFixed(1)} `
    }
  }
  css.push('@keyframes sig{from{opacity:.25}to{opacity:.85}}')
  return `<g transform="translate(${cx} ${cy})"><g class="${cls(`animation:sig 6s ease-in-out ${delay}s infinite alternate`)}">
    <path d="${p}" fill="none" stroke="url(#chrome)" stroke-width="2" stroke-linecap="square"/>
    <circle r="${(r * 0.18).toFixed(1)}" fill="none" stroke="#b8404a" stroke-width="1.5"/><circle r="${(r * 1.08).toFixed(1)}" fill="none" stroke="#5a5650" stroke-dasharray="2 9"/></g></g>`
}

// VU meter: ticked arc and a needle that swings to a slow signal.
function vu(cx: number, cy: number, r: number, delay: number): string {
  let ticks = ''
  for (let i = 0; i <= 12; i++) {
    const a = (-130 + (i * 80) / 12) * Math.PI / 180, red = i > 9
    ticks += `<line x1="${(Math.cos(a) * r * 0.8).toFixed(1)}" y1="${(Math.sin(a) * r * 0.8).toFixed(1)}" x2="${(Math.cos(a) * r).toFixed(1)}" y2="${(Math.sin(a) * r).toFixed(1)}" stroke="${red ? '#b8404a' : '#8a847c'}" stroke-width="${i % 3 ? 1 : 2}"/>`
  }
  css.push('@keyframes vu{0%{transform:rotate(-38deg)}18%{transform:rotate(-8deg)}31%{transform:rotate(-26deg)}52%{transform:rotate(4deg)}67%{transform:rotate(-18deg)}84%{transform:rotate(-2deg)}100%{transform:rotate(-30deg)}}')
  return `<g transform="translate(${cx} ${cy})"><rect x="${-r * 1.15}" y="${-r * 1.1}" width="${r * 2.3}" height="${r * 1.35}" fill="#0c0b0a" stroke="#3a3631"/>${ticks}
    <text y="${-r * 0.35}" text-anchor="middle" font-family="${MONO}" font-size="10" fill="#8a847c" letter-spacing="3">VU</text>
    <g class="${cls(`animation:vu 7s ease-in-out ${delay}s infinite alternate`)}"><line x1="0" y1="0" x2="0" y2="${-r * 0.95}" stroke="#efeae2" stroke-width="1.6"/></g>
    <circle r="4" fill="#d8d2c8"/></g>`
}

// A record, turning very slowly behind the words: grooves as dashed rings, an oxblood label.
function vinyl(cx: number, cy: number, r: number): string {
  let g = ''
  for (let k = 0; k < 14; k++) {
    const rr = r * (0.36 + k * 0.045)
    g += `<circle r="${rr.toFixed(1)}" fill="none" stroke="#d8d2c8" stroke-width=".8" stroke-dasharray="${(3 + (k % 4) * 7).toFixed(0)} ${(2 + (k % 3) * 3).toFixed(0)}" opacity="${(0.05 + (k % 3) * 0.02).toFixed(2)}"/>`
  }
  g += `<path d="M 0 ${-r} A ${r} ${r} 0 0 1 ${r * 0.7} ${-r * 0.71}" fill="none" stroke="#eef0f2" stroke-width="1.5" opacity=".12"/>`
  return `<g transform="translate(${cx} ${cy})"><circle r="${r}" fill="#0b0a09" opacity=".5"/>
    <g class="${cls('animation:spin 120s linear infinite')}">${g}<circle r="${r * 0.3}" fill="#b8404a" opacity=".16"/><circle r="${r * 0.3 - 6}" fill="none" stroke="#b8404a" stroke-opacity=".3" stroke-dasharray="2 5"/><rect x="-2" y="${-r * 0.27}" width="4" height="${r * 0.1}" fill="#d8d2c8" opacity=".3"/></g>
    <circle r="6" fill="#d8d2c8" opacity=".35"/></g>`
}

function buildSVG(): string {
  seed = 13; css = []; cid = 0
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
<style>
  .spin{animation:spin linear infinite} .spinr{animation:spinr linear infinite}
  .fall{animation:fall linear infinite}
  .fallRows{animation:rows 60s linear infinite}
  .glide{animation:glide 18s linear infinite}
  .scope{animation:scope 40s linear infinite}
  .breath{animation:breath 10s ease-in-out infinite alternate}
  @keyframes spin{to{transform:rotate(360deg)}} @keyframes spinr{to{transform:rotate(-360deg)}}
  @keyframes roll{from{transform:translateY(0)}to{transform:translateY(1240px)}}
  GENCSS
  @keyframes glide{from{transform:translateY(0)}to{transform:translateY(-480px)}}
  @keyframes scope{from{transform:translateX(0)}to{transform:translateX(-${W}px)}}
  @keyframes breath{from{opacity:.35}to{opacity:.8}}
</style>
<defs>
  <linearGradient id="chrome" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3d4148"/><stop offset=".5" stop-color="#eef0f2"/><stop offset="1" stop-color="#3d4148"/></linearGradient>
  <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d2c8" stop-opacity="0"/><stop offset=".8" stop-color="#d8d2c8" stop-opacity=".12"/><stop offset="1" stop-color="#f1ece3" stop-opacity=".3"/></linearGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".35"/></pattern>
  <linearGradient id="rollG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d2c8" stop-opacity="0"/><stop offset=".5" stop-color="#d8d2c8" stop-opacity=".035"/><stop offset="1" stop-color="#d8d2c8" stop-opacity="0"/></linearGradient>
  <linearGradient id="heat" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8404a"/><stop offset=".35" stop-color="#d8d2c8"/><stop offset="1" stop-color="#4a453f"/></linearGradient>
  <radialGradient id="vig" cx=".5" cy=".4" r=".5"><stop offset="0" stop-color="#050505" stop-opacity=".6"/><stop offset=".6" stop-color="#050505" stop-opacity=".25"/><stop offset="1" stop-color="#050505" stop-opacity="0"/></radialGradient>
  <linearGradient id="groundMask" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff"/></linearGradient>
  <mask id="mGround"><rect y="740" width="${W}" height="${H - 740}" fill="url(#groundMask)"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="#070707"/>
${terrain()}
${waterfall(W - 230, 230)}
${waterfall(0, 230)}
${tunnel(960, 500, 9)}
${lissajous(960, 480, 240)}
${sigil(410, 170, 62, 0)}
${sigil(W - 410, 170, 62, -3)}
${vu(410, 870, 70, 0)}
${vu(W - 410, 870, 70, -2.5)}
${reel(410, 360, 105, 90, 1)}
${reel(410, 640, 80, 70, -1)}
<rect x="404" y="360" width="12" height="280" fill="#d8d2c8" opacity=".1"/>
${reel(W - 410, 360, 105, 90, -1)}
${reel(W - 410, 640, 80, 70, 1)}
<rect x="${W - 416}" y="360" width="12" height="280" fill="#d8d2c8" opacity=".1"/>
${scope()}
${ash(12)}
<rect width="${W}" height="${H}" fill="url(#vig)"/>
<rect width="${W}" height="${H}" fill="url(#scan)"/>
<rect class="${cls('animation:roll 24s linear infinite')}" x="0" y="-160" width="${W}" height="160" fill="url(#rollG)"/>
<text class="breath" x="${W / 2}" y="${H - 24}" text-anchor="middle" font-family="${MONO}" font-size="12" letter-spacing="14" fill="#d8d2c8">NIGHT STUDIO</text>
</svg>`
  return out.replace('GENCSS', css.join('\n  '))
}

const SVG = buildSVG()

// Rick Owens palette: black, dust, bone, concrete; oxblood for the accent.
const { theme, problems } = makeColors({
  label: 'night studio cave', only: 'dark',
  roles: { accent: '#b8404a', danger: '#e05a5a', success: '#7fb58a', warning: '#d6a35c', pro: '#b9b2a6' },
  dark: { gray: { anchors: { 'surface-0': '#0c0b0a', 'surface-1': '#13110f', 'surface-2': '#191714', 'surface-3': '#1e1b18', 'text-primary': '#efeae2', 'text-secondary': '#c9c2b6', 'text-muted': '#9a9286' } } },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: SCENE, glass: false },
}

async function apply($: any): Promise<string> {
  const bad = problems.find((l: string) => l.startsWith("Desktop won't paint"))
  if (bad) return `night studio colors refused: ${bad}`
  const r = await $.theme.set(LOOK)
  return r.isDrawn ? 'night studio look is on' : `night studio look not drawn: ${r.reason}`
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    const msg = await apply($)
    await $.command.register({ name: 'night-studio-theme', description: 'Put the night studio look on and say whether it is drawn' })
    if (!msg.endsWith('is on')) $.ui.toast(msg)
    return next(e)
  })

  on('command.run', { command: 'night-studio-theme' }, async ($) => ({ text: await apply($) }))

  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    if ((e.props as any).scene !== SCENE) return next(e)
    const { Svg } = $.ui.resolve(e) as any
    return Svg({ source: SVG, alt: 'night studio backdrop: a dark cave with ASCII stalactites, a concrete monolith split by light, swaying chains, fog, falling ash and drifting bats', isInteractive: true })
  })
}
