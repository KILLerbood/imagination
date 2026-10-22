/* Imagination — interactive AI demos (all simulated in the browser, no API keys) */
(function () {
  const I = window.I18N;
  const t = (k, v) => I.t(k, v);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const small = () => innerWidth < 700;
  const g = () => window.gsap;

  function onVisible(el, cb, once = true) {
    if (!el) return;
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      cb(en.isIntersecting);
      if (en.isIntersecting && once) io.disconnect();
    }), { threshold: .25 });
    io.observe(el);
  }
  function seg(container, attr, cb) {
    $$(`[${attr}]`, container).forEach(b => b.addEventListener('click', () => {
      $$(`[${attr}]`, container).forEach(x => x.classList.toggle('is-on', x === b));
      cb(b.getAttribute(attr), b);
    }));
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove(); return Promise.resolve();
  }

  /* =========================================================
     01 · RACE THE AI — polynomial parser + solver
     ========================================================= */
  const Race = (() => {
    const EPS = 1e-9;
    const trim = p => { p = p.slice(); while (p.length > 1 && Math.abs(p[p.length - 1]) < EPS) p.pop(); return p; };
    const deg = p => trim(p).length - 1;
    const add = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0)));
    const neg = a => a.map(v => -v);
    const sub = (a, b) => add(a, neg(b));
    const mul = (a, b) => { const r = new Array(a.length + b.length - 1).fill(0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return trim(r); };
    const div = (a, b) => { if (deg(b) > 0 || Math.abs(b[0]) < EPS) throw 0; return a.map(v => v / b[0]); };
    const evalP = (p, x) => p.reduce((s, c, i) => s + c * Math.pow(x, i), 0);

    function parse(str) {
      let src = String(str).replace(/[×·✕]/g, '*').replace(/÷/g, '/').replace(/[−–—]/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/X/g, 'x').replace(/\s+/g, '');
      src = src.replace(/(\d),(\d)/g, '$1.$2');
      const toks = src.match(/\d+(?:\.\d+)?|\.\d+|[x+\-*/^()=]/g);
      if (!toks || toks.join('') !== src) throw 0;
      let i = 0;
      const peek = () => toks[i], next = () => toks[i++];
      const isStart = p => p === 'x' || p === '(' || /^[\d.]/.test(p);
      function expr() { let a = term(); while (peek() === '+' || peek() === '-') { const op = next(); const b = term(); a = op === '+' ? add(a, b) : sub(a, b); } return a; }
      function term() {
        let a = unary();
        for (;;) {
          const p = peek();
          if (p === '*' || p === '/') { next(); const b = unary(); a = p === '*' ? mul(a, b) : div(a, b); }
          else if (p && isStart(p)) a = mul(a, power());
          else break;
        }
        return a;
      }
      function unary() { if (peek() === '-') { next(); return neg(unary()); } if (peek() === '+') { next(); return unary(); } return power(); }
      function power() {
        const b = primary();
        if (peek() !== '^') return b;
        next();
        const e = unary();
        if (deg(e) > 0) throw 0;
        const n = e[0];
        if (deg(b) === 0) return [Math.pow(b[0], n)];
        if (!Number.isInteger(n) || n < 0 || n > 4) throw 0;
        let r = [1]; for (let k = 0; k < n; k++) r = mul(r, b); return r;
      }
      function primary() {
        const tk = next();
        if (tk === undefined) throw 0;
        if (tk === 'x') return [0, 1];
        if (tk === '(') { const e = expr(); if (next() !== ')') throw 0; return e; }
        if (/^[\d.]/.test(tk)) return [parseFloat(tk)];
        throw 0;
      }
      const sides = [expr()];
      if (peek() === '=') { next(); sides.push(expr()); }
      if (i < toks.length) throw 0;
      return sides;
    }

    const fmt = n => {
      if (!isFinite(n)) return '∞';
      if (Math.abs(n - Math.round(n)) < 1e-9) return String(Math.round(n));
      return String(+n.toFixed(4));
    };
    const fmtS = n => (n < 0 ? '−' + fmt(-n) : fmt(n));
    function polyStr(p) {
      p = trim(p); let s = '';
      for (let d = p.length - 1; d >= 0; d--) {
        const c = p[d]; if (Math.abs(c) < EPS) continue;
        const a = Math.abs(c), negv = c < 0;
        const coef = d > 0 && Math.abs(a - 1) < EPS ? '' : fmt(a);
        const v = d === 0 ? '' : d === 1 ? 'x' : d === 2 ? 'x²' : 'x^' + d;
        s += s ? (negv ? ' − ' : ' + ') + coef + v : (negv ? '−' : '') + coef + v;
      }
      return s || '0';
    }

    // returns { roots:[...] | null, special, steps:[{k, code, final}] }
    function solve(text, extraSteps) {
      const sides = parse(text);
      const steps = [];
      if (sides.length === 1) {
        if (deg(sides[0]) > 0) throw 0;
        const v = sides[0][0];
        if (extraSteps) steps.push(...extraSteps);
        else steps.push({ k: 'd1.st.order', code: pretty(text) });
        steps.push({ k: 'd1.st.answer', code: '= ' + fmtS(v), final: true });
        return { roots: [v], steps };
      }
      const [L, R] = sides;
      const P = sub(L, R);
      const d = deg(P);
      if (d > 2) throw 0;
      steps.push({ k: 'd1.st.move', code: polyStr(P) + ' = 0' });
      if (d === 0) {
        const all = Math.abs(P[0]) < EPS;
        steps.push({ k: all ? 'd1.st.all' : 'd1.st.none', code: fmtS(P[0]) + (all ? ' = 0 ✓' : ' ≠ 0'), final: true });
        return { roots: all ? 'all' : [], steps };
      }
      if (d === 1) {
        const x = -P[0] / P[1];
        steps.push({ k: 'd1.st.iso', code: `${fmtS(P[1])}x = ${fmtS(-P[0])}   →   x = ${fmtS(-P[0])} / ${fmtS(P[1])}` });
        steps.push({ k: 'd1.st.answer', code: 'x = ' + fmtS(x), final: true });
        steps.push({ k: 'd1.st.verify', code: `${fmtS(evalP(L, x))} = ${fmtS(evalP(R, x))} ✓` });
        return { roots: [x], steps };
      }
      const [c, b, a] = P;
      const D = b * b - 4 * a * c;
      steps.push({ k: 'd1.st.coef', code: `a = ${fmtS(a)},  b = ${fmtS(b)},  c = ${fmtS(c)}` });
      steps.push({ k: 'd1.st.disc', code: `Δ = b² − 4ac = (${fmtS(b)})² − 4·(${fmtS(a)})·(${fmtS(c)}) = ${fmtS(D)}` });
      if (D < -EPS) {
        const re = -b / (2 * a), im = Math.sqrt(-D) / (2 * Math.abs(a));
        steps.push({ k: 'd1.st.complex', code: `x = ${fmtS(re)} ± ${fmt(im)}i`, final: true });
        return { roots: [], steps };
      }
      const sq = Math.sqrt(Math.max(D, 0));
      steps.push({ k: 'd1.st.formula', code: `x = (−b ± √Δ) / 2a = (${fmtS(-b)} ± ${fmt(sq)}) / ${fmtS(2 * a)}` });
      if (Math.abs(D) < EPS) {
        const x = -b / (2 * a);
        steps.push({ k: 'd1.st.double', code: 'x = ' + fmtS(x), final: true });
        return { roots: [x], steps };
      }
      const x1 = (-b - sq) / (2 * a), x2 = (-b + sq) / (2 * a);
      const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
      steps.push({ k: 'd1.st.answer', code: `x₁ = ${fmtS(lo)},   x₂ = ${fmtS(hi)}`, final: true });
      steps.push({ k: 'd1.st.verify', code: `P(${fmtS(lo)}) = ${fmt(Math.abs(evalP(P, lo)) < 1e-6 ? 0 : evalP(P, lo))},  P(${fmtS(hi)}) = ${fmt(Math.abs(evalP(P, hi)) < 1e-6 ? 0 : evalP(P, hi))} ✓` });
      return { roots: [lo, hi], steps };
    }
    const pretty = s => s.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\^2/g, '²').replace(/\s+/g, ' ').trim();

    function generate(mode) {
      if (mode === 'linear') {
        const x = randi(-9, 9) || 4, a = randi(3, 9), c = randi(1, a - 1), b = randi(-20, 20) || 7;
        const d = (a - c) * x + b;
        return { text: `${polyStr([b, a])} = ${polyStr([d, c])}` };
      }
      if (mode === 'quad') {
        let r1 = randi(-7, 7), r2 = randi(-7, 7); if (r1 === r2) r2 = r1 + randi(1, 4);
        const a = [1, 1, 2][randi(0, 2)], k = randi(1, 15);
        const P = [a * r1 * r2 + k, -a * (r1 + r2), a];
        return { text: `${polyStr(P)} = ${k}` };
      }
      const A = randi(12, 99), B = randi(11, 49), Dv = randi(4, 16), Q = randi(8, 60), C = Dv * Q, E = randi(10, 300);
      const P = A * B, Rr = P + Q - E;
      return {
        text: `${A} × ${B} + ${C} ÷ ${Dv} − ${E}`,
        extra: [
          { k: 'd1.st.order', code: `${A} × ${B} = ${P}` },
          { k: 'd1.st.order', code: `${C} ÷ ${Dv} = ${Q}` },
          { k: 'd1.st.order', code: `${P} + ${Q} − ${E} = ${Rr}` }
        ]
      };
    }

    let mode = 'linear', problem = null, startT = 0, youDone = 0, aiDone = false, raf = 0;
    const eqEl = $('#raceEq'), youTime = $('#youTime'), aiTime = $('#aiTime'), stepsEl = $('#aiSteps'), result = $('#raceResult');
    const youForm = $('#youForm'), youInput = $('#youInput'), youMsg = $('#youMsg'), aiGo = $('#aiGo');

    function tickTimer() {
      if (!youDone && problem) youTime.textContent = ((performance.now() - startT) / 1000).toFixed(2) + 's';
      raf = requestAnimationFrame(tickTimer);
    }
    function setProblem(p) {
      problem = p;
      eqEl.textContent = p ? pretty(p.text) : t('d1.customHint');
      eqEl.style.fontSize = p ? '' : '18px';
      startT = performance.now(); youDone = 0; aiDone = false;
      youTime.textContent = '0.00s'; aiTime.textContent = '—';
      stepsEl.innerHTML = ''; result.innerHTML = '';
      youMsg.textContent = t('d1.youHint'); youMsg.className = 'you-msg';
      youForm.className = 'you-form'; youInput.value = '';
      aiGo.disabled = !p;
      if (p && g()) g().fromTo(eqEl, { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: .7, ease: 'expo.out' });
    }
    function newProblem() {
      $('.race').classList.toggle('is-custom', mode === 'custom');
      if (mode === 'custom') { setProblem(null); return; }
      setProblem(generate(mode));
    }
    function parseAnswers(s) {
      const parts = s.replace(/x\s*[₁₂12]?\s*=/gi, '').split(/[;,]|\bor\b|\bund\b|\bили\b|أو|و/).map(x => x.trim()).filter(Boolean);
      return parts.map(p => { const r = parse(p); if (r.length !== 1 || deg(r[0]) > 0) throw 0; return r[0][0]; });
    }
    youForm.addEventListener('submit', e => {
      e.preventDefault();
      if (!problem || youDone) return;
      let ok = false;
      try {
        const sol = solve(problem.text, problem.extra);
        const got = parseAnswers(youInput.value).sort((a, b) => a - b);
        const want = sol.roots === 'all' ? null : [...new Set(sol.roots.map(v => +v.toFixed(6)))].sort((a, b) => a - b);
        ok = want && got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) < 1e-3 * Math.max(1, Math.abs(want[i])));
      } catch (err) { ok = false; }
      if (ok) {
        youDone = performance.now() - startT;
        youTime.textContent = (youDone / 1000).toFixed(2) + 's';
        youForm.className = 'you-form ok'; youMsg.className = 'you-msg ok';
        youMsg.textContent = t('d1.correct', { t: (youDone / 1000).toFixed(2) + 's' });
      } else {
        youForm.className = 'you-form'; void youForm.offsetWidth; youForm.className = 'you-form bad';
        youMsg.className = 'you-msg bad'; youMsg.textContent = t('d1.wrong');
      }
    });

    function fmtAi(ms) { return ms < 1 ? (ms * 1000).toFixed(0) + ' µs' : ms.toFixed(2) + ' ms'; }
    aiGo.addEventListener('click', () => {
      if (!problem || aiDone) return;
      aiDone = true;
      const N = 300; let sol;
      const t0 = performance.now();
      for (let k = 0; k < N; k++) sol = solve(problem.text, problem.extra);
      const ms = Math.max((performance.now() - t0) / N, 0.004);
      const youMs = youDone || (performance.now() - startT);
      const stillRunning = !youDone;
      if (stillRunning) youDone = youMs;
      aiTime.textContent = fmtAi(ms);
      stepsEl.innerHTML = sol.steps.map(s => `<li class="${s.final ? 'final' : ''}"><small>${esc(t(s.k))}</small><code>${esc(s.code)}</code></li>`).join('');
      if (g()) g().to(stepsEl.children, { opacity: 1, y: 0, duration: .5, stagger: .14, ease: 'expo.out' });
      else [...stepsEl.children].forEach(li => { li.style.opacity = 1; li.style.transform = 'none'; });
      const x = Math.round(youMs / ms);
      result.innerHTML = stillRunning
        ? esc(t('d1.faster2', { ai: fmtAi(ms), you: (youMs / 1000).toFixed(2) + 's' })).replace(fmtAi(ms), `<b>${fmtAi(ms)}</b>`)
        : esc(t('d1.faster', { ai: fmtAi(ms), x: I.num(x) })).replace(I.num(x), `<b>${I.num(x)}</b>`);
      if (g()) g().fromTo(result, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .6, ease: 'back.out(2)' });
      window.IMAGINATION_SCENE && window.IMAGINATION_SCENE.wake();
    });

    $('#customEq').addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#customInput').value.trim();
      try { solve(v); setProblem({ text: v }); }
      catch (err) { eqEl.textContent = t('d1.bad'); eqEl.style.fontSize = '16px'; aiGo.disabled = true; problem = null; }
    });
    seg($('.race-modes'), 'data-mode', m => { mode = m; newProblem(); });
    $('#raceNew').addEventListener('click', newProblem);

    // scratch pad
    function scratchPad() {
      const c = $('#scratch'), ctx = c.getContext('2d');
      const size = () => { const r = c.getBoundingClientRect(); const d = Math.min(devicePixelRatio || 1, 2); c.width = r.width * d; c.height = r.height * d; ctx.scale(d, d); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = '#ffd38a'; };
      size(); addEventListener('resize', size);
      let drawing = false, lx = 0, ly = 0;
      const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      c.addEventListener('pointerdown', e => { drawing = true; c.setPointerCapture(e.pointerId); [lx, ly] = pos(e); });
      c.addEventListener('pointermove', e => { if (!drawing) return; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(x, y); ctx.stroke(); lx = x; ly = y; });
      const end = () => { drawing = false; };
      c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
      $('#scratchClear').addEventListener('click', () => ctx.clearRect(0, 0, c.width, c.height));
    }

    return {
      init() {
        scratchPad(); newProblem(); tickTimer();
        // the clock starts when the visitor actually reaches the race
        onVisible($('#race'), vis => { if (vis && problem && !youDone && !aiDone) startT = performance.now(); });
      },
      onLang() {
        if (!problem) eqEl.textContent = t('d1.customHint');
        if (!youMsg.classList.contains('ok') && !youMsg.classList.contains('bad')) youMsg.textContent = t('d1.youHint');
        $$('#aiSteps li').forEach(() => {});
        if (aiDone && problem) {
          const sol = solve(problem.text, problem.extra);
          stepsEl.innerHTML = sol.steps.map(s => `<li class="${s.final ? 'final' : ''}" style="opacity:1;transform:none"><small>${esc(t(s.k))}</small><code>${esc(s.code)}</code></li>`).join('');
          result.innerHTML = '';
        }
      }
    };
  })();

  /* =========================================================
     02 · VISION STUDIO — generation + transformation
     ========================================================= */
  const Vision = (() => {
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let x = Math.imul(a ^ a >>> 15, 1 | a); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
    const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
    function blurred(src, f) {
      const s = mk(Math.max(1, Math.round(src.width / f)), Math.max(1, Math.round(src.height / f)));
      const x = s.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, s.width, s.height);
      const o = mk(src.width, src.height); const y = o.getContext('2d'); y.imageSmoothingEnabled = true; y.imageSmoothingQuality = 'high'; y.drawImage(s, 0, 0, o.width, o.height);
      return o;
    }

    const PAL = {
      cine: { sky: ['#06142a', '#1d3f6b', '#e0773a', '#ffcf7a'], accent: '#ffb547', accent2: '#40e6ff' },
      dream: { sky: ['#1b1240', '#5b3d9a', '#d58bd8', '#ffe0ef'], accent: '#ffd6f0', accent2: '#9be7ff' },
      neon: { sky: ['#06001a', '#2a0066', '#a1007a', '#ff2fa0'], accent: '#ff2fa0', accent2: '#2ff4ff' }
    };
    const KW = {
      ocean: ['sun', 'sea', 'ocean', 'moon', 'beach', 'wave', 'غروب', 'بحر', 'محيط', 'قمر', 'شاطئ', 'meer', 'sonne', 'mond', 'strand', 'закат', 'океан', 'море', 'луна', 'пляж'],
      city: ['city', 'neon', 'night', 'rain', 'street', 'cyber', 'مدينة', 'نيون', 'مطر', 'شارع', 'ليل', 'stadt', 'regen', 'nacht', 'straße', 'город', 'неон', 'дожд', 'ночь', 'улиц'],
      aurora: ['aurora', 'northern', 'mountain', 'snow', 'polar', 'شفق', 'جبال', 'جبل', 'ثلج', 'polarlicht', 'berg', 'schnee', 'сияни', 'гор', 'снег'],
      fluid: ['fluid', 'abstract', 'liquid', 'gold', 'art', 'marble', 'سائل', 'فن', 'تجريد', 'ذهب', 'flüssig', 'kunst', 'abstrakt', 'жидк', 'абстракт', 'искусств', 'золот']
    };
    function pickScene(prompt) {
      const p = prompt.toLowerCase(); let best = null, score = 0;
      for (const k in KW) { const s = KW[k].reduce((n, w) => n + (p.includes(w) ? 1 : 0), 0); if (s > score) { score = s; best = k; } }
      return best || ['ocean', 'city', 'aurora', 'fluid'][hash(p) % 4];
    }
    function skyGrad(ctx, w, h, stops, horizon) {
      const gr = ctx.createLinearGradient(0, 0, 0, horizon);
      stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, horizon);
    }
    function stars(ctx, w, h, r, n, maxY) {
      for (let i = 0; i < n; i++) { ctx.globalAlpha = r() * .8 + .1; ctx.fillStyle = '#fff'; const s = r() * 1.6 + .3; ctx.fillRect(r() * w, r() * maxY, s, s); }
      ctx.globalAlpha = 1;
    }
    const SCENES = {
      ocean(ctx, w, h, r, P) {
        const hz = h * .6;
        skyGrad(ctx, w, h, P.sky, hz);
        stars(ctx, w, h, r, 160, hz * .55);
        const mx = w * (.3 + r() * .4), my = h * (.32 + r() * .08), mr = h * (.15 + r() * .07);
        let gl = ctx.createRadialGradient(mx, my, mr * .5, mx, my, mr * 4);
        gl.addColorStop(0, P.accent + 'aa'); gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, w, hz);
        gl = ctx.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr);
        gl.addColorStop(0, '#fffaf0'); gl.addColorStop(1, P.accent);
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
        ctx.globalAlpha = .08; ctx.fillStyle = '#000';
        for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(mx + (r() - .5) * mr * 1.3, my + (r() - .5) * mr * 1.3, mr * (.06 + r() * .14), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        const sea = ctx.createLinearGradient(0, hz, 0, h);
        sea.addColorStop(0, P.sky[2]); sea.addColorStop(.25, P.sky[1]); sea.addColorStop(1, '#02030a');
        ctx.fillStyle = sea; ctx.fillRect(0, hz, w, h - hz);
        for (let y = hz; y < h; y += 2.2) {
          const k = (y - hz) / (h - hz);
          const len = (mr * 2.2) * (1 - k * .3) * (.3 + r());
          ctx.globalAlpha = (1 - k) * .55 * r();
          ctx.fillStyle = r() > .3 ? P.accent : '#fff';
          ctx.fillRect(mx - len / 2 + (r() - .5) * mr * (1 + k * 3), y, len, 1.4);
        }
        ctx.globalAlpha = .25; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        for (let i = 0; i < 40; i++) { const y = hz + Math.pow(r(), 2) * (h - hz); ctx.beginPath(); const x = r() * w; ctx.moveTo(x, y); ctx.lineTo(x + 20 + r() * 80, y); ctx.stroke(); }
        ctx.globalAlpha = 1;
      },
      city(ctx, w, h, r, P) {
        skyGrad(ctx, w, h, [P.sky[0], P.sky[1], P.sky[2]], h);
        const ground = h * .78;
        const layer = (count, minH, maxH, col, lit) => {
          let x = -20;
          while (x < w) {
            const bw = w / count * (.6 + r() * .8), bh = minH + r() * (maxH - minH);
            ctx.fillStyle = col; ctx.fillRect(x, ground - bh, bw, bh + 2);
            for (let wy = ground - bh + 10; wy < ground - 8; wy += 9) for (let wx = x + 6; wx < x + bw - 6; wx += 8) {
              if (r() < lit) { ctx.fillStyle = r() > .7 ? P.accent2 : (r() > .5 ? P.accent : '#ffd9a0'); ctx.globalAlpha = .5 + r() * .5; ctx.fillRect(wx, wy, 4, 5); ctx.globalAlpha = 1; }
            }
            if (r() < .25) { ctx.save(); ctx.shadowColor = r() > .5 ? P.accent : P.accent2; ctx.shadowBlur = 24; ctx.fillStyle = ctx.shadowColor; ctx.fillRect(x + bw * .2, ground - bh + 16 + r() * 30, bw * .6, 6); ctx.restore(); }
            x += bw + 2;
          }
        };
        layer(14, h * .2, h * .45, '#0d0a24', .18);
        layer(9, h * .28, h * .66, '#05040f', .3);
        const st = ctx.createLinearGradient(0, ground, 0, h);
        st.addColorStop(0, '#120d2c'); st.addColorStop(1, '#030208');
        ctx.fillStyle = st; ctx.fillRect(0, ground, w, h - ground);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 26; i++) { const x = r() * w; const gr = ctx.createLinearGradient(0, ground, 0, h); const c = r() > .5 ? P.accent : P.accent2; gr.addColorStop(0, c + '88'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gr; ctx.fillRect(x, ground, 2 + r() * 6, h - ground); }
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(200,220,255,.25)'; ctx.lineWidth = 1;
        for (let i = 0; i < 700; i++) { const x = r() * w, y = r() * h, l = 8 + r() * 16; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - l * .25, y + l); ctx.stroke(); }
      },
      aurora(ctx, w, h, r, P) {
        skyGrad(ctx, w, h, ['#01030c', '#06122a', P.sky[1]], h);
        stars(ctx, w, h, r, 420, h * .75);
        ctx.globalCompositeOperation = 'lighter';
        const cols = [P.accent2, '#7dff9b', P.accent];
        for (let b = 0; b < 3; b++) {
          const len = h * (.22 + r() * .15), f1 = .004 + r() * .004, f2 = .011 + r() * .01, ph = r() * 10, base = h * (.12 + b * .09);
          const gr = ctx.createLinearGradient(0, 0, 0, len);
          gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.25, cols[b] + 'aa'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr;
          for (let x = 0; x < w; x += 2) {
            const y = base + Math.sin(x * f1 + ph) * h * .07 + Math.sin(x * f2 + ph * 2) * h * .025;
            ctx.globalAlpha = .25 + .25 * Math.sin(x * .02 + ph);
            ctx.save(); ctx.translate(0, y); ctx.fillRect(x, 0, 2, len); ctx.restore();
          }
        }
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
        const layers = [['#1a2a55', .55], ['#0d1733', .66], ['#050914', .8]];
        layers.forEach(([col, base], li) => {
          ctx.beginPath(); ctx.moveTo(0, h);
          let y = h * base, minY = h;
          for (let x = 0; x <= w; x += w / 40) { y += (r() - .5) * h * .09; y = Math.min(Math.max(y, h * (base - .22)), h * (base + .08)); minY = Math.min(minY, y); ctx.lineTo(x, y); }
          ctx.lineTo(w, h); ctx.closePath();
          ctx.fillStyle = col; ctx.fill();
          const sn = ctx.createLinearGradient(0, minY, 0, minY + h * .14);
          sn.addColorStop(0, `rgba(235,245,255,${.75 - li * .2})`); sn.addColorStop(1, 'rgba(235,245,255,0)');
          ctx.fillStyle = sn; ctx.fill();
        });
      },
      fluid(ctx, w, h, r, P) {
        const sw = Math.round(w / 2), sh = Math.round(h / 2);
        const c = mk(sw, sh), x = c.getContext('2d'), img = x.createImageData(sw, sh), d = img.data;
        const a1 = r() * 6, a2 = r() * 6, f = .012 + r() * .01;
        const stops = [[26, 11, 58], [139, 108, 255], [255, 181, 71], [255, 95, 176], [255, 240, 210]];
        if (P === PAL.neon) stops.splice(2, 1, [47, 244, 255]);
        for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) {
          const u = i * f, v = j * f;
          const q = Math.sin(u + Math.sin(v * 1.7 + a1) * 2.1) + Math.sin(v * 1.3 + Math.sin(u * 1.1 + a2) * 1.8);
          const s = Math.sin(q * 2.2 + u * .6) * .5 + .5;
          const tt = s * (stops.length - 1), k = Math.min(stops.length - 2, Math.floor(tt)), fr = tt - k;
          const A = stops[k], B = stops[k + 1], o = (j * sw + i) * 4;
          const sheen = Math.pow(Math.max(0, Math.sin(q * 6)), 18) * 90;
          d[o] = A[0] + (B[0] - A[0]) * fr + sheen; d[o + 1] = A[1] + (B[1] - A[1]) * fr + sheen; d[o + 2] = A[2] + (B[2] - A[2]) * fr + sheen; d[o + 3] = 255;
        }
        x.putImageData(img, 0, 0);
        ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, 0, 0, w, h);
      }
    };
    function grade(ctx, w, h, style, r) {
      const cv = ctx.canvas;
      if (style === 'dream') {
        const b = blurred(cv, 14); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = .55; ctx.drawImage(b, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (style === 'neon') {
        const b = blurred(cv, 10); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35; ctx.drawImage(b, 0, 0);
        ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .35;
        const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ff2fa0'); gr.addColorStop(1, '#2ff4ff'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      if (style === 'cine') {
        ctx.globalCompositeOperation = 'soft-light'; ctx.globalAlpha = .35;
        const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0f6b7a'); gr.addColorStop(1, '#ff9a4a'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      }
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * .35, w / 2, h / 2, w * .75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
      if (style === 'cine') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h * .06); ctx.fillRect(0, h * .94, w, h * .06); }
    }
    function render(prompt, style, w, h, seed) {
      const c = mk(w, h), ctx = c.getContext('2d');
      const r = mulberry(seed), P = PAL[style];
      SCENES[pickScene(prompt)](ctx, w, h, r, P);
      grade(ctx, w, h, style, r);
      return c;
    }

    /* ---- generate tab ---- */
    let genStyle = 'cine', genRun = 0, busy = false;
    const canvas = $('#genCanvas'), gctx = canvas.getContext('2d');
    const noise = (() => { const c = mk(320, 200), x = c.getContext('2d'), im = x.createImageData(320, 200); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v * rand(.6, 1); im.data[i + 1] = v * rand(.5, 1); im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; })();

    async function generate() {
      const promptEl = $('#genPrompt');
      if (!promptEl.value.trim()) promptEl.value = t('d2.g1');
      const prompt = promptEl.value.trim();
      const run = ++genRun; busy = true;
      const btn = $('#genGo'); btn.disabled = true;
      const W = small() ? 768 : 1024, H = Math.round(W * .625);
      canvas.width = W; canvas.height = H;
      const seed = (hash(prompt + genStyle) ^ (Math.random() * 1e9)) >>> 0;
      const t0 = performance.now();
      const final = render(prompt, genStyle, W, H, seed);
      $('#genOverlay').classList.add('is-off');
      const stepEl = $('#genStep'); stepEl.classList.add('is-on');
      const steps = 30;
      for (let s = 1; s <= steps; s++) {
        if (run !== genRun) return;
        const p = s / steps;
        const f = Math.max(1, 64 * Math.pow(1 - p, 2.2));
        gctx.globalAlpha = 1; gctx.imageSmoothingEnabled = true;
        gctx.drawImage(f > 1.05 ? blurred(final, f) : final, 0, 0);
        gctx.globalAlpha = Math.pow(1 - p, 1.4) * .95;
        gctx.globalCompositeOperation = p < .5 ? 'source-over' : 'overlay';
        gctx.drawImage(noise, -rand(0, 40), -rand(0, 40), W + 40, H + 40);
        gctx.globalCompositeOperation = 'source-over'; gctx.globalAlpha = 1;
        stepEl.textContent = `step ${s}/${steps} · denoising`;
        $('#genBar').style.width = (p * 100) + '%';
        await sleep(55 + (s < 6 ? 40 : 0));
      }
      gctx.drawImage(final, 0, 0);
      stepEl.classList.remove('is-on');
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      lastMeta = { w: W, h: H, seed, steps, t: secs };
      $('#genMeta').textContent = t('d2.meta', lastMeta);
      btn.disabled = false; busy = false;
      if (g()) g().fromTo(canvas, { scale: .985 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)' });
    }
    let lastMeta = null;

    /* ---- transform tab ---- */
    let srcCanvas = null, trStyle = 'enhance', comparePos = 50, trRun = 0;
    const before = $('#trBefore'), after = $('#trAfter');
    function setSource(img) {
      const W = small() ? 720 : 960, H = Math.round(W / 1.5);
      const c = mk(W, H), x = c.getContext('2d');
      const ir = img.width / img.height, cr = W / H;
      let sw = img.width, sh = img.height, sx = 0, sy = 0;
      if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2; } else { sh = img.width / cr; sy = (img.height - sh) / 2; }
      x.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
      srcCanvas = c;
      before.width = after.width = W; before.height = after.height = H;
      before.getContext('2d').drawImage(c, 0, 0);
      transform(trStyle);
    }
    function fallbackSource() { return render('ocean moon', 'cine', 960, 640, 1234); }
    function loadDefault() {
      const img = new Image(); img.crossOrigin = 'anonymous';
      img.onload = () => { try { setSource(img); } catch (e) { setSource(fallbackSource()); } };
      img.onerror = () => setSource(fallbackSource());
      img.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80';
    }

    function filter(style, src) {
      const W = src.width, H = src.height;
      const sctx = src.getContext('2d');
      const S = sctx.getImageData(0, 0, W, H).data;
      const out = new ImageData(W, H), O = out.data;
      const L = new Float32Array(W * H);
      for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = .299 * S[p] + .587 * S[p + 1] + .114 * S[p + 2];
      const edges = () => {
        const E = new Float32Array(W * H);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
          const i = y * W + x;
          const gx = -L[i - W - 1] - 2 * L[i - 1] - L[i + W - 1] + L[i - W + 1] + 2 * L[i + 1] + L[i + W + 1];
          const gy = -L[i - W - 1] - 2 * L[i - W] - L[i - W + 1] + L[i + W - 1] + 2 * L[i + W] + L[i + W + 1];
          E[i] = Math.sqrt(gx * gx + gy * gy);
        }
        return E;
      };
      const cl = v => v < 0 ? 0 : v > 255 ? 255 : v;
      const vig = (x, y, k) => { const dx = x / W - .5, dy = y / H - .5; return 1 - k * (dx * dx + dy * dy) * 2.2; };
      const sat = (r, g2, b, s) => { const l = .299 * r + .587 * g2 + .114 * b; return [l + (r - l) * s, l + (g2 - l) * s, l + (b - l) * s]; };
      const post = (v, n) => Math.round(v / 255 * (n - 1)) / (n - 1) * 255;

      if (style === 'enhance') {
        const B = blurred(src, 3).getContext('2d').getImageData(0, 0, W, H).data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const p = (y * W + x) * 4;
          let r = S[p] + (S[p] - B[p]) * .9, g2 = S[p + 1] + (S[p + 1] - B[p + 1]) * .9, b = S[p + 2] + (S[p + 2] - B[p + 2]) * .9;
          [r, g2, b] = sat(r, g2, b, 1.35);
          const v = vig(x, y, .25);
          O[p] = cl(((r - 128) * 1.14 + 134 + 6) * v); O[p + 1] = cl(((g2 - 128) * 1.14 + 134) * v); O[p + 2] = cl(((b - 128) * 1.14 + 134 - 4) * v); O[p + 3] = 255;
        }
      } else if (style === 'cyber') {
        const E = edges();
        const st = [[8, 4, 34], [96, 10, 160], [255, 47, 160], [60, 240, 255], [255, 255, 255]];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x, p = i * 4;
          const tt = Math.min(.999, L[i] / 255) * (st.length - 1), k = Math.floor(tt), f = tt - k, A = st[k], Bc = st[k + 1];
          const e = Math.min(1, E[i] / 260), scan = y % 3 === 0 ? .82 : 1;
          O[p] = cl((A[0] + (Bc[0] - A[0]) * f + e * 60) * scan); O[p + 1] = cl((A[1] + (Bc[1] - A[1]) * f + e * 230) * scan); O[p + 2] = cl((A[2] + (Bc[2] - A[2]) * f + e * 255) * scan); O[p + 3] = 255;
        }
      } else if (style === 'anime') {
        const B = blurred(src, 3).getContext('2d').getImageData(0, 0, W, H).data, E = edges();
        for (let i = 0, p = 0; i < L.length; i++, p += 4) {
          let [r, g2, b] = sat(B[p], B[p + 1], B[p + 2], 1.6);
          r = post(cl(r * 1.08 + 8), 8); g2 = post(cl(g2 * 1.08 + 8), 8); b = post(cl(b * 1.1 + 10), 8);
          const line = E[i] > 95 ? .18 : E[i] > 60 ? .6 : 1;
          O[p] = r * line; O[p + 1] = g2 * line; O[p + 2] = b * line + (1 - line) * 30; O[p + 3] = 255;
        }
      } else if (style === 'sketch') {
        const E = edges();
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x, p = i * 4;
          const ln = 255 - Math.min(255, E[i] * 1.5);
          const shade = 255 - (255 - L[i]) * .38;
          const hatch = ((x + y) % 6 === 0 && L[i] < 90) ? .82 : 1;
          const v = Math.min(ln, shade) * hatch * (.95 + Math.random() * .05);
          O[p] = cl(v * .99 + 2); O[p + 1] = cl(v * .97); O[p + 2] = cl(v * .92); O[p + 3] = 255;
        }
      } else if (style === 'oil') {
        const B = blurred(src, 5).getContext('2d').getImageData(0, 0, W, H).data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const p = (y * W + x) * 4;
          const brush = Math.sin(x * .35 + Math.sin(y * .12) * 3) * 9 + Math.sin(y * .5 + Math.sin(x * .07) * 4) * 6;
          let [r, g2, b] = sat(B[p], B[p + 1], B[p + 2], 1.4);
          O[p] = cl(post(cl(r + brush), 9) + 6); O[p + 1] = cl(post(cl(g2 + brush), 9)); O[p + 2] = cl(post(cl(b + brush), 9) - 6); O[p + 3] = 255;
        }
      } else {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const i = y * W + x, p = i * 4;
          const v = 255 / (1 + Math.exp(-(L[i] - 120) / 30)) * vig(x, y, .55) + (Math.random() - .5) * 30;
          O[p] = O[p + 1] = O[p + 2] = cl(v); O[p + 3] = 255;
        }
      }
      return out;
    }
    function setPos(v) {
      comparePos = Math.max(0, Math.min(100, v));
      after.style.clipPath = `inset(0 ${100 - comparePos}% 0 0)`;
      $('#compareLine').style.left = comparePos + '%';
    }
    async function transform(style) {
      if (!srcCanvas) return;
      trStyle = style;
      const run = ++trRun;
      $('#trStatus').classList.add('is-on');
      await sleep(60);
      const data = filter(style, srcCanvas);
      if (run !== trRun) return;
      await sleep(450);
      after.getContext('2d').putImageData(data, 0, 0);
      $('#trStatus').classList.remove('is-on');
      const o = { v: 0 };
      if (g()) g().timeline().to(o, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => setPos(o.v) }).to(o, { v: 52, duration: .9, ease: 'expo.out', onUpdate: () => setPos(o.v) });
      else setPos(52);
    }
    function compareDrag() {
      const el = $('#compare');
      let down = false;
      const move = e => { const r = el.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
      el.addEventListener('pointerdown', e => { down = true; el.setPointerCapture(e.pointerId); move(e); });
      el.addEventListener('pointermove', e => { if (down || e.pointerType === 'mouse') move(e); });
      const up = () => { down = false; };
      el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    }

    function tabs() {
      const ink = $('.tab-ink');
      const place = () => { const on = $('.tab.is-on'); ink.style.width = on.offsetWidth + 'px'; ink.style.transform = `translateX(${on.offsetLeft - 4}px)`; };
      $$('[data-vtab]').forEach(b => b.addEventListener('click', () => {
        $$('[data-vtab]').forEach(x => x.classList.toggle('is-on', x === b));
        $$('[data-vpanel]').forEach(p => p.classList.toggle('is-on', p.dataset.vpanel === b.dataset.vtab));
        place();
        if (b.dataset.vtab === 'tr' && !srcCanvas) loadDefault();
        window.ScrollTrigger && window.ScrollTrigger.refresh();
      }));
      place(); addEventListener('resize', place);
      return place;
    }
    let placeInk = () => {};
    return {
      render, filter,
      init() {
        placeInk = tabs();
        $$('[data-gp]').forEach(b => b.addEventListener('click', () => { $('#genPrompt').value = t(b.dataset.gp); generate(); }));
        $$('[data-gp]').forEach(b => { b.textContent = t(b.dataset.gp); });
        seg($('#genStyle'), 'data-gs', s => { genStyle = s; });
        $('#genGo').addEventListener('click', generate);
        seg($('#trStyles'), 'data-style', s => transform(s));
        $('#trUpload').addEventListener('change', e => {
          const f = e.target.files && e.target.files[0]; if (!f) return;
          const url = URL.createObjectURL(f); const img = new Image();
          img.onload = () => { setSource(img); URL.revokeObjectURL(url); };
          img.src = url;
        });
        compareDrag();
        onVisible($('#vision'), vis => { if (vis && !busy && !lastMeta) { $('#genPrompt').value = t('d2.g1'); generate(); } });
        onVisible($('#vision'), vis => { if (vis) setTimeout(loadDefault, 1500); });
      },
      onLang() {
        $$('[data-gp]').forEach(b => { b.textContent = t(b.dataset.gp); });
        if (lastMeta) $('#genMeta').textContent = t('d2.meta', lastMeta);
        requestAnimationFrame(placeInk);
      }
    };
  })();

  /* =========================================================
     03 · WRITER
     ========================================================= */
  const Writer = (() => {
    let type = 'desc', tone = 0, run = 0, done = false;
    const out = $('#wOut');
    function compose() {
      const name = ($('#wName').value.trim() || 'Lumi Smart Lamp');
      const tag = name.replace(/[^\p{L}\p{N}]+/gu, '');
      const head = t(`d3.${type}.o${tone}`, { name, tag });
      const body = t(`d3.${type}.body`, { name, tag });
      return { head, body };
    }
    function paint(head, body, n, cursor) {
      const full = head + '\n\n' + body;
      const shown = full.slice(0, n);
      const h = shown.slice(0, head.length), b = shown.slice(head.length);
      out.innerHTML = `<span class="h">${esc(h)}</span>${esc(b.replace(/^\n\n/, ''))}${cursor ? '<span class="cursor-b"></span>' : ''}`;
    }
    async function write(instant) {
      const id = ++run; done = false;
      const { head, body } = compose();
      const total = head.length + 2 + body.length;
      const t0 = performance.now();
      $('#wScore').textContent = '…';
      if (!instant) {
        let n = 0;
        while (n < total) {
          if (id !== run) return;
          n = Math.min(total, n + randi(2, 6));
          paint(head, body, n, true);
          await sleep(16 + (Math.random() < .04 ? 120 : 0));
        }
      }
      paint(head, body, total, false);
      done = true;
      const words = (head + ' ' + body).split(/\s+/).filter(Boolean).length;
      $('#wStats').textContent = t('d3.stats', { w: words, s: instant ? '0.0' : ((performance.now() - t0) / 1000).toFixed(1) });
      $('#wScore').textContent = randi(88, 97);
    }
    return {
      init() {
        seg($('#wTypes'), 'data-wt', v => { type = v; write(); });
        seg($('#wTone'), 'data-tone', v => { tone = +v; write(); });
        $('#wGo').addEventListener('click', () => write());
        $('#wAgain').addEventListener('click', () => { tone = (tone + 1) % 3; $$('#wTone [data-tone]').forEach(b => b.classList.toggle('is-on', +b.dataset.tone === tone)); write(); });
        $('#wCopy').addEventListener('click', () => {
          const { head, body } = compose();
          copyText(head + '\n\n' + body).then(() => { const s = $('#wCopy span'); s.textContent = t('d3.copied'); setTimeout(() => { s.textContent = t('d3.copy'); }, 1600); });
        });
        onVisible($('#writer'), vis => { if (vis) write(); });
      },
      onLang() { if (done || run) write(true); }
    };
  })();

  /* =========================================================
     04 · CODE FORGE
     ========================================================= */
  const Code = (() => {
    const SNIPS = [
`<!-- Generated by Imagination · Code Forge -->
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #07080f; font-family: system-ui; }
  .card { width: 240px; padding: 28px; border-radius: 22px; color: #fff;
          background: linear-gradient(160deg, #1b1640, #0d0f1f);
          box-shadow: 0 0 0 1px #7c5cff66, 0 20px 60px #7c5cff55;
          animation: float 4s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-8px); } }
  .tag { font-size: 12px; color: #40e6ff; letter-spacing: 2px; }
  .price { font-size: 46px; font-weight: 800; margin: 10px 0; }
  .price span { font-size: 14px; color: #9aa0bd; }
  li { margin: 8px 0; color: #c9ccf0; list-style: none; }
  button { width: 100%; padding: 13px; border: 0; border-radius: 12px;
           font-weight: 700; cursor: pointer; color: #05060a;
           background: linear-gradient(90deg, #8b6cff, #40e6ff); }
  button:hover { filter: brightness(1.15); }
</style>
<div class="card">
  <div class="tag">PRO PLAN</div>
  <div class="price">$29<span>/month</span></div>
  <ul style="padding:0">
    <li>✦ Unlimited generations</li>
    <li>✦ 4K image exports</li>
    <li>✦ Priority AI agents</li>
  </ul>
  <button>Start free trial</button>
</div>`,
`<!-- Generated by Imagination · Code Forge -->
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; color: #fff;
         background: radial-gradient(circle at 30% 20%, #1d1450, #07080f 60%);
         font-family: system-ui; }
  form { width: 260px; padding: 28px; border-radius: 20px; background: #ffffff0d;
         border: 1px solid #ffffff22; backdrop-filter: blur(12px); }
  h2 { margin: 0 0 18px; font-size: 22px; }
  input { width: 100%; box-sizing: border-box; margin: 6px 0; padding: 12px;
          border-radius: 10px; border: 1px solid #ffffff2a; background: #00000055;
          color: #fff; outline: none; }
  input.err { border-color: #ff4f6d; }
  .msg { height: 18px; font-size: 12px; color: #ff4f6d; }
  .msg.ok { color: #7dff9b; }
  button { width: 100%; margin-top: 8px; padding: 12px; border: 0; border-radius: 10px;
           font-weight: 700; cursor: pointer; background: linear-gradient(90deg, #8b6cff, #40e6ff); }
</style>
<form id="f" novalidate>
  <h2>Welcome back</h2>
  <input id="email" placeholder="Email">
  <input id="pass" type="password" placeholder="Password">
  <div class="msg" id="msg">Try it: type and press Sign in</div>
  <button>Sign in</button>
</form>
<script>
  f.onsubmit = function (e) {
    e.preventDefault();
    var ok = /\\S+@\\S+\\.\\S+/.test(email.value);
    email.classList.toggle('err', !ok);
    pass.classList.toggle('err', pass.value.length < 6);
    msg.className = 'msg';
    if (!ok) return msg.textContent = 'Enter a valid email';
    if (pass.value.length < 6) return msg.textContent = 'Min. 6 characters';
    msg.className = 'msg ok';
    msg.textContent = '✓ Signed in';
  };
</script>`,
`<!-- Generated by Imagination · Code Forge -->
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
         background: #07080f; font-family: system-ui; color: #fff; }
  .w { width: 250px; padding: 24px; border-radius: 26px;
       background: linear-gradient(160deg, #3a7bff, #7a5cff);
       box-shadow: 0 20px 60px #3a7bff66; }
  .sun { position: relative; width: 70px; height: 70px; border-radius: 50%;
         background: #ffd25c; box-shadow: 0 0 40px #ffd25c;
         animation: glow 3s infinite; }
  .cloud { position: absolute; left: 34px; top: 34px; width: 64px; height: 28px;
           border-radius: 20px; background: #fff;
           animation: drift 4s ease-in-out infinite alternate; }
  @keyframes glow { 50% { box-shadow: 0 0 80px #ffd25c; } }
  @keyframes drift { to { transform: translateX(16px); } }
  .t { font-size: 58px; font-weight: 800; margin: 18px 0 0; }
  .row { display: flex; justify-content: space-between;
         margin-top: 16px; font-size: 13px; opacity: .85; }
</style>
<div class="w">
  <div class="sun"><div class="cloud"></div></div>
  <div class="t">24°</div>
  <div>Berlin · Partly sunny</div>
  <div class="row"><span>Mon 25°</span><span>Tue 22°</span><span>Wed 19°</span></div>
</div>`
    ];
    const RX = /(<!--[\s\S]*?-->)|(<\/?[a-zA-Z][\w-]*|\/?>)|("[^"]*"|'[^']*')|(\b(?:var|function|return|if|const|let)\b)|([a-z-]+(?=\s*:\s*[^\s/]))|(#[0-9a-fA-F]{3,8}\b|\b\d+(?:\.\d+)?(?:px|%|s|deg|vh)?\b)/g;
    const CLS = [null, 'cm', 'tg', 'st', 'kw', 'pr', 'nu'];
    function tokenize(code) {
      const segs = []; let last = 0, m;
      RX.lastIndex = 0;
      while ((m = RX.exec(code))) {
        if (m.index > last) segs.push([code.slice(last, m.index), null]);
        const gi = m.slice(1).findIndex(Boolean) + 1;
        segs.push([m[0], CLS[gi]]);
        last = m.index + m[0].length;
      }
      if (last < code.length) segs.push([code.slice(last), null]);
      return segs;
    }
    function html(segs, n, cursor) {
      let s = '', left = n;
      for (const [txt, c] of segs) {
        if (left <= 0) break;
        const part = txt.slice(0, left); left -= part.length;
        s += c ? `<span class="${c}">${esc(part)}</span>` : esc(part);
      }
      return s + (cursor ? '<span class="cur"></span>' : '');
    }
    let run = 0, active = -1;
    const pre = $('#cOut'), codeEl = $('#cOut code'), frame = $('#cFrame');
    async function go(i) {
      const id = ++run; active = i;
      $$('[data-snip]').forEach(b => b.classList.toggle('is-on', +b.dataset.snip === i));
      frame.classList.remove('is-on');
      $('#cState').textContent = '';
      const promptText = t(['d4.p1', 'd4.p2', 'd4.p3'][i]);
      const pEl = $('#cPrompt'); pEl.textContent = '';
      for (const ch of promptText) { if (id !== run) return; pEl.textContent += ch; await sleep(22); }
      await sleep(250);
      const code = SNIPS[i], segs = tokenize(code);
      $('#cState').textContent = t('d4.writing');
      let n = 0; const t0 = performance.now();
      while (n < code.length) {
        if (id !== run) return;
        n = Math.min(code.length, n + randi(4, 11));
        codeEl.innerHTML = html(segs, n, true);
        pre.scrollTop = pre.scrollHeight;
        const secs = (performance.now() - t0) / 1000;
        $('#cStat').textContent = t('d4.stat', { n: Math.round(n / 3.4), s: secs > .05 ? Math.round(n / 3.4 / secs) : '—' });
        await sleep(14);
      }
      codeEl.innerHTML = html(segs, code.length, false);
      frame.srcdoc = code;
      frame.onload = () => { if (id === run) { frame.classList.add('is-on'); $('#cState').textContent = '● ' + t('d4.running'); } };
    }
    return {
      init() {
        $$('[data-snip]').forEach(b => b.addEventListener('click', () => go(+b.dataset.snip)));
        onVisible($('#code'), vis => { if (vis) go(0); });
      },
      onLang() {
        if (active >= 0) $('#cPrompt').textContent = t(['d4.p1', 'd4.p2', 'd4.p3'][active]);
        if (frame.classList.contains('is-on')) $('#cState').textContent = '● ' + t('d4.running');
      }
    };
  })();

  /* =========================================================
     05 · CUSTOMER AGENT
     ========================================================= */
  const Chat = (() => {
    const body = $('#chatBody');
    let busy = false, session = 0, used = false;
    const scroll = () => { body.scrollTop = body.scrollHeight; };
    function add(cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; body.appendChild(d); scroll(); return d; }
    async function stream(el, text, id) {
      const words = text.split(/(\s+)/); el.textContent = '';
      for (const w of words) { if (id !== session) return; el.textContent += w; scroll(); await sleep(/\s/.test(w) ? 0 : 28 + Math.random() * 30); }
    }
    const FLOWS = { 1: [['tool.orders', 'tool.ship'], 'a1'], 2: [['tool.orders', 'tool.refund'], 'a2'], 3: [['tool.crm', 'tool.analytics'], 'a3'] };
    async function ask(q, custom) {
      if (busy) return;
      busy = true; used = true;
      const id = session;
      const [tools, answer] = custom ? [['tool.understand', 'tool.crm'], 'generic'] : FLOWS[q];
      add('msg user', esc(custom || t('q' + q)));
      await sleep(350);
      const typing = add('msg bot typing', '<i></i><i></i><i></i>');
      await sleep(700);
      typing.remove();
      if (id !== session) { busy = false; return; }
      const box = add('tools', '');
      for (const k of tools) {
        const el = document.createElement('div'); el.className = 'tool';
        el.innerHTML = `<span class="spin"></span><span class="ok">✓</span><span>${esc(t(k))}…</span>`;
        box.appendChild(el); scroll();
        await sleep(650 + Math.random() * 350);
        if (id !== session) { busy = false; return; }
        el.classList.add('done');
      }
      await sleep(200);
      const msg = add('msg bot', '');
      await stream(msg, t(answer), id);
      busy = false;
    }
    function reset() {
      session++; busy = false;
      body.innerHTML = '';
      add('msg bot', esc(t('d5.greeting')));
    }
    return {
      init() {
        reset();
        $$('[data-q]').forEach(b => b.addEventListener('click', () => ask(+b.dataset.q)));
        $('#chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#chatText').value.trim(); if (!v) return; $('#chatText').value = ''; ask(0, v); });
        $('#chatReset').addEventListener('click', () => { used = false; reset(); });
        onVisible($('#agent'), vis => { if (vis) setTimeout(() => { if (!used) ask(1); }, 1400); });
      },
      onLang() { reset(); }
    };
  })();

  /* =========================================================
     06 · SMART PAYMENTS
     ========================================================= */
  const Pay = (() => {
    const AMOUNT = 249;
    let volume = 1284530, blocked = 37, feedOn = false, timer = 0, paying = false;
    const CITIES = ['Cairo, EG', 'Berlin, DE', 'Dubai, AE', 'Moscow, RU', 'New York, US', 'Riyadh, SA', 'London, UK', 'Munich, DE', 'Alexandria, EG', 'Istanbul, TR', 'Paris, FR', 'Kazan, RU'];
    const card = $('#card3d');
    function labels() {
      $('#payLabel').textContent = paying ? t('d6.processing') : t('d6.pay', { amount: I.money(AMOUNT, 2) });
      $('#payAmount').textContent = I.money(AMOUNT, 2);
      $('#fVol').textContent = I.money(volume);
      $('#fBlk').textContent = I.num(blocked);
      $$('#feedList li').forEach(li => { const s = li.querySelector('.st'); s.textContent = t(s.dataset.k); });
    }
    function row(city, amt, status, mine) {
      const cls = { 'd6.approved': 'ap', 'd6.declined': 'bl', 'd6.review': 'rv' }[status];
      const li = document.createElement('li'); if (mine) li.className = 'mine';
      li.innerHTML = `<span>${esc(city)}</span><span class="amt" dir="ltr">${I.money(amt, 2)}</span><span class="st ${cls}" data-k="${status}">${esc(t(status))}</span>`;
      const list = $('#feedList'); list.prepend(li);
      while (list.children.length > 6) list.lastChild.remove();
    }
    function tickFeed() {
      const r = Math.random();
      const status = r < .07 ? 'd6.declined' : r < .13 ? 'd6.review' : 'd6.approved';
      const amt = Math.round(rand(9, 1800) * 100) / 100;
      row(CITIES[randi(0, CITIES.length - 1)], amt, status);
      if (status === 'd6.declined') blocked++; else volume += amt;
      bumpStats();
    }
    let shownVol = volume;
    function bumpStats() {
      const o = { v: shownVol };
      if (g()) g().to(o, { v: volume, duration: .8, ease: 'power2.out', onUpdate: () => { $('#fVol').textContent = I.money(o.v); } });
      shownVol = volume;
      $('#fBlk').textContent = I.num(blocked);
    }
    function confetti() {
      const c = $('#confetti'), ctx = c.getContext('2d');
      const r = c.getBoundingClientRect(); c.width = r.width; c.height = r.height;
      const cols = ['#8b6cff', '#40e6ff', '#ff5fb0', '#ffb547', '#7dff9b'];
      const ps = Array.from({ length: 140 }, () => ({ x: c.width / 2, y: c.height * .4, vx: rand(-7, 7), vy: rand(-11, -3), s: rand(4, 8), r: rand(0, 6), vr: rand(-.3, .3), c: cols[randi(0, 4)] }));
      let f = 0;
      (function loop() {
        ctx.clearRect(0, 0, c.width, c.height);
        ps.forEach(p => { p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
        if (++f < 140) requestAnimationFrame(loop); else ctx.clearRect(0, 0, c.width, c.height);
      })();
    }
    function resetRisk() {
      $('#gFill').style.strokeDashoffset = 267; $('#gVal').textContent = '0';
      $('#riskPill').textContent = '—'; $('#riskPill').className = 'pill';
      $$('#checks li').forEach(li => li.classList.remove('on'));
    }
    async function pay(e) {
      e.preventDefault();
      if (paying) return;
      paying = true; card.classList.remove('flip');
      $('#payBtn').disabled = true; labels();
      resetRisk();
      const score = randi(4, 14), o = { v: 0 };
      if (g()) g().to(o, { v: score, duration: 1.3, ease: 'power2.out', onUpdate: () => { $('#gVal').textContent = Math.round(o.v); $('#gFill').style.strokeDashoffset = 267 * (1 - o.v / 100); } });
      for (const li of $$('#checks li')) { await sleep(300); li.classList.add('on'); }
      await sleep(250);
      $('#riskPill').textContent = t('d6.low'); $('#riskPill').className = 'pill low';
      await sleep(500);
      $('#txId').textContent = 'TX-' + Math.random().toString(36).slice(2, 10).toUpperCase() + ' · ' + I.money(AMOUNT, 2) + ' · ' + (Math.random() * .3 + .4).toFixed(2) + 's';
      $('#paySuccess').classList.add('is-on');
      confetti();
      volume += AMOUNT; bumpStats();
      row($('#pName').value.trim() || 'You', AMOUNT, 'd6.approved', true);
      window.IMAGINATION_SCENE && window.IMAGINATION_SCENE.wake();
    }
    function bindCard() {
      const fmtNum = v => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
      $('#pNum').addEventListener('input', e => { e.target.value = fmtNum(e.target.value); $('#cardNum').textContent = (e.target.value + ' •••• •••• •••• ••••').slice(0, 19); });
      $('#pName').addEventListener('input', e => { $('#cardName').textContent = e.target.value.toUpperCase() || 'YOUR NAME'; });
      $('#pExp').addEventListener('input', e => { let v = e.target.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); e.target.value = v; $('#cardExp').textContent = v || 'MM/YY'; });
      $('#pCvc').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 3); $('#cardCvc').textContent = e.target.value || '•••'; });
      $('#pCvc').addEventListener('focus', () => card.classList.add('flip'));
      $('#pCvc').addEventListener('blur', () => card.classList.remove('flip'));
      const scene = $('#cardScene');
      if (matchMedia('(pointer: fine)').matches) {
        scene.addEventListener('pointermove', e => {
          const r = scene.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          card.style.transform = `rotateY(${px * 26}deg) rotateX(${-py * 22}deg)`;
          card.style.setProperty('--shine', (px * 80) + '%');
          $$('.card-shine').forEach(s => { s.style.transform = `translateX(${px * 70}%)`; });
        });
        scene.addEventListener('pointerleave', () => { card.style.transform = ''; });
      } else if (g()) {
        g().to(card, { rotateY: 10, rotateX: -6, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      }
    }
    return {
      init() {
        bindCard(); labels();
        for (let i = 0; i < 5; i++) tickFeed();
        $('#payForm').addEventListener('submit', pay);
        $('#payAgain').addEventListener('click', () => { $('#paySuccess').classList.remove('is-on'); paying = false; $('#payBtn').disabled = false; resetRisk(); labels(); });
        onVisible($('#payments'), vis => {
          feedOn = vis; clearInterval(timer);
          if (vis) timer = setInterval(tickFeed, 1500);
        }, false);
      },
      onLang() { labels(); if (paying) $('#payLabel').textContent = t('d6.processing'); }
    };
  })();

  /* =========================================================
     07 · PULSE CRM
     ========================================================= */
  const CRM = (() => {
    const deals = [
      { n: 'Atlas Logistics', v: 48000, s: 82, st: 2, c: '#40e6ff' },
      { n: 'Nordwind GmbH', v: 36500, s: 74, st: 1, c: '#8b6cff' },
      { n: 'Souq Nova', v: 22000, s: 91, st: 3, c: '#7dff9b' },
      { n: 'Polar Studio', v: 12800, s: 58, st: 0, c: '#ff5fb0' },
      { n: 'Mirage Hotels', v: 64000, s: 69, st: 1, c: '#ffb547' },
      { n: 'Kraftwerk Labs', v: 27400, s: 77, st: 2, c: '#40e6ff' },
      { n: 'Volga Retail', v: 15900, s: 46, st: 0, c: '#c4b2ff' },
      { n: 'Nile Health', v: 41200, s: 63, st: 0, c: '#ff5fb0' }
    ];
    const PROB = [.1, .3, .6, 1];
    const ACTUAL = [182, 196, 188, 214, 231, 226, 248, 262, 279];
    let shown = null, fc = null, insightIdx = 0, holdUntil = 0, flashId = -1, drawn = false;
    const metrics = () => {
      const open = deals.filter(d => d.st < 3).reduce((a, d) => a + d.v, 0);
      const forecast = deals.reduce((a, d) => a + d.v * PROB[d.st], 0);
      const won = deals.filter(d => d.st === 3).length;
      return { open, forecast, win: (won + 9) / (deals.length + 20) * 100, score: deals.reduce((a, d) => a + d.s, 0) / deals.length };
    };
    const scoreCol = s => s >= 80 ? '#7dff9b' : s >= 60 ? '#40e6ff' : s >= 50 ? '#ffb547' : '#ff5fb0';
    const initials = n => n.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    function renderBoard() {
      const kb = $('#kanban');
      kb.innerHTML = [0, 1, 2, 3].map(st => {
        const list = deals.map((d, i) => [d, i]).filter(([d]) => d.st === st);
        const total = list.reduce((a, [d]) => a + d.v, 0);
        return `<div class="col" data-stage="${st}"><div class="col-head"><b>${esc(t('st' + (st + 1)))}<span class="ct">${list.length}</span></b><span dir="ltr">${I.money(total)}</span></div>
          ${list.map(([d, i]) => `<div class="deal${i === flashId ? ' flash' : ''}" data-i="${i}"><div class="deal-top"><span class="deal-name">${esc(d.n)}</span><span class="deal-av" style="background:${d.c}">${initials(d.n)}</span></div><div class="deal-val" dir="ltr">${I.money(d.v)}</div><div class="deal-score"><i><em style="width:${d.s}%;background:${scoreCol(d.s)}"></em></i><b>${d.s}</b></div></div>`).join('')}</div>`;
      }).join('');
      flashId = -1;
    }
    function renderKpis(animate) {
      const m = metrics();
      const set = (o) => {
        $('#k1').textContent = I.money(o.open); $('#k2').textContent = I.money(o.forecast);
        $('#k3').textContent = I.num(o.win, 0) + '%'; $('#k4').textContent = I.num(o.score, 0);
      };
      if (!shown || !animate || !g()) { shown = { ...m }; set(shown); return; }
      $$('.kpi').forEach(k => { k.classList.remove('bump'); void k.offsetWidth; k.classList.add('bump'); });
      g().to(shown, { ...m, duration: .9, ease: 'power3.out', onUpdate: () => set(shown) });
    }
    function chartPoints(forecast) {
      const k = forecast / 1000;
      const last = ACTUAL[ACTUAL.length - 1];
      return [last + k * .22, last + k * .42, last + k * .66];
    }
    function drawChart(pts) {
      const svg = $('#chart'), W = 420, H = 200, all = ACTUAL.concat(pts);
      const min = 150, max = Math.max(380, Math.max(...all) + 20);
      const X = i => 10 + i * (W - 20) / (all.length - 1), Y = v => H - 14 - (v - min) / (max - min) * (H - 30);
      const line = ACTUAL.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      const area = line + ` L${X(ACTUAL.length - 1)},${H} L${X(0)},${H} Z`;
      const li = ACTUAL.length - 1;
      const fline = `M${X(li)},${Y(ACTUAL[li])} ` + pts.map((v, i) => `L${X(li + 1 + i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
      const grid = [0, 1, 2, 3].map(i => `<line x1="0" x2="${W}" y1="${14 + i * (H - 28) / 3}" y2="${14 + i * (H - 28) / 3}" stroke="rgba(255,255,255,.06)"/>`).join('');
      svg.innerHTML = `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8b6cff" stop-opacity=".45"/><stop offset="1" stop-color="#8b6cff" stop-opacity="0"/></linearGradient></defs>${grid}
        <path d="${area}" fill="url(#ga)"/>
        <path id="aLine" d="${line}" fill="none" stroke="#8b6cff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <path d="${fline}" fill="none" stroke="#40e6ff" stroke-width="2.5" stroke-dasharray="6 6" vector-effect="non-scaling-stroke"/>
        ${pts.map((v, i) => `<circle cx="${X(li + 1 + i)}" cy="${Y(v)}" r="4" fill="#07070f" stroke="#40e6ff" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join('')}`;
    }
    function renderMonths() {
      const now = new Date(); const fmtM = new Intl.DateTimeFormat(I.locale, { month: 'short' });
      const labels = Array.from({ length: 12 }, (_, i) => fmtM.format(new Date(now.getFullYear(), now.getMonth() - 8 + i, 1)));
      $('#chartMonths').innerHTML = labels.map((l, i) => `<span style="${i > 8 ? 'color:#40e6ff' : ''}">${esc(l)}</span>`).join('');
    }
    function updateChart() {
      const target = chartPoints(metrics().forecast);
      if (!fc || !g()) { fc = target.slice(); drawChart(fc); return; }
      const o = { a: fc[0], b: fc[1], c: fc[2] };
      g().to(o, { a: target[0], b: target[1], c: target[2], duration: 1, ease: 'power3.out', onUpdate: () => { fc = [o.a, o.b, o.c]; drawChart(fc); } });
    }
    function say(text) {
      const p = $('#insightText');
      if (g()) g().to(p, { opacity: 0, y: 6, duration: .2, onComplete: () => { p.textContent = text; g().to(p, { opacity: 1, y: 0, duration: .4 }); } });
      else p.textContent = text;
    }
    function move(i, st) {
      const d = deals[i];
      if (st === d.st) return;
      const diff = st - d.st;
      d.s = Math.max(20, Math.min(99, d.s + (diff > 0 ? 6 * diff : -5)));
      d.st = st; flashId = i;
      renderBoard(); renderKpis(true); updateChart();
      const m = metrics();
      holdUntil = Date.now() + 6500;
      say(st === 3 ? t('d7.won', { deal: d.n, value: I.money(d.v) }) : t('d7.moved', { deal: d.n, stage: t('st' + (st + 1)), value: I.money(m.forecast) }));
      if (st === 3) window.IMAGINATION_SCENE && window.IMAGINATION_SCENE.wake();
    }
    function interact() {
      const kb = $('#kanban');
      let drag = null, suppress = false;
      kb.addEventListener('pointerdown', e => {
        const el = e.target.closest('.deal'); if (!el || e.pointerType !== 'mouse' || e.button !== 0) return;
        drag = { el, i: +el.dataset.i, x: e.clientX, y: e.clientY, on: false, ghost: null, col: null };
      });
      addEventListener('pointermove', e => {
        if (!drag) return;
        if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) {
          drag.on = true;
          const gh = drag.el.cloneNode(true); gh.classList.add('ghost'); document.body.appendChild(gh); drag.ghost = gh;
          drag.el.classList.add('dragging');
        }
        if (!drag.on) return;
        drag.ghost.style.left = (e.clientX - 95) + 'px'; drag.ghost.style.top = (e.clientY - 30) + 'px';
        const col = document.elementFromPoint(e.clientX, e.clientY)?.closest('.col');
        $$('.col').forEach(c => c.classList.toggle('over', c === col));
        drag.col = col;
      });
      addEventListener('pointerup', () => {
        if (!drag) return;
        const d = drag; drag = null;
        if (!d.on) return;
        suppress = true; setTimeout(() => { suppress = false; }, 50);
        d.ghost.remove(); $$('.col').forEach(c => c.classList.remove('over'));
        d.el.classList.remove('dragging');
        if (d.col) move(d.i, +d.col.dataset.stage);
      });
      kb.addEventListener('click', e => {
        if (suppress) return;
        const el = e.target.closest('.deal'); if (!el) return;
        const i = +el.dataset.i; if (deals[i].st < 3) move(i, deals[i].st + 1);
      });
    }
    return {
      init() {
        renderBoard(); renderKpis(false); renderMonths(); updateChart(); interact();
        $('#insightText').textContent = t('i1');
        setInterval(() => { if (Date.now() < holdUntil) return; insightIdx = (insightIdx + 1) % 3; say(t('i' + (insightIdx + 1))); }, 7000);
        onVisible($('#crm'), vis => {
          if (!vis || drawn || !g()) return; drawn = true;
          const p = $('#aLine'); if (!p) return;
          const len = p.getTotalLength();
          g().fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', onComplete: () => { p.style.strokeDasharray = 'none'; } });
          const o = { open: 0, forecast: 0, win: 0, score: 0 }; shown = o; renderKpis(true);
        });
      },
      onLang() { renderBoard(); renderKpis(false); renderMonths(); $('#insightText').textContent = t('i' + (insightIdx + 1)); }
    };
  })();

  /* =========================================================
     ROI CALCULATOR
     ========================================================= */
  const ROI = (() => {
    const shown = { money: 0, hrs: 0, fte: 0 };
    function calc(animate) {
      const team = +$('#rTeam').value, hours = +$('#rHours').value, rate = +$('#rRate').value;
      $$('.roi-inputs input[type=range]').forEach(r => r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'));
      $('#rTeamV').textContent = I.num(team); $('#rHoursV').textContent = I.num(hours); $('#rRateV').textContent = I.money(rate);
      const sel = $$('#rTools .chip.is-on').map(c => +c.dataset.auto);
      const auto = Math.min(.8, 1 - sel.reduce((a, s) => a * (1 - s), 1));
      const hrs = team * hours * 48 * auto, money = hrs * rate, fte = hrs / 1760;
      const set = () => { $('#rMoney').textContent = I.money(shown.money); $('#rHrs').textContent = I.num(shown.hrs); $('#rFte').textContent = I.num(shown.fte, 1); };
      $('#rBar2').style.width = ((1 - auto) * 100) + '%';
      if (animate && g()) g().to(shown, { money, hrs, fte, duration: .7, ease: 'power3.out', overwrite: true, onUpdate: set });
      else { Object.assign(shown, { money, hrs, fte }); set(); }
    }
    return {
      init() {
        $$('.roi-inputs input[type=range]').forEach(r => r.addEventListener('input', () => calc(true)));
        $$('#rTools .chip').forEach(c => c.addEventListener('click', () => { c.classList.toggle('is-on'); calc(true); }));
        calc(false); shown.money = shown.hrs = shown.fte = 0;
        onVisible($('#roi'), vis => { if (vis) calc(true); });
      },
      onLang() { calc(false); }
    };
  })();

  const all = [Race, Writer, Code, Chat, Pay, CRM, ROI];
  // Vision Studio lives in js/vision.js; it reuses the procedural renderer and CPU filters as offline fallbacks
  window.VisionProcedural = Vision.render;
  window.VisionCPUFilter = Vision.filter;
  window.Demos = {
    init() { all.forEach(m => { try { m.init(); } catch (e) { console.error(e); } }); },
    onLang() { all.forEach(m => { try { m.onLang(); } catch (e) { console.error(e); } }); }
  };
})();
