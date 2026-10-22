/* Imagination — Nova's human avatar: a "video call" face that blinks, looks at you,
   listens and lip-syncs while Nova (js/voice.js) talks. */
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const V = window.Voice;
  if (!V || !$('#avatarSvg')) return;

  const call = $('#call'), caps = $('#captions');
  const head = $('#avHead'), irises = $$('.av-iris'), lids = $$('.av-eye-in');
  const inner = $('#avInner'), teeth = $('#avTeeth'), low = $('#avLow'), browL = $('#avBrowL'), browR = $('#avBrowR'), mic = $('#avMic');
  let mode = 'idle', active = false, visible = false, raf = 0;
  let mouth = 0, look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }, lastPointer = 0, blinkAt = performance.now() + 2500, blinkUntil = 0;
  let callStart = 0, clock = 0;

  /* ---------- captions ---------- */
  let capRun = 0;
  async function caption(text, who) {
    const id = ++capRun;
    caps.className = 'captions ' + who;
    if (who !== 'bot') { caps.textContent = text; return; }
    caps.textContent = '';
    for (const w of text.split(' ')) {
      if (id !== capRun) return;
      caps.textContent += (caps.textContent ? ' ' : '') + w;
      await new Promise(r => setTimeout(r, 70));
    }
  }
  addEventListener('nova:say', e => caption(e.detail, 'bot'));
  addEventListener('nova:user', e => caption(e.detail, 'user'));
  addEventListener('nova:interim', e => caption(e.detail, 'user'));
  addEventListener('nova:state', e => { mode = e.detail; call.dataset.mode = mode; });

  /* ---------- call controls ---------- */
  function startTimer() {
    callStart = performance.now();
    clearInterval(clock);
    clock = setInterval(() => {
      const s = Math.floor((performance.now() - callStart) / 1000);
      $('#callTime').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }, 500);
  }
  function begin() {
    if (active) return false;
    active = true; call.classList.add('is-active'); startTimer();
    return true;
  }
  function primary() {
    if (begin()) { V.startCall(); return; }
    if (V.mode === 'listen') V.stopListening(); else V.listen();
  }
  $('#callBtn').addEventListener('click', primary);
  $('#avatarStage').addEventListener('click', primary);
  $('#callEnd').addEventListener('click', () => {
    active = false; call.classList.remove('is-active'); clearInterval(clock);
    $('#callTime').textContent = '00:00'; caps.textContent = '';
    V.endCall();
  });
  $('#callType').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#callText').value.trim(); if (!v) return;
    $('#callText').value = '';
    begin();
    V.ask(v);
  });

  /* ---------- face animation ---------- */
  const svg = $('#avatarSvg');
  addEventListener('pointermove', e => {
    if (!visible) return;
    const r = svg.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * .52;
    lookT.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (r.width * .8)));
    lookT.y = Math.max(-1, Math.min(1, (e.clientY - cy) / (r.height * .8)));
    lastPointer = performance.now();
  }, { passive: true });

  function frame(now) {
    if (!visible) { raf = 0; return; }
    const t = now / 1000;
    const talking = mode === 'speak' || mode === 'tour';

    // mouth: syllable-like motion while speaking, nudged by word boundaries from the voice
    let target = 0;
    if (talking && (V.speaking() || mode === 'speak')) {
      target = .12 + .58 * Math.abs(Math.sin(t * 13.5 + Math.sin(t * 4.7) * 1.6)) * (.65 + .35 * Math.sin(t * 2.3)) + V.pulse() * .35;
    }
    mouth += (Math.min(1, target) - mouth) * .35;
    inner.setAttribute('ry', (2 + mouth * 11).toFixed(2));
    inner.setAttribute('cy', (316 + mouth * 4).toFixed(2));
    teeth.setAttribute('opacity', mouth > .2 ? .9 : 0);
    const smile = mode === 'idle' ? 2 : 0;
    low.setAttribute('d', `M178 ${316 - smile} Q200 ${330 + mouth * 15} 222 ${316 - smile} Q200 ${320 + mouth * 13} 178 ${316 - smile}Z`);

    // eyes: follow the pointer, wander when idle, glance up while thinking
    if (now - lastPointer > 2500) {
      if (mode === 'think') { lookT.x = .5; lookT.y = -.7; }
      else if (Math.random() < .01) { lookT.x = (Math.random() - .5) * .8; lookT.y = (Math.random() - .5) * .5; }
    }
    look.x += (lookT.x - look.x) * .12; look.y += (lookT.y - look.y) * .12;
    irises.forEach(g => g.setAttribute('transform', `translate(${(look.x * 6).toFixed(2)} ${(look.y * 3.5).toFixed(2)})`));

    // blinking
    if (now > blinkAt) { blinkUntil = now + 130; blinkAt = now + 2200 + Math.random() * 3500; }
    const lid = now < blinkUntil ? .08 : 1;
    lids.forEach(g => g.setAttribute('transform', `scale(1 ${lid})`));

    // brows lift when listening
    const lift = mode === 'listen' ? -5 : mode === 'think' ? -2 : talking ? -Math.abs(Math.sin(t * 3)) * 2 : 0;
    browL.setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);
    browR.setAttribute('transform', `translate(0 ${lift.toFixed(2)})`);

    // head: breathing, gentle sway, nods while talking, leans in while listening
    const sway = Math.sin(t * .7) * 1.8 + (talking ? Math.sin(t * 2.6) * 1.6 : 0) + look.x * 2.5;
    const nod = (talking ? Math.sin(t * 5.2) * 1.4 : 0) + Math.sin(t * 1.3) * 1.2 + (mode === 'listen' ? 3 : 0);
    head.setAttribute('transform', `translate(0 ${nod.toFixed(2)}) rotate(${sway.toFixed(2)} 200 330)`);
    mic.setAttribute('fill', mode === 'listen' ? (Math.sin(t * 8) > 0 ? '#ff4f6d' : '#ff9aa9') : '#40e6ff');

    raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(es => es.forEach(en => {
    visible = en.isIntersecting;
    if (visible && !raf) raf = requestAnimationFrame(frame);
  }), { threshold: .1 }).observe(call);
})();
