# VR KRYPTA

**The Universal Information Transformation Toolkit** — *TRANSFORM • DECIPHER • ANALYZE*

A local-first environment for discovering, understanding, applying, chaining and experimenting with information transformation systems: codes, classical ciphers, encodings, hashes, compression and byte-level operations.

A **VR DEVELOPMENTS** project.

---

## What it is

Not another Base64 page. VR KRYPTA is a unified toolkit built around a single idea: **every transformation is a first-class, typed operation** registered in one engine. The same contract powers the searchable library, the universal workspace, and the pipeline lab.

- **188 operations** across 9 categories — codes & representations, classical ciphers, encodings, hashing, compression, byte operations, text transforms, analysis, and cryptanalysis & detection. Every operation is genuinely implemented; there are no placeholders.
- **Universal workspace** — one interface that adapts to each operation's contract. Hashes never show a "Decode" button because hashes cannot be decoded.
- **Pipeline lab** — chain operations (`Text → Caesar → Base64`), inspect every intermediate hop, export/import pipelines as validated JSON.
- **Python in the browser** — selected operations (SHA-3, BLAKE2, Hill, Bifid, Trifid, Nihilist, Four-square, Fractionated Morse) run on real CPython via Pyodide/WebAssembly, lazily downloaded once and executed locally.
- **Local-first** — no accounts, no backend, no analytics, no telemetry. Favorites, history and pipelines live in your browser (IndexedDB / localStorage).
- **Offline PWA** — installable, with a service worker that caches the app shell and the Pyodide runtime.

## Honest cryptography

- Classical ciphers are historical study objects — every cipher page says so.
- The **Secret Message Locker** is the one deliberately modern exception: real AES-256-GCM with PBKDF2-SHA-256 key stretching (200k rounds), fresh random salt/IV per message, and it still warns that its strength is bounded by the passphrase.
- **Sharing is local-first too:** the SECRET DROP page and every operation's **Share result** button pack the data into the URL hash (`VK1.…` blobs or `x/<op>/<base64url>`), and never send bytes to any server. Links work fully offline once the PWA is cached.
- MD5 and SHA-1 carry explicit collision warnings.
- Hashes are one-way: you can *verify* a digest, never "decode" one.
- This is an exploration/education toolkit, not a password manager or a substitute for professional cryptographic review.

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18 + TypeScript (strict) |
| Build | Vite |
| Styling | Custom CSS design system (CSS variables, zero runtime deps) |
| Crypto | Web Crypto API + clean-room TS MD5 (tested against RFC vectors) |
| Compression | Browser Compression Streams API (gzip / zlib / DEFLATE) |
| Python | Pyodide (CPython on WASM) in a Web Worker, lazy-loaded |
| Storage | IndexedDB + localStorage behind one abstraction |
| Testing | Vitest + golden vectors (`tests/vectors/core.json`) |
| Hosting | GitHub Pages via GitHub Actions |

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # golden-vector engine tests
npm run typecheck  # strict TS
npm run build      # production build → dist/
```

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. **Settings → Pages → Source: GitHub Actions.**
3. Push to `main` — the workflow in `.github/workflows/deploy.yml` typechecks, tests, builds and deploys automatically.

The app is configured for root-path hosting (a `username.github.io` site). For a project page (`username.github.io/repo/`), set `base: '/repo/'` in `vite.config.ts` and the same value for `start_url`/`scope` in `public/manifest.webmanifest`.

## Privacy

Transformations run in your browser whenever supported; inputs are never uploaded — there is no backend. Python-backed operations fetch the Pyodide runtime once from a public CDN (jsdelivr) and then execute it locally; the service worker caches it for offline reuse. See the in-app **About** page for the full statement.

## License

MIT — see below. Built with the browser platform and [Pyodide](https://pyodide.org) upstreams; classical algorithm definitions are public-domain knowledge.

---

*VR means VR Developments — this is not a virtual-reality product.*
