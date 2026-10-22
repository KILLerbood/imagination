# Imagination — AI tools showcase

A 3D, multilingual (English, Arabic, German, Russian) website that demos what AI can do for a business:
math reasoning, image generation and restyling, writing, code generation, a customer-service agent,
payments, a CRM and Nova, a voice assistant with a talking avatar.

## Run it locally (full features)
Windows, no Node or Python needed:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:5180/. The local server also proxies Nova's conversations and the image
models, so API keys stay on your PC (they are stored in `%LOCALAPPDATA%\imagination-ai\`, never in this repo).

## Public version
On a static host (GitHub Pages) everything visual works and images use the free model straight from the
browser; Nova answers from its built-in knowledge instead of a live AI model.

Made by Magmafy
