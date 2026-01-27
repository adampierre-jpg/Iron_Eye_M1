// src/lib/services/videoIngest.ts
import { videoIngest } from '$lib/stores'; // Your existing Svelte 5 store
import { poseService } from '$lib/services/pose';
import type { PoseResult } from '$lib/types';

type FrameCallback = (result: PoseResult) => void;

class VideoIngestService {
  private videoElement: HTMLVideoElement | null = null;
  private onFrame: FrameCallback | null = null;
  private animationFrameId: number | null = null;
  private isActive = false;
  
  // Concurrency Lock: Prevents stacking inference calls if the model is slow
  private isProcessingFrame = false;

  constructor() {
    // Singleton initialization if needed
  }

  /**
   * connect the service to the DOM video element and prepare the pipeline.
   */
  async initialize(
    video: HTMLVideoElement, 
    callback: FrameCallback
  ): Promise<boolean> {
    if (!video) {
      console.error('❌ [VideoIngest] No video element provided.');
      return false;
    }

    this.videoElement = video;
    this.onFrame = callback;

    // Initialize the Pose Model (Lazy load)
    const poseReady = await poseService.initialize();
    if (!poseReady) {
      console.error('❌ [VideoIngest] PoseService failed to initialize.');
      return false;
    }

    console.log('✅ [VideoIngest] Service initialized and linked.');
    return true;
  }

  /**
   * Starts the processing loop.
   */
  startFrameLoop() {
    if (this.isActive) return;
    if (!this.videoElement) {
      console.warn('⚠️ [VideoIngest] Cannot start loop: No video element.');
      return;
    }

    this.isActive = true;
    videoIngest.isPlaying = true; // Update store
    
    console.log('▶️ [VideoIngest] Loop started.');
    this.loop();
  }

  /**
   * Stops the processing loop.
   */
  stopFrameLoop() {
    this.isActive = false;
    videoIngest.isPlaying = false; // Update store
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log('xc [VideoIngest] Loop stopped.');
  }

  /**
   * The Main Heartbeat (60Hz target)
   */
  private loop = () => {
    if (!this.isActive || !this.videoElement) return;

    // Schedule next frame immediately to maintain cadence
    this.animationFrameId = requestAnimationFrame(this.loop);

    // 1. Throttle: If previous frame is still crunching, skip this tick.
    // This prevents "Death Spirals" on low-end devices.
    if (this.isProcessingFrame) {
      // Optional: Count dropped frames in a store for debugging
      return;
    }

    // 2. Video State Check: Don't process if video is paused or buffering
    if (this.videoElement.paused || this.videoElement.ended) {
       // We might want to process one last frame if paused, but for now skip.
       return;
    }

    this.processFrame();
  };

  /**
   * Isolated logic for handling a single frame
   */
  private async processFrame() {
    if (!this.videoElement || !this.onFrame) return;

    this.isProcessingFrame = true;
    const startTime = performance.now();

    try {
      // A. INFERENCE: Send image to MediaPipe
      const result: PoseResult = await poseService.process(this.videoElement);
      
      // B. CALLBACK: Send data back to UI (Canvas drawing, Telemetry)
      this.onFrame(result);

      // C. TELEMETRY: Update FPS stats in the Svelte Store
      // (Simple moving average could be added here if the store doesn't handle it)
      const duration = performance.now() - startTime;
      videoIngest.actualFps = result.fps; // Use the FPS calculated by PoseService

    } catch (err) {
      console.error('Error processing frame:', err);
      this.stopFrameLoop(); // Safety stop
    } finally {
      this.isProcessingFrame = false;
    }
  }
}

// Singleton Export
let instance: VideoIngestService | null = null;

export function getVideoIngestService(): VideoIngestService {
  if (!instance) {
    instance = new VideoIngestService();
  }
  return instance;
}

export function destroyVideoIngestService() {
  if (instance) {
    instance.stopFrameLoop();
    instance = null;
  }
}