# Contributing to VR KRYPTA

The whole architecture exists to make one thing easy: **adding a new operation must mean adding one file section, not touching the app.**

## Adding an operation

1. Pick the right module in `src/operations/` (or create one): `codes`, `ciphers`, `encodings`, `bytes`, `text`, `hashing`, `compression`, `analysis`, `pythonOps`.
2. Call `defineOp({...})` with the full contract:

```ts
defineOp({
  id: 'my-op',                    // stable kebab-case, never rename after release
  name: 'My Operation',
  category: 'codes',
  description: 'One or two precise sentences. What it does, what variant, what standard.',
  aliases: ['searchable', 'names'],
  tags: ['code'],
  input: 'text',                  // 'text' | 'encoded' | 'bytes' | 'any'
  output: 'encoded',
  reversible: true,               // false + oneWay: true for hashes
  engine: 'typescript',
  options: [/* text | number | select | toggle fields */],
  actions: [
    { id: 'encode', label: 'Encode', kind: 'encode', run: (v, o) => textValue(...) },
    { id: 'decode', label: 'Decode', kind: 'decode', run: (v, o) => textValue(...) }
  ],
  examples: [{ label: 'Demo', input: 'HELLO' }],
  warnings: ['Honest caveats — lossy steps, broken ciphers, limits.'],
  docs: 'Deeper explanation shown in the workspace.'
});
```

3. The operation instantly appears in the library, workspace, search, pipelines and history. **No other file changes.**

## Rules of the house

- **Verify before implementing.** Check the algorithm's definition, variant and a published test vector. Then lock the vector into `tests/vectors/core.json`.
- **Correct terminology.** Codes map symbols, ciphers use keys, encodings transport bytes, hashes are one-way. Never label a hash "decode", never call Base64 encryption.
- **Fail loudly, never silently.** Unsupported characters, malformed input, wrong keys → throw a helpful `Error`. The workspace renders it beautifully.
- **Lossy means labelled.** If information can be destroyed, set `lossy: true` and say exactly what is lost in `warnings`.
- **Python when it earns its keep.** Prefer TS/browser-native on hot paths; use `pythonOps` where Python's standard library or math clarity is genuinely valuable.
- **No new dependencies** without a justification: maintenance, license, size, and whether the platform already does it.

## Tests

```bash
npm test           # golden vectors + round-trips + validation behaviour
npm run typecheck  # strict TypeScript
```

Every operation should have at least one golden vector in `tests/vectors/core.json` keyed `"<opId>.<actionId>"`.
