/* bg-ascii.js — photo background that transforms into ASCII art.
   Put data-bg="assets/your-photo.jpg" on the hero <section>. The photo sits full-height on the right,
   fades into the dark on the left (so text stays readable) and drifts slightly with the mouse.
   Any element with [data-ascii-toggle] (or BgAscii.toggle()) switches the photo to a glyph-mosaic
   built from the photo's own colours, sweeping left to right; click again to switch back.
   Also adds a small trailing-arrow cursor over the hero (fine pointers only).
   Add:  <script src="scripts/bg-ascii.js" defer></script>      Optional attributes on the hero:
   data-bg-side="right|left" (default right), data-bg-color="#050607" */
(() => {
  const hero = document.querySelector('[data-bg]');
  if (!hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const BG = hero.dataset.bgColor || '#050607';
  const SIDE = hero.dataset.bgSide === 'left' ? 'left' : 'right';
  const RAMP = ' .,:;-=+*#%@';
  const CW = 8, CH = 13;

  const css = `
[data-bg]{position:relative;isolation:isolate}
.bg-wrap{position:absolute;inset:0;z-index:-1;overflow:hidden;background:${BG};pointer-events:none}
.bg-wrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.bg-trail{position:fixed;left:0;top:0;z-index:200;pointer-events:none;font:11px/1 var(--mono,monospace);color:var(--lime,#d7ff64);opacity:0;transition:opacity .25s;will-change:transform}
.bg-trail.on{opacity:var(--o,.8)}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  // keep the hero's own content above the background
  [...hero.children].forEach((c) => { if (getComputedStyle(c).position === 'static') c.style.position = 'relative'; });

  const wrap = document.createElement('div');
  wrap.className = 'bg-wrap';
  wrap.setAttribute('aria-hidden', 'true');
  const filters = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  filters.setAttribute('aria-hidden', 'true');
  filters.setAttribute('width', '0');
  filters.setAttribute('height', '0');
  filters.innerHTML = '<filter id="hero-fluid-warp" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".006 .009" numOctaves="1" seed="4" result="noise"><animate attributeName="baseFrequency" begin="indefinite" values=".006 .009;.008 .011;.005 .007;.006 .009" dur="11s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>';
  wrap.appendChild(filters);
  const cv = document.createElement('canvas');
  wrap.appendChild(cv);
  hero.prepend(wrap);
  const ctx = cv.getContext('2d');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  let W = 0, H = 0, dpr = 1, frame, cols = 0, rows = 0, cells = null;
  let p = 0, target = 0, raf = 0, last = 0;
  let mx = 0, my = 0, smx = 0, hx = -1, hy = -1; // mouse parallax + glyph highlight

  function compose() { // photo (with soft edges) drawn into an offscreen canvas
    frame = frame || document.createElement('canvas');
    frame.width = Math.round(W * dpr); frame.height = Math.round(H * dpr);
    const f = frame.getContext('2d');
    f.scale(dpr, dpr);
    f.fillStyle = BG; f.fillRect(0, 0, W, H);
    const ar = img.naturalWidth / img.naturalHeight;
    let dh = H * 1.04, dw = dh * ar;
    if (dw > W) { dw = W; dh = dw / ar; }
    const dx = SIDE === 'right' ? W - dw + W * .02 : -W * .02;
    const dy = (H - dh) / 2;
    f.drawImage(img, dx, dy, dw, dh);
    const fade = (x0, x1, a, b) => { const g = f.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, a); g.addColorStop(1, b); f.fillStyle = g; };
    const edge = Math.min(dw * .55, W * .3);
    if (SIDE === 'right') { fade(dx, dx + edge, BG, 'rgba(5,6,7,0)'); f.fillRect(dx - 1, 0, edge + 1, H); }
    else { fade(dx + dw - edge, dx + dw, 'rgba(5,6,7,0)', BG); f.fillRect(dx + dw - edge, 0, edge + 1, H); }
    const v = f.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, 'rgba(5,6,7,.55)'); v.addColorStop(.2, 'rgba(5,6,7,0)'); v.addColorStop(.7, 'rgba(5,6,7,0)'); v.addColorStop(1, 'rgba(5,6,7,.8)');
    f.fillStyle = v; f.fillRect(0, 0, W, H);
    // sample cells for the ASCII layer
    cols = Math.ceil(W / CW); rows = Math.ceil(H / CH);
    const s = document.createElement('canvas'); s.width = cols; s.height = rows;
    const sc = s.getContext('2d'); sc.drawImage(frame, 0, 0, cols, rows);
    cells = sc.getImageData(0, 0, cols, rows).data;
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    if (!frame) return;
    const e = p * p * (3 - 2 * p); // smoothstep
    if (e < 1) {
      ctx.globalAlpha = 1 - Math.min(1, e * 1.6);
      ctx.drawImage(frame, smx * -14, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (e > 0 && cells) {
      ctx.font = `${CH - 1}px "DM Mono",ui-monospace,monospace`;
      ctx.textBaseline = 'top';
      const moving = p > 0 && p < 1;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          const r = cells[i], g = cells[i + 1], b = cells[i + 2];
          let l = (r * .299 + g * .587 + b * .114) / 255;
          if (l < .045) continue;
          l = Math.min(1, Math.pow(l, .55) * 1.2); // lift the shadows so dark clothing still reads
          // sweep: columns light up left→right (or right→left) with a little noise
          const pos = SIDE === 'right' ? 1 - x / cols : x / cols;
          const rv = Math.min(1, Math.max(0, e * 1.7 - pos * .7 - ((x * 7 + y * 13) % 10) / 60));
          if (rv <= 0) continue;
          const d = hx < 0 ? 99 : Math.hypot(x - hx, y - hy);
          if (d < 7) l = Math.min(1, l + (1 - d / 7) * .6);
          let k = Math.floor(l * (RAMP.length - 1));
          if (moving && rv < 1) k = Math.min(RAMP.length - 1, Math.max(1, k + ((Math.random() * 5) | 0) - 2));
          const boost = d < 7 ? 2.2 : 1.7;
          ctx.globalAlpha = rv * (.45 + .55 * l);
          ctx.fillStyle = `rgb(${Math.min(255, r * boost) | 0},${Math.min(255, g * boost) | 0},${Math.min(255, b * boost) | 0})`;
          ctx.fillText(RAMP[k], x * CW, y * CH);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function tick(ts) {
    const dt = Math.min((ts - (last || ts)) / 1000, .05); last = ts;
    const step = dt / 1.2;
    p = p < target ? Math.min(target, p + step) : Math.max(target, p - step);
    smx += (mx - smx) * .08;
    render();
    if (p !== target || Math.abs(mx - smx) > .002) raf = requestAnimationFrame(tick); else { raf = 0; last = 0; }
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function size() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    if (img.complete && img.naturalWidth) compose();
    render();
  }

  const api = {
    setMotion(enabled) {
      const animation = filters.querySelector('animate');
      if (!animation || typeof animation.beginElement !== 'function' || typeof animation.endElement !== 'function') return;
      if (enabled) animation.beginElement();
      else animation.endElement();
    },
    set(on) {
      target = on ? 1 : 0;
      hero.classList.toggle('ascii-on', on);
      document.querySelectorAll('[data-ascii-toggle]').forEach((b) => b.setAttribute('aria-pressed', String(on)));
      if (reduced) { p = target; render(); } else kick();
    },
    toggle() { api.set(target < .5); }
  };
  window.BgAscii = api;
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-ascii-toggle]'); if (b) { e.preventDefault(); api.toggle(); } });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && target) api.set(false); });

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width - .5) * 2;
    my = (e.clientY - r.top) / r.height;
    hx = (e.clientX - r.left) / CW; hy = (e.clientY - r.top) / CH;
    if (!reduced) kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { mx = 0; hx = hy = -1; if (!reduced) kick(); });

  // trailing-arrow cursor
  if (fine && !reduced) {
    const N = 6, dots = [], pos = [];
    for (let i = 0; i < N; i++) {
      const d = document.createElement('span');
      d.className = 'bg-trail'; d.textContent = '↖'; d.style.setProperty('--o', (0.85 - i * .12).toFixed(2));
      document.body.appendChild(d); dots.push(d); pos.push({ x: -50, y: -50 });
    }
    let tx = -50, ty = -50, tr = 0;
    const loop = () => {
      let moving = false;
      pos.forEach((q, i) => {
        const k = .32 - i * .04;
        q.x += (tx - q.x) * k; q.y += (ty - q.y) * k;
        if (Math.abs(tx - q.x) + Math.abs(ty - q.y) > .4) moving = true;
        dots[i].style.transform = `translate(${q.x + 8}px,${q.y + 8}px)`;
      });
      tr = moving ? requestAnimationFrame(loop) : 0;
    };
    hero.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; dots.forEach((d) => d.classList.add('on')); if (!tr) tr = requestAnimationFrame(loop); }, { passive: true });
    hero.addEventListener('pointerleave', () => dots.forEach((d) => d.classList.remove('on')));
  }

  new ResizeObserver(size).observe(hero);
  img.onload = size;
  img.src = hero.dataset.bg;
})();
