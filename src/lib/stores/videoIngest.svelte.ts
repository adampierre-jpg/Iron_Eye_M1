// src/lib/stores/videoIngest.svelte.ts
class VideoIngestStore {
    isActive = $state(false);
    isPlaying = $state(false);
    actualFps = $state(0);
    frameCount = $state(0);
    droppedFrames = $state(0);
}

export const videoIngest = new VideoIngestStore();