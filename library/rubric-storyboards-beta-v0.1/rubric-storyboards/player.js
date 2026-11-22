/* RUBRIC Storyboards (beta) · wireframe player.
   Draws a step 1 storyboard (prompts.mjs WIREFRAME_SCHEMA) as a grey-box animatic on a canvas.
   draw(t) is a pure function of t, so playing, scrubbing and screenshots always agree. */
(function () {
  const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };
  const TAU = Math.PI * 2;
  const ACC = '#ff6b1a';
  const c01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const easeOut = x => 1 - Math.pow(1 - c01(x), 3);
  const easeInOut = x => { x = c01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const backOut = x => { x = c01(x); const a = 1.70158, b = a + 1; return 1 + b * Math.pow(x - 1, 3) + a * Math.pow(x - 1, 2); };
  const bounceOut = x => {
    x = c01(x); const n = 7.5625, d = 2.75;
    if (x < 1 / d) return n * x * x;
    if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
    if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
    return n * (x -= 2.625 / d) * x + 0.984375;
  };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  const THEMES = {
    dark: { bg: '#15140f', grid: 'rgba(232,226,210,.07)', fg: '#e8e2d2', dim: 'rgba(232,226,210,.5)', faint: 'rgba(232,226,210,.16)', fill: 'rgba(232,226,210,.05)', acc: ACC },
    light: { bg: '#ebe7dd', grid: 'rgba(28,26,22,.08)', fg: '#1c1a16', dim: 'rgba(28,26,22,.55)', faint: 'rgba(28,26,22,.16)', fill: 'rgba(28,26,22,.05)', acc: ACC },
    accent: { bg: ACC, grid: 'rgba(19,19,17,.12)', fg: '#131311', dim: 'rgba(19,19,17,.6)', faint: 'rgba(19,19,17,.2)', fill: 'rgba(19,19,17,.08)', acc: '#ffffff' },
    gradient: { bg: 'gradient', grid: 'rgba(232,226,210,.06)', fg: '#e8e2d2', dim: 'rgba(232,226,210,.5)', faint: 'rgba(232,226,210,.16)', fill: 'rgba(232,226,210,.05)', acc: ACC },
    image: { bg: '#1d1b16', grid: 'rgba(232,226,210,.05)', fg: '#e8e2d2', dim: 'rgba(232,226,210,.5)', faint: 'rgba(232,226,210,.16)', fill: 'rgba(232,226,210,.05)', acc: ACC, hatch: true },
  };
  const IN_DUR = { cut: 0, fade: 0.45, 'slide-up': 0.5, 'slide-down': 0.5, 'slide-left': 0.5, 'slide-right': 0.5, 'scale-up': 0.5, pop: 0.4,
    draw: 0.7, 'mask-reveal': 0.55, drop: 0.6, 'spin-in': 0.6, 'blur-in': 0.5 };
  const OUT_DUR = 0.35;
  const TR = { dissolve: 0.3, 'wipe-left': 0.3, 'wipe-right': 0.3, 'wipe-up': 0.3, iris: 0.35, 'zoom-through': 0.25, whip: 0.18, glitch: 0.15, flash: 0.12 };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function shapePath(ctx, shape, w, h) {
    const rx = w / 2, ry = h / 2;
    ctx.beginPath();
    if (shape === 'circle' || shape === 'ring') { ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); return 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2); }
    if (shape === 'triangle') { ctx.moveTo(0, -ry); ctx.lineTo(rx, ry); ctx.lineTo(-rx, ry); ctx.closePath(); return w + 2 * Math.hypot(rx, h); }
    const pts = [];
    if (shape === 'hexagon') for (let i = 0; i < 6; i++) { const a = i * TAU / 6 - TAU / 12; pts.push([Math.cos(a) * rx, Math.sin(a) * ry]); }
    else if (shape === 'star') for (let i = 0; i < 10; i++) { const a = i * TAU / 10 - TAU / 4, r = i % 2 ? 0.45 : 1; pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]); }
    else if (shape === 'blob') for (let i = 0; i < 48; i++) { const a = i * TAU / 48, r = 0.9 * (1 + 0.12 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 5)); pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]); }
    if (pts.length) {
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      let L = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      return L;
    }
    const r = Math.min(w, h) * 0.08;
    roundRect(ctx, -rx, -ry, w, h, r);
    return 2 * (w + h);
  }

  class WireframePlayer {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.buf = document.createElement('canvas');
      this.sb = null;
      this.notes = false;
      this.W = 1920; this.H = 1080;
    }

    load(sb) {
      this.sb = sb;
      const [W, H] = SIZES[sb.aspect] || SIZES['16:9'];
      this.W = W; this.H = H;
      this.c.width = W; this.c.height = H;
      this.buf.width = W; this.buf.height = H;
    }

    sceneIndex(t) {
      const sc = this.sb.scenes;
      for (let i = 0; i < sc.length; i++) if (t < sc[i].end) return i;
      return sc.length - 1;
    }

    draw(t) {
      if (!this.sb) return;
      const { ctx, W, H } = this;
      const sb = this.sb;
      t = Math.max(0, Math.min(sb.duration - 1e-4, t));
      const i = this.sceneIndex(t);
      const s = sb.scenes[i], next = sb.scenes[i + 1], prev = sb.scenes[i - 1];
      const lt = t - s.start;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.filter = 'none';

      // arriving through the previous scene's transition
      let zoomIn = 1, arriveAlpha = 1;
      if (prev && prev.transition === 'zoom-through' && lt < TR['zoom-through']) { const p = easeOut(lt / TR['zoom-through']); zoomIn = 0.82 + 0.18 * p; arriveAlpha = p; }
      this.drawScene(i, lt, zoomIn, arriveAlpha);

      // leaving through this scene's transition
      if (next) {
        const tr = s.transition, left = s.end - t, D = TR[tr];
        if (D && left < D) {
          const p = 1 - left / D;
          if (tr === 'dissolve') { ctx.save(); ctx.globalAlpha = p; this.drawScene(i + 1, 0); ctx.restore(); }
          else if (tr.startsWith('wipe')) {
            ctx.save(); ctx.beginPath();
            const e = easeInOut(p);
            if (tr === 'wipe-left') ctx.rect(W * (1 - e), 0, W * e + 1, H);
            else if (tr === 'wipe-right') ctx.rect(0, 0, W * e, H);
            else ctx.rect(0, H * (1 - e), W, H * e + 1);
            ctx.clip(); this.drawScene(i + 1, 0); ctx.restore();
            ctx.save(); ctx.fillStyle = ACC; ctx.globalAlpha = 0.9;
            const bar = Math.max(6, W * 0.006);
            if (tr === 'wipe-left') ctx.fillRect(W * (1 - e) - bar / 2, 0, bar, H);
            else if (tr === 'wipe-right') ctx.fillRect(W * e - bar / 2, 0, bar, H);
            else ctx.fillRect(0, H * (1 - e) - bar / 2, W, bar);
            ctx.restore();
          } else if (tr === 'iris') {
            this.buf.getContext('2d').drawImage(this.c, 0, 0);
            this.drawScene(i + 1, 0);
            ctx.save(); ctx.beginPath();
            ctx.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * (1 - easeInOut(p)), 0, TAU); ctx.clip();
            ctx.drawImage(this.buf, 0, 0); ctx.restore();
          } else if (tr === 'zoom-through') {
            this.buf.getContext('2d').drawImage(this.c, 0, 0);
            const z = 1 + 2.2 * p * p;
            ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1 - p * 0.9;
            ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
            ctx.drawImage(this.buf, 0, 0); ctx.restore();
          } else if (tr === 'whip') this.smear(p);
          else if (tr === 'glitch') this.glitch(p, t);
          else if (tr === 'flash') this.flash(p);
        }
      }
      if (prev) {
        const tr = prev.transition, D = TR[tr];
        if (D && lt < D) {
          const p = 1 - lt / D;
          if (tr === 'whip') this.smear(p);
          else if (tr === 'glitch') this.glitch(p, t);
          else if (tr === 'flash') this.flash(p);
        }
      }
      this.overlay(t, i, s, lt);
    }

    flash(p) {
      const { ctx, W, H } = this;
      ctx.save(); ctx.globalAlpha = 0.9 * p; ctx.fillStyle = '#fffaf0'; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    smear(p) {
      const { ctx, W, H } = this;
      const b = this.buf.getContext('2d');
      b.clearRect(0, 0, W, H); b.drawImage(this.c, 0, 0);
      ctx.save();
      for (let k = 1; k <= 5; k++) { ctx.globalAlpha = 0.22 * p; ctx.drawImage(this.buf, (k * W * 0.025) * p, 0); ctx.drawImage(this.buf, -(k * W * 0.025) * p, 0); }
      ctx.globalAlpha = 0.5 * p; ctx.fillStyle = 'rgba(255,255,255,.5)';
      for (let k = 0; k < 18; k++) ctx.fillRect(0, hash(k + 3) * H, W, 1 + hash(k) * 3);
      ctx.restore();
    }

    glitch(p, t) {
      const { ctx, W, H } = this;
      const b = this.buf.getContext('2d');
      b.clearRect(0, 0, W, H); b.drawImage(this.c, 0, 0);
      const f = Math.floor(t * 60);
      ctx.save();
      for (let k = 0; k < 9; k++) {
        const y = hash(f * 13 + k) * H, h = H * (0.02 + hash(f + k * 7) * 0.08), dx = (hash(f * 3 + k) - 0.5) * W * 0.12 * p;
        ctx.drawImage(this.buf, 0, y, W, h, dx, y, W, h);
      }
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.35 * p;
      ctx.fillStyle = ACC; ctx.fillRect(0, hash(f) * H, W, H * 0.03);
      ctx.restore();
    }

    drawScene(i, lt, zoom = 1, alpha = 1) {
      const { ctx, W, H } = this;
      const s = this.sb.scenes[i];
      const th = THEMES[s.bg] || THEMES.dark;
      ctx.save();
      ctx.globalAlpha *= alpha;
      this.camera(s, lt, zoom);
      this.background(s, th);
      const len = s.end - s.start;
      s.elements.forEach((el, k) => this.element(el, lt, len, th, i, k));
      ctx.restore();
    }

    camera(s, lt, zoom) {
      const { ctx, W, H } = this;
      const len = s.end - s.start, p = easeInOut(lt / len);
      let sc = zoom, tx = 0, ty = 0, rot = 0;
      switch (s.camera) {
        case 'push-in': sc *= 1 + 0.09 * p; break;
        case 'pull-out': sc *= 1.09 - 0.09 * p; break;
        case 'pan-left': tx = W * 0.035 - W * 0.07 * p; break;
        case 'pan-right': tx = -W * 0.035 + W * 0.07 * p; break;
        case 'tilt-up': ty = -H * 0.035 + H * 0.07 * p; break;
        case 'tilt-down': ty = H * 0.035 - H * 0.07 * p; break;
        case 'orbit': rot = (p - 0.5) * 0.05; sc *= 1.05; tx = Math.sin(p * Math.PI) * W * 0.012; break;
        case 'shake': { const k = Math.max(0, 1 - lt / 0.7), f = Math.floor(lt * 30); tx = (hash(f) - 0.5) * W * 0.022 * k; ty = (hash(f + 7) - 0.5) * H * 0.022 * k; break; }
      }
      ctx.translate(W / 2 + tx, H / 2 + ty); ctx.rotate(rot); ctx.scale(sc, sc); ctx.translate(-W / 2, -H / 2);
    }

    background(s, th) {
      const { ctx, W, H } = this;
      const x0 = -W * 0.15, y0 = -H * 0.15, w = W * 1.3, h = H * 1.3;
      if (th.bg === 'gradient') {
        const g = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
        g.addColorStop(0, '#34302a'); g.addColorStop(1, '#0c0b09'); ctx.fillStyle = g;
      } else ctx.fillStyle = th.bg;
      ctx.fillRect(x0, y0, w, h);
      const step = Math.round(Math.min(W, H) / 22);
      ctx.fillStyle = th.grid;
      for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
      if (th.hatch) {
        ctx.save(); ctx.strokeStyle = th.faint; ctx.lineWidth = 1.5;
        for (let x = -H; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H, 0); ctx.stroke(); }
        ctx.fillStyle = th.dim; ctx.font = `600 ${Math.round(Math.min(W, H) * 0.022)}px Outfit, system-ui, sans-serif`;
        ctx.textAlign = 'right'; ctx.fillText('BACKGROUND IMAGE', W * 0.965, H * 0.94);
        ctx.restore();
      }
    }

    element(el, lt, len, th, si, k) {
      const { ctx, W, H } = this;
      const since = lt - el.enter_at;
      if (since < 0) return;
      const inD = el.enter === 'type-on' ? Math.min(1.2, 0.035 * el.label.length + 0.1) : (IN_DUR[el.enter] ?? 0.45);
      const pin = inD ? c01(since / inD) : 1;
      let pout = 0;
      if (el.exit_at != null && el.exit && el.exit !== 'none') { const s = lt - el.exit_at; if (s > 0) pout = c01(s / OUT_DUR); if (pout >= 1) return; }
      const cx = el.x / 100 * W, cy = el.y / 100 * H, w = el.w / 100 * W, h = el.h / 100 * H;
      let alpha = 1, sc = 1, rot = 0, dx = 0, dy = 0, blur = 0, clipIn = null, clipOut = null, reveal = 1;
      const e = easeOut(pin);
      switch (el.enter) {
        case 'fade': alpha *= e; break;
        case 'slide-up': dy += (1 - e) * H * 0.08; alpha *= e; break;
        case 'slide-down': dy -= (1 - e) * H * 0.08; alpha *= e; break;
        case 'slide-left': dx += (1 - e) * W * 0.08; alpha *= e; break;
        case 'slide-right': dx -= (1 - e) * W * 0.08; alpha *= e; break;
        case 'scale-up': sc *= 0.6 + 0.4 * e; alpha *= e; break;
        case 'pop': sc *= backOut(pin); break;
        case 'drop': dy -= (1 - bounceOut(pin)) * H * 0.35; break;
        case 'spin-in': rot -= (1 - e) * TAU / 3; sc *= 0.7 + 0.3 * e; alpha *= e; break;
        case 'blur-in': blur += (1 - e) * 18; alpha *= e; break;
        case 'mask-reveal': clipIn = e; break;
        case 'draw': reveal = e; break;
        case 'type-on': reveal = pin; break;
      }
      if (pout > 0) {
        const o = easeInOut(pout);
        switch (el.exit) {
          case 'fade': alpha *= 1 - o; break;
          case 'slide-up': dy -= o * H * 0.08; alpha *= 1 - o; break;
          case 'slide-down': dy += o * H * 0.08; alpha *= 1 - o; break;
          case 'slide-left': dx -= o * W * 0.08; alpha *= 1 - o; break;
          case 'slide-right': dx += o * W * 0.08; alpha *= 1 - o; break;
          case 'scale-down': sc *= 1 - 0.5 * o; alpha *= 1 - o; break;
          case 'pop-out': sc *= pout < 0.3 ? 1 + 0.12 * (pout / 0.3) : 1.12 * (1 - (pout - 0.3) / 0.7); break;
          case 'wipe': clipOut = 1 - o; break;
          case 'blur-out': blur += o * 18; alpha *= 1 - o; break;
        }
      }
      const life = c01(since / Math.max(0.5, len - el.enter_at));
      const beat = 60 / (this.sb.bpm || 120);
      switch (el.move) {
        case 'drift-left': dx -= W * 0.04 * life; break;
        case 'drift-right': dx += W * 0.04 * life; break;
        case 'drift-up': dy -= H * 0.05 * life; break;
        case 'drift-down': dy += H * 0.05 * life; break;
        case 'spin': rot += life * TAU * 0.35; break;
        case 'pulse': sc *= 1 + 0.06 * Math.pow(Math.max(0, Math.cos((lt / beat) * TAU)), 6); break;
        case 'orbit': dx += Math.cos(lt * 1.8 + k) * W * 0.012; dy += Math.sin(lt * 1.8 + k) * H * 0.02; break;
        case 'float': dy += Math.sin(lt * 2.1 + k) * H * 0.012; break;
        case 'grow': sc *= 1 + 0.18 * life; break;
        case 'shrink': sc *= 1 - 0.18 * life; break;
      }
      if (alpha <= 0.002 || sc <= 0.001) return;
      ctx.save();
      ctx.globalAlpha *= alpha;
      if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.translate(cx + dx, cy + dy); ctx.rotate(rot); ctx.scale(sc, sc);
      if (clipIn != null || clipOut != null) {
        ctx.beginPath();
        if (clipIn != null) ctx.rect(-w / 2 - 6, -h / 2 - 6, (w + 12) * clipIn, h + 12);
        else ctx.rect(-w / 2 - 6 + (w + 12) * (1 - clipOut), -h / 2 - 6, (w + 12) * clipOut, h + 12);
        ctx.clip();
      }
      this.kind(el, w, h, lt, reveal, th, si * 31 + k);
      ctx.restore();
    }

    label(text, w, h, th, where) {
      if (!text) return;
      const { ctx } = this;
      const size = Math.max(14, Math.min(h * 0.11, w * 0.08, 30));
      ctx.font = `500 ${size}px Outfit, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let s = text;
      while (s.length > 4 && ctx.measureText(s).width > w * 0.92) s = s.slice(0, -2);
      if (s !== text) s = s.replace(/\s*\S?$/, '') + '…';
      ctx.fillStyle = th.dim;
      ctx.fillText(s, 0, where === 'below' ? h / 2 + size * 0.95 : where === 'top' ? -h / 2 + size * 1.1 : h / 2 - size * 1.1);
    }

    tag(text, x, y, th) {
      const { ctx } = this;
      const size = Math.max(11, Math.min(this.W, this.H) * 0.013);
      ctx.font = `600 ${size}px Outfit, system-ui, sans-serif`;
      const w = ctx.measureText(text).width + size * 1.2;
      ctx.fillStyle = th.faint; roundRect(ctx, x, y, w, size * 1.7, size * 0.35); ctx.fill();
      ctx.fillStyle = th.dim; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x + size * 0.6, y + size * 0.87);
    }

    kind(el, w, h, lt, reveal, th, seed) {
      const { ctx } = this;
      const col = el.accent ? th.acc : th.fg;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.012);
      switch (el.kind) {
        case 'text': {
          const text = el.label || '';
          let size = h * 0.78;
          const font = s => `700 ${s}px Outfit, system-ui, sans-serif`;
          ctx.font = font(size);
          const tw = ctx.measureText(text).width;
          if (tw > w) { size *= w / tw; ctx.font = font(size); }
          const full = ctx.measureText(text).width;
          const shown = el.enter === 'type-on' ? text.slice(0, Math.ceil(text.length * reveal)) : text;
          ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText(shown, -full / 2, 0);
          if (el.enter === 'type-on' && reveal < 1 && Math.floor(lt * 4) % 2 === 0) {
            ctx.fillRect(-full / 2 + ctx.measureText(shown).width + size * 0.05, -size * 0.38, size * 0.06, size * 0.76);
          }
          ctx.setLineDash([6, 8]); ctx.strokeStyle = th.faint; ctx.lineWidth = 1.5; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.setLineDash([]);
          break;
        }
        case 'shape': {
          const L = shapePath(ctx, el.shape, w, h);
          if (reveal >= 1 && el.shape !== 'ring') { ctx.fillStyle = el.accent ? 'rgba(255,107,26,.22)' : th.fill; ctx.fill(); }
          ctx.strokeStyle = col;
          if (reveal < 1) ctx.setLineDash([L * reveal, L]);
          ctx.stroke(); ctx.setLineDash([]);
          if (el.shape === 'ring') { ctx.save(); ctx.scale(0.78, 0.78); shapePath(ctx, 'ring', w, h); ctx.globalAlpha *= 0.5 * reveal; ctx.stroke(); ctx.restore(); }
          this.label(el.label, w, h, th, 'below');
          break;
        }
        case 'image': case 'icon': {
          const r = el.kind === 'icon' ? Math.min(w, h) * 0.22 : Math.min(w, h) * 0.03;
          roundRect(ctx, -w / 2, -h / 2, w, h, r);
          ctx.fillStyle = th.fill; ctx.fill();
          ctx.setLineDash([12, 9]); ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]);
          ctx.save(); ctx.clip(); ctx.strokeStyle = th.faint; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.stroke(); ctx.restore();
          this.label(el.label, w, h, th, el.kind === 'icon' ? 'below' : 'inside');
          if (w > 80 && h > 50) this.tag(el.kind === 'icon' ? 'ICON' : 'IMAGE', -w / 2 + 10, -h / 2 + 10, th);
          break;
        }
        case 'ui': {
          roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.06);
          ctx.fillStyle = th.fill; ctx.fill(); ctx.strokeStyle = col; ctx.stroke();
          const pad = Math.min(w, h) * 0.1;
          ctx.fillStyle = th.faint;
          ctx.fillRect(-w / 2 + pad, -h / 2 + pad, w * 0.35, Math.max(6, h * 0.07));
          for (let r = 0; r < 3; r++) ctx.fillRect(-w / 2 + pad, -h / 2 + pad + h * (0.24 + r * 0.14), (w - pad * 2) * (0.9 - hash(seed + r) * 0.4), Math.max(4, h * 0.045));
          ctx.fillStyle = el.accent ? th.acc : th.dim;
          roundRect(ctx, w / 2 - pad - w * 0.22, h / 2 - pad - h * 0.13, w * 0.22, h * 0.13, h * 0.065); ctx.fill();
          this.label(el.label, w, h, th, 'below');
          break;
        }
        case 'chart': {
          const x0 = -w / 2 + w * 0.08, y0 = h / 2 - h * 0.12, cw = w * 0.84, ch = h * 0.72;
          ctx.strokeStyle = th.dim; ctx.beginPath(); ctx.moveTo(x0, y0 - ch); ctx.lineTo(x0, y0); ctx.lineTo(x0 + cw, y0); ctx.stroke();
          const n = 6, bw = cw / n * 0.6;
          for (let b = 0; b < n; b++) {
            const bh = ch * (0.25 + 0.75 * ((b + 1) / n) * (0.7 + 0.3 * hash(seed + b))) * easeOut(reveal * 1.2 - b * 0.08);
            ctx.fillStyle = el.accent && b === n - 1 ? th.acc : th.faint;
            ctx.fillRect(x0 + (b + 0.2) * cw / n, y0 - bh, bw, bh);
          }
          this.label(el.label, w, h, th, 'below');
          break;
        }
        case 'particles': {
          const n = 140;
          for (let q = 0; q < n; q++) {
            const a = hash(seed * 7 + q) * TAU, r = Math.sqrt(hash(seed + q * 3.1));
            const x = Math.cos(a + lt * 0.25 * (hash(q) - 0.5)) * r * w / 2 + Math.sin(lt * 1.3 + q) * w * 0.012;
            const y = Math.sin(a + lt * 0.25 * (hash(q) - 0.5)) * r * h / 2 + Math.cos(lt * 1.1 + q) * h * 0.012;
            ctx.fillStyle = el.accent && q % 9 === 0 ? th.acc : th.dim;
            const d = 2 + hash(q + 1) * 3;
            ctx.fillRect(x - d / 2, y - d / 2, d, d);
          }
          this.label(el.label, w, h, th, 'below');
          break;
        }
        case '3d': {
          const s = Math.min(w, h) * 0.34, ay = lt * 0.9 + seed, ax = 0.55;
          const V = [];
          for (const X of [-1, 1]) for (const Y of [-1, 1]) for (const Z of [-1, 1]) {
            const x1 = X * Math.cos(ay) - Z * Math.sin(ay), z1 = X * Math.sin(ay) + Z * Math.cos(ay);
            const y2 = Y * Math.cos(ax) - z1 * Math.sin(ax);
            V.push([x1 * s, y2 * s]);
          }
          const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
          ctx.strokeStyle = col; ctx.beginPath();
          for (const [a, b] of E) { ctx.moveTo(V[a][0], V[a][1]); ctx.lineTo(V[b][0], V[b][1]); }
          ctx.stroke();
          this.tag('3D', -w / 2 + 6, -h / 2 + 6, th);
          this.label(el.label, w, h, th, 'below');
          break;
        }
        case 'line': {
          ctx.strokeStyle = col; ctx.lineWidth = Math.max(3, h * 0.25, Math.min(this.W, this.H) * 0.004);
          ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(-w / 2 + w * reveal, 0); ctx.stroke();
          break;
        }
        case 'grid': {
          const n = 8, gx = w / n, gy = h / Math.max(1, Math.round(n * h / w));
          ctx.fillStyle = el.accent ? th.acc : th.dim;
          for (let y = -h / 2 + gy / 2; y < h / 2; y += gy) for (let x = -w / 2 + gx / 2; x < w / 2; x += gx) ctx.fillRect(x - 2, y - 2, 4, 4);
          this.label(el.label, w, h, th, 'below');
          break;
        }
        default: {
          ctx.strokeStyle = col; ctx.strokeRect(-w / 2, -h / 2, w, h);
          this.label(el.label, w, h, th, 'inside');
        }
      }
    }

    overlay(t, i, s, lt) {
      const { ctx, W, H } = this;
      const k = Math.min(W, H) / 1080;
      ctx.save();
      // safe-frame corners
      ctx.strokeStyle = 'rgba(232,226,210,.28)'; ctx.lineWidth = 2 * k;
      const m = Math.min(W, H) * 0.045, L = 26 * k;
      for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
        ctx.beginPath(); ctx.moveTo(x, y + sy * L); ctx.lineTo(x, y); ctx.lineTo(x + sx * L, y); ctx.stroke();
      }
      // scene chip
      const label = `S${i + 1}  ${s.name.toUpperCase()}`;
      ctx.font = `600 ${22 * k}px Outfit, system-ui, sans-serif`;
      const lw = ctx.measureText(label).width;
      const range = `${s.start.toFixed(1)}-${s.end.toFixed(1)}s`;
      ctx.font = `400 ${18 * k}px Outfit, system-ui, sans-serif`;
      const rw = ctx.measureText(range).width;
      ctx.fillStyle = 'rgba(19,19,17,.72)';
      roundRect(ctx, m, m, lw + rw + 80 * k, 42 * k, 8 * k); ctx.fill();
      // beat light, first in the chip: flashes on every beat of the storyboard's bpm
      const beat = 60 / (this.sb.bpm || 120), ph = (t / beat) % 1;
      ctx.globalAlpha = 0.25 + 0.75 * Math.max(0, 1 - ph * 4);
      ctx.fillStyle = '#ff6b1a'; ctx.beginPath(); ctx.arc(m + 21 * k, m + 21 * k, 7 * k, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ff6b1a'; ctx.font = `600 ${22 * k}px Outfit, system-ui, sans-serif`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      ctx.fillText(label, m + 40 * k, m + 21 * k);
      ctx.fillStyle = 'rgba(232,226,210,.7)'; ctx.font = `400 ${18 * k}px Outfit, system-ui, sans-serif`;
      ctx.fillText(range, m + 56 * k + lw, m + 21 * k);
      // notes band
      if (this.notes && (s.idea || s.sfx)) {
        const pad = 22 * k, fs = 24 * k;
        ctx.font = `400 ${fs}px Outfit, system-ui, sans-serif`;
        const maxW = W - m * 2 - pad * 2;
        const words = (s.idea || '').split(/\s+/), lines = [];
        let line = '';
        for (const wd of words) { const test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test; }
        if (line) lines.push(line);
        if (s.sfx) lines.push('♪ ' + s.sfx);
        const shown = lines.slice(0, 5), bh = shown.length * fs * 1.35 + pad * 1.6;
        ctx.fillStyle = 'rgba(19,19,17,.82)';
        roundRect(ctx, m, H - m - bh, W - m * 2, bh, 10 * k); ctx.fill();
        ctx.fillStyle = '#e8e2d2'; ctx.textBaseline = 'top';
        shown.forEach((ln, n) => { ctx.fillStyle = ln.startsWith('♪') ? '#ff6b1a' : '#e8e2d2'; ctx.fillText(ln, m + pad, H - m - bh + pad * 0.8 + n * fs * 1.35); });
      }
      ctx.restore();
    }
  }

  window.WireframePlayer = WireframePlayer;
  window.WIREFRAME_SIZES = SIZES;
})();
