# ONXX — Project Context & Handoff

## 1. Project Identity
* **Name:** ONXX (Optimized Neuromuscular eXercise for 2X fibers)
* **Objective:** Mobile-first, edge-to-edge web tool for analyzing kettlebell snatch mechanics (Phase, Velocity, Reps).
* **Tech Stack:** SvelteKit (SPA Mode), Svelte 5 Runes, TypeScript, Tailwind.
* **Core CV Stack:**
    * **Pose:** `@mediapipe/pose` (BlazePose)
    * **Inference:** `onnxruntime-web` (WASM)
    * **Signal Processing:** **OneEuro Filter** (Crucial for 30fps/60fps parity)

---

## 2. Status Board

### Milestone 1 (Foundation): ✅ COMPLETED
* Video ingest loop (rAF) and Double-layer rendering (Video + Canvas) are stable.
* Upload UI handles file input and playback control.

### Milestone 2 (Kinematics & AI): ⚠️ REFACTORING IN PROGRESS
* **Pose Extraction:** MediaPipe initialized.
* **Logic Engine:** `snatchLogic.ts` is robust.
* **AI Inference:** Model pipeline is technically functional but **Lacks Accuracy**.
    * **Issue:** The current model was trained on raw 60fps data. The live app (often 30fps webcam) introduces "aliasing noise" which causes the model to hallucinate phases (e.g., rapid flickering between PULL/FLOAT).
    * **Solution:** "Operation Iron Smoothing" (See Section 3).

---

## 3. IMMEDIATE NEXT STEP: Operation Iron Smoothing
**The goal:** Retrain the model on **Filtered Data** so it learns the "Clean Physics" of the snatch, rather than the "Digital Noise" of a specific webcam.

### A. The "Cohesive Physics" Mandate
Both the **Svelte App** and the **Python Training Notebook** must use the exact same signal processing mathematics.

**Shared Hyperparameters (Must be identical in TS and Python):**
* `MIN_CUTOFF`: **0.5 Hz** (Stabilizes the "Parking/Lockout" phases)
* `BETA`: **0.05** (Minimizes lag during the "Hike/Punch" ballistic phases)
* `D_CUTOFF`: **1.0 Hz** (Standard derivation cutoff)

### B. Implementation Plan (Runtime - TypeScript)
1.  **Create:** `src/lib/engine/oneEuro.ts` (Port of standard 1€ algorithm).
2.  **Integrate:** In `pose.ts`, apply the filter to `keypoint.x` and `keypoint.y` *immediately* after MediaPipe extraction.
3.  **Refactor:** `features.ts` should no longer need its own EMA smoothing if the raw inputs are cleaned by OneEuro.

### C. Implementation Plan (Training - Python)
The next Kaggle notebook must:
1.  Load the raw CSV/Video data.
2.  **Apply OneEuro Filter** to the raw landmarks (x, y, z) using the *exact same parameters* as the App.
3.  **Then** calculate features (Angles, Velocities).
4.  **Then** Train the 1D CNN.

**Why?** This ensures the model is "blind" to frame rate differences. Whether the user provides 30fps (webcam) or 60fps (upload), the OneEuro filter normalizes the signal curve before the AI sees it.

---

## 4. Codebase Directives for Next LLM

### To Create: `src/lib/engine/oneEuro.ts`
```typescript
export class OneEuroFilter {
    private minCutoff: number;
    private beta: number;
    private dCutoff: number;
    private xPrev: number | null = null;
    private dxPrev: number | null = null;
    private tPrev: number | null = null;

    constructor(minCutoff = 0.5, beta = 0.05, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
    }

    filter(t: number, x: number): number {
        // Implementation must match Python 'one_euro.py' exactly
        // ... (standard algorithm)
    }
}