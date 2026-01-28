// src/lib/engine/features.ts
import type { PoseResult, Keypoint } from '$lib/types';

/**
 * Maps the 33 MediaPipe landmarks to the 12 features required by the CNN.
 * State is required to calculate velocity (Current - Previous).
 */
export class FeatureBuilder {
  private lastPose: PoseResult | null = null;
  private lastTime: number = 0;

  // Smoothing factors or thresholds could go here
  private readonly VELOCITY_THRESHOLD = 20.0; // Cap crazy spikes

  /**
   * Transforms a raw PoseResult into the 12-float vector expected by the ONNX model.
   * Returns null if pose is invalid or confidence is too low.
   */
  extract(pose: PoseResult): number[] | null {
    if (!pose || pose.keypoints.length === 0) return null;

    // 1. Determine Active Side (Simple heuristic if not provided)
    // If side is null, assume Right (1.0) or use logic. 
    // TODO: Connect to your "Side Lock" logic. 
    const isRight = pose.side === 'LEFT' ? 0 : 1; // 0=Left, 1=Right (Model dependent)
    
    const kp = pose.keypoints;
    const idx = this.getIndices(isRight === 1);

    // 2. Get Keypoints
    const shoulder = kp[idx.shoulder];
    const elbow = kp[idx.elbow];
    const wrist = kp[idx.wrist];
    const hip = kp[idx.hip];
    const knee = kp[idx.knee];
    const ankle = kp[idx.ankle];

    // Safety: If any keypoint is missing/low confidence, abort
    if (Math.min(shoulder.score, elbow.score, wrist.score, hip.score, knee.score) < 0.3) {
      return null;
    }

    // 3. Calculate Angles (Degrees)
    const elbowAngle = this.calculateAngle(shoulder, elbow, wrist);
    const shoulderAngle = this.calculateAngle(hip, shoulder, elbow);
    const hipAngle = this.calculateAngle(shoulder, hip, knee);
    const kneeAngle = this.calculateAngle(hip, knee, ankle);

    // 4. Calculate Velocities & Time Delta
    // Normalize velocity by "User Height" (Heel to Nose) to make it invariant to camera distance
    const userHeightPx = Math.abs(kp[0].y - kp[isRight ? 30 : 29].y) || 1.0; 
    const dt = (pose.timestamp - this.lastTime) / 1000; // seconds

    let vElbow = 0, vShoulder = 0, vHip = 0, vKnee = 0, vWristY = 0;

    if (this.lastPose && dt > 0 && dt < 1.0) {
       const prevKp = this.lastPose.keypoints;
       const prevHeight = Math.abs(prevKp[0].y - prevKp[isRight ? 30 : 29].y) || 1.0;
       
       // Velocity = (Current - Prev) / dt / HeightScale
       // We use normalized Y (0-1), so dividing by height pixels isn't quite right.
       // MediaPipe Y is % of screen. 
       // Feature = (dY / dt) 
       
       vElbow = this.getVelocity(elbow, prevKp[idx.elbow], dt);
       vShoulder = this.getVelocity(shoulder, prevKp[idx.shoulder], dt);
       vHip = this.getVelocity(hip, prevKp[idx.hip], dt);
       vKnee = this.getVelocity(knee, prevKp[idx.knee], dt);
       
       // Specific feature: wrist_velocity_y (Vertical only)
       vWristY = (-(wrist.y - prevKp[idx.wrist].y) / dt); // Negative because Y is down in CV
    }

    // 5. Special Features
    // wrist_rel_y: Wrist height relative to shoulder (Normalized)
    // Positive = Above shoulder, Negative = Below
    const wristRelY = (shoulder.y - wrist.y) * (1.0 / userHeightPx); // Approximation

    // torso_lean: Angle of Hip-Shoulder vector vs Vertical
    const torsoLean = this.calculateVerticalAngle(hip, shoulder);

    // Update History
    this.lastPose = pose;
    this.lastTime = pose.timestamp;

    // 6. Assemble Vector (Order MUST match config.json)
    return [
      elbowAngle / 180.0,      // Normalize angles 0-1 usually
      shoulderAngle / 180.0,
      hipAngle / 180.0,
      kneeAngle / 180.0,
      vElbow,
      vShoulder,
      vHip,
      vKnee,
      wristRelY,
      vWristY,
      torsoLean / 180.0,
      isRight === 1 ? 1.0 : 0.0 // active_side
    ];
  }

  // --- Helpers ---

  /** Map logical names to MediaPipe indices based on side */
  private getIndices(isRight: boolean) {
    return isRight ? {
      shoulder: 12, elbow: 14, wrist: 16, hip: 24, knee: 26, ankle: 28
    } : {
      shoulder: 11, elbow: 13, wrist: 15, hip: 23, knee: 25, ankle: 27
    };
  }

  /** Calculate angle between three points (A-B-C) at B */
  private calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360.0 - angle;
    return angle;
  }

  /** Calculate angle of vector A-B against vertical axis */
  private calculateVerticalAngle(a: Keypoint, b: Keypoint): number {
    // Vector A->B
    const dy = b.y - a.y;
    const dx = b.x - a.x;
    // Angle vs (0, -1) [Up]
    const theta = Math.atan2(dx, -dy) * 180 / Math.PI;
    return theta; // -180 to 180
  }

  private getVelocity(curr: Keypoint, prev: Keypoint, dt: number): number {
    const dist = Math.sqrt(Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2));
    return dist / dt; 
  }
}

export const featureBuilder = new FeatureBuilder();