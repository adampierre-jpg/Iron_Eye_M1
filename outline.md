# ONXX — Implementation Blueprint (Optimized Neuromuscular eXercise)

**Design rules**

- **Minimalist UI**. No clutter, no dashboards during work sets.
- **Mobile-first** for live mode: once started, **edge-to-edge video**. Target **60fps if available**, fallback **30fps**.
- **Desktop-oriented** for upload mode: centered video player with native controls, calibration panel, and overlays.
- **Palette**: **oxblood / copper / black** (copper for “active/armed”, oxblood for warnings, black as base).
- Core model: **1D CNN snatch model** (v1 movement model).

---

## 0) Definition of Done (global)

A build is “done” only if:

- Live camera runs edge-to-edge without jank; overlays never drop frames noticeably.
- Upload mode plays videos smoothly with native controls and identical overlays.
- Rep counting + phase tracking stable across typical lighting and angles.
- Peak velocity computed only inside the concentric gate.
- Alerts are confidence-gated (never “hard stop” when tracking is low).
- Session exports cleanly to Notion with consistent schema.

---

## 1) UX Blueprint (Minimalist)

### Screen A — Session Select

**Must have**

- Movement: Snatch (v1), Swing/Clean (locked/coming soon), Complex/Chain (coming later)
- Mode: **Live** / **Upload**
- Toggles: Form Eval (server) [off by default v1], Notion Export [on/off]
- Inputs: load (optional), notes (optional)

**Acceptance**

- 1–2 taps from open → camera running (Live) or upload screen (Upload).

### Screen B — Setup / Calibration (shared for both modes)

**Must have**

- Height input (inches) + confirm
- Framing guide (simple silhouette box — live mode only)
- “Calibration quality” indicator (dot + label: Good / OK / Poor)
- “Side lock” status (waiting → locked L/R — live mode primary)

**Acceptance**

- User can reach “Ready” state in under 20 seconds.

### Screen C — Live (Edge-to-edge, mobile-first)

**Must have (overlay, minimal)**

- Top-left: phase label (small)
- Top-right: side lock + confidence dot
- Bottom-center: live velocity during concentric + “Peak” after rep ends
- Bottom-left: subtle rep counter
- Alerts as single-line banner (oxblood background, copper text)

**Frame-rate rule**

- Request 60fps where supported; fallback to 30fps.
- Overlays must be GPU-friendly (no heavy DOM reflow).

**Acceptance**

- Stable 60fps (if device supports); otherwise stable 30fps.
- ≤5 UI elements visible at once.

### Screen D — Upload (Desktop-oriented, minimalist)

**Must have**

- Centered video player with native controls (play/pause/scrub/loop)
- Identical overlays to Live mode (phase label, side confidence, velocity, rep count, alert banner)
- Calibration panel below video: height input + “Confirm Calibration” button
- Drag-and-drop or file picker upload zone (pre-video load)

**Behavior**

- Video loads instantly via object URL; autoplay + loop optional.
- No forced fullscreen or edge-to-edge.
- Calibration persists across sessions if desired.

**Acceptance**

- Video playback smooth on desktop; overlays update in real-time during processing.
- Calibration completes with feedback banner.
- ≤6 UI elements visible when video loaded.

### Screen E — Summary

**Must have**

- Best peak velocity, avg, drop-off %
- Any alerts triggered + reason
- Export status (Notion success/fail)
- Tap into “Rep list” (optional drilldown)

**Acceptance**

- Summary readable in <10 seconds.

---

## 2) Architecture Blueprint (Client-first)

### Client modules (SvelteKit)

1. **Video Ingest**
    - Live camera stream **or** upload video playback
    - Produces frames + timestamps uniformly for both modes
2. **MediaPipe Holistic**
    - Pose + hand landmarks per frame
3. **Side Lock**
    - Hand-on-bell lifecycle determines L/R
4. **Feature Builder**
    - Converts landmarks → fixed feature vector for snatch 1D CNN
5. **Snatch Phase Model Runner (existing)**
    - Runs inference on windows; outputs per-frame phase probabilities
6. **Phase Legalizer / Smoother**
    - Converts probs → stable phase track + start markers
7. **Concentric Gate + Velocity Engine**
    - Uses phase markers to compute peak m/s at wrist (requires calibration)
8. **Alert Policy Engine**
    - Velocity drop-off logic + confidence gating
9. **Session Store**
    - Rep/set/session summaries persisted locally until export
10. **Notion Export Client**
    - Initiates export (client-side OAuth v1 or server relay recommended)

### Server modules (v2, optional)

- Form eval receiver + GCN scoring + drift + session intelligence
- Notion export service (centralized tokens)

---

## 3) Contracts (what each module must output)

### Pose Stream (shared Live/Upload)

- `timestampMs`, `frameIndex`
- `poseLandmarks`, `handLandmarksL/R`
- `confidencePose`, `confidenceHands`
- `imageWidth`, `imageHeight`
- `visibility` (MediaPipe pose visibility score)

### Side Lock

- `sideLocked`, `side` (L/R), `handOnBell`
- `events`: `handOnBellStart/End`, `sideLockAcquired/Lost`
- `confidenceSide`

### Feature Vector (Snatch)

- `timestampMs`
- `features[]` (fixed length matching model)
- `featureQuality` (0–1)

### Phase Track (Snatch)

- `phaseLabel` per frame
- `phaseConfidence` per frame
- `phaseEvents` (start markers)

### Rep Metrics

- `repId`, `side`
- `concentricStartMs`, `concentricEndMs`
- `peakVelocityMps`, `timeToPeakMs`
- `trackingQuality`
- `phaseTimestamps` (key phases)

### Alerts

- `type`, `severity`, `message`, `timeMs`
- `evidence` (velocity drop %, confidence, etc.)

---

## 4) Build Order (milestones with acceptance criteria)

### Milestone 1 — Camera, Upload & Minimal UI Foundation

**Deliver**

- Edge-to-edge live camera view (mobile)
- Dedicated upload screen with video player, drag-drop, and calibration panel
- Shared minimal overlay system (phase, side, velocity, rep count)
- 60fps request + fallback for live

**Acceptance**

- Camera starts ≤2 seconds; stable pacing (no stutter >250ms)
- Upload screen loads/videos play smoothly with overlays

### Milestone 2 — Hook up existing Snatch 1D CNN model

**Deliver**

- Feature builder aligned to model expectations
- Model inference runs in both Live and Upload modes
- Phase label + confidence displayed

**Acceptance**

- Phase track stable on golden clips; no freeze in single phase
- Low confidence → “Tracking low” UI, not wrong phases

### Milestone 3 — Phase Legalizer + Rep Segmentation

**Deliver**

- Legal phase order enforcement (hysteresis + rules)
- Rep start/end from phase events
- Rep counter reliable

**Acceptance**

- Rep count matches ground truth ±0 on training dataset clips
- No illegal phase transitions

### Milestone 4 — Concentric Gate + Peak Velocity

**Deliver**

- Gate opens/closes on defined phases
- Wrist velocity in m/s using calibration (shared store)
- Per-rep metrics stored

**Acceptance**

- Peak computed only inside gate
- Poor calibration → flagged velocity + UI de-emphasis

### Milestone 5 — Returns Engine (velocity-based v1)

**Deliver**

- Drop-off detection per set
- Alert banner when returns met/exceeded
- Confidence gating

**Acceptance**

- Alerts trigger only on consistent evidence
- No hard alerts below confidence threshold

### Milestone 6 — Session Summary + Notion Export v1

**Deliver**

- Summary screen with key metrics + alerts
- Notion export: session row, set rows, optional rep rows

**Acceptance**

- Export consistent schema; clear success/failure feedback

---

## 5) Data blueprint (minimum fields)

### Session

- datetime, movement, mode (Live/Upload)
- heightInches, calibrationQuality, pxPerMeter
- bestPeakVelocityMps, avgPeakVelocityMps, velocityDropPct
- returnsMetFlag + returnsMetAtMs
- notes, modelVersion

### Set

- setIndex, repCount
- best/avg velocity, drop %
- alerts summary

### Rep (optional v1)

- repIndex, side
- peakVelocityMps, timeToPeakMs
- concentricStart/End
- trackingQuality, phaseTimestamps

---

## 6) Performance blueprint (60fps-first for Live)

**Hard rules**

- Never block UI thread if it causes drops.
- Batch inference on cadence while maintaining render fps (Live) or playback fidelity (Upload).
- Minimal DOM updates; single overlay layer.
- If device struggles: reduce inference frequency before dropping camera fps.

**Acceptance checks**

- Dev-mode frame drop counter + timing logs.

---

## 7) Visual design blueprint (oxblood / copper / black)

- **Black**: base background, hidden chrome in live
- **Copper**: active indicators, velocity highlight
- **Oxblood**: warnings/alert banners
- Typography: single clean sans, ≤2 weights
- Icons: minimal line icons

**Acceptance**

- Live screen ≤5 elements; Upload ≤6 when loaded.

---

## 8) Risk list

- Feature mismatch (notebook vs runtime) → stuck phase
- Timestamp alignment drift (especially Upload playback)
- Calibration variability → velocity inaccuracy
- Pose confidence dips → false alerts

**Mitigations**

- Debug HUD (toggle): confidence, phase probs, gate state, fps
- Golden clip verification for feature vector alignment

---

## 9) Acceptance test pack

**Fixed assets**

- 3 live snatch sessions (varied lighting/angles)
- 5 upload videos (including ≥1 training clip)

**Required passes**

- Rep counts match expected
- Peak velocity in sane ranges
- Phase order always valid
- No stuck phases
- Export works consistently
- Upload mode processes all clips without timestamp drift