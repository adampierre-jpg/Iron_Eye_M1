// ============================================================
// Iron Eye — Core Type Definitions
// ============================================================

// Movement types supported
export type Movement = 'snatch' | 'swing' | 'clean' | 'complex';

// Session mode
export type SessionMode = 'live' | 'upload';

// Snatch phases (9-class, no punch)
export type SnatchPhase = 
  | 'STANDING'
  | 'HANDONBELL'
  | 'HIKE'
  | 'PULL'
  | 'FLOAT'
  | 'LOCKOUT'
  | 'DROP'
  | 'CATCH'
  | 'PARK';

// Side detection
export type Side = 'L' | 'R' | null;

// Calibration quality levels
export type CalibrationQuality = 'good' | 'ok' | 'poor' | 'none';

// Tracking confidence
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'lost';

// ============================================================
// Session Configuration
// ============================================================

export interface SessionConfig {
  movement: Movement;
  mode: SessionMode;
  formEvalEnabled: boolean;
  notionExportEnabled: boolean;
  loadKg?: number;
  notes?: string;
}

// ============================================================
// Calibration
// ============================================================

export interface CalibrationData {
  heightInches: number;
  pxPerMeter: number;
  quality: CalibrationQuality;
  sideLocked: boolean;
  side: Side;
  timestamp: number;
}

// ============================================================
// Video Frame Data
// ============================================================

export interface FrameData {
  timestampMs: number;
  frameIndex: number;
  imageWidth: number;
  imageHeight: number;
  videoElement: HTMLVideoElement;
}

// ============================================================
// Pose Stream (from MediaPipe)
// ============================================================

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface PoseData {
  timestampMs: number;
  frameIndex: number;
  poseLandmarks: PoseLandmark[] | null;
  handLandmarksL: PoseLandmark[] | null;
  handLandmarksR: PoseLandmark[] | null;
  confidencePose: number;
  confidenceHands: number;
  imageWidth: number;
  imageHeight: number;
}

// ============================================================
// Side Lock
// ============================================================

export interface SideLockState {
  sideLocked: boolean;
  side: Side;
  handOnBell: boolean;
  confidenceSide: number;
}

export type SideLockEvent = 
  | 'handOnBellStart'
  | 'handOnBellEnd'
  | 'sideLockAcquired'
  | 'sideLockLost';

// ============================================================
// Phase Track
// ============================================================

export interface PhaseState {
  phaseLabel: SnatchPhase;
  phaseConfidence: number;
  phaseProbabilities: Record<SnatchPhase, number>;
}

export interface PhaseEvent {
  phase: SnatchPhase;
  timestampMs: number;
  frameIndex: number;
  type: 'start' | 'end';
}

// ============================================================
// Velocity & Rep Metrics
// ============================================================

export interface VelocityData {
  currentMps: number;
  peakMps: number;
  isInConcentricGate: boolean;
}

export interface RepMetrics {
  repId: string;
  repIndex: number;
  side: Side;
  concentricStartMs: number;
  concentricEndMs: number;
  peakVelocityMps: number;
  timeToPeakMs: number;
  trackingQuality: number;
  phaseTimestamps: Record<SnatchPhase, number>;
}

export interface SetMetrics {
  setIndex: number;
  repCount: number;
  bestVelocityMps: number;
  avgVelocityMps: number;
  velocityDropPct: number;
  alerts: Alert[];
}

// ============================================================
// Alerts
// ============================================================

export type AlertType = 
  | 'velocity_drop'
  | 'tracking_lost'
  | 'calibration_poor'
  | 'returns_met';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  timestampMs: number;
  evidence?: {
    velocityDropPct?: number;
    confidence?: number;
    trackingQuality?: number;
  };
}

// ============================================================
// Session Data
// ============================================================

export interface SessionData {
  id: string;
  datetime: Date;
  movement: Movement;
  mode: SessionMode;
  heightInches: number;
  calibrationQuality: CalibrationQuality;
  pxPerMeter: number;
  bestPeakVelocityMps: number;
  avgPeakVelocityMps: number;
  velocityDropPct: number;
  returnsMetFlag: boolean;
  returnsMetAtMs?: number;
  notes?: string;
  modelVersion: string;
  sets: SetMetrics[];
  reps: RepMetrics[];
  alerts: Alert[];
}

// ============================================================
// UI State
// ============================================================

export type Screen = 'select' | 'setup' | 'live' | 'upload' | 'summary';

export interface OverlayState {
  phase: SnatchPhase;
  phaseConfidence: number;
  side: Side;
  sideLocked: boolean;
  sideConfidence: number;
  currentVelocity: number;
  peakVelocity: number;
  repCount: number;
  setCount: number;
  alert: Alert | null;
  fps: number;
  trackingConfidence: ConfidenceLevel;
}

export interface UIState {
  currentScreen: Screen;
  isLoading: boolean;
  isProcessing: boolean;
  error: string | null;
  debugMode: boolean;
}

// ============================================================
// Video Ingest
// ============================================================

export interface VideoIngestConfig {
  targetFps: 60 | 30;
  fallbackFps: 30;
  facingMode: 'user' | 'environment';
}

export interface VideoIngestState {
  isActive: boolean;
  actualFps: number;
  frameCount: number;
  droppedFrames: number;
  lastFrameTimestamp: number;
}
