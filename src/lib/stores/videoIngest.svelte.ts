// src/lib/stores/videoIngest.svelte.ts
import type { VideoIngestState } from '$lib/types';

// Use $state for Svelte 5 rune-based store
const initialVideoIngestState: VideoIngestState = {
  isActive: false,
  actualFps: 0,
  frameCount: 0,
  droppedFrames: 0,
  lastFrameTimestamp: 0,
};

export const videoIngest = $state(initialVideoIngestState);