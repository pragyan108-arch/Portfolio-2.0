/* bg-halftone.js — centred halftone-dot portrait that dissolves into particles and re-assembles.
   Put data-halftone="assets/your-photo.jpg" on the hero <section>. The photo is drawn as a black-and-white
   dot-matrix portrait behind the hero text. Behaviour:
     • on load the dots fly in and assemble into the portrait
     • moving the mouse over it pushes the dots away; they spring back
     • scrolling down dissolves the portrait into drifting dots; scrolling back up re-assembles it
   Optional attributes on the hero:
     data-ht-cell="5"        dot grid size in px (smaller = finer, heavier)
     data-ht-height=".8"     portrait height as a fraction of the hero height
     data-ht-y=".42"         vertical centre of the portrait (fraction of hero height)
     data-ht-focus=".55,.35" where the subject sits in the photo (x,y, 0–1) — everything far from it fades out
     data-ht-color="#050607" background colour, data-ht-ink="236,232,224" dot colour (r,g,b)
   Falls back to a still dot portrait on reduced motion. Add:  <script src="bg-halftone.js" defer></script> */
(() => {
  const hero = document.querySelector('[data-halftone]');
  if (!hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const num = (k, d) => (hero.dataset[k] !== undefined && !isNaN(+hero.dataset[k]) ? +hero.dataset[k] : d);
  const CELL = num('htCell', 5), HF = num('htHeight', .8), YC = num('htY', .42);
  const BG = hero.dataset.htColor || '#050607';
  const INK = hero.dataset.htInk || '236,232,224';
  const [FX, FY] = (hero.dataset.htFocus || '.5,.4').split(',').map(Number);

  const style = document.createElement('style');
  style.textContent = `[data-halftone]{position:relative;isolation:isolate}
.ht-wrap{position:absolute;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:${BG}}
.ht-wrap canvas{position:absolute;inset:0;width:100%;height:100%;display:block}`;
  document.head.appendChild(style);
  const wrap = document.createElement('div');
  wrap.className = 'ht-wrap'; wrap.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  wrap.appendChild(cv); hero.prepend(wrap);
  const ctx = cv.getContext('2d');

  const img = new Image();
  img.crossOrigin = 'anonymous';
  let W = 0, H = 0, dpr = 1, dots = [], raf = 0, visible = true, ready = false;
  let px = -9999, py = -9999, intro = reduced ? 0 : 1, t0 = 0, lastD = -1;

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function build() {
    W = hero.clientWidth; H = hero.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const ar = img.naturalWidth / img.naturalHeight;
    let dh = H * HF, dw = dh * ar;
    if (dw > W * .92) { dw = W * .92; dh = dw / ar; }
    const x0 = (W - dw) / 2, y0 = H * YC - dh / 2;
    const cols = Math.max(8, Math.floor(dw / CELL)), rows = Math.max(8, Math.floor(dh / CELL));
    const s = document.createElement('canvas'); s.width = cols; s.height = rows;
    const sc = s.getContext('2d'); sc.drawImage(img, 0, 0, cols, rows);
    const data = sc.getImageData(0, 0, cols, rows).data;
    // auto-levels over the masked area so dark clothing / dim faces still produce visible dots
    const lums = [], cellMask = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 4;
      const lum = (data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114) / 255;
      const u = (c / cols - FX) / .42, v = (r / rows - FY) / .62;
      const m = 1 - smooth(.55, 1, Math.hypot(u, v));
      lums.push(lum); cellMask.push(m);
    }
    const inside = lums.filter((_, k) => cellMask[k] > .5).sort((a, b) => a - b);
    const lo = inside.length ? inside[Math.floor(inside.length * .04)] : 0;
    const hi = inside.length ? inside[Math.floor(inside.length * .97)] : 1;
    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c;
        const l = Math.pow(Math.min(1, Math.max(0, (lums[k] - lo) / Math.max(.05, hi - lo))), .75);
        const rad = CELL * .56 * l * cellMask[k];
        if (rad < .45) continue;
        dots.push({ hx: x0 + (c + .5) * CELL, hy: y0 + (r + .5) * CELL, r: rad, ox: 0, oy: 0, vx: 0, vy: 0,
          k: Math.random(), a: Math.random() * 6.283 });
      }
    }
    ready = true; t0 = 0; draw(true); kick();
  }

  function scrollD() {
    const b = hero.getBoundingClientRect();
    return smooth(0, .6, Math.min(1, Math.max(0, -b.top / (b.height || 1))));
  }

  function draw(still) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    const d = Math.max(scrollD(), intro);
    ctx.globalAlpha = 1 - d * .85;
    ctx.fillStyle = `rgb(${INK})`;
    ctx.beginPath();
    let energy = 0;
    const R = 110;
    for (let n = 0; n < dots.length; n++) {
      const p = dots[n];
      if (!still && !reduced) {
        const dd = Math.min(1, Math.max(0, d * 1.25 - p.k * .25)); // staggered per dot
        const tx = Math.cos(p.a) * dd * (50 + p.k * 170);
        const ty = Math.sin(p.a) * dd * (30 + p.k * 90) - dd * (30 + p.k * 120);
        let fx = (tx - p.ox) * .07, fy = (ty - p.oy) * .07;
        const dx = p.hx + p.ox - px, dy = p.hy + p.oy - py, dist = Math.hypot(dx, dy);
        if (dist < R && dist > .1) { const f = (1 - dist / R); const k = f * f * 3.2; fx += dx / dist * k; fy += dy / dist * k; }
        p.vx = (p.vx + fx) * .86; p.vy = (p.vy + fy) * .86;
        p.ox += p.vx; p.oy += p.vy;
        energy += Math.abs(p.vx) + Math.abs(p.vy);
      }
      const rr = p.r * (1 - d * .45);
      const x = p.hx + p.ox, y = p.hy + p.oy;
      ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, 6.283);
    }
    ctx.fill();
    ctx.globalAlpha = 1;
    return { energy, d };
  }

  function tick(ts) {
    raf = 0;
    if (!ready || !visible) return;
    if (!t0) t0 = ts;
    if (!reduced && intro > 0) { const e = Math.min(1, Math.max(0, (ts - t0 - 250) / 2200)); intro = Math.pow(1 - e, 2); }
    const { energy, d } = draw(false);
    const moving = energy / Math.max(1, dots.length) > .01 || Math.abs(d - lastD) > .0005 || intro > 0 || px > -9000;
    lastD = d;
    if (moving) raf = requestAnimationFrame(tick);
  }
  function kick() { if (!raf && ready && visible) raf = requestAnimationFrame(tick); }

  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top; kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { px = py = -9999; kick(); });
  addEventListener('scroll', kick, { passive: true });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) kick(); }).observe(hero);
  new ResizeObserver(() => { if (img.complete && img.naturalWidth) build(); }).observe(hero);
  img.onload = build;
  img.src = hero.dataset.halftone;
})();
