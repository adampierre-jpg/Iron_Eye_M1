// src/lib/services/videoIngest.ts
import { overlay } from '$lib/stores/overlay.svelte'; // ✅ DIRECT IMPORT
import { videoIngest } from '$lib/stores/videoIngest.svelte'; // ✅ DIRECT IMPORT
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

  async initialize(video: HTMLVideoElement, callback: FrameCallback): Promise<boolean> {
    if (!video) return false;

    this.videoElement = video;
    this.onFrame = callback;

    console.log('🔌 [VideoIngest] Initializing services...');
    
    const poseReady = await poseService.initialize();
    analysisService.initialize();

    if (!poseReady) {
      console.error('❌ [VideoIngest] PoseService failed.');
      return false;
    }
    
    return true;
  }

  startFrameLoop() {
    if (this.isActive || !this.videoElement) return;
    
    this.isActive = true;
    videoIngest.isActive = true; 
    videoIngest.isPlaying = true;
    
    console.log('▶️ [VideoIngest] Loop started.');
    this.loop();
  }

  stopFrameLoop() {
    this.isActive = false;
    videoIngest.isActive = false;
    videoIngest.isPlaying = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

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

  private async processFrame() {
    if (!this.videoElement || !this.onFrame) return;

    this.isProcessingFrame = true;
    try {
      // 1. Get Pose
      const result = await poseService.process(this.videoElement);
      
      // 2. Run AI Analysis
      const currentPhase = await analysisService.process(result);
      
      // 3. Update HUD Store (The Critical Wiring)
      if (currentPhase) {
          // Debug log to confirm AI is firing (Check console if HUD stays '---')
          if (overlay.phase !== currentPhase) {
             console.log(`Update Phase: ${currentPhase}`); 
          }
          overlay.phase = currentPhase;
      }
      
      // 4. Update Telemetry
      videoIngest.actualFps = result.fps;
      videoIngest.frameCount++;

      // 5. Draw
      this.onFrame(result);
      
    } catch (err) {
      console.error('Frame Error:', err);
    } finally {
      this.isProcessingFrame = false;
    }
  }
}

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