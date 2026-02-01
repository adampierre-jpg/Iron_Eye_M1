// src/lib/engine/features.ts
import type { PoseResult, Keypoint } from '$lib/types';
import { get } from 'svelte/store';
import { calibration } from '$lib/stores';

export interface FeatureResult {
    vector: number[];    // The 12-float array for the CNN (Normalized)
    velocityMps: number; // Real-world velocity for UI/Engine (Meters/sec)
}

interface FeatureState {
    elbowAng: number;
    shoulderAng: number;
    hipAng: number;
    kneeAng: number;
    wristY: number;
}

export class FeatureBuilder {
  private lastState: FeatureState | null = null;
  private lastTime: number = 0;

  /**
   * Transforms a raw PoseResult into the EXACT vector expected by the Kaggle-trained model.
   * Source Truth: Python 'build_features' function.
   */
  extract(pose: PoseResult): FeatureResult | null {
    // 1. GUARD: Full Skeleton
    if (!pose || !pose.keypoints || pose.keypoints.length < 33) return null;

    const kp = pose.keypoints;
    const isRight = pose.side === 'LEFT' ? 0 : 1; // Logic Engine Priority
    const idx = this.getIndices(isRight === 1);

    // Safety: Check core confidence
    if (Math.min(kp[idx.shoulder].score, kp[idx.elbow].score, kp[idx.wrist].score) < 0.3) {
        return null;
    }

    // 2. EXTRACT RAW POINTS (Matches Python 'lm' access)
    // We use .x and .y directly. .z is available but 'angle_3pt' in Python 
    // usually runs on the slice [:3]. We will include Z for parity if available.
    const sh = kp[idx.shoulder];
    const el = kp[idx.elbow];
    const wr = kp[idx.wrist];
    const hip = kp[idx.hip];
    const knee = kp[idx.knee];
    const ankle = kp[idx.ankle];

    // 3. COMPUTE ANGLES (Degrees) using Dot Product (Arccos)
    // Python: np.degrees(np.arccos(cos_ang))
    const elbowAng = this.angle3pt(sh, el, wr);
    const shoulderAng = this.angle3pt(hip, sh, el);
    const hipAng = this.angle3pt(sh, hip, knee);
    const kneeAng = this.angle3pt(hip, knee, ankle);

    // 4. COMPUTE RAW FEATURES
    const wristY = wr.y; // Raw Normalized Y (0.0 top, 1.0 bottom)
    
    // CRITICAL FIX: Torso Lean Polarity
    // The model learned that "Negative" = Leaning into the active side.
    // Right Arm (Active Right): Lean Right -> Shoulder moves Left (lower X) -> (sh - hip) is Negative.
    // Left Arm (Active Left): Lean Left -> Shoulder moves Right (higher X) -> (sh - hip) is Positive.
    // We must invert the result for the Left arm to maintain "Negative = Active Lean".
    const rawLean = sh.x - hip.x; 
    const torsoLean = (isRight === 1) ? rawLean : -rawLean;

    // 5. COMPUTE VELOCITIES (Finite Difference)
    const dt = (pose.timestamp - this.lastTime) / 1000; // seconds

    // Defaults for first frame
    let vElbow = 0, vShoulder = 0, vHip = 0, vKnee = 0, vWristY = 0;
    
    // UI Velocity Calculation (Meters/sec)
    let velocityMps = 0; 

    if (this.lastState && dt > 0 && dt < 1.0) {
        // Python: (curr - prev) / dt
        // Python Scale: / 500.0 for Angles
        vElbow = ((elbowAng - this.lastState.elbowAng) / dt) / 500.0;
        vShoulder = ((shoulderAng - this.lastState.shoulderAng) / dt) / 500.0;
        vHip = ((hipAng - this.lastState.hipAng) / dt) / 500.0;
        vKnee = ((kneeAng - this.lastState.kneeAng) / dt) / 500.0;

        // Python Scale: * 10.0 for Wrist Y
        const dy = wristY - this.lastState.wristY;
        vWristY = (dy / dt) * 10.0; 

        // --- UI / ENGINE VELOCITY (Real World) ---
        const calib = get(calibration);
        if (calib.pxPerMeter > 0) {
            velocityMps = -(dy / calib.pxPerMeter) / dt;
        } else {
             // Fallback: 1 unit = 2.18m (approx 1.75m height)
             velocityMps = -(dy * 2.18) / dt;
        }
    }

    // 6. UPDATE STATE
    this.lastState = { elbowAng, shoulderAng, hipAng, kneeAng, wristY };
    this.lastTime = pose.timestamp;

    // CRITICAL FIX: Hand Flag Parity
    // The notebook hardcoded the last feature to 1.0. 
    // The app must send 1.0 regardless of side, or the bias weights will be ignored.
    const handFlag = 1.0; 

    // 7. ASSEMBLE VECTOR (Exact Match to Python 'build_features')
    const vector = [
        elbowAng / 180.0,       // 0
        shoulderAng / 180.0,    // 1
        hipAng / 180.0,         // 2
        kneeAng / 180.0,        // 3
        vElbow,                 // 4
        vShoulder,              // 5
        vHip,                   // 6
        vKnee,                  // 7
        wristY,                 // 8
        vWristY,                // 9
        torsoLean,              // 10 (Fixed)
        handFlag                // 11 (Fixed)
    ];

    return { vector, velocityMps };
  }

  // --- Helpers ---

  /** * Python 'angle_3pt' equivalent. */
  private angle3pt(a: Keypoint, b: Keypoint, c: Keypoint): number {
    const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
    const dot = (ba.x * bc.x) + (ba.y * bc.y) + (ba.z * bc.z);
    const magBA = Math.sqrt(ba.x*ba.x + ba.y*ba.y + ba.z*ba.z);
    const magBC = Math.sqrt(bc.x*bc.x + bc.y*bc.y + bc.z*bc.z);
    const denom = (magBA * magBC) + 1e-8;
    const cosine = Math.max(-1, Math.min(1, dot / denom));
    return Math.acos(cosine) * (180.0 / Math.PI);
  }

  private getIndices(isRight: boolean) {
    return isRight ? { shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28 } 
                   : { shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27 };
  }
}

export const featureBuilder = new FeatureBuilder();