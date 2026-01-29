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

### Milestone 3 (Refinement & Metrics): 🟢 COMPLETED (Logic Implemented / Testing Pending)
* **Rep Counting:** ✅ **IMPLEMENTED.** `SnatchSessionEngine` now handles the state machine (Start -> Hike -> Lockout -> Drop -> Count).
* **Velocity Calibration:** ✅ **COMPLETED.** "Subject as Ruler" logic implemented and wired to feature engine.
* **Live Usability:** ✅ **SOLVED.** "Iron Cross" (T-Pose) Auto-Calibration implemented.
* **Session Data:** ⏳ Pending export capabilities.

---

## 3. Technical Log (Recent Fixes)

1.  **Svelte 5 Rune Migration (HUD Sync):**
    * **Problem:** The AI service was writing to a new Rune store while the UI was reading from an old Svelte 4 Writable store.
    * **Fix:** Fully migrated `overlay.svelte.ts` to Svelte 5 Runes (`$state`, `$derived`) and updated `VideoOverlay.svelte` and `upload/+page.svelte` to import directly from the Rune store.
    * **Result:** Real-time synchronization between the ONNX classifier and the HUD.

2.  **Immediate Visibility & Static Analysis:**
    * **Problem:** HUD stats and skeletons were only active during "Processing," preventing analysis while the video was paused or scrubbed.
    * **Fix:** Updated `videoIngest.ts` to start the frame loop immediately on load and added a manual static capture in `handleVideoLoaded` to process the first frame.

3.  **WASM & ONNX Infrastructure:**
    * Fixed `404` errors for WASM assets by deploying files from `node_modules` to `/static` and setting `ort.env.wasm.wasmPaths = "/"`.
    * Corrected a `TypeError` regarding tensor dimensions by aligning the `PhaseClassifier` interface with the model's `frame_window` configuration.

4.  **Viterbi Decoder Stabilization (The "NaN" Fix):**
    * **Problem:** The Viterbi loop was iterating `T` times (36 steps) over a single-step logit output (9 classes), causing `undefined` lookups and `NaN` poisoning.
    * **Fix:** Updated `phaseClassifier.ts` to call `decodeLast(logits, 1)` instead of `T`.
    * **Result:** Stable phase tracking and enforcement of the grammar rules.

5.  **Calibration Engine ("Subject as Ruler"):**
    * **Problem:** Velocity metrics were "out of place" (huge unitless numbers) because they relied on raw pixel deltas and micro-second `dt` variations.
    * **Fix:** Implemented `calibrateFromPose` in `calibration.svelte.ts`. This measures the user's "Nose-to-Ankle" distance against their physical height to derive a precise `unitsPerMeter` scale.

6.  **Hands-Free Calibration (The "Iron Cross"):**
    * **Problem:** User could not calibrate while standing in position (too far from screen).
    * **Fix:** Implemented `CalibrationPanel.svelte` with a "Self-Timer" state machine (`Setup` -> `Countdown` -> `Scan` -> `Success`).
    * **Logic:** Uses geometry (wrists extended + aligned with shoulders) to detect a "T-Pose" hold, triggering the calibration automatically.

7.  **Logic Engine & Side Locking (The "Brain"):**
    * **Problem:** The CNN model needs to know *which* arm to look at, but we don't know the arm until the set starts.
    * **Fix:** Created `src/lib/engine/snatchLogic.ts`. It detects the active side during the `HANDONBELL` phase by comparing wrist heights (Active hand is lower).
    * **Integration:** Patched `analysis.ts` to inject this `lockedSide` into the Pose object *before* feature extraction, ensuring the CNN always observes the working arm.

---

## 4. Architecture & Data Flow

### Data Layer (Stores)
* **`src/lib/stores/overlay.svelte.ts`**: Unified Svelte 5 Rune store for Phase, Reps, Velocity, and Tracking Status.
* **`src/lib/stores/index.ts`**: Central Hub. Holds the **Calibration Store** and exports all Rune stores.

### Service Layer (Orchestration)
* **`src/lib/services/videoIngest.ts`**: The "Conductor." Handles Camera Ignition and frame piping.
* **`src/lib/services/analysis.ts`**: The "Bridge." Connects MediaPipe -> Logic Engine -> UI. Now injects `lockedSide` context.
* **`src/lib/services/pose.ts`**: Manages MediaPipe BlazePose initialization.

### Engine Layer (Pure Logic)
* **`src/lib/engine/phaseClassifier.ts`**: Handles the rolling Tensor buffer and ONNX session.
* **`src/lib/engine/snatchLogic.ts`** (NEW): The "Referee." Manages Session Start, Side Locking, Rep Counting, and Velocity Gating.
* **`src/lib/engine/features.ts`**: Converts raw Pose landmarks into the 12-feature vector. Now respects `pose.side`.

---

## 5. Immediate Action Plan (Next Phase)

**Phase Objective:** Integration Testing & Live UI Polish.

1.  **Live Mode UI Integration:**
    * Wire the `SnatchSessionEngine` "Ready" state to the main view to unlock the recording/session UI.
    * Ensure the "T-Pose" success state smoothly transitions to the "Waiting for Hand on Bell" state.

2.  **Field Testing (The Acceptance Pack):**
    * Verify **Right Arm** Snatch (Does `lockedSide` stick to Right?).
    * Verify **Left Arm** Snatch (Does `lockedSide` switch to Left?).
    * Verify **Rep Count** accuracy (HIKE -> LOCKOUT -> DROP cycle).

3.  **Visual Polish:**
    * Implement the Copper/Oxblood palette in the HUD for "Concentric" vs "Eccentric" feedback.

---

## 6. Operational Protocols (Strict)

* **No Blind Patches:** Never generate code to fix or patch a file without first requesting and verifying the current content of that file.
* **Rune-First:** All new state management must utilize Svelte 5 Runes.
* **Calibration Verification:** Always verify velocity numbers via the `📏 [Calibration]` debug group in the console.