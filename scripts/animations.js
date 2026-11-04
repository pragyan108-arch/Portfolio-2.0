(() => {
  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const motionToggles = Array.from(document.querySelectorAll('.motion-toggle'));
  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  const heroHeading = document.querySelector('#hero-title');
  const heroLede = document.querySelector('.hero-lede');
  const heroActions = document.querySelector('.hero-actions');
  const cleanups = [];
  let context;
  let lenis;
  let cursor;
  let ticker;
  let progressBar;

  const addListener = (target, type, callback, options) => {
    target.addEventListener(type, callback, options);
    cleanups.push(() => target.removeEventListener(type, callback, options));
  };

  const splitLines = (element, lineClass, innerClass) => {
    if (!element) return [];
    if (element.dataset.motionSplit) {
      return Array.from(element.querySelectorAll(`.${innerClass}`));
    }
    const lines = [];
    let nodes = [];
    const flush = () => {
      if (!nodes.length) return;
      const line = document.createElement('span');
      const inner = document.createElement('span');
      line.className = lineClass;
      inner.className = innerClass;
      nodes.forEach((node) => inner.append(node));
      line.append(inner);
      lines.push(inner);
      element.append(line);
      nodes = [];
    };

    Array.from(element.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'BR') {
        flush();
        node.remove();
      } else {
        nodes.push(node);
      }
    });
    flush();
    element.dataset.motionSplit = 'true';
    return lines;
  };

  const makeFallbackVisible = () => {
    revealItems.forEach((item) => item.classList.add('is-visible'));
    root.classList.add('motion-off');
    motionToggles.forEach((toggle) => {
      toggle.setAttribute('aria-pressed', 'false');
      toggle.textContent = 'Motion: Off';
    });
  };

  const teardown = () => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
    if (window.gsap) {
      if (ticker) window.gsap.ticker.remove(ticker);
      window.gsap.ticker.lagSmoothing(500, 33);
    }
    ticker = null;
    if (context) context.revert();
    context = null;
    if (window.ScrollTrigger) {
      window.ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    }
    if (lenis) lenis.destroy();
    lenis = null;
    if (cursor) cursor.remove();
    cursor = null;
    if (progressBar) progressBar.remove();
    progressBar = null;
  };

  const setup = () => {
    if (!window.gsap || !window.ScrollTrigger || !window.Lenis) {
      makeFallbackVisible();
      motionToggles.forEach((toggle) => { toggle.disabled = true; });
      return;
    }

    root.classList.remove('motion-off');
    revealItems.forEach((item) => item.classList.remove('is-visible'));
    window.gsap.registerPlugin(window.ScrollTrigger);

    context = window.gsap.context(() => {
      const gsap = window.gsap;
      const ScrollTrigger = window.ScrollTrigger;
      progressBar = document.createElement('div');
      progressBar.className = 'scroll-progress';
      progressBar.setAttribute('aria-hidden', 'true');
      document.body.append(progressBar);

      lenis = new window.Lenis({ autoRaf: false, anchors: true });
      lenis.on('scroll', ScrollTrigger.update);
      ticker = (time) => lenis && lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
          gsap.set(progressBar, { scaleX: self.progress });
        }
      });

      gsap.fromTo('.wordmark',
        { y: 12, opacity: 0 },
        { y: 0, opacity: 1, duration: .24, ease: 'power2.out' }
      );

      const heroLines = splitLines(heroHeading, 'hero-title-line', 'hero-title-line-inner');
      if (heroHeading) gsap.set(heroHeading, { opacity: 1, y: 0 });
      if (heroLede) gsap.set(heroLede, { opacity: 1, y: 0 });
      if (heroActions) gsap.set(heroActions, { opacity: 1, y: 0 });

      const intro = gsap.timeline({ delay: .35 });
      intro.fromTo(heroLines,
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          duration: .4,
          stagger: .12,
          ease: 'power3.out',
          onComplete: () => heroHeading && heroHeading.classList.add('is-visible')
        }
      );
      if (heroLede) {
        intro.fromTo(heroLede, { y: 18, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: .27,
          ease: 'power2.out',
          onComplete: () => heroLede.classList.add('is-visible')
        });
      }
      if (heroActions) {
        intro.fromTo(Array.from(heroActions.children), { y: 18, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: .27,
          stagger: .1,
          ease: 'power2.out',
          onComplete: () => heroActions.classList.add('is-visible')
        });
      }

      const generalReveals = revealItems.filter((item) =>
        item !== heroHeading && item !== heroLede && item !== heroActions &&
        !item.classList.contains('display-heading')
      );
      ScrollTrigger.batch(generalReveals, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => {
          gsap.fromTo(batch, { y: 22, opacity: 0 }, {
            y: 0,
            opacity: 1,
            duration: .65,
            stagger: .08,
            ease: 'power2.out',
            onComplete: () => batch.forEach((item) => item.classList.add('is-visible'))
          });
        }
      });

      document.querySelectorAll('.display-heading').forEach((heading) => {
        const lines = splitLines(heading, 'display-line', 'display-line-inner');
        gsap.set(heading, { opacity: 1, y: 0 });
        gsap.fromTo(lines, { yPercent: 110, opacity: 0 }, {
          yPercent: 0,
          opacity: 1,
          duration: .65,
          stagger: .1,
          ease: 'power3.out',
          onComplete: () => heading.classList.add('is-visible'),
          scrollTrigger: { trigger: heading, start: 'top 88%', once: true }
        });
      });

      document.querySelectorAll('.timeline-line').forEach((line) => {
        gsap.fromTo(line, { scaleY: 0 }, {
          scaleY: 1,
          duration: .7,
          ease: 'power2.out',
          scrollTrigger: { trigger: line, start: 'top 86%', once: true }
        });
      });
      document.querySelectorAll('.timeline-dot').forEach((dot) => {
        gsap.fromTo(dot, { scale: 0, opacity: 0 }, {
          scale: 1,
          opacity: 1,
          duration: .35,
          ease: 'back.out(1.7)',
          scrollTrigger: { trigger: dot, start: 'top 88%', once: true }
        });
      });
      document.querySelectorAll('.credential-list > div').forEach((credential, index) => {
        gsap.fromTo(credential, { y: 14, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: .4,
          delay: index * .07,
          ease: 'power2.out',
          scrollTrigger: { trigger: credential, start: 'top 92%', once: true }
        });
      });
      document.querySelectorAll('.project-visual').forEach((visual) => {
        gsap.to(visual, {
          yPercent: -4,
          ease: 'none',
          scrollTrigger: { trigger: visual, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
      document.querySelectorAll('.hero-image img, .person-image img, .photo-strip img').forEach((image) => {
        gsap.fromTo(image, { yPercent: -3 }, {
          yPercent: 3,
          ease: 'none',
          scrollTrigger: { trigger: image, start: 'top bottom', end: 'bottom top', scrub: true }
        });
      });
      document.querySelectorAll('[data-count]').forEach((stat) => {
        const target = Number(stat.dataset.count);
        if (!Number.isFinite(target)) return;
        const decimals = (stat.dataset.count.split('.')[1] || '').length;
        const counter = { value: 0 };
        gsap.to(counter, {
          value: target,
          duration: 1.2,
          ease: 'power1.out',
          onUpdate: () => { stat.textContent = counter.value.toFixed(decimals); },
          scrollTrigger: { trigger: stat, start: 'top 90%', once: true }
        });
      });

      if (finePointer.matches) {
        cursor = document.createElement('span');
        cursor.className = 'custom-cursor';
        cursor.setAttribute('aria-hidden', 'true');
        document.body.append(cursor);
        root.classList.add('has-custom-cursor');
        const moveX = gsap.quickTo(cursor, 'x', { duration: .18, ease: 'power2.out' });
        const moveY = gsap.quickTo(cursor, 'y', { duration: .18, ease: 'power2.out' });
        addListener(window, 'pointermove', (event) => {
          moveX(event.clientX - 6);
          moveY(event.clientY - 6);
        });
        cleanups.push(() => root.classList.remove('has-custom-cursor'));

        document.querySelectorAll('.button, .text-link').forEach((link) => {
          const move = (event) => {
            const bounds = link.getBoundingClientRect();
            gsap.to(link, {
              x: (event.clientX - bounds.left - bounds.width / 2) * .12,
              y: (event.clientY - bounds.top - bounds.height / 2) * .16,
              duration: .25,
              overwrite: true
            });
          };
          const reset = () => gsap.to(link, { x: 0, y: 0, duration: .45, ease: 'elastic.out(1,.35)' });
          addListener(link, 'pointermove', move);
          addListener(link, 'pointerleave', reset);
        });
      }

      document.querySelectorAll('.project').forEach((project) => {
        const visual = project.querySelector('.project-visual');
        if (!visual) return;
        gsap.set(visual, { transformPerspective: 900, transformOrigin: 'center' });
        const move = (event) => {
          const bounds = visual.getBoundingClientRect();
          gsap.to(visual, {
            rotateY: ((event.clientX - bounds.left) / bounds.width - .5) * 3,
            rotateX: ((event.clientY - bounds.top) / bounds.height - .5) * -3,
            scale: 1.015,
            duration: .3,
            overwrite: true
          });
        };
        const reset = () => gsap.to(visual, { rotateX: 0, rotateY: 0, scale: 1, duration: .45, ease: 'power2.out' });
        addListener(visual, 'pointermove', move);
        addListener(visual, 'pointerleave', reset);
      });

      addListener(window, 'load', () => ScrollTrigger.refresh(), { once: true });
    }, document.body);
  };

  const setMotion = (enabled, persist) => {
    if (reducedMotion.matches) enabled = false;
    if (enabled && (!window.gsap || !window.ScrollTrigger || !window.Lenis)) enabled = false;
    if (persist) window.localStorage.setItem('portfolio-motion', enabled ? 'on' : 'off');
    teardown();
    if (enabled) {
      setup();
    } else {
      makeFallbackVisible();
    }
    motionToggles.forEach((toggle) => {
      toggle.setAttribute('aria-pressed', String(enabled));
      toggle.textContent = `Motion: ${enabled ? 'On' : 'Off'}`;
      toggle.disabled = reducedMotion.matches || (!window.gsap || !window.ScrollTrigger || !window.Lenis);
    });
  };

  const savedMotion = window.localStorage.getItem('portfolio-motion');
  setMotion(!reducedMotion.matches && savedMotion !== 'off', false);

  motionToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      setMotion(toggle.getAttribute('aria-pressed') !== 'true', true);
    });
  });
  reducedMotion.addEventListener('change', (event) => {
    motionToggles.forEach((toggle) => { toggle.disabled = event.matches; });
    const motionIsEnabled = !motionToggles.length || motionToggles[0].getAttribute('aria-pressed') !== 'false';
    setMotion(!event.matches && motionIsEnabled, false);
  });
})();
