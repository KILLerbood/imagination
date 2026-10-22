/* Imagination — page shell: language, scroll, motion, micro-interactions */
(function () {
  const I = window.I18N;
  const { gsap, ScrollTrigger, ScrollSmoother } = window;
  gsap.registerPlugin(ScrollTrigger, ScrollSmoother);
  ScrollTrigger.config({ ignoreMobileResize: true });

  const fine = matchMedia('(pointer: fine)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- smooth scroll (desktop only; native on touch for iOS/Samsung) ---------- */
  let smoother = null;
  if (fine && !reduce) {
    smoother = ScrollSmoother.create({ wrapper: '#smooth-wrapper', content: '#smooth-content', smooth: 1.3, effects: false, normalizeScroll: false, ignoreMobileResize: true });
  }
  window.IMAGINATION_SMOOTHER = smoother;
  function scrollToEl(el) {
    if (!el) return;
    if (smoother) smoother.scrollTo(el, true, 'top 70px');
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: reduce ? 'auto' : 'smooth' });
  }
  window.IMAGINATION_SCROLL = scrollToEl;
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    document.body.classList.remove('menu-open');
    scrollToEl($(id));
  });

  /* ---------- language ---------- */
  function splitWords(el) {
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w';
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = p;
            w.appendChild(wi); frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
  }

  function applyText() {
    $$('[data-i18n]').forEach(el => { el.textContent = I.t(el.dataset.i18n); });
    $$('[data-i18n-html]').forEach(el => { el.innerHTML = I.t(el.dataset.i18nHtml); });
    $$('[data-i18n-ph]').forEach(el => { el.placeholder = I.t(el.dataset.i18nPh); });
    $$('[data-tip]').forEach(el => { el.dataset.label = I.t(el.dataset.tip); });
    $$('.split').forEach(splitWords);
    document.title = I.t('hero.title').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() + ' · Imagination';
  }

  function setLang(lang, initial) {
    I.lang = lang;
    try { localStorage.setItem('imagination-lang', I.lang); } catch (e) {}
    const html = document.documentElement;
    html.lang = I.lang; html.dir = I.rtl ? 'rtl' : 'ltr';
    $('#langCur').textContent = I.lang.toUpperCase();
    $$('.lang-menu button').forEach(b => b.classList.toggle('is-on', b.dataset.lang === I.lang));
    applyText();
    if (!initial) {
      buildHoriz();
      setupReveals(true);
      window.Demos && window.Demos.onLang();
      window.Voice && window.Voice.onLang();
      window.VisionStudio && window.VisionStudio.onLang();
      window.dispatchEvent(new Event('imgn-lang'));
      requestAnimationFrame(() => ScrollTrigger.refresh());
    }
  }

  let saved = null;
  try { saved = new URLSearchParams(location.search).get('lang') || localStorage.getItem('imagination-lang'); } catch (e) {}
  setLang(I.langs.includes(saved) ? saved : 'en', true);

  const langBox = $('#lang');
  $('#langBtn').addEventListener('click', e => { e.stopPropagation(); langBox.classList.toggle('is-open'); $('#langBtn').setAttribute('aria-expanded', langBox.classList.contains('is-open')); });
  document.addEventListener('click', e => { if (!langBox.contains(e.target)) langBox.classList.remove('is-open'); });
  $$('.lang-menu button').forEach(b => b.addEventListener('click', () => {
    langBox.classList.remove('is-open');
    if (b.dataset.lang === I.lang) return;
    gsap.to('main, .footer', { opacity: 0, duration: .25, onComplete: () => { setLang(b.dataset.lang); gsap.to('main, .footer', { opacity: 1, duration: .45 }); } });
  }));

  /* ---------- mobile menu ---------- */
  $('#burger').addEventListener('click', () => document.body.classList.toggle('menu-open'));

  /* ---------- horizontal capabilities ---------- */
  let horizTween = null;
  function buildHoriz() {
    if (horizTween) { horizTween.scrollTrigger.kill(true); horizTween.kill(); horizTween = null; }
    const wrap = $('.horiz-gallery-wrapper'), strip = $('.horiz-gallery-strip');
    gsap.set(strip, { x: 0 });
    // Phones/tablets keep the pinned sideways scroll, but move each card on its own with plain 2D
    // transforms (no 3D/GPU layer for a ~2600px-wide strip, which iOS can't afford on a 3x screen).
    if (!fine) {
      const items = [...strip.children];
      const d = () => Math.max(0, strip.scrollWidth - window.innerWidth);
      horizTween = gsap.to(items, {
        x: () => (document.documentElement.dir === 'rtl' ? 1 : -1) * d(),
        ease: 'none', force3D: false,
        scrollTrigger: { trigger: wrap, start: 'top top', end: () => '+=' + d(), pin: true, scrub: true, invalidateOnRefresh: true, refreshPriority: 1 }
      });
      return;
    }
    const dist = () => Math.max(0, strip.scrollWidth - window.innerWidth);
    horizTween = gsap.to(strip, {
      x: () => (document.documentElement.dir === 'rtl' ? 1 : -1) * dist(),
      ease: 'none',
      scrollTrigger: { trigger: wrap, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1, refreshPriority: 1 }
    });
    // cards lean into the motion
    // 3D card lean only where there's a real GPU budget (laptops/desktops); phones get a flat, cheap slide
    if (!fine) return;
    $$('.cap-card').forEach(card => {
      gsap.fromTo(card, { rotateY: document.documentElement.dir === 'rtl' ? 14 : -14, z: -80 }, {
        rotateY: 0, z: 0, ease: 'none',
        scrollTrigger: { trigger: card, containerAnimation: horizTween, start: 'left 100%', end: 'left 45%', scrub: true }
      });
    });
  }

  /* ---------- reveals ---------- */
  let revealTweens = [];
  function setupReveals(rebuild) {
    revealTweens.forEach(t => { t.scrollTrigger && t.scrollTrigger.kill(); t.kill(); });
    revealTweens = [];
    if (reduce) return;
    $$('.split').forEach(el => {
      if (el.closest('.hero')) return;
      const words = el.querySelectorAll('.wi');
      revealTweens.push(gsap.from(words, { yPercent: 115, rotate: 4, duration: 1, stagger: .045, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));
    });
    if (rebuild) return;
    $$('.rv').forEach(el => {
      if (el.closest('.hero')) return;
      gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  }

  function heroIntro() {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from('.hero-title .wi', { yPercent: 120, rotate: 6, duration: 1.4, stagger: .06 })
      .from('.hero .rv', { y: 40, opacity: 0, duration: 1.2, stagger: .1 }, '-=1.1')
      .from('.nav', { y: -30, opacity: 0, duration: 1 }, '-=1.2')
      .from('.core-hint, .scroll-cue', { opacity: 0, duration: 1 }, '-=.6');
    countUp($$('.hero-stats [data-count]'));
  }

  function countUp(els) {
    els.forEach(el => {
      const end = parseFloat(el.dataset.count), dec = +el.dataset.dec || 0, suf = el.dataset.suffix || '';
      const o = { v: 0 };
      gsap.to(o, { v: end, duration: 2.2, ease: 'power3.out', delay: .5, onUpdate: () => { el.textContent = o.v.toFixed(dec) + suf; } });
    });
  }

  /* ---------- nav, progress, dock ---------- */
  const nav = $('#nav'), bar = $('.scroll-progress i'), dock = $('#dock');
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: self => {
      nav.classList.toggle('is-scrolled', self.scroll() > 40);
      bar.style.transform = `scaleX(${self.progress})`;
    }
  });
  const dockLinks = $$('#dock a');
  ScrollTrigger.create({ trigger: '#race', start: 'top 60%', endTrigger: '#avatar', end: 'bottom 40%', onToggle: s => dock.classList.toggle('is-on', s.isActive) });
  dockLinks.forEach(a => {
    ScrollTrigger.create({ trigger: a.getAttribute('href'), start: 'top 50%', end: 'bottom 50%', onToggle: s => { if (s.isActive) dockLinks.forEach(x => x.classList.toggle('is-on', x === a)); } });
  });

  /* ---------- cursor, magnetic, tilt (desktop) ---------- */
  if (fine) {
    document.body.classList.add('has-cursor');
    const cur = $('.cursor');
    const label = $('.cursor-label');
    const xTo = gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3' });
    const yTo = gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3' });
    addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    addEventListener('pointerdown', () => cur.classList.add('is-down'));
    addEventListener('pointerup', () => cur.classList.remove('is-down'));
    document.addEventListener('pointerover', e => {
      const hit = e.target.closest('a, button, input, textarea, label, .deal, .compare, canvas#scratch');
      cur.classList.toggle('is-hover', !!hit);
      label.textContent = e.target.closest('.compare') ? '⟷' : (e.target.closest('.hero') && !hit ? '' : '');
    });

    $$('.mag').forEach(el => {
      const xT = gsap.quickTo(el, 'x', { duration: .5, ease: 'elastic.out(1, .4)' });
      const yT = gsap.quickTo(el, 'y', { duration: .5, ease: 'elastic.out(1, .4)' });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        xT((e.clientX - r.left - r.width / 2) * .25); yT((e.clientY - r.top - r.height / 2) * .35);
      });
      el.addEventListener('pointerleave', () => { xT(0); yT(0); });
    });

    $$('.tilt').forEach(el => {
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
        gsap.to(el, { rotateY: px * 10, rotateX: -py * 10, transformPerspective: 900, duration: .5, ease: 'power2.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotateY: 0, rotateX: 0, duration: .8, ease: 'elastic.out(1, .5)' }));
    });
  }

  /* ---------- CTA form ---------- */
  $('#ctaForm').addEventListener('submit', e => {
    e.preventDefault();
    $('#ctaOk').classList.add('is-on');
    gsap.fromTo('#ctaOk', { y: 10 }, { y: 0, duration: .6, ease: 'expo.out' });
    window.IMAGINATION_SCENE && window.IMAGINATION_SCENE.wake();
    $('#ctaEmail').value = '';
  });

  /* ---------- build tag + phone 3D switch ---------- */
  function paintBuild() {
    $('#buildTag').textContent = 'build ' + (window.IMGN_BUILD || '');
    const tg = $('#threeToggle');
    tg.hidden = !window.IMGN_MOBILE;
    tg.textContent = document.documentElement.classList.contains('lite') ? I.t('f.3dOn') : I.t('f.3dOff');
  }
  $('#threeToggle').addEventListener('click', () => {
    try {
      if (document.documentElement.classList.contains('lite')) { localStorage.removeItem('imgn-lite'); sessionStorage.removeItem('imgn-alive'); }
      else localStorage.setItem('imgn-lite', '1');
    } catch (e) {}
    location.reload();
  });
  paintBuild();
  addEventListener('imgn-lang', paintBuild);

  /* ---------- boot ---------- */
  buildHoriz();
  setupReveals();
  window.Demos && window.Demos.init();
  window.VisionStudio && window.VisionStudio.init();

  // Loader: driven by plain timers (not the animation ticker) and never waits for the 3D scene,
  // so a slow GPU / in-app browser can't leave the visitor stuck on the loading screen.
  const pctEl = $('#loaderPct'), barEl = $('#loaderBar');
  let pct = 0;
  const paint = () => { pctEl.textContent = Math.round(pct); barEl.style.width = pct + '%'; };
  const creep = setInterval(() => { pct += (90 - pct) * .12; paint(); }, 100);
  let booted = false;
  function finish() {
    if (booted) return; booted = true;
    clearInterval(creep); pct = 100; paint();
    const loader = $('#loader');
    loader.style.transition = 'opacity .6s ease'; loader.style.opacity = '0'; loader.style.pointerEvents = 'none';
    setTimeout(() => loader.remove(), 700);
    document.body.classList.remove('is-loading');
    ScrollTrigger.refresh();
    heroIntro();
    // start the 3D only once the page is on screen and usable
    setTimeout(() => window.dispatchEvent(new Event('start-scene')), 400);
  }
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(r => setTimeout(r, 1800))]).then(() => setTimeout(finish, 200));
  setTimeout(finish, 3000);   // hard cap whatever happens
  addEventListener('load', () => ScrollTrigger.refresh());
})();
