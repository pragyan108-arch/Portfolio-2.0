/* photo-ink.js — ink / smoke dissolve on photos.
   Hover (or touch-drag) smears the photo into an ink wash that settles back;
   photos also "resolve" from ink when they scroll into view.
   Vanilla WebGL, no dependencies. Add:  <script src="scripts/photo-ink.js" defer></script>
   Targets: any <img data-ink> plus the selectors in SELECTORS below.
   Falls back to the plain <img> when WebGL fails, on reduced motion, or if the image is cross-origin. */
(() => {
  const SELECTORS = '[data-ink], .hero-image img, .person-image img, .photo-strip img';
  const MAX_PTS = 24;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  try { if (!document.createElement('canvas').getContext('webgl')) return; } catch (e) { return; }

  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
varying vec2 v;uniform sampler2D t;uniform vec2 res,scale,off;uniform vec4 pts[${MAX_PTS}];
uniform float reveal,time;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p*=2.03;a*=.5;}return s;}
vec3 tex(vec2 uv){return texture2D(t,clamp((uv-.5)*scale+.5+off,0.,1.)).rgb;}
void main(){
  float asp=res.x/res.y;
  float nz=fbm(v*5.+time*.04);
  float inf=0.;
  for(int i=0;i<${MAX_PTS};i++){
    vec4 q=pts[i];
    float d=length((v-q.xy)*vec2(asp,1.))+(nz-.5)*.10;
    inf=max(inf,q.w*smoothstep(q.z,0.,d));
  }
  // reveal sweeps top-down with a ragged "dripping" edge, then fades
  float drip=fbm(vec2(v.x*14.,v.y*1.5))*.45;
  float rv=smoothstep(0.,.35,reveal*1.35-v.y*.35+drip-.2);
  inf=max(inf,rv*step(.001,reveal));
  vec2 w=(vec2(fbm(v*7.+3.),fbm(v*7.+11.))-.5)*inf*.38;
  w.y+=inf*inf*.05;
  vec2 uv=v+w;
  float r=inf*.03;
  vec3 c=tex(uv)*.28+tex(uv+vec2(r,0.))*.18+tex(uv-vec2(r,0.))*.18+tex(uv+vec2(0.,r))*.18+tex(uv-vec2(0.,r))*.18;
  float g=dot(c,vec3(.3,.59,.11));
  c=mix(c,vec3(g),inf*.8);
  float wash=smoothstep(.35,1.,inf*(.8+1.1*nz));
  c=mix(c,vec3(.93,.9,.92)*(.8+.2*nz),wash*.85);
  c=mix(c,c*vec3(.82,.74,.8),inf*smoothstep(.3,.7,nz)*.5);
  gl_FragColor=vec4(c,1.);
}`;

  function sh(gl, type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function setup(img) {
    if (img.dataset.inkReady) return;
    img.dataset.inkReady = '1';
    const src = img.currentSrc || img.src;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { try { build(img, im); } catch (e) { /* keep plain image */ } };
    im.src = src;
  }

  function build(img, im) {
    const host = img.parentElement;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;pointer-events:none;display:block;';
    host.appendChild(cv);
    const gl = cv.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tx = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tx);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); // throws if tainted
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const U = (n) => gl.getUniformLocation(prog, n);
    const u = { res: U('res'), scale: U('scale'), off: U('off'), pts: U('pts'), reveal: U('reveal'), time: U('time') };

    const cs = getComputedStyle(img);
    cv.style.borderRadius = cs.borderRadius;
    cv.style.filter = cs.filter === 'none' ? '' : cs.filter; // keep the site's saturate() look
    const [ox, oy] = cs.objectPosition.split(' ').map((s) => (s.endsWith('%') ? parseFloat(s) / 100 : 0.5));

    const pts = [];          // {x,y,r,life}
    const arr = new Float32Array(MAX_PTS * 4);
    let reveal = 1, revealing = false, raf = 0, last = 0, ready = false;

    function layout() {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = img.offsetWidth, h = img.offsetHeight;
      if (!w || !h) return;
      cv.style.left = img.offsetLeft + 'px'; cv.style.top = img.offsetTop + 'px';
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      gl.viewport(0, 0, cv.width, cv.height);
      const ca = w / h, ia = im.naturalWidth / im.naturalHeight;
      const sx = ca > ia ? 1 : ca / ia, sy = ca > ia ? ia / ca : 1; // object-fit: cover
      gl.uniform2f(u.res, w, h);
      gl.uniform2f(u.scale, sx, sy);
      gl.uniform2f(u.off, (ox - .5) * (1 - sx), (oy - .5) * (1 - sy));
      draw(0);
    }

    function draw(time) {
      arr.fill(0);
      for (let i = 0; i < pts.length && i < MAX_PTS; i++) {
        const p = pts[pts.length - 1 - i];
        arr.set([p.x, p.y, p.r, p.life * p.life], i * 4);
      }
      gl.uniform4fv(u.pts, arr);
      gl.uniform1f(u.reveal, reveal);
      gl.uniform1f(u.time, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!ready) { ready = true; img.style.opacity = '0'; } // hide plain img once canvas has painted
    }

    function frame(ts) {
      const dt = Math.min((ts - (last || ts)) / 1000, .05); last = ts;
      for (const p of pts) p.life -= dt * .75;
      while (pts.length && pts[0].life <= 0) pts.shift();
      if (revealing) { reveal = Math.max(0, reveal - dt / 1.6); if (!reveal) revealing = false; }
      draw(ts / 1000);
      if (pts.length || revealing) raf = requestAnimationFrame(frame); else { raf = 0; last = 0; }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

    function move(e) {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      const l = pts[pts.length - 1];
      if (l && Math.hypot((x - l.x) * r.width / r.height, y - l.y) < .02) return;
      pts.push({ x, y, r: .24 + Math.random() * .08, life: 1 });
      if (pts.length > MAX_PTS * 2) pts.shift();
      kick();
    }
    host.addEventListener('pointermove', move, { passive: true });

    new IntersectionObserver((es, ob) => {
      if (es.some((e) => e.isIntersecting)) { ob.disconnect(); revealing = true; kick(); }
    }, { threshold: .25 }).observe(host);

    new ResizeObserver(layout).observe(img);
    layout();
    if (!revealing) { reveal = 1; draw(0); }
  }

  const init = () => document.querySelectorAll(SELECTORS).forEach((img) => {
    if (img.complete && img.naturalWidth) setup(img); else img.addEventListener('load', () => setup(img), { once: true });
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
