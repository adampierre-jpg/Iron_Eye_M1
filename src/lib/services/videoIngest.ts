// src/lib/services/videoIngest.ts
import { overlay } from '$lib/stores/overlay.svelte'; 
import { videoIngest } from '$lib/stores/videoIngest.svelte'; 
import { poseService } from '$lib/services/pose';
import { analysisService } from '$lib/services/analysis';
import type { PoseResult } from '$lib/types';

type FrameCallback = (result: PoseResult) => void;

// Add this interface to match what +page.svelte is sending
interface VideoOptions {
    targetFps?: number;
    facingMode?: 'user' | 'environment';
}

class VideoIngestService {
  private videoElement: HTMLVideoElement | null = null;
  private onFrame: FrameCallback | null = null;
  private animationFrameId: number | null = null;
  private isProcessingFrame = false;
  private isActive = false;
  private stream: MediaStream | null = null; // Track the stream to clean up later

  // Updated signature to accept Options
  async initialize(
      video: HTMLVideoElement, 
      callback: FrameCallback, 
      options: VideoOptions = {}
  ): Promise<boolean> {
    if (!video) return false;

    this.videoElement = video;
    this.onFrame = callback;

    console.log('🔌 [VideoIngest] Starting Ignition...');

    try {
        // 1. IGNITION: Get Camera Stream
        // Use 'environment' (rear) by default for kettlebells, 'user' for testing
        const mode = options.facingMode || 'environment'; 
        
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: mode,
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: options.targetFps || 60 }
            }
        });

        // 2. Attach Stream to Video Element
        this.videoElement.srcObject = this.stream;
        
        // Wait for video to actually be ready
        await new Promise<void>((resolve) => {
            if (!this.videoElement) return resolve();
            this.videoElement.onloadedmetadata = () => {
                this.videoElement?.play().then(() => resolve());
            };
        });

        console.log('📸 [VideoIngest] Camera rolling.');

        // 3. Initialize AI Services
        const poseReady = await poseService.initialize();
        analysisService.initialize();

        if (!poseReady) {
            console.error('❌ [VideoIngest] PoseService failed.');
            return false;
        }
        
        return true;

    } catch (err) {
        console.error('❌ [VideoIngest] Camera permission denied or error:', err);
        return false;
    }
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

    // Stop the camera stream to release the hardware light
    if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
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
      
      // 3. Update HUD Store
      if (currentPhase) {
          if (overlay.phase !== currentPhase) {
             // console.log(`Update Phase: ${currentPhase}`); 
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