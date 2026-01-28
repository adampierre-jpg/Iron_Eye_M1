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

### Milestone 3 (Refinement & Metrics): ⏳ PENDING
* **Rep Counting:** Logic to increment reps based on phase transitions.
* **Velocity Calibration:** Computing meters-per-second inside the concentric gate (Pull/Float/Lockout).
* **Session Data:** Exporting results to Notion or summary screens.

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

---

## 4. Architecture & Data Flow

### Data Layer (Stores)
* **`src/lib/stores/overlay.svelte.ts`**: Unified Svelte 5 Rune store for Phase, Reps, Velocity, and Tracking Status.
* **`src/lib/stores/videoIngest.svelte.ts`**: Tracks playback state and performance metrics like dropped frames.

### Service Layer (Orchestration)
* **`src/lib/services/videoIngest.ts`**: The "Conductor" that orchestrates the Pose -> Analysis -> Store update pipeline.
* **`src/lib/services/analysis.ts`**: Wraps the AI engine and manages decoded phase state.
* **`src/lib/services/pose.ts`**: Manages MediaPipe BlazePose initialization and inference.

### Engine Layer (Pure Logic)
* **`src/lib/engine/phaseClassifier.ts`**: Handles the rolling Tensor buffer and ONNX session.

---

## 5. Immediate Action Plan (Next Phase)

**Phase Objective:** Transition from "Seeing" (Phases) to "Measuring" (Metrics).

1.  **Rep Counter State Machine:**
    * Implement a transition listener to detect valid snatch cycles (e.g., HIKE -> PULL -> LOCKOUT -> DROP).
    * Ensure reps are only counted once per cycle and increment the `repCount` in the Rune store.

2.  **Velocity Computation:**
    * Integrate `pxPerMeter` from the calibration store.
    * Calculate vertical wrist velocity (m/s) specifically during the "concentric gate" (PULL, FLOAT, and LOCKOUT phases).

3.  **Visual Polish:**
    * Update HUD styles to use the **Copper** palette for active concentric phases and **Oxblood** for any tracking alerts.

---

## 6. Operational Protocols (Strict)

* **No Blind Patches:** Never generate code to fix or patch a file without first requesting and verifying the current content of that file.
* **Rune-First:** All new state management must utilize Svelte 5 Runes to maintain compatibility with the unified architecture.