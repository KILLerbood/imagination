/* Imagination — Vision Studio
   Generate: any-language prompt -> AI-written English prompt (Claude, or a free fallback) -> real
             text-to-image model (FLUX via Pollinations, proxied by serve.ps1) with a diffusion-style reveal.
   Transform: GPU (WebGL) stylisation — Kuwahara painterly smoothing, XDoG line art, cel shading —
              plus "AI remake": Claude describes the photo and the image model redraws it in the style. */
(function () {
  const I = window.I18N, t = (k, v) => I.t(k, v);
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const g = () => window.gsap;
  const small = () => innerWidth < 700;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const rand = (a, b) => a + Math.random() * (b - a);
  const claudeOn = () => !!(window.Voice && window.Voice.claude);

  // reuses two scratch canvases: Safari caps total canvas memory, so we never allocate per frame
  const blurS = mk(1, 1), blurO = mk(1, 1);
  function blurred(src, f) {
    const sw = Math.max(1, Math.round(src.width / f)), sh = Math.max(1, Math.round(src.height / f));
    if (blurS.width !== sw || blurS.height !== sh) { blurS.width = sw; blurS.height = sh; } else blurS.getContext('2d').clearRect(0, 0, sw, sh);
    blurS.getContext('2d').drawImage(src, 0, 0, sw, sh);
    if (blurO.width !== src.width || blurO.height !== src.height) { blurO.width = src.width; blurO.height = src.height; }
    const x = blurO.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(blurS, 0, 0, blurO.width, blurO.height);
    return blurO;
  }
  function blobToImage(blob) {
    return new Promise((res, rej) => { const u = URL.createObjectURL(blob); const im = new Image(); im.onload = () => { res(im); URL.revokeObjectURL(u); }; im.onerror = rej; im.src = u; });
  }
  function drawCover(ctx, img, W, H) {
    const ir = img.width / img.height, cr = W / H;
    let sw = img.width, sh = img.height, sx = 0, sy = 0;
    if (ir > cr) { sw = img.height * cr; sx = (img.width - sw) / 2; } else { sh = img.width / cr; sy = (img.height - sh) / 2; }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }

  /* =========================================================
     Prompt engineering + real image model
     ========================================================= */
  const STYLE = {
    photo: 'ultra-realistic photograph, natural light, 35mm lens, sharp focus, highly detailed',
    cine: 'cinematic film still, dramatic lighting, anamorphic lens, teal and orange color grade, shallow depth of field',
    anime: 'anime illustration in the style of a Studio Ghibli film, clean line art, soft cel shading, vibrant colors, detailed painted background',
    '3d': '3D render in Pixar style, octane render, soft global illumination, cute and highly detailed',
    oil: 'oil painting on canvas, thick visible brush strokes, impressionist, rich warm colors',
    neon: 'cyberpunk neon aesthetic, glowing magenta and cyan lights, synthwave, high contrast, night',
    sketch: 'detailed graphite pencil sketch on textured paper, cross-hatching, monochrome',
    mono: 'black and white film photograph, high contrast, fine grain, dramatic shadows'
  };
  const REMAKE = { anime: 'anime', oil: 'oil', sketch: 'sketch', cyber: 'neon', enhance: 'photo', mono: 'mono' };

  async function chat(system, content) {
    const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, messages: [{ role: 'user', content }] }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.text) throw new Error('chat');
    return d.text.trim().replace(/^["“]|["”]$/g, '');
  }
  async function buildPrompt(raw, style) {
    if (claudeOn()) {
      try {
        // the free image model follows short, concrete, front-loaded prompts much better than long prose
        const p = await chat(`You write prompts for a small text-to-image model that only understands short, concrete English. Turn the user's request (any language) into ONE prompt of 25 to 45 words, comma-separated phrases, no full sentences. This model gives the most weight to the first words, so the FIRST phrase must hold the main subjects with their exact count, action and props together with the most distinctive colored element, e.g. "two samurai warriors dueling with katanas under a crimson red full moon glowing red". Then: every other element the user asked for, named explicitly; setting and time of day; lighting that repeats the key color (e.g. "red moonlight"). Never drop or soften anything the user asked for, and never invent extra people or change counts: "a samurai fighting another samurai" means exactly two samurai dueling. End with: ${STYLE[style]}. Reply with the prompt only.`, raw);
        return { prompt: p, by: 'AI' };
      } catch (e) { /* fall through */ }
    }
    if (/[^\x00-\x7F]/.test(raw) || raw.trim().split(/\s+/).length < 7) {
      try {
        let r = await fetch('/api/prompt?q=' + encodeURIComponent(raw));
        if (r.status === 404 || r.status === 405) {
          // static host: ask the free text model directly
          const ask = `Rewrite this as one vivid, detailed English prompt for an AI image generator (subject, setting, lighting, composition, mood). Keep every element the user asked for. Reply with the prompt only, no quotes: ${raw}`;
          const tr = await fetch('https://text.pollinations.ai/' + encodeURIComponent(ask) + '?referrer=imagination-ai');
          r = { ok: tr.ok, json: async () => ({ prompt: (await tr.text()).trim() }) };
        }
        const d = await r.json();
        if (r.ok && d.prompt && d.prompt.length < 700 && !/[؀-ۿЀ-ӿ]/.test(d.prompt)) return { prompt: d.prompt.replace(/^["“]|["”]$/g, '') + ', ' + STYLE[style], by: 'AI' };
      } catch (e) { /* fall through */ }
    }
    return { prompt: raw + ', ' + STYLE[style], by: null };
  }
  // The free image tier allows one image every 45 s per IP: the server tells us exactly how long to wait,
  // and we show a live countdown instead of hammering it.
  // On a static host (GitHub Pages) there is no /api: call the free image service straight from the browser.
  let noBackend = false;
  async function directImage(prompt, w, h, seed) {
    const r = await fetch(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&seed=${seed}&nologo=true&referrer=imagination-ai`);
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image')) return { ok: true, r };
    let wait = +(r.headers.get('retry-after') || 0);
    if (!wait) { const d = await r.json().catch(() => ({})); const m = /(\d+)\s*s/.exec((d.error && d.error.message) || ''); wait = m ? +m[1] : 45; }
    return { ok: false, status: r.status === 402 ? 429 : r.status, wait: wait + 1 };
  }
  async function fetchImage(prompt, w, h, seed, onWait, isCancelled) {
    let errors = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      let r, d = {};
      try {
        if (!noBackend) {
          r = await fetch(`/api/image?prompt=${encodeURIComponent(prompt)}&w=${w}&h=${h}&seed=${seed}`);
          if (r.status === 404 || r.status === 405) noBackend = true;
        }
        if (noBackend) {
          const x = await directImage(prompt, w, h, seed);
          if (x.ok) return await blobToImage(await x.r.blob());
          r = { ok: false, status: x.status, headers: new Headers() }; d = { wait: x.wait };
        }
      }
      catch (e) { if (++errors > 1) return null; await sleep(1500); continue; }
      if (r.ok && (r.headers.get('content-type') || '').startsWith('image')) return await blobToImage(await r.blob());
      if (!noBackend) d = await r.json().catch(() => ({}));
      if (r.status === 429 && d.wait) {
        for (let s = Math.min(d.wait, 60); s > 0; s--) {
          if (isCancelled && isCancelled()) return null;
          onWait && onWait(s);
          await sleep(1000);
        }
        continue;
      }
      if (++errors > 1) return null;
      await sleep(2000);
    }
    return null;
  }

  /* =========================================================
     GENERATE
     ========================================================= */
  const SIZES = { wide: [1024, 640], square: [832, 832], tall: [768, 960] };
  let genStyle = 'photo', genSize = 'wide', genRun = 0, busy = false, lastMeta = null, lastKey = '';
  const promptCache = {};
  const hashSeed = s => { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) % 1000000; };
  const canvas = $('#genCanvas'), gctx = canvas.getContext('2d');
  const noise = (() => { const c = mk(256, 256), x = c.getContext('2d'), im = x.createImageData(256, 256); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = v * rand(.55, 1); im.data[i + 1] = v * rand(.45, .9); im.data[i + 2] = v; im.data[i + 3] = 255; } x.putImageData(im, 0, 0); return c; })();

  function setStep(text, p) {
    const el = $('#genStep'); el.textContent = text; el.classList.toggle('is-on', !!text);
    if (p != null) $('#genBar').style.width = (p * 100) + '%';
  }
  // flowing "latent noise" while the model works
  function dream(run) {
    let tt = 0;
    const loop = () => {
      if (run !== genRun || !busy) return;
      tt += .016;
      const W = canvas.width, H = canvas.height;
      gctx.globalAlpha = 1; gctx.fillStyle = '#07060f'; gctx.fillRect(0, 0, W, H);
      gctx.globalAlpha = .9; gctx.imageSmoothingEnabled = true;
      const s = 1.2 + Math.sin(tt * .5) * .15;
      gctx.drawImage(noise, -Math.sin(tt) * 40 - 40, -Math.cos(tt * .7) * 40 - 40, W * s + 80, H * s + 80);
      gctx.globalCompositeOperation = 'overlay';
      const gr = gctx.createRadialGradient(W * (.5 + Math.sin(tt * .8) * .2), H * (.5 + Math.cos(tt * .6) * .2), 10, W / 2, H / 2, W * .7);
      gr.addColorStop(0, '#8b6cff'); gr.addColorStop(.5, '#40e6ff'); gr.addColorStop(1, '#ff5fb0');
      gctx.fillStyle = gr; gctx.fillRect(0, 0, W, H);
      gctx.globalCompositeOperation = 'source-over'; gctx.globalAlpha = 1;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  async function reveal(final) {
    const W = canvas.width, H = canvas.height, steps = 18;
    for (let s = 1; s <= steps; s++) {
      const p = s / steps, f = Math.max(1, 48 * Math.pow(1 - p, 2.4));
      gctx.globalAlpha = 1; gctx.drawImage(f > 1.05 ? blurred(final, f) : final, 0, 0, W, H);
      gctx.globalAlpha = Math.pow(1 - p, 1.5) * .85;
      gctx.globalCompositeOperation = p < .5 ? 'source-over' : 'overlay';
      gctx.drawImage(noise, -rand(0, 40), -rand(0, 40), W + 80, H + 80);
      gctx.globalCompositeOperation = 'source-over'; gctx.globalAlpha = 1;
      setStep(`${t('d2.s4')} ${s}/${steps}`, .85 + p * .15);
      await sleep(45);
    }
    gctx.drawImage(final, 0, 0, W, H);
  }
  function addToGallery() {
    const thumb = mk(160, Math.round(160 * canvas.height / canvas.width));
    thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);
    const full = canvas.toDataURL('image/jpeg', .92);
    const b = document.createElement('button');
    b.className = 'gen-thumb'; b.style.backgroundImage = `url(${thumb.toDataURL('image/jpeg', .8)})`;
    b.addEventListener('click', () => { const im = new Image(); im.onload = () => { canvas.width = im.width; canvas.height = im.height; canvas.style.aspectRatio = `${im.width}/${im.height}`; gctx.drawImage(im, 0, 0); $('#genDl').href = full; }; im.src = full; });
    const gal = $('#genGallery'); gal.prepend(b);
    while (gal.children.length > 6) gal.lastChild.remove();
    $('#genDl').href = full; $('#genDl').hidden = false;
  }

  async function generate() {
    const promptEl = $('#genPrompt');
    if (!promptEl.value.trim()) promptEl.value = t('d2.g1');
    const raw = promptEl.value.trim();
    const run = ++genRun; busy = true;
    const btn = $('#genGo'); btn.disabled = true;
    const [W, H] = SIZES[genSize];
    canvas.width = W; canvas.height = H; canvas.style.aspectRatio = `${W}/${H}`;
    $('#genOverlay').classList.add('is-off');
    $('#genUsed').textContent = '';
    // same idea + style + format -> same seed, so repeats come straight from the server cache
    const key = raw + '|' + genStyle + '|' + genSize;
    const again = lastKey === key; lastKey = key;
    const t0 = performance.now(), seed = again ? Math.floor(Math.random() * 1e6) : hashSeed(key);
    dream(run);
    setStep(t('d2.s1'), .08);
    let creep = .1;
    const creeper = setInterval(() => { creep += (.82 - creep) * .05; $('#genBar').style.width = (creep * 100) + '%'; }, 200);
    let img = null, engine = 'FLUX', note = '';
    if (gemini) {
      // Nano Banana understands any language and follows long descriptions closely: send the visitor's own words
      const gp = `Create an image of: ${raw}\n\nStyle: ${STYLE[genStyle]}.\nFollow every detail of the description exactly: subjects, how many, actions, positions, setting, colors and lighting.`;
      $('#genUsed').textContent = 'Gemini · Nano Banana';
      setStep(t('d2.s3'));
      const res = await geminiImage(gp, ASPECT[genSize]);
      if (run !== genRun) { clearInterval(creeper); return; }
      if (res.img) { img = res.img; engine = 'Gemini (Nano Banana)'; }
      else note = res.error === 'blocked' ? t('d2.blocked') : res.error === 'quota' ? t('d2.gemQuota') : '';
      if (note) setStep(note);
    }
    if (!img) {
      const built = promptCache[raw + '|' + genStyle] || await buildPrompt(raw, genStyle);
      promptCache[raw + '|' + genStyle] = built;
      if (run !== genRun) { clearInterval(creeper); return; }
      $('#genUsed').textContent = (note ? note + ' · ' : '') + (built.by ? built.by + ' → ' : '') + built.prompt;
      setStep(t('d2.s3'));
      img = await fetchImage(built.prompt, W, H, seed, s => setStep(t('d2.wait', { s })), () => run !== genRun);
    }
    clearInterval(creeper);
    if (run !== genRun) return;
    busy = false;
    let final;
    if (img) {
      // keep the model's own framing (Gemini picks exact aspect ratios)
      const s = Math.min(1, 1280 / Math.max(img.width, img.height));
      const fw = Math.round(img.width * s), fh = Math.round(img.height * s);
      canvas.width = fw; canvas.height = fh; canvas.style.aspectRatio = `${fw}/${fh}`;
      final = mk(fw, fh); final.getContext('2d').drawImage(img, 0, 0, fw, fh);
    }
    else { final = window.VisionProcedural ? window.VisionProcedural(raw, genStyle === 'neon' ? 'neon' : genStyle === 'cine' ? 'cine' : 'dream', W, H, seed) : mk(W, H); engine = t('d2.offline'); }
    await reveal(final);
    setStep('', 1);
    lastMeta = { w: canvas.width, h: canvas.height, seed, engine, t: ((performance.now() - t0) / 1000).toFixed(1) };
    paintMeta();
    addToGallery();
    btn.disabled = false;
    if (g()) g().fromTo('#genFrame', { scale: .985 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.5)' });
  }
  function paintMeta() { if (lastMeta) $('#genMeta').textContent = `${lastMeta.w}×${lastMeta.h} · seed ${lastMeta.seed} · ${lastMeta.engine} · ${lastMeta.t}s`; }

  /* =========================================================
     TRANSFORM — WebGL stylisation
     ========================================================= */
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const KUWAHARA = `precision highp float;uniform sampler2D t;uniform vec2 px;varying vec2 v;
    void main(){
      vec3 m0=vec3(0.),m1=vec3(0.),m2=vec3(0.),m3=vec3(0.),s0=vec3(0.),s1=vec3(0.),s2=vec3(0.),s3=vec3(0.);
      for(int j=-R;j<=0;j++)for(int i=-R;i<=0;i++){vec3 c=texture2D(t,v+vec2(float(i),float(j))*px).rgb;m0+=c;s0+=c*c;}
      for(int j=-R;j<=0;j++)for(int i=0;i<=R;i++){vec3 c=texture2D(t,v+vec2(float(i),float(j))*px).rgb;m1+=c;s1+=c*c;}
      for(int j=0;j<=R;j++)for(int i=0;i<=R;i++){vec3 c=texture2D(t,v+vec2(float(i),float(j))*px).rgb;m2+=c;s2+=c*c;}
      for(int j=0;j<=R;j++)for(int i=-R;i<=0;i++){vec3 c=texture2D(t,v+vec2(float(i),float(j))*px).rgb;m3+=c;s3+=c*c;}
      float n=float((R+1)*(R+1));
      m0/=n;m1/=n;m2/=n;m3/=n;
      vec3 q0=abs(s0/n-m0*m0),q1=abs(s1/n-m1*m1),q2=abs(s2/n-m2*m2),q3=abs(s3/n-m3*m3);
      float v0=q0.r+q0.g+q0.b,v1=q1.r+q1.g+q1.b,v2=q2.r+q2.g+q2.b,v3=q3.r+q3.g+q3.b;
      vec3 c=m0;float mv=v0;
      if(v1<mv){mv=v1;c=m1;} if(v2<mv){mv=v2;c=m2;} if(v3<mv){mv=v3;c=m3;}
      gl_FragColor=vec4(c,1.);
    }`;
  const COMPOSE = `precision highp float;
    uniform sampler2D o;uniform sampler2D sm;uniform vec2 px;uniform vec2 res;uniform float style;uniform float strength;varying vec2 v;
    float lum(vec3 c){return dot(c,vec3(.299,.587,.114));}
    vec3 sat(vec3 c,float s){return mix(vec3(lum(c)),c,s);}
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    float th(float x){float e=exp(2.*clamp(x,-10.,10.));return (e-1.)/(e+1.);}
    float bl(vec2 uv,float r){float s=0.;
      s+=lum(texture2D(o,uv+vec2(-1.,-1.)*px*r).rgb)*1.;s+=lum(texture2D(o,uv+vec2(0.,-1.)*px*r).rgb)*2.;s+=lum(texture2D(o,uv+vec2(1.,-1.)*px*r).rgb)*1.;
      s+=lum(texture2D(o,uv+vec2(-1.,0.)*px*r).rgb)*2.;s+=lum(texture2D(o,uv).rgb)*4.;s+=lum(texture2D(o,uv+vec2(1.,0.)*px*r).rgb)*2.;
      s+=lum(texture2D(o,uv+vec2(-1.,1.)*px*r).rgb)*1.;s+=lum(texture2D(o,uv+vec2(0.,1.)*px*r).rgb)*2.;s+=lum(texture2D(o,uv+vec2(1.,1.)*px*r).rgb)*1.;
      return s/16.;}
    float xdog(float r1,float r2,float k,float eps,float phi){float d=bl(v,r1)-k*bl(v,r2);return d>=eps?1.:1.+th(phi*(d-eps));}
    float vig(float k){vec2 d=v-.5;return 1.-k*dot(d,d)*2.2;}
    void main(){
      vec3 src=texture2D(o,v).rgb, s=texture2D(sm,v).rgb, col=src;
      if(style<.5){ /* anime */
        col=sat(s,1.38);
        float l=lum(col),b=l*5.;float q=(floor(b)+smoothstep(.35,.65,fract(b)))/5.;
        col*= (q+.06)/(l+.06);
        col=pow(clamp(col,0.,1.),vec3(.9))*1.06;
        float e=xdog(1.,1.9,.985,-.004,180.);
        col=mix(vec3(.07,.05,.14),col,clamp(e,0.,1.));
      } else if(style<1.5){ /* oil */
        col=sat(s,1.28);
        float gx=lum(texture2D(sm,v+vec2(px.x*2.,0.)).rgb)-lum(texture2D(sm,v-vec2(px.x*2.,0.)).rgb);
        float gy=lum(texture2D(sm,v+vec2(0.,px.y*2.)).rgb)-lum(texture2D(sm,v-vec2(0.,px.y*2.)).rgb);
        vec3 n=normalize(vec3(-gx*6.,-gy*6.,1.));
        float light=dot(n,normalize(vec3(-.5,.6,.9)));
        col*= .82+.3*light;
        float weave=.97+.03*sin(gl_FragCoord.x*1.7)*sin(gl_FragCoord.y*1.7);
        col*=weave*vig(.25);
      } else if(style<2.5){ /* pencil sketch */
        float e=xdog(1.,1.7,.98,-.002,120.);
        float tone=bl(v,2.);
        float h1=step(.5,fract((gl_FragCoord.x+gl_FragCoord.y)/5.)), h2=step(.5,fract((gl_FragCoord.x-gl_FragCoord.y)/6.));
        float d=1.-tone;
        float hatch=mix(1.,.8+.2*h1,smoothstep(.4,.7,d))*mix(1.,.82+.18*h2,smoothstep(.62,.9,d));
        float paper=.955+.045*hash(floor(gl_FragCoord.xy/2.));
        float g=clamp(e,0.,1.)*hatch*paper*(.82+.18*tone);
        col=vec3(g)*vec3(1.,.985,.95);
      } else if(style<3.5){ /* neon cyber */
        float r=texture2D(o,v+vec2(px.x*2.5,0.)).r, b=texture2D(o,v-vec2(px.x*2.5,0.)).b;
        float l=lum(vec3(r,src.g,b));
        vec3 c1=vec3(.03,.01,.12),c2=vec3(1.,.18,.65),c3=vec3(.25,.95,1.);
        col=l<.5?mix(c1,c2,l*2.):mix(c2,c3,(l-.5)*2.);
        col=mix(col,vec3(1.),smoothstep(.85,1.,l));
        float e=1.-clamp(xdog(1.,1.8,.98,-.003,140.),0.,1.);
        col+=e*vec3(.25,.95,1.)*.95;
        col*=.84+.16*step(.5,fract(gl_FragCoord.y/3.));
        col*=vig(.35);
      } else if(style<4.5){ /* enhance */
        vec3 blr=vec3(0.);
        blr+=texture2D(o,v+vec2(px.x*1.5,0.)).rgb;blr+=texture2D(o,v-vec2(px.x*1.5,0.)).rgb;blr+=texture2D(o,v+vec2(0.,px.y*1.5)).rgb;blr+=texture2D(o,v-vec2(0.,px.y*1.5)).rgb;blr/=4.;
        col=src+(src-blr)*.9;
        float mx=max(col.r,max(col.g,col.b)),mn=min(col.r,min(col.g,col.b));
        col=sat(col,1.+.45*(1.-(mx-mn)));
        col=clamp(col,0.,1.);col=mix(col,col*col*(3.-2.*col),.35);
        col*=vec3(1.03,1.,.97);col*=vig(.18);
      } else { /* noir */
        float l=lum(src);l=smoothstep(.04,.96,l);l=mix(l,l*l*(3.-2.*l),.6);
        l+=(hash(v*res)-.5)*.09;
        col=vec3(l)*vig(.5);
      }
      gl_FragColor=vec4(mix(src,clamp(col,0.,1.),strength),1.);
    }`;
  const STYLE_ID = { anime: 0, oil: 1, sketch: 2, cyber: 3, enhance: 4, mono: 5 };
  const RADIUS = { anime: 5, oil: 8 };

  // the stylisation WebGL context is created only when Transform is first used (saves GPU memory on phones)
  let GLinst;
  const getGL = () => (GLinst !== undefined ? GLinst : (GLinst = makeGL()));
  const makeGL = () => {
    const c = mk(2, 2);
    const gl = c.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) return null;
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const progs = {};
    function prog(key, fs) {
      if (progs[key]) return progs[key];
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return (progs[key] = p);
    }
    function tex(src, w, h) {
      const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (src) { gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      return tx;
    }
    function draw(p) {
      gl.useProgram(p);
      const loc = gl.getAttribLocation(p, 'p');
      gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    let cache = { src: null, texO: null };
    return {
      run(srcCanvas, style, strength) {
        const W = srcCanvas.width, H = srcCanvas.height;
        c.width = W; c.height = H; gl.viewport(0, 0, W, H);
        if (cache.src !== srcCanvas) { if (cache.texO) gl.deleteTexture(cache.texO); cache = { src: srcCanvas, texO: tex(srcCanvas) }; }
        const texO = cache.texO;
        let texS = texO, fb = null, out = null;
        const R = RADIUS[style];
        if (R) {
          out = tex(null, W, H);
          fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, out, 0);
          const pk = prog('k' + R, '#define R ' + R + '\n' + KUWAHARA);
          gl.useProgram(pk);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texO);
          gl.uniform1i(gl.getUniformLocation(pk, 't'), 0);
          gl.uniform2f(gl.getUniformLocation(pk, 'px'), 1 / W, 1 / H);
          draw(pk);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          texS = out;
        }
        const pc = prog('compose', COMPOSE);
        gl.useProgram(pc);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texO);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, texS);
        gl.uniform1i(gl.getUniformLocation(pc, 'o'), 0); gl.uniform1i(gl.getUniformLocation(pc, 'sm'), 1);
        gl.uniform2f(gl.getUniformLocation(pc, 'px'), 1 / W, 1 / H);
        gl.uniform2f(gl.getUniformLocation(pc, 'res'), W, H);
        gl.uniform1f(gl.getUniformLocation(pc, 'style'), STYLE_ID[style]);
        gl.uniform1f(gl.getUniformLocation(pc, 'strength'), strength);
        draw(pc);
        if (fb) { gl.deleteFramebuffer(fb); gl.deleteTexture(out); }
        return c;
      }
    };
  };

  let srcCanvas = null, trStyle = 'anime', comparePos = 50, trRun = 0, aiResult = null;
  const before = $('#trBefore'), after = $('#trAfter');
  function setSource(img) {
    const W = small() ? 720 : 1080, H = Math.round(W / 1.5);
    const c = mk(W, H); drawCover(c.getContext('2d'), img, W, H);
    srcCanvas = c; aiResult = null;
    before.width = after.width = W; before.height = after.height = H;
    before.getContext('2d').drawImage(c, 0, 0);
    transform(trStyle, true);
  }
  function loadDefault() {
    if (srcCanvas) return;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { try { setSource(img); } catch (e) { setSource(window.VisionProcedural('ocean moon', 'cine', 960, 640, 1234)); } };
    img.onerror = () => setSource(window.VisionProcedural('ocean moon', 'cine', 960, 640, 1234));
    img.src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=80';
  }
  function setPos(v) {
    comparePos = Math.max(0, Math.min(100, v));
    after.style.clipPath = `inset(0 ${100 - comparePos}% 0 0)`;
    $('#compareLine').style.left = comparePos + '%';
  }
  function sweep() {
    const o = { v: 0 };
    if (g()) g().timeline().to(o, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => setPos(o.v) }).to(o, { v: 52, duration: .9, ease: 'expo.out', onUpdate: () => setPos(o.v) });
    else setPos(52);
  }
  function status(on, text) { $('#trStatus').classList.toggle('is-on', on); $('#trStatusText').textContent = text || t('d2.processing'); }
  async function transform(style, animate = true) {
    if (!srcCanvas) return;
    trStyle = style; aiResult = null;
    const run = ++trRun;
    status(true);
    await sleep(40);
    const strength = +$('#trStrength').value / 100;
    const actx = after.getContext('2d');
    try {
      const GL = getGL(); if (!GL) throw 0;
      const out = GL.run(srcCanvas, style, strength);
      if (run !== trRun) return;
      actx.drawImage(out, 0, 0, after.width, after.height);
    } catch (e) {
      console.warn('WebGL stylisation unavailable, CPU fallback', e);
      if (window.VisionCPUFilter) actx.putImageData(window.VisionCPUFilter(style, srcCanvas), 0, 0);
    }
    await sleep(animate ? 350 : 0);
    status(false);
    if (animate) sweep();
  }
  async function remake() {
    if (!srcCanvas) return;
    if (!claudeOn() && !gemini) { $('#trRemakeNote').classList.add('flash'); setTimeout(() => $('#trRemakeNote').classList.remove('flash'), 1200); return; }
    const run = ++trRun, btn = $('#trRemake'); btn.disabled = true;
    status(true, t('d2.remaking'));
    try {
      if (gemini) {
        // real photo editing: Nano Banana restyles the actual photo, keeping its composition
        const big = mk(1024, Math.round(1024 * srcCanvas.height / srcCanvas.width)); big.getContext('2d').drawImage(srcCanvas, 0, 0, big.width, big.height);
        const res = await geminiImage(`Restyle this photo as ${EDIT[trStyle]}. Keep exactly the same composition, subjects, poses, framing and layout; change only the artistic style. Return the edited image.`, '3:2', big.toDataURL('image/jpeg', .9).split(',')[1]);
        if (run !== trRun) return;
        if (res.img) { drawCover(after.getContext('2d'), res.img, after.width, after.height); status(false); sweep(); btn.disabled = false; return; }
        if (!claudeOn()) throw new Error(res.error);
      }
      const sm = mk(640, Math.round(640 * srcCanvas.height / srcCanvas.width)); sm.getContext('2d').drawImage(srcCanvas, 0, 0, sm.width, sm.height);
      const data = sm.toDataURL('image/jpeg', .85).split(',')[1];
      const style = STYLE[REMAKE[trStyle]];
      const prompt = await chat(`You turn photos into prompts for a text-to-image model. Describe the photo in ONE English prompt of 40 to 70 words so the model can redraw the same scene: main subjects, their positions, composition, setting, colors and lighting. Then end with this style: ${style}. Reply with the prompt only.`,
        [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }, { type: 'text', text: 'Describe this photo for an AI redraw.' }]);
      if (run !== trRun) return;
      status(true, t('d2.s3'));
      const img = await fetchImage(prompt, 1024, 688, Math.floor(Math.random() * 1e6), s => status(true, t('d2.wait', { s })), () => run !== trRun);
      if (run !== trRun) return;
      if (!img) throw new Error('image');
      const actx = after.getContext('2d'); drawCover(actx, img, after.width, after.height);
      aiResult = prompt;
      status(false); sweep();
    } catch (e) { status(true, t('d2.remakeFail')); await sleep(2200); status(false); }
    btn.disabled = false;
  }
  function compareDrag() {
    const el = $('#compare'); let down = false;
    const move = e => { const r = el.getBoundingClientRect(); setPos((e.clientX - r.left) / r.width * 100); };
    el.addEventListener('pointerdown', e => { down = true; el.setPointerCapture(e.pointerId); move(e); });
    el.addEventListener('pointermove', e => { if (down || e.pointerType === 'mouse') move(e); });
    const up = () => { down = false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function paintRemakeNote() { $('#trRemakeNote').hidden = claudeOn() || (typeof gemini !== 'undefined' && gemini); }
  let imagesKey = false, gemini = false, gemQuota = false;
  const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
  function paintKey() {
    const box = $('#imgFree'); if (!box) return;
    box.hidden = gemini || gemQuota;
    $('#polBox').hidden = imagesKey;
    $('#gemKeyForm').hidden = !isLocal; $('#imgKeyForm').hidden = !isLocal;
    paintRemakeNote();
  }

  /* ---------- Gemini "Nano Banana": best quality generation + real photo editing ---------- */
  const ASPECT = { wide: '16:9', square: '1:1', tall: '4:5' };
  const EDIT = {
    anime: 'a high-quality anime illustration in the style of a Studio Ghibli film (clean line art, soft cel shading, vibrant colors)',
    oil: 'a rich impressionist oil painting with thick visible brush strokes',
    sketch: 'a detailed graphite pencil sketch on textured paper with cross-hatching',
    cyber: 'a cyberpunk neon artwork with glowing magenta and cyan lights',
    enhance: 'a professionally retouched, sharper, more vibrant high-end photograph',
    mono: 'a dramatic black and white film photograph with deep contrast and fine grain'
  };
  async function geminiImage(prompt, aspect, imageB64) {
    const r = await fetch('/api/gemini', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, aspect, image: imageB64 || undefined }) });
    if (r.ok && (r.headers.get('content-type') || '').startsWith('image')) return { img: await blobToImage(await r.blob()) };
    const d = await r.json().catch(() => ({}));
    if (d.error === 'bad_key' || d.error === 'no_key') { gemini = false; paintKey(); }
    if (d.error === 'quota') { gemini = false; gemQuota = true; paintKey(); }  // key works but images need a paid tier: use the free model directly
    return { error: d.error || 'api_error' };
  }

  /* ---------- tabs + wiring ---------- */
  let placeInk = () => {};
  function tabs() {
    const ink = $('.tab-ink');
    const place = () => { const on = $('.tab.is-on'); if (!on) return; ink.style.width = on.offsetWidth + 'px'; ink.style.transform = `translateX(${on.offsetLeft - 4}px)`; };
    $$('[data-vtab]').forEach(b => b.addEventListener('click', () => {
      $$('[data-vtab]').forEach(x => x.classList.toggle('is-on', x === b));
      $$('[data-vpanel]').forEach(p => p.classList.toggle('is-on', p.dataset.vpanel === b.dataset.vtab));
      place();
      if (b.dataset.vtab === 'tr') { loadDefault(); paintRemakeNote(); }
      window.ScrollTrigger && window.ScrollTrigger.refresh();
    }));
    place(); addEventListener('resize', place);
    return place;
  }
  function seg(sel, attr, cb) {
    $$(`${sel} [${attr}]`).forEach(b => b.addEventListener('click', () => { $$(`${sel} [${attr}]`).forEach(x => x.classList.toggle('is-on', x === b)); cb(b.getAttribute(attr)); }));
  }
  function init() {
    placeInk = tabs();
    $$('[data-gp]').forEach(b => { b.textContent = t(b.dataset.gp); b.addEventListener('click', () => { $('#genPrompt').value = t(b.dataset.gp); generate(); }); });
    seg('#genStyle', 'data-gs', s => { genStyle = s; });
    seg('#genSize', 'data-gz', s => { genSize = s; });
    $('#genGo').addEventListener('click', generate);
    $('#genPrompt').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });
    seg('#trStyles', 'data-style', s => transform(s));
    let rt = 0;
    $('#trStrength').addEventListener('input', e => { e.target.style.setProperty('--p', e.target.value + '%'); clearTimeout(rt); rt = setTimeout(() => transform(trStyle, false), 60); });
    $('#trStrength').style.setProperty('--p', '100%');
    $('#trRemake').addEventListener('click', remake);
    $('#trUpload').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const url = URL.createObjectURL(f), img = new Image();
      img.onload = () => { setSource(img); URL.revokeObjectURL(url); }; img.src = url;
    });
    compareDrag();
    // no auto-generation on visit: the free tier allows one image every 45 s, keep it for the visitor's own idea
    const io = new IntersectionObserver(es => es.forEach(en => {
      if (!en.isIntersecting) return; io.disconnect();
      if (!$('#genPrompt').value) $('#genPrompt').value = t('d2.g1');
      setTimeout(loadDefault, 1500);
    }), { threshold: .25 });
    io.observe($('#vision'));
    // optional free Pollinations key -> unlimited images (saved by serve.ps1, only from this PC)
    fetch('/api/status').then(r => r.json()).then(s => { imagesKey = !!s.images; gemini = !!s.gemini; paintKey(); }).catch(() => {});
    $('#gemKeyForm').addEventListener('submit', async e => {
      e.preventDefault();
      const k = $('#gemKey').value.trim(); if (!k) return;
      const r = await fetch('/api/gemkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) }).catch(() => null);
      if (r && r.ok) { gemini = true; $('#gemKey').value = ''; paintKey(); }
      else $('#gemMsg').textContent = t('d2.gemBad');
    });
    $('#imgKeyForm').addEventListener('submit', async e => {
      e.preventDefault();
      const k = $('#imgKey').value.trim(); if (!k) return;
      const r = await fetch('/api/imgkey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) }).catch(() => null);
      if (r && r.ok) { imagesKey = true; $('#imgKey').value = ''; paintKey(); }
    });
  }
  window.VisionStudio = {
    init,
    onLang() {
      $$('[data-gp]').forEach(b => { b.textContent = t(b.dataset.gp); });
      paintMeta(); paintRemakeNote(); requestAnimationFrame(placeInk);
    }
  };
  addEventListener('nova:lang', paintRemakeNote);
  // init is called by main.js once the page language is applied
})();
