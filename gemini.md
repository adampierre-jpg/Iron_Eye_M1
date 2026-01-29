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

### Milestone 2 (Kinematics & AI): ✅ COMPLETED
* **Pose Extraction:** MediaPipe initialized and running.
* **AI Inference:** ONNX Runtime initialized. Model loaded and phase classification verified in console.
* **HUD UI Sync:** Resolved the "Split Brain" state issue. The UI Overlay (HUD) now updates in real-time by consuming Svelte 5 Runes directly.
* **Immediate Feedback:** Skeleton and HUD are visible immediately upon video load, enabling analysis during scrubbing and on the initial frame.
* **Live Camera Feed:** ✅ **STABILIZED.** Camera permissions, stream attachment, and client-side rendering are fully functional.

### Milestone 3 (Refinement & Metrics): 🟡 IN PROGRESS
* **Rep Counting:** ⏳ Pending logic to increment reps based on phase transitions.
* **Velocity Calibration:** ✅ COMPLETED. "Subject as Ruler" logic implemented and wired to feature engine.
* **Live Usability:** ⏳ Pending "Hands-Free" calibration workflow.
* **Session Data:** ⏳ Pending export capabilities.

---

## 3. Technical Log (Recent Fixes)

1.  **Svelte 5 Rune Migration (HUD Sync):**
    * **Problem:** The AI service was writing to a new Rune store while the UI was reading from an old Svelte 4 Writable store, causing a "Split Brain" where the HUD stayed static.
    * **Fix:** Fully migrated `overlay.svelte.ts` to Svelte 5 Runes (`$state`, `$derived`) and updated `VideoOverlay.svelte` and `upload/+page.svelte` to import directly from the Rune store.
    * **Result:** Real-time synchronization between the ONNX classifier and the HUD.

2.  **Immediate Visibility & Static Analysis:**
    * **Problem:** HUD stats and skeletons were only active during "Processing," preventing analysis while the video was paused or scrubbed.
    * **Fix:** Updated `videoIngest.ts` to start the frame loop immediately on load and added a manual static capture in `handleVideoLoaded` to process the first frame.

3.  **WASM & ONNX Infrastructure:**
    * Fixed `404` errors for WASM assets by deploying files from `node_modules` to `/static` and setting `ort.env.wasm.wasmPaths = "/"`.
    * Corrected a `TypeError` regarding tensor dimensions by aligning the `PhaseClassifier` interface with the model's `frame_window` configuration.

4.  **Viterbi Decoder Stabilization (The "NaN" Fix):**
    * **Problem:** The Viterbi loop was iterating `T` times (36 steps) over a single-step logit output (9 classes), causing `undefined` lookups and `NaN` poisoning. This resulted in erratic tracking and illegal transitions (e.g., `LOCKOUT` -> `DROP` -> `LOCKOUT`).
    * **Fix:** Updated `phaseClassifier.ts` to call `decodeLast(logits, 1)` instead of `T`.
    * **Result:** Stable phase tracking and enforcement of the grammar rules.

5.  **Calibration Engine ("Subject as Ruler"):**
    * **Problem:** Velocity metrics were "out of place" (huge unitless numbers) because they relied on raw pixel deltas and micro-second `dt` variations.
    * **Fix:** Implemented `calibrateFromPose` in `calibration.svelte.ts`. This measures the user's "Nose-to-Ankle" distance (plus 10% head offset) against their physical height to derive a precise `unitsPerMeter` scale.
    * **Integration:** Wired `FeatureBuilder` to consume this scale, converting normalized displacement into true `m/s` before inference.

6.  **Live Page Stabilization (SSR & Camera Ignition):**
    * **Problem A (500 Error):** The `/live` route was crashing on the server because `onnxruntime-web` attempted to access browser-only APIs (WASM config) during SSR.
    * **Problem B (Black Screen):** The `VideoIngestService` was missing the `getUserMedia` logic to actually request and attach the camera stream.
    * **Problem C (Disconnected Circuit):** The `overlay` Rune store was not exported from `src/lib/stores/index.ts`, causing runtime undefined errors.
    * **Fixes:**
        * Disabled SSR for Live Route (`export const ssr = false` in `src/routes/live/+page.ts`).
        * Wrapped ONNX configuration in `phaseClassifier.ts` with `if (browser)` checks.
        * Implemented `navigator.mediaDevices.getUserMedia` in `videoIngest.ts`.
        * Exported `overlay` from the main store index.
    * **Result:** Live camera now loads immediately, requests permissions, and pipes frames to the AI engine without crashing.

---

## 4. Architecture & Data Flow

### Data Layer (Stores)
* **`src/lib/stores/overlay.svelte.ts`**: Unified Svelte 5 Rune store for Phase, Reps, Velocity, and Tracking Status.
* **`src/lib/stores/index.ts`**: Central Hub. Holds the **Calibration Store** and exports all Rune stores (videoIngest, telemetry, overlay).
* **`src/lib/stores/videoIngest.svelte.ts`**: Tracks playback state and performance metrics like dropped frames.

### Service Layer (Orchestration)
* **`src/lib/services/videoIngest.ts`**: The "Conductor." Now handles Camera Ignition (`getUserMedia`) and orchestrates the Pose -> Analysis -> Store update pipeline.
* **`src/lib/services/analysis.ts`**: Wraps the AI engine and manages decoded phase state.
* **`src/lib/services/pose.ts`**: Manages MediaPipe BlazePose initialization and inference. Now includes synchronous `getLastResult()` for UI tools.

### Engine Layer (Pure Logic)
* **`src/lib/engine/phaseClassifier.ts`**: Handles the rolling Tensor buffer and ONNX session.
* **`src/lib/engine/features.ts`**: Converts raw Pose landmarks into the 12-feature vector for the CNN. Handles velocity scaling.

---

## 5. Immediate Action Plan (Next Phase)

**Phase Objective:** Transition from "Measuring" to "Counting" (Reps & Session Logic).

1.  **Hands-Free Calibration (Live Mode Priority):**
    * **Problem:** User cannot physically press "Calibrate" while standing far enough away to be fully in frame (Ankle-to-Nose visibility required).
    * **Solution:** Implement an auto-trigger (e.g., "Stand still for 3 seconds" or a specific "Arms Out" T-pose) to lock calibration automatically without touching the screen.

2.  **Rep Counter State Machine:**
    * Implement a transition listener to detect valid snatch cycles (e.g., HIKE -> PULL -> LOCKOUT -> DROP).
    * Ensure reps are only counted once per cycle and increment the `repCount` in the Rune store.

3.  **Side Detection Logic:**
    * Currently, `pose.ts` defaults `side` to `null` (forcing Right-side features).
    * Implement logic to detect which hand is holding the bell (e.g., wrist height differential or proximity to shoulder) to correctly set `active_side`.

4.  **Visual Polish:**
    * Update HUD styles to use the **Copper** palette for active concentric phases and **Oxblood** for any tracking alerts.

---

## 6. Operational Protocols (Strict)

* **No Blind Patches:** Never generate code to fix or patch a file without first requesting and verifying the current content of that file.
* **Rune-First:** All new state management must utilize Svelte 5 Runes to maintain compatibility with the unified architecture.
* **Calibration Verification:** Always verify velocity numbers via the `📏 [Calibration]` debug group in the console before trusting metric outputs.