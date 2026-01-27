// src/lib/types/index.ts

// 1. The phases of the Snatch (State Machine Labels)
export type SnatchPhase = 
  | 'STANDING' 
  | 'HANDONBELL' // "Ready"
  | 'HIKE' 
  | 'PULL' 
  | 'FLOAT' 
  | 'LOCKOUT' 
  | 'DROP' 
  | 'CATCH' 
  | 'PARK';

// 2. MediaPipe-specific types
export interface Keypoint {
  x: number; // 0.0 - 1.0 (Normalized to image width)
  y: number; // 0.0 - 1.0 (Normalized to image height)
  z: number; // Relative depth
  score: number; // Confidence 0.0 - 1.0
  name?: string; // e.g., 'right_wrist'
}

// 3. The Object returned by PoseService each frame
export interface PoseResult {
  timestamp: number; // ms
  keypoints: Keypoint[];     // The raw skeleton (33 points)
  worldLandmarks: Keypoint[]; // 3D metric scale (meters)
  
  // Logic Signals
  side: 'LEFT' | 'RIGHT' | null;
  isHandOnBell: boolean;
  
  // Telemetry
  fps: number;
  confidence: number;
}

// 4. Analysis Data (Persisted per frame)
export interface FrameData {
  time: number;
  phase: SnatchPhase;
  velocity: number; // m/s (vertical)
  pose: PoseResult | null;
}