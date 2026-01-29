// src/lib/stores/index.ts
// ============================================================
// Iron Eye — Svelte Stores
// ============================================================

import { writable, derived, get } from 'svelte/store';
import type {
  SessionConfig,
  SessionData,
  CalibrationData,
  UIState,
  Screen,
  Movement,
  SessionMode,
  Side,
  CalibrationQuality,
  PoseResult
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
  pxPerMeter: 0,    // Actually "Normalized Units per Meter"
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
    // The "Subject as Ruler" Logic
    calibrateFromPose: (pose: PoseResult) => {
        update(c => {
            const kp = pose.keypoints;
            if (kp.length < 33) return c; // Safety

            // 1. Get Measurements (Nose to Ankle)
            // Nose = 0, Left Ankle = 27, Right Ankle = 28
            const nose = kp[0];
            const leftAnkle = kp[27];
            const rightAnkle = kp[28];
            
            // Use average ankle height
            const ankleY = (leftAnkle.y + rightAnkle.y) / 2;
            const noseY = nose.y;
            
            // Normalized height (0.0 - 1.0 range)
            const measuredHeightUnits = Math.abs(ankleY - noseY);
            
            // 2. Add Head Offset
            // Nose-to-Ankle is roughly 90% of total height.
            // Full Height = measured / 0.90
            const fullBodyUnits = measuredHeightUnits / 0.90;

            // 3. Convert User Height to Meters
            const userHeightMeters = c.heightInches * 0.0254;

            // 4. Calculate Scale: Units Per Meter
            // e.g. If user is 1.8m and takes up 0.5 of screen, Scale = 0.5 / 1.8 = 0.277 units/m
            const unitsPerMeter = fullBodyUnits / userHeightMeters;

            return {
                ...c,
                pxPerMeter: unitsPerMeter,
                quality: pose.confidence > 0.8 ? 'good' : 'ok',
                timestamp: Date.now()
            };
        });
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

// ============================================================
// Rune Stores (Svelte 5)
// ============================================================

import { videoIngest } from './videoIngest.svelte';
import { telemetry } from './telemetry.svelte';
import { overlay } from './overlay.svelte'; // ✅ ADDED THIS

export { videoIngest, telemetry, overlay }; // ✅ EXPORTED THIS

// ============================================================
// Session Data Store
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