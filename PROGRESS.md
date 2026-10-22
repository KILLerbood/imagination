# Imagination AI — status

Separate project from othman-furniture. Run: `powershell -ExecutionPolicy Bypass -File serve.ps1`
- Laptop: http://localhost:5180/
- Phone (same Wi-Fi): http://<PC Wi-Fi IP>:5180/  (was 192.168.100.3)
- Force a language: `?lang=ar|de|ru|en` (also remembered in localStorage)

## Files
- `index.html` — all sections; "Made by Magmafy" is the last line of the footer.
- `css/style.css` — design system (violet/cyan/pink neon on #04040a), RTL, responsive.
- `js/i18n.js` — EN/AR/DE/RU copy, `window.I18N`.
- `js/scene.js` — Three.js core (noise shader), wire shell, particle rings, 7 orbiting modules, stars;
  section states via `[data-scene]`; adaptive quality; click core = pulse.
- `js/main.js` — language switch, ScrollSmoother (desktop only), pinned horizontal gallery (RTL aware),
  reveals, loader, cursor, magnetic buttons, tilt, dock.
- `js/demos.js` — Race the AI (real parser/solver + timers), Vision Studio (procedural generation with
  denoise animation + photo filters, upload, compare slider), Writer, Code Forge (live iframe), Customer
  Agent chat, Smart Payments (3D card, risk gauge, live feed, confetti), Pulse CRM (drag/click kanban,
  KPIs, forecast chart), ROI calculator.

- `js/voice.js` — Nova voice assistant (floating button + hero button): Web Speech API listening
  (en-US / ar-EG / de-DE / ru-RU), speechSynthesis replies, keyword intent knowledge base about the
  business (tools, pricing, security, integrations, ROI, start), guided site tour, hands-free loop.
  Mic input needs a secure context: works on http://localhost, NOT on http://<LAN-IP> on phones
  (there it falls back to typing, replies are still spoken). Needs HTTPS hosting for phone voice input.

- Nova brain: `serve.ps1` proxies `/api/chat` to Claude (`claude-opus-5-5`, effort low, server-side
  fallbacks). Key from `$env:ANTHROPIC_API_KEY` or `%LOCALAPPDATA%\imagination-ai\anthropic-key.txt`
  (saved via the "connect" box in Nova's panel, accepted only from localhost). Without a key Nova falls
  back to the offline keyword knowledge base. Replies may end with [[go:<section>]] / [[tour]] tags.
- Voices: per-language native neural voice preferred (Edge "Online (Natural)" voices are best);
  Arabic offered as Egyptian (`ar`) or MSA (`arm`).
- `js/avatar.js` + section `#avatar` (08): SVG human "video call" avatar wired to Nova
  (lip-sync, blink, eye tracking, captions, call controls).

- `js/vision.js` (replaces the old Vision module in demos.js, which now only exports
  `VisionProcedural`/`VisionCPUFilter` as offline fallbacks): real text-to-image via Pollinations
  (FLUX) proxied by `/api/image` (free, rate-limited, small watermark; optional Pollinations key via
  `/api/imgkey` or `$env:POLLINATIONS_API_KEY`), prompt rewriting by Claude or free `/api/prompt`,
  6 styles, 3 formats, gallery, download. Transform = WebGL (Kuwahara + XDoG + cel shading) and
  "AI remake" (Claude vision describes photo -> image model redraws; needs Claude key).

## Tested (2026-10-22)
Desktop 1440×900 EN + AR: all demos run, no console errors. Mobile 375px: no horizontal overflow.

## Ideas for later
- Real AI APIs behind the demos, a pricing section, GLTF hero model.
