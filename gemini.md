Markdown

# Iron Eye: Context & Handoff

## 1. Project Identity
* **Name:** Iron Eye (Kettlebell Snatch Analysis)
* **Role:** Senior Full-Stack Engineer & CV Specialist
* **Stack:** SvelteKit (Svelte 5 Runes), TypeScript, Tailwind/Custom CSS.
* **Core Tech:** MediaPipe Pose (BlazePose), TensorFlow.js (1D CNN), Canvas API.
* **Objective:** Mobile-first, edge-to-edge web tool for analyzing kettlebell snatch mechanics (velocity, phase, rep count).

## 2. Status Board
* **Milestone 1 (Foundation):** [COMPLETED]
    * Video Ingest Service (rAF loop) operational.
    * Double-layer rendering (Video + Canvas Overlay) synced.
* **Milestone 2 (Kinematics & AI):** [IN PROGRESS]
    * **Loop A (Pose Stream):** [COMPLETED]
        * Integrated `@mediapipe/pose`.
        * **Critical Fix:** Implemented "Aggressive Search" for MediaPipe constructor to handle Vite/UMD bundling issues.
        * **Critical Fix:** Disabled SSR for Upload route (`export const ssr = false`) and added `browser` checks in services.
        * Verified: Green skeleton overlays appear on video.
    * **Loop B (Feature Builder):** [NEXT UP]
        * Goal: Convert raw (x,y,z) tuples into normalized vectors.
    * **Loop C (Model Inference):** [PENDING]
        * Goal: Load TFJS model and output Phase Labels.

## 3. Architecture Spec (M2)
We are refactoring `src/lib` to separate "Services" (Hardware/External) from "Engine" (Pure Logic).

### Directory Structure
```text
src/lib/
├── types/              # Domain interfaces (PoseResult, SnatchPhase)
├── stores/
│   ├── overlay.svelte.ts   # UI State
│   └── telemetry.svelte.ts # High-freq stream (Velocity, Phase)
├── services/           # Stateful Singletons
│   ├── videoIngest.ts      # Main Loop Conductor
│   ├── pose.ts             # MediaPipe Wrapper (Robust Import Logic)
│   └── audio.ts            # Feedback cues
└── engine/             # Pure Logic (No DOM)
    ├── calibration.ts      # Pixels-to-Meters
    ├── kinematics.ts       # Smoothing & Velocity Calc
    ├── features.ts         # Vector Builder for Model (Next Task)
    └── modelRunner.ts      # TFJS Inference
4. Technical Constraints
Svelte 5 Only: Use $state, $derived, $effect runes.

Performance:

Live Mode: Target 60fps.

Mobile-First: Use MediaPipe Pose (not Holistic).

Bundling/SSR:

Always wrap AI libraries in await import(...) and check if (!browser).

Always inspect module keys for default exports when using UMD libraries in Vite.

5. Implementation Plan: Milestone 2
Loop B: The Feature Builder (CURRENT)
Goal: Convert skeletons to valid feature vectors for the 1D CNN.

Task 1: Implement src/lib/engine/features.ts.

Logic: Center pose on Hips.

Logic: Normalize scale based on Torso height.

Logic: Flatten to Float32Array.

...
### Loop C (Model Inference): [IN PROGRESS]
* **Engine:** ONNX Runtime Web (`ort`).
* **Model:** `snatch_cnn_v4.onnx` (1D CNN).
* **Decoder:** Viterbi (`viterbiDecoder.ts`).
* **Status:** Files loaded. `FeatureBuilder` implemented.
* **Next:** Wire `phaseClassifier.ts` into `videoIngest.ts`.
...