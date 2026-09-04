# Tesseract OCR assets

The schedule importer (`src/components/schedule/schedule-import-dialog.tsx`) runs
Tesseract entirely **same-origin**. Nothing here is fetched from a CDN, so
`next.config.ts` keeps `script-src`/`connect-src` at `'self'` (plus
`'wasm-unsafe-eval'`, which is required to instantiate the WASM core).

## Generated at build time — do not commit

`worker.min.js` and every `tesseract-core-*-lstm.wasm{,.js}` file in this
directory are copied out of `node_modules` by `scripts/vendor-tesseract.mjs`,
which runs from the web app's `predev` and `prebuild` scripts. They are
gitignored so the served bytes always match the pinned dependency:

| File | Source package |
| --- | --- |
| `worker.min.js` | `tesseract.js@7.0.0` → `dist/worker.min.js` |
| `tesseract-core-relaxedsimd-lstm.wasm{,.js}` | `tesseract.js-core@7.0.0` |
| `tesseract-core-simd-lstm.wasm{,.js}` | `tesseract.js-core@7.0.0` |
| `tesseract-core-lstm.wasm{,.js}` | `tesseract.js-core@7.0.0` |

All three `*-lstm` variants are required: the importer calls
`createWorker('eng', OEM.LSTM_ONLY, …)`, and `tesseract.js` picks the
relaxedsimd / simd / plain core at runtime from the browser's WASM feature
detection. Shipping only one variant 404s on most current browsers.

## Committed — `eng.traineddata.gz`

The English language model is not published in any npm package `tesseract.js`
depends on, so it is the one asset checked in here.

- **Source:** `https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz`
- **Size:** 2,952,873 bytes
- **sha256:** `45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91`

This is the LSTM-only model, which is exactly what `tesseract.js@7.0.0` fetches
by default for `OEM.LSTM_ONLY` (see the `langPathDownload` fallback in
`node_modules/tesseract.js/src/worker-script/index.js`). An earlier revision of
this branch committed the 10.9 MB combined legacy+LSTM `4.0.0` bundle
(`ed350f3752f81ee8f38769edc14d92d997dababe23b565c59879372cc46a2468`), whose
legacy half the importer can never use.

To re-verify:

```bash
sha256sum apps/web/public/tesseract/eng.traineddata.gz
```

`.gitattributes` marks this directory `-text` so git never rewrites the bytes —
an earlier revision of this branch shipped `*.wasm.js` files that CRLF
normalization had altered by one byte per line.
