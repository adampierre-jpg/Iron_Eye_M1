# Copilot Instructions for Iron Eye

## Project Overview
- **Iron Eye** is a SvelteKit + TypeScript PWA for kettlebell snatch detection and velocity-based training (VBT) metrics.
- **Client-only:** No SSR; all logic runs in-browser. See `src/routes/+layout.ts` for `ssr = false`.
- **UI Modes:**
  - `/live`: Mobile-first, edge-to-edge camera view
  - `/upload`: Desktop-oriented video upload and analysis
  - `/summary`: Session results and export

## Key Architecture
- **Video Ingest:** Unified frame loop for camera/upload in `src/lib/services/videoIngest.ts`.
- **Stores:** Centralized Svelte stores in `src/lib/stores/index.ts` (e.g., `sessionConfig`, `calibration`, `overlay`, `videoIngest`).
- **Types:** All types in `src/lib/types/index.ts` (e.g., `SnatchPhase`, `CalibrationData`).
- **Components:** Overlay and UI in `src/lib/components/` (e.g., `VideoOverlay.svelte`, `CalibrationPanel.svelte`).
- **Model Inference:**
  - `phaseClassifier.ts` (not yet present) will wrap ONNX 1D CNN model
  - `viterbiDecoder.ts` (not yet present) will enforce phase transition grammar
  - Model loaded via onnxruntime-web (WASM)

## Developer Workflows
- **Dev server:** `npm run dev` (HTTPS required for camera)
- **Build:** `npm run build`
- **Preview:** `npm run preview`
- **Type check:** `npm run check`
- **Debug HUD:** Toggle via invisible tap (live) or checkbox (upload)
- **Test clips:** Use referenced CSVs for upload mode validation

## Critical Conventions
- **Svelte 5 Runes:** Use `$state()`, `$derived()`, `$effect()`
- **No direct store mutation:** Use exported helpers from `stores/index.ts`
- **Timestamps:** Use `performance.now()` for frames, `Date.now()` for session state
- **Units:** Angles (deg), velocity (m/s), height (in)
- **File naming:**
  - Components: `PascalCase.svelte`
  - Services/Stores: `camelCase.ts`
  - Types: `index.ts` in `types/`

## Data Flow Example
```
VideoIngest (camera/upload) → Frame Loop → Feature Extraction → Model Inference → Viterbi Decoder → Overlay UI
```

## Performance
- Never block UI thread; batch inference if needed
- Minimal DOM updates (single overlay layer)
- Target 60fps (30fps fallback)

## Integration Points
- **MediaPipe Holistic:** Loaded from CDN at runtime
- **ONNX Model:** Loaded via onnxruntime-web, input shape `[1, 36, 12]`
- **Session Export:** Planned for Notion API

## References
- See `CLAUDE.md` for detailed model, phase, and milestone documentation.
- See `src/lib/services/`, `src/lib/components/`, and `src/lib/stores/` for main logic.
