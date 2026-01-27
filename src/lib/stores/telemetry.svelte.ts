// src/lib/stores/telemetry.svelte.ts
import type { TelemetryState } from '$lib/types';

const initialTelemetryState: TelemetryState = {
  videoFps: 0,
  poseFps: 0,
  inferenceTimeMs: 0,
  processingTimeMs: 0,
  totalProcessingTimeMs: 0,
  lastVideoTimestamp: 0,
  lastPoseTimestamp: 0,
  lastInferenceTimestamp: 0,
  frameQueueSize: 0,
};

export const telemetry = $state(initialTelemetryState);