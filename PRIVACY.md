# VR KRYPTA — Privacy Notes

## Local-first processing

Your transformations run in your browser whenever supported. **Your input is not automatically uploaded to a VR KRYPTA backend — the application has no backend.**

Concretely:

- No accounts, sign-ups, emails, passwords or identity checks. The optional display name is a local preference, not an identifier.
- No analytics or telemetry of any kind. No trackers, no third-party scripts.
- Transformation inputs, outputs, history, favorites and pipelines are stored only in your browser (IndexedDB / localStorage) and are never transmitted.

## What does touch the network

1. **Static hosting** — like any website, the app files themselves are downloaded from the hosting server (GitHub Pages).
2. **Pyodide runtime** — operations marked `python` download the Pyodide WebAssembly runtime once (~10 MB) from the jsDelivr CDN, then execute it locally. The service worker caches it, so later runs are fully offline.
3. **Nothing else.** Fonts are system fonts; icons are inline SVG; there are no external APIs in the transformation path.

## Your controls

- Settings → **Clear history / Clear favorites / Erase ALL VR KRYPTA data**.
- The browser's own site-data controls remove everything including cached runtime files.

## No permanence promises

Browser storage is not permanent and does not sync between devices or browsers. Clearing site data, switching browsers, or using private windows starts fresh. Saved pipelines can be exported as JSON if you want to keep them.
