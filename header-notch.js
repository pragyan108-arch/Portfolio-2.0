/* header-notch.js — "dynamic island" header.
   A small dark notch hangs from the top edge showing only the logo. Hover / focus expands it
   into a pill with the nav links fading in one by one; leaving collapses it again.
   Builds itself from the existing #nav links, so no markup changes are needed.
   Desktop (hover-capable, >900px) only: on touch/small screens the original header stays.
   Add:  <script src="header-notch.js" defer></script> */
(() => {
  if (!matchMedia('(min-width:901px) and (hover:hover)').matches) return;
  const src = [...document.querySelectorAll('#nav a')];
  if (!src.length) return;

  const BG = '#050607', EAR = 20;
  const css = `
.topbar{display:none!important}
.notch{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:100;display:flex;font:500 12px/1 var(--sans,system-ui);letter-spacing:.02em;color:var(--text,#f3f1eb)}
.notch::before,.notch::after{content:"";position:absolute;top:0;width:${EAR}px;height:${EAR}px;pointer-events:none}
.notch::before{right:100%;background:radial-gradient(circle at 0 100%,transparent ${EAR - .5}px,${BG} ${EAR}px)}
.notch::after{left:100%;background:radial-gradient(circle at 100% 100%,transparent ${EAR - .5}px,${BG} ${EAR}px)}
.notch-in{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:38px;width:84px;padding:0 14px;background:${BG};border-radius:0 0 22px 22px;overflow:hidden;white-space:nowrap;transition:width .65s cubic-bezier(.7,0,.2,1),height .45s cubic-bezier(.7,0,.2,1)}
.notch.is-open .notch-in{width:var(--open-w,560px)}
.notch-logo{font:400 19px/1 var(--serif,Georgia,serif);letter-spacing:.04em;color:inherit;text-decoration:none;padding:0 10px;transition:transform .5s cubic-bezier(.7,0,.2,1)}
.notch-side{display:flex;gap:24px;min-width:0}
.notch-side:first-child{justify-content:flex-end;padding-right:14px}
.notch-side:last-child{justify-content:flex-start;padding-left:14px}
.notch-side a{color:rgba(243,241,235,.62);text-decoration:none;opacity:0;transform:translateY(-8px);transition:opacity .25s,transform .25s,color .2s}
.notch.is-open .notch-side a{opacity:1;transform:none;transition:opacity .45s var(--d,0s),transform .55s cubic-bezier(.2,.8,.2,1) var(--d,0s),color .2s}
.notch-side a:hover,.notch-side a:focus-visible,.notch-side a.is-active{color:var(--lime,#d7ff64)}
@media (prefers-reduced-motion:reduce){.notch-in,.notch-side a,.notch-logo{transition:none!important}}`;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

  const label = (a) => (a.childNodes[0] ? a.childNodes[0].textContent : a.textContent).trim();
  const half = Math.ceil(src.length / 2);
  const side = (arr, off) => `<div class="notch-side">${arr.map((a, i) =>
    `<a href="${a.getAttribute('href')}" style="--d:${(0.12 + (i + off) * 0.06).toFixed(2)}s">${label(a)}</a>`).join('')}</div>`;
  const el = document.createElement('header');
  el.className = 'notch';
  el.innerHTML = `<nav class="notch-in" aria-label="Main navigation">${side(src.slice(0, half), 0)}<a class="notch-logo" href="#top" aria-label="Home">PS</a>${side(src.slice(half), half)}</nav>`;
  document.body.prepend(el);

  const inner = el.querySelector('.notch-in');
  const sides = el.querySelectorAll('.notch-side');
  const measure = () => {
    // sum link widths (offsetWidth works even while clipped; scrollWidth ignores left overflow)
    const sideW = (s) => { const a = [...s.querySelectorAll('a')]; return a.reduce((t, x) => t + x.offsetWidth, 0) + 24 * (a.length - 1) + 14; };
    const w = Math.max(...[...sides].map(sideW)) * 2 + el.querySelector('.notch-logo').offsetWidth + 28;
    el.style.setProperty('--open-w', Math.ceil(w) + 'px');
  };
  measure();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener('resize', measure);

  let t;
  const open = () => { clearTimeout(t); measure(); el.classList.add('is-open'); };
  const close = () => { clearTimeout(t); t = setTimeout(() => el.classList.remove('is-open'), 160); };
  el.addEventListener('pointerenter', open);
  el.addEventListener('pointerleave', close);
  el.addEventListener('focusin', open);
  el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) close(); });
  el.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => el.classList.remove('is-open')));

  // highlight the link of the section in view
  const map = new Map();
  el.querySelectorAll('.notch-side a').forEach((a) => {
    const s = document.querySelector(a.getAttribute('href'));
    if (s) map.set(s, a);
  });
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    if (e.isIntersecting) { map.forEach((a) => a.classList.remove('is-active')); map.get(e.target).classList.add('is-active'); }
  }), { rootMargin: '-45% 0px -50% 0px' });
  map.forEach((_, s) => io.observe(s));
})();
