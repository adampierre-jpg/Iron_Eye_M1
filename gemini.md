# Iron Eye — Project Context & Handoff

## 1. Project Identity
* **Name:** Iron Eye (Kettlebell Snatch Analysis)
* **Objective:** Mobile-first, edge-to-edge web tool for analyzing kettlebell snatch mechanics (Phase, Velocity, Reps).
* **Tech Stack:** SvelteKit (SPA Mode), Svelte 5 Runes, TypeScript, Tailwind.
* **Core CV Stack:**
    * **Pose:** `@mediapipe/pose` (BlazePose)
    * **Inference:** `onnxruntime-web` (WASM)

---

## 2. Status Board

### Milestone 1 (Foundation): ✅ COMPLETED
* Video ingest loop (rAF) and Double-layer rendering (Video + Canvas) are stable.
* Upload UI handles file input and playback control.

### Milestone 2 (Kinematics & AI): ⚠️ PARTIAL
* **Pose Extraction:** ✅ MediaPipe initialized and running.
* **AI Inference:** ✅ ONNX Runtime initialized. Model loaded. **Console now logs phases.**
* **HUD UI:** 🛑 **BLOCKED.** The UI Overlay (HUD) does not update to match the console logs. It remains static (likely 'STANDING').

### Milestone 3 (Refinement & Metrics): ⏳ PENDING
* Rep Counting.
* Velocity Calibration.

---

## 3. Technical Log (Recent Fixes)

We successfully resolved the "AI Initialization Crash" via the following actions:

1.  **WASM Assets Deployment:**
    * **Problem:** Browser returned `404` for `.wasm` and `.mjs` files locked inside `node_modules`.
    * **Fix:** Manually copied all `*.wasm` and `*.mjs` files from `node_modules/onnxruntime-web/dist/` to `static/`.

2.  **ONNX Path Configuration:**
    * **Problem:** ONNX Runtime looked for binaries in relative paths that did not exist.
    * **Fix:** In `src/lib/engine/phaseClassifier.ts`, we explicitly set:
        ```typescript
        ort.env.wasm.wasmPaths = "/";
        ```

3.  **Config Interface Mismatch:**
    * **Problem:** `TypeError: dims[1] must be an integer`. The TypeScript interface expected `sequence_length`, but the JSON model config provided `frame_window`.
    * **Fix:** Updated `PhaseClassifier` to match the JSON structure:
        ```typescript
        interface Config {
          model: {
            frame_window: number;
            feature_dim: number;
          };
        }
        ```

---

## 4. Architecture & Data Flow

### Data Layer (Stores)
* **`src/lib/stores/overlay.svelte.ts`**: Holds UI state (Phase label, Rep count).
* **`src/lib/stores/videoIngest.svelte.ts`**: Holds playback state.

### Service Layer (Orchestration)
* **`src/lib/services/videoIngest.ts`**: The "Conductor". It calls Pose -> Analysis -> **[MISSING LINK]** -> Store.
* **`src/lib/services/analysis.ts`**: Wraps the AI engine.
* **`src/lib/services/pose.ts`**: Wraps MediaPipe.

### Engine Layer (Pure Logic)
* **`src/lib/engine/phaseClassifier.ts`**: Handles the Tensor buffer and ONNX session. **(VERIFIED WORKING)**

---

## 5. Immediate Action Plan

**Current Issue:** The "Brain" is working (console shows phases), but the "Face" is blank (HUD doesn't update).

**Hypothesis:** The result from `phaseClassifier.classify()` is returned to `AnalysisService`, but it is likely not being passed correctly to `overlay.svelte.ts` to trigger a UI reactivity update.

**Next Steps:**
1.  **Inspect `src/lib/services/videoIngest.ts`:** Check the `processFrame` loop. Is it taking the result from `analysis.process()` and writing it to the overlay store?
2.  **Inspect `src/lib/services/analysis.ts`:** Ensure it returns the phase string up the chain.

---

## 6. Operational Protocols (Strict)

* **NO BLIND PATCHES:** Never generate code to fix or patch a file without first requesting and verifying the current content of that file.
* **Verify State:** Always ask for the specific block of code or the whole file before assuming its state.
* **Diagnosis First:** Verify the "Fact" of the bug (via logs or file inspection) before proposing a hypothesis.