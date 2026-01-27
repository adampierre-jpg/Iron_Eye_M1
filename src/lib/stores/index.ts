// ============================================================
// Iron Eye — Svelte Stores
// ============================================================

import { writable, derived, get } from 'svelte/store';
import type {
  SessionConfig,
  SessionData,
  CalibrationData,
  OverlayState,
  UIState,
  Screen,
  Movement,
  SessionMode,
  SnatchPhase,
  Side,
  Alert,
  ConfidenceLevel,
  CalibrationQuality,
  VideoIngestState
} from '$lib/types';

// ============================================================
// Session Configuration Store
// ============================================================

const defaultSessionConfig: SessionConfig = {
  movement: 'snatch',
  mode: 'live',
  formEvalEnabled: false,
  notionExportEnabled: false,
  loadKg: undefined,
  notes: undefined
};

function createSessionConfigStore() {
  const { subscribe, set, update } = writable<SessionConfig>(defaultSessionConfig);

  return {
    subscribe,
    setMovement: (movement: Movement) => update(s => ({ ...s, movement })),
    setMode: (mode: SessionMode) => update(s => ({ ...s, mode })),
    setFormEval: (enabled: boolean) => update(s => ({ ...s, formEvalEnabled: enabled })),
    setNotionExport: (enabled: boolean) => update(s => ({ ...s, notionExportEnabled: enabled })),
    setLoad: (loadKg: number | undefined) => update(s => ({ ...s, loadKg })),
    setNotes: (notes: string | undefined) => update(s => ({ ...s, notes })),
    reset: () => set(defaultSessionConfig)
  };
}

export const sessionConfig = createSessionConfigStore();

// ============================================================
// Calibration Store
// ============================================================

const defaultCalibration: CalibrationData = {
  heightInches: 70, // 5'10" default
  pxPerMeter: 0,
  quality: 'none',
  sideLocked: false,
  side: null,
  timestamp: 0
};

function createCalibrationStore() {
  const { subscribe, set, update } = writable<CalibrationData>(defaultCalibration);

  return {
    subscribe,
    setHeight: (heightInches: number) => {
      update(c => ({ ...c, heightInches }));
    },
    setPxPerMeter: (pxPerMeter: number, quality: CalibrationQuality) => {
      update(c => ({
        ...c,
        pxPerMeter,
        quality,
        timestamp: Date.now()
      }));
    },
    lockSide: (side: Side) => {
      update(c => ({
        ...c,
        sideLocked: true,
        side,
        timestamp: Date.now()
      }));
    },
    unlockSide: () => {
      update(c => ({
        ...c,
        sideLocked: false,
        side: null
      }));
    },
    reset: () => set(defaultCalibration)
  };
}

export const calibration = createCalibrationStore();

// ============================================================
// Overlay State Store (real-time UI updates)
// ============================================================

const defaultOverlay: OverlayState = {
  phase: 'STANDING',
  phaseConfidence: 0,
  side: null,
  sideLocked: false,
  sideConfidence: 0,
  currentVelocity: 0,
  peakVelocity: 0,
  repCount: 0,
  setCount: 1,
  alert: null,
  fps: 0,
  trackingConfidence: 'lost'
};

function createOverlayStore() {
  const { subscribe, set, update } = writable<OverlayState>(defaultOverlay);

  return {
    subscribe,
    updatePhase: (phase: SnatchPhase, confidence: number) => {
      update(o => ({ ...o, phase, phaseConfidence: confidence }));
    },
    updateSide: (side: Side, locked: boolean, confidence: number) => {
      update(o => ({
        ...o,
        side,
        sideLocked: locked,
        sideConfidence: confidence
      }));
    },
    updateVelocity: (current: number, peak: number) => {
      update(o => ({
        ...o,
        currentVelocity: current,
        peakVelocity: peak
      }));
    },
    incrementRep: () => {
      update(o => ({ ...o, repCount: o.repCount + 1 }));
    },
    incrementSet: () => {
      update(o => ({
        ...o,
        setCount: o.setCount + 1,
        repCount: 0,
        peakVelocity: 0
      }));
    },
    setAlert: (alert: Alert | null) => {
      update(o => ({ ...o, alert }));
    },
    updateFps: (fps: number) => {
      update(o => ({ ...o, fps }));
    },
    updateTracking: (confidence: ConfidenceLevel) => {
      update(o => ({ ...o, trackingConfidence: confidence }));
    },
    reset: () => set(defaultOverlay)
  };
}

export const overlay = createOverlayStore();

// ============================================================
// UI State Store
// ============================================================

const defaultUI: UIState = {
  currentScreen: 'select',
  isLoading: false,
  isProcessing: false,
  error: null,
  debugMode: false
};

function createUIStore() {
  const { subscribe, set, update } = writable<UIState>(defaultUI);

  return {
    subscribe,
    setScreen: (screen: Screen) => update(u => ({ ...u, currentScreen: screen })),
    setLoading: (loading: boolean) => update(u => ({ ...u, isLoading: loading })),
    setProcessing: (processing: boolean) => update(u => ({ ...u, isProcessing: processing })),
    setError: (error: string | null) => update(u => ({ ...u, error })),
    toggleDebug: () => update(u => ({ ...u, debugMode: !u.debugMode })),
    reset: () => set(defaultUI)
  };
}

export const ui = createUIStore();

import { videoIngest } from './videoIngest.svelte';
import { telemetry } from './telemetry.svelte';

export { videoIngest, telemetry };

// ============================================================
// Session Data Store (for summary/export)
// ============================================================

const defaultSessionData: SessionData | null = null;

function createSessionDataStore() {
  const { subscribe, set, update } = writable<SessionData | null>(defaultSessionData);

  return {
    subscribe,
    initialize: (config: SessionConfig, calibrationData: CalibrationData) => {
      const session: SessionData = {
        id: crypto.randomUUID(),
        datetime: new Date(),
        movement: config.movement,
        mode: config.mode,
        heightInches: calibrationData.heightInches,
        calibrationQuality: calibrationData.quality,
        pxPerMeter: calibrationData.pxPerMeter,
        bestPeakVelocityMps: 0,
        avgPeakVelocityMps: 0,
        velocityDropPct: 0,
        returnsMetFlag: false,
        notes: config.notes,
        modelVersion: '1.0.0-cnn',
        sets: [],
        reps: [],
        alerts: []
      };
      set(session);
    },
    clear: () => set(null),
    get: () => get({ subscribe })
  };
}

export const sessionData = createSessionDataStore();

// ============================================================
// Derived Stores
// ============================================================

// Combined calibration status
export const calibrationStatus = derived(
  calibration,
  ($calibration) => ({
    isCalibrated: $calibration.quality !== 'none',
    isReady: $calibration.quality === 'good' || $calibration.quality === 'ok',
    qualityLabel: {
      good: 'Good',
      ok: 'OK',
      poor: 'Poor',
      none: 'Not Calibrated'
    }[$calibration.quality]
  })
);

// Side lock status for UI
export const sideLockStatus = derived(
  calibration,
  ($calibration) => ({
    isLocked: $calibration.sideLocked,
    side: $calibration.side,
    label: $calibration.sideLocked 
      ? `Locked ${$calibration.side}` 
      : 'Waiting...'
  })
);

// Tracking quality for UI
export const trackingStatus = derived(
  overlay,
  ($overlay) => ({
    confidence: $overlay.trackingConfidence,
    isTracking: $overlay.trackingConfidence !== 'lost',
    label: {
      high: 'Tracking',
      medium: 'Tracking',
      low: 'Low Confidence',
      lost: 'No Tracking'
    }[$overlay.trackingConfidence],
    color: {
      high: 'var(--color-copper)',
      medium: 'var(--color-copper)',
      low: 'var(--color-oxblood)',
      lost: 'var(--color-muted)'
    }[$overlay.trackingConfidence]
  })
);
