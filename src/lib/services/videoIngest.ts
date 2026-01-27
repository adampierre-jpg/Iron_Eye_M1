// src/lib/services/videoIngest.ts
import { get, writable } from 'svelte/store';
import { videoIngest } from '$lib/stores';
import type { FrameData } from '$lib/types';

class VideoIngestService {
  private videoElement: HTMLVideoElement | null = null;
  private animationFrameId: number | null = null;
  private onFrameCallback: ((frame: FrameData) => void) | null = null;
  private lastFrameTime = 0;

  /**
   * Initializes the service with a video element and file
   */
  async initializeUploadVideo(
    video: HTMLVideoElement, 
    file: File, 
    callback: (frame: FrameData) => void
  ): Promise<boolean> {
    this.videoElement = video;
    this.onFrameCallback = callback;

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        videoIngest.update(s => ({
          ...s,
          width: video.videoWidth,
          height: video.videoHeight,
          status: 'ready'
        }));
        resolve(true);
      };
      
      video.onerror = () => {
        console.error("Video loading error");
        resolve(false);
      };
    });
  }

  /**
   * Starts the requestAnimationFrame loop
   */
  startFrameLoop() {
    if (this.animationFrameId) return;
    
    const loop = (now: number) => {
      if (!this.videoElement || this.videoElement.paused || this.videoElement.ended) {
        this.animationFrameId = requestAnimationFrame(loop);
        return;
      }

      // Calculate FPS for the store
      const deltaTime = now - this.lastFrameTime;
      if (deltaTime > 0) {
        const currentFps = 1000 / deltaTime;
        videoIngest.update(s => ({ ...s, actualFps: Math.round(currentFps) }));
      }
      this.lastFrameTime = now;

      // Create dummy/placeholder frame data for Milestone 1
      // In Milestone 2+, this is where your AI/Vision logic would run
      const mockFrame: FrameData = {
        timestamp: this.videoElement.currentTime,
        keypoints: [],
        metrics: { velocity: 0 }
      };

      if (this.onFrameCallback) {
        this.onFrameCallback(mockFrame);
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
    videoIngest.update(s => ({ ...s, isProcessing: true }));
  }

  stopFrameLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    videoIngest.update(s => ({ ...s, isProcessing: false }));
  }
}

// Singleton Pattern
let instance: VideoIngestService | null = null;

export function getVideoIngestService() {
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