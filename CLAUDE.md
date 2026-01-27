# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Iron Eye is an AI-powered kettlebell snatch detector with velocity-based training (VBT) metrics. It's a SvelteKit + TypeScript PWA (client-only, no SSR) designed for real-time movement phase detection and coaching feedback.

**Design Philosophy:**
- Minimalist UI — no clutter during work sets
- Mobile-first for live mode (edge-to-edge video)
- Desktop-oriented for upload mode (centered player with controls)
- Palette: oxblood (#722f37) / copper (#b87333) / black (#0a0a0a)

## Commands

```bash
npm run dev          # Start dev server (HTTPS for camera access)
npm run build        # Production build
npm run preview      # Preview production build
npm run check        # Type checking (svelte-kit sync + svelte-check)
```

## Architecture

### Current (Milestone 1)
```
Video Ingest (camera/upload) → Frame Loop → Overlay UI
```

### Target (Full Pipeline)
```
Video Ingest → MediaPipe Holistic → Feature Builder → 1D CNN Model
    ↓
Viterbi Decoder → Rep Segmentation → Velocity Engine → Alert Policy → UI
```

### Key Files
- **`src/lib/types/index.ts`** — All TypeScript types (SnatchPhase, CalibrationData, PoseData, etc.)
- **`src/lib/stores/index.ts`** — Svelte stores (sessionConfig, calibration, overlay, ui, videoIngest)
- **`src/lib/services/videoIngest.ts`** — Unified frame loop for live camera and upload video
- **`src/lib/services/phaseClassifier.ts`** — ONNX inference wrapper for 1D CNN model
- **`src/lib/services/viterbiDecoder.ts`** — Transition grammar enforcement via Viterbi algorithm
- **`src/lib/components/`** — VideoOverlay, CalibrationPanel, FramingGuide

### Routes
- **`/`** — Session Select (movement, mode, options)
- **`/live`** — Edge-to-edge camera view (mobile-first)
- **`/upload`** — Desktop video player with drag-drop
- **`/summary`** — Session results and export

## 9-Phase Snatch Model

```
STANDING → HANDONBELL → HIKE → PULL → FLOAT → LOCKOUT → DROP → CATCH → PARK
                                                          ↓
                                                    (back to PULL for next rep)
```

**Transition Grammar:**
- STANDING → STANDING, HANDONBELL
- HANDONBELL → HANDONBELL, HIKE
- HIKE → HIKE, PULL
- PULL → PULL, FLOAT
- FLOAT → FLOAT, LOCKOUT
- LOCKOUT → LOCKOUT, DROP
- DROP → DROP, CATCH
- CATCH → CATCH, PULL, PARK (branch point: next rep or end set)
- PARK → PARK, STANDING

**Concentric phases** (velocity measured): PULL, FLOAT, LOCKOUT
**Eccentric phases**: DROP, CATCH
**Transition phases**: HIKE, HANDONBELL, PARK, STANDING

## Critical Conventions

- **No SSR** — All logic is client-side; `+layout.ts` exports `ssr = false`
- **Svelte 5 Runes** — Use `$state()`, `$derived()`, `$effect()` syntax
- **MediaPipe** — Will be loaded from CDN at runtime (not bundled)
- **Timestamps** — Use `performance.now()` for frame timing, `Date.now()` for session state
- **Units** — Angles in degrees, velocity in m/s, height in inches internally
- **Store updates** — Use exported helper functions, not direct mutation

## Milestone Checklist

### ✅ Milestone 1 — Camera, Upload & Minimal UI Foundation
- [x] Edge-to-edge live camera view (mobile-first)
- [x] 60fps request with 30fps fallback
- [x] Upload screen with drag-drop and native video controls
- [x] Shared overlay system (phase, side, velocity, rep count, alerts)
- [x] Calibration panel with height input
- [x] Session select screen (1-2 taps to start)
- [x] Oxblood/copper/black palette
- [x] Summary screen layout
- [x] Clean build (0 errors, 0 warnings)

### ⬜ Milestone 2 — Hook Up 1D CNN Snatch Model
- [ ] Integrate MediaPipe Holistic (pose + hands)
- [ ] Feature builder with 12 features (see Model Integration Notes):
  - [ ] elbow_angle, shoulder_angle, hip_angle, knee_angle
  - [ ] elbow_velocity, shoulder_velocity, hip_velocity, knee_velocity
  - [ ] wrist_rel_y, wrist_velocity_y
  - [ ] torso_lean, active_side
- [ ] Copy `phaseClassifier.ts` and `viterbiDecoder.ts` to services
- [ ] Load ONNX model via onnxruntime-web (WASM backend)
- [ ] Run inference on 36-frame sliding window
- [ ] Viterbi decoder enforces transition grammar
- [ ] Display phase label + confidence in overlay
- [ ] "Tracking low" UI state when confidence drops
- [ ] Verify on golden clips (no stuck phases, no illegal transitions)

### ⬜ Milestone 3 — Phase Legalizer + Rep Segmentation
- [ ] Phase event markers (start/end timestamps per phase)
- [ ] Rep detection from CATCH → PULL transition (new rep) or CATCH → PARK (end set)
- [ ] Rep counter updates in real-time
- [ ] Side lock from HANDONBELL phase (hand detection determines L/R)
- [ ] Validate: rep count matches ground truth ±0

### ⬜ Milestone 4 — Concentric Gate + Peak Velocity
- [ ] Gate opens at PULL, closes at LOCKOUT
- [ ] Wrist position tracking via MediaPipe hand landmarks
- [ ] Pixel-to-meter conversion using calibration height
- [ ] Velocity calculation (central differences, One Euro filter)
- [ ] Per-rep metrics: peakVelocityMps, timeToPeakMs
- [ ] Poor calibration flagged in UI
- [ ] Validate: peak only computed inside gate

### ⬜ Milestone 5 — Returns Engine (Velocity Alerts)
- [ ] Drop-off detection (% decline from best)
- [ ] Configurable threshold (default 10%)
- [ ] Alert banner when threshold exceeded
- [ ] Confidence gating (no alerts below tracking threshold)
- [ ] Alert evidence stored (velocity values, timestamps)
- [ ] Validate: no false alerts on clean sets

### ⬜ Milestone 6 — Session Summary + Notion Export
- [ ] Summary screen with real data:
  - [ ] Best peak velocity
  - [ ] Average peak velocity
  - [ ] Drop-off percentage
  - [ ] Total reps
  - [ ] Alerts triggered
- [ ] Rep drilldown table (optional expand)
- [ ] Notion export (OAuth or API key)
- [ ] Export schema: session row, set rows, rep rows
- [ ] Success/failure feedback
- [ ] Validate: consistent export schema

---

## Model Integration Notes

### Model Specification (from config.json)
```json
{
  "model_version": "4.0.0-cnn-viterbi",
  "model_type": "cnn",
  "num_classes": 9,
  "sequence_length": 36,
  "num_features": 12,
  "fps": 60
}
```

### Feature Vector (12 features per frame)
```typescript
const featureNames = [
  'elbow_angle',       // angle(shoulder, elbow, wrist) in degrees
  'shoulder_angle',    // angle(hip, shoulder, elbow) in degrees
  'hip_angle',         // angle(shoulder, hip, knee) in degrees
  'knee_angle',        // angle(hip, knee, ankle) in degrees
  'elbow_velocity',    // d(elbow_angle)/dt
  'shoulder_velocity', // d(shoulder_angle)/dt
  'hip_velocity',      // d(hip_angle)/dt
  'knee_velocity',     // d(knee_angle)/dt
  'wrist_rel_y',       // wrist.y normalized (0-1, top to bottom)
  'wrist_velocity_y',  // d(wrist_rel_y)/dt
  'torso_lean',        // shoulder.x - hip.x (positive = leaning forward)
  'active_side'        // 0 = left, 1 = right
];
```

### PhaseClassifier Usage
```typescript
import { phaseClassifier } from '$lib/services/phaseClassifier';

// Load model on app init
await phaseClassifier.load('/models/snatch-cnn/model.onnx', '/models/snatch-cnn/config.json');

// Each frame: add features to sliding window buffer
phaseClassifier.addFrame(features); // features: number[12]

// When buffer full (36 frames), classify
if (phaseClassifier.isReady()) {
  const phase = await phaseClassifier.classify(); // returns SnatchPhase
}

// On session end
phaseClassifier.reset();
```

### Viterbi Decoder
The model outputs raw logits for all 36 timesteps. The Viterbi decoder:
1. Converts logits to log-probabilities via log-softmax
2. Applies transition grammar constraints (illegal transitions get -1000 penalty)
3. Adds self-transition bonus (+0.1) to encourage phase stability
4. Returns the most likely phase sequence
5. Maintains state across calls for continuity

```typescript
// Decoder is used internally by phaseClassifier
// Config from config.json:
{
  "viterbi": {
    "beam_width": 3,
    "illegal_transition_penalty": -1000.0,
    "self_transition_bonus": 0.1
  }
}
```

### ONNX Runtime Setup
```typescript
import * as ort from 'onnxruntime-web';

ort.env.wasm.numThreads = 1;  // Single thread for consistency
ort.env.wasm.simd = true;     // Enable SIMD for performance

// Input shape: [1, 36, 12] (batch, sequence, features)
const input = new ort.Tensor('float32', featureBuffer, [1, 36, 12]);
const output = await session.run({ input });
// Output 'logits': [1, 36, 9] (batch, sequence, classes)
```

---

## Testing

- **Live mode:** Test on mobile device with HTTPS (camera requires secure context)
- **Upload mode:** Use training clips referenced in `snatch_Phases_1.csv` and `snatch_Phases_2.csv`
- **Debug HUD:** Toggle via invisible tap zone (bottom-right on live, checkbox on upload)
- **Golden clips:** Verify phase sequence matches CSV annotations

## Performance Rules

- Never block UI thread
- Batch inference on cadence (don't run every frame if struggling)
- Minimal DOM updates — single overlay layer
- If device struggles: reduce inference frequency before dropping camera fps
- Target: stable 60fps on modern devices, 30fps acceptable on older

## File Naming

- Components: `PascalCase.svelte`
- Services: `camelCase.ts`
- Stores: `camelCase.ts` with named exports
- Types: `index.ts` in types folder, import from `$lib/types`
