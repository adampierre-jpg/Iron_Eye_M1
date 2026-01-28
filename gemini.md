# Iron Eye — Project Context & Handoff

## 1. Project Identity
* **Name:** Iron Eye (Kettlebell Snatch Analysis)
* **Objective:** Mobile-first, edge-to-edge web tool for analyzing kettlebell snatch mechanics (Phase, Velocity, Reps).
* **Tech Stack:** SvelteKit (SPA Mode/SSR Disabled), Svelte 5 Runes, TypeScript, Tailwind.
* **Core CV Stack:**
    * **Pose:** `@mediapipe/pose` (BlazePose)
    * **Inference:** `onnxruntime-web` (WASM)

---

## 2. Status Board

### Milestone 1 (Foundation): ✅ COMPLETED
* Video ingest loop (rAF) and Double-layer rendering (Video + Canvas) are stable.
* Upload UI handles file input and playback control.
* Server-Side Rendering (SSR) disabled to prevent 500 errors with browser-only libs.

### Milestone 2 (Kinematics & AI): ⚠️ IN FINAL INTEGRATION
* **Loop A (Pose):** ✅ Green skeleton draws correctly on the canvas.
* **Loop B (Features):** ✅ `FeatureBuilder` converts Keypoints → 12-point Vector.
* **Loop C (Model):** ✅ ONNX model (`snatch_cnn_v4.onnx`) loads successfully.
* **The Blocker:** The HUD displays `---` instead of the current phase.
    * *Diagnosis:* The `overlay` store is likely initialized to `undefined`, and the wiring between `AnalysisService` and the store is disconnected.

---

## 3. Architecture Overview

### Data Layer (Stores)
* **`src/lib/stores/overlay.svelte.ts`**: Holds UI state (Phase, FPS, Velocity). **[FIX REQUIRED]**
* **`src/lib/stores/videoIngest.svelte.ts`**: Holds playback state (Frame count, dropped frames).

### Service Layer (Orchestration)
* **`src/lib/services/videoIngest.ts`**: The main loop. Calls Pose -> Analysis -> Updates Store. **[FIX REQUIRED]**
* **`src/lib/services/analysis.ts`**: Wraps ONNX session. Manages the 36-frame rolling buffer.
* **`src/lib/services/pose.ts`**: Wraps MediaPipe. Contains "Aggressive Search" fix for Vite imports.

### Engine Layer (Pure Logic)
* **`src/lib/engine/features.ts`**: Math engine (Angles/Velocities).
* **`src/lib/engine/phaseClassifier.ts`**: ONNX inference logic.
* **`src/lib/engine/viterbiDecoder.ts`**: State machine (Viterbi algorithm).

---

## 4. Immediate Action Plan (The Fix)

The goal for the next session is purely **Wiring**. We must connect the AI output to the UI Store.

### Step 1: Fix Store Initialization
**File:** `src/lib/stores/overlay.svelte.ts`
*Action:* Initialize `phase` with a string value to prevent `---`.

```typescript
import type { SnatchPhase } from '$lib/types';

class OverlayStore {
    // Initialize with 'STANDING' (String), NOT undefined
    phase = $state<SnatchPhase>('STANDING'); 
    
    repCount = $state(0);
    currentVelocity = $state(0);
    peakVelocity = $state(0);
    fps = $state(0);
    alert = $state<{ message: string } | null>(null);

    reset() {
        this.phase = 'STANDING';
        this.repCount = 0;
        this.currentVelocity = 0;
        this.peakVelocity = 0;
        this.alert = null;
    }

    updateFps(val: number) {
        this.fps = val;
    }
}

export const overlay = new OverlayStore();

Step 2: Connect Data Pipeline
File: src/lib/services/videoIngest.ts Action: Update processFrame to write the analysis result to the store.

// ... imports
import { overlay } from '$lib/stores'; // Ensure imported
import { analysisService } from '$lib/services/analysis';
// ...

private async processFrame() {
  if (!this.videoElement || !this.onFrame) return;

  this.isProcessingFrame = true;
  try {
    // 1. Get Pose
    const result = await poseService.process(this.videoElement);
    
    // 2. Run AI (Returns 'PULL', 'LOCKOUT', or null if buffering)
    const currentPhase = await analysisService.process(result);
    
    // 3. WRITE TO STORE (The Critical Fix)
    if (currentPhase) {
        overlay.phase = currentPhase;
    }
    
    // 4. Update Component & Telemetry
    this.onFrame(result);
    // ... update videoIngest stats ...
    
  } catch (err) {
    console.error(err);
  } finally {
    this.isProcessingFrame = false;
  }
}

Step 3: Verify Viterbi Return Type
File: src/lib/engine/viterbiDecoder.ts Action: Ensure decodeLast returns a string from the PHASES array, not a number index.

// ... inside decodeLast ...
this.state = bestIdx;
return PHASES[bestIdx]; // Return String, not Index