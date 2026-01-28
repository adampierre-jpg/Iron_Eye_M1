// src/lib/services/videoIngest.ts
import { videoIngest, overlay } from '$lib/stores'; // Import the stores
import { poseService } from '$lib/services/pose';
import { analysisService } from '$lib/services/analysis';
import type { PoseResult } from '$lib/types';

type FrameCallback = (result: PoseResult) => void;

class VideoIngestService {
  private videoElement: HTMLVideoElement | null = null;
  private onFrame: FrameCallback | null = null;
  private animationFrameId: number | null = null;
  private isProcessingFrame = false;
  private isActive = false;

  /**
   * Initialize the pipeline
   */
  async initialize(video: HTMLVideoElement, callback: FrameCallback): Promise<boolean> {
    if (!video) return false;

    this.videoElement = video;
    this.onFrame = callback;

    console.log('🔌 [VideoIngest] Initializing services...');
    
    // 1. Init Pose Service
    const poseReady = await poseService.initialize();
    
    // 2. Init AI Brain (Fire and forget, it loads async)
    analysisService.initialize();

    if (!poseReady) {
      console.error('❌ [VideoIngest] PoseService failed.');
      return false;
    }
    
    return true;
  }

  /**
   * Start the Loop
   */
  startFrameLoop() {
    if (this.isActive || !this.videoElement) return;
    
    this.isActive = true;
    videoIngest.isActive = true; // Update store
    videoIngest.isPlaying = true;
    
    console.log('▶️ [VideoIngest] Loop started.');
    this.loop();
  }

  /**
   * Stop the Loop
   */
  stopFrameLoop() {
    this.isActive = false;
    videoIngest.isActive = false; // Update store
    videoIngest.isPlaying = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * The Heartbeat
   */
  private loop = () => {
    if (!this.isActive) return;
    this.animationFrameId = requestAnimationFrame(this.loop);

    if (this.isProcessingFrame) {
      videoIngest.droppedFrames++;
      return;
    }

    if (this.videoElement && !this.videoElement.paused && !this.videoElement.ended) {
      this.processFrame();
    }
  };

  /**
   * The Brain (Logic)
   */
  private async processFrame() {
    if (!this.videoElement || !this.onFrame) return;

    this.isProcessingFrame = true;
    try {
      // 1. Get Pose
      const result = await poseService.process(this.videoElement);
      
      // 2. Run AI Analysis (Get 'PULL', 'LOCKOUT', etc.)
      const currentPhase = await analysisService.process(result);
      
      // 3. Update HUD Store
      if (currentPhase) {
          overlay.phase = currentPhase;
      }
      
      // 4. Update Telemetry Store
      videoIngest.actualFps = result.fps;
      videoIngest.frameCount++;

      // 5. Draw to Canvas (Callback to UI)
      this.onFrame(result);
      
    } catch (err) {
      console.error('Frame Error:', err);
    } finally {
      this.isProcessingFrame = false;
    }
  }
}

// Singleton Export
let instance: VideoIngestService | null = null;

export function getVideoIngestService(): VideoIngestService {
  if (!instance) instance = new VideoIngestService();
  return instance;
}

export function destroyVideoIngestService() {
  if (instance) {
    instance.stopFrameLoop();
    instance = null;
  }
}