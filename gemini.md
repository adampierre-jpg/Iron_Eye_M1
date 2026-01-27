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
    * Basic UI (Drag & Drop, Playback controls) functional.
* **Milestone 2 (Kinematics & AI):** [IN PROGRESS]
    * Goal: Integrate Pose Detection, Physics Engine, and Snatch State Machine.
    * Immediate Task: "Loop A" — Implement the Pose Stream logic.

## 3. Architecture Spec (M2 Update)
We are refactoring `src/lib` to separate "Services" (Hardware/External) from "Engine" (Pure Logic).

### New Directory Structure
```text
src/lib/
├── types/              # Domain interfaces
├── stores/
│   ├── session.svelte.ts   # "Cold" state (Reps, Sets)
│   ├── settings.svelte.ts  # Calibration data, User height
│   └── telemetry.svelte.ts # "Hot" state (Velocity, Phase - 60hz)
├── services/           # Stateful Singletons
│   ├── videoIngest.ts      # Main Loop Conductor
│   ├── pose.ts             # MediaPipe Wrapper & Side Lock
│   └── audio.ts            # Feedback cues
└── engine/             # Pure Logic (No DOM)
    ├── calibration.ts      # Pixels-to-Meters
    ├── kinematics.ts       # Smoothing & Velocity Calc
    ├── features.ts         # Vector Builder for Model
    └── modelRunner.ts      # TFJS Inference

    4. Technical Constraints
Svelte 5 Only: Use $state, $derived, $effect runes. No legacy stores unless strictly necessary for library compat.

Performance: * Live Mode: Target 60fps.

Inference: Decouple from render loop if needed (e.g., infer every 2nd frame).

Mobile-First: Use MediaPipe Pose (not Holistic) to save GPU cycles.

Visuals: Oxblood/Copper/Black palette. Minimalist overlay.

5. Implementation Plan: Milestone 2
We are executing in three strict loops to ensure stability.

Loop A: The Pose Stream (CURRENT)
Goal: Get raw skeletons drawing on the canvas at 60fps.

Task 1: Define Types in src/lib/types/index.ts (PoseResult, FrameData).

Task 2: Scaffold src/lib/services/pose.ts (Initialize MediaPipe).

Task 3: Wire pose.ts into videoIngest.ts.

Loop B: The Feature Builder
Goal: Convert skeletons to valid feature vectors.

Task: Implement src/lib/engine/features.ts (Normalization, flattening).

Loop C: The Model Inference
Goal: Output Phase Labels (HIKE, PULL, PUNCH, etc.).

Task: Load TFJS model and feed vectors in modelRunner.ts.