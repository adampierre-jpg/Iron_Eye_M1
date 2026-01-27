// ============================================================
// Iron Eye — Video Ingest Service
// ============================================================
// Handles both live camera streams and uploaded video playback
// Produces uniform frame data for downstream processing

import type { FrameData, VideoIngestConfig } from '$lib/types';
import { videoIngest } from '$lib/stores';

export class VideoIngestService {
  private videoElement: HTMLVideoElement | null = null;
  private stream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isRunning = false;
  private frameCallback: ((frame: FrameData) => void) | null = null;
  
  // FPS tracking
  private frameTimestamps: number[] = [];
  private fpsUpdateInterval: number | null = null;
  private frameIndex = 0;
  
  // Configuration
  private config: VideoIngestConfig = {
    targetFps: 60,
    fallbackFps: 30,
    facingMode: 'environment' // Back camera for kettlebell tracking
  };

  constructor(config?: Partial<VideoIngestConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // ============================================================
  // Live Camera Mode
  // ============================================================

  async initializeLiveCamera(
    videoElement: HTMLVideoElement,
    onFrame: (frame: FrameData) => void
  ): Promise<boolean> {
    this.videoElement = videoElement;
    this.frameCallback = onFrame;

    try {
      // Request camera with target fps
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: this.config.facingMode,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: this.config.targetFps, min: this.config.fallbackFps }
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Check actual capabilities
      const track = this.stream.getVideoTracks()[0];
      const settings = track.getSettings();
      const actualFps = settings.frameRate || this.config.fallbackFps;
      
      console.log(`[VideoIngest] Camera initialized: ${settings.width}x${settings.height} @ ${actualFps}fps`);
      
      // Attach stream to video element
      this.videoElement.srcObject = this.stream;
      this.videoElement.playsInline = true;
      this.videoElement.muted = true;
      
      // Wait for video to be ready
      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) return reject('No video element');
        
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play()
            .then(() => resolve())
            .catch(reject);
        };
        
        this.videoElement.onerror = () => reject('Video load error');
        
        // Timeout after 5 seconds
        setTimeout(() => reject('Camera start timeout'), 5000);
      });

      videoIngest.setActive(true);
      videoIngest.updateFps(actualFps);
      
      return true;
    } catch (error) {
      console.error('[VideoIngest] Camera initialization failed:', error);
      videoIngest.setActive(false);
      return false;
    }
  }

  // ============================================================
  // Upload Video Mode
  // ============================================================

  async initializeUploadVideo(
    videoElement: HTMLVideoElement,
    videoFile: File,
    onFrame: (frame: FrameData) => void
  ): Promise<boolean> {
    this.videoElement = videoElement;
    this.frameCallback = onFrame;

    try {
      // Create object URL for video file
      const objectUrl = URL.createObjectURL(videoFile);
      
      this.videoElement.src = objectUrl;
      this.videoElement.playsInline = true;
      this.videoElement.controls = true; // Native controls for upload mode
      this.videoElement.loop = true;
      
      // Wait for video metadata
      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) return reject('No video element');
        
        this.videoElement.onloadedmetadata = () => {
          console.log(
            `[VideoIngest] Video loaded: ${this.videoElement!.videoWidth}x${this.videoElement!.videoHeight}`
          );
          resolve();
        };
        
        this.videoElement.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject('Video load error');
        };
        
        setTimeout(() => reject('Video load timeout'), 10000);
      });

      videoIngest.setActive(true);
      
      // Estimate FPS from video (default to 60 if unknown)
      // Note: Getting actual video FPS requires parsing the file
      videoIngest.updateFps(60);
      
      return true;
    } catch (error) {
      console.error('[VideoIngest] Video initialization failed:', error);
      videoIngest.setActive(false);
      return false;
    }
  }

  // ============================================================
  // Frame Loop
  // ============================================================

  startFrameLoop(): void {
    if (this.isRunning || !this.videoElement) return;
    
    this.isRunning = true;
    this.frameIndex = 0;
    this.frameTimestamps = [];
    
    // Start FPS tracking interval
    this.fpsUpdateInterval = window.setInterval(() => {
      this.updateFpsCounter();
    }, 1000);
    
    // Start animation frame loop
    this.processFrame();
  }

  private processFrame = (): void => {
    if (!this.isRunning || !this.videoElement || !this.frameCallback) {
      return;
    }

    const now = performance.now();
    
    // Only process if video is playing and has valid dimensions
    if (
      !this.videoElement.paused &&
      !this.videoElement.ended &&
      this.videoElement.readyState >= 2 &&
      this.videoElement.videoWidth > 0
    ) {
      // Track frame timing
      this.frameTimestamps.push(now);
      
      // Build frame data
      const frameData: FrameData = {
        timestampMs: now,
        frameIndex: this.frameIndex,
        imageWidth: this.videoElement.videoWidth,
        imageHeight: this.videoElement.videoHeight,
        videoElement: this.videoElement
      };
      
      // Send to callback
      this.frameCallback(frameData);
      
      // Update store
      videoIngest.incrementFrame(now);
      this.frameIndex++;
    }
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  private updateFpsCounter(): void {
    const now = performance.now();
    const oneSecondAgo = now - 1000;
    
    // Filter to only timestamps from the last second
    this.frameTimestamps = this.frameTimestamps.filter(t => t > oneSecondAgo);
    
    const fps = this.frameTimestamps.length;
    videoIngest.updateFps(fps);
  }

  stopFrameLoop(): void {
    this.isRunning = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    if (this.fpsUpdateInterval) {
      clearInterval(this.fpsUpdateInterval);
      this.fpsUpdateInterval = null;
    }
  }

  // ============================================================
  // Cleanup
  // ============================================================

  destroy(): void {
    this.stopFrameLoop();
    
    // Stop camera stream if active
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    // Revoke object URL if it was created
    if (this.videoElement?.src?.startsWith('blob:')) {
      URL.revokeObjectURL(this.videoElement.src);
    }
    
    // Clear video element
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement.src = '';
      this.videoElement = null;
    }
    
    this.frameCallback = null;
    videoIngest.reset();
  }

  // ============================================================
  // Getters
  // ============================================================

  get isActive(): boolean {
    return this.isRunning;
  }

  get currentVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

// Singleton instance for global access
let instance: VideoIngestService | null = null;

export function getVideoIngestService(config?: Partial<VideoIngestConfig>): VideoIngestService {
  if (!instance) {
    instance = new VideoIngestService(config);
  }
  return instance;
}

export function destroyVideoIngestService(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
