// src/lib/services/pose.ts
import { browser } from '$app/environment';
import type { Results } from '@mediapipe/pose'; 
import type { PoseResult, Keypoint } from '$lib/types';

class PoseDetectorService {
  private detector: any = null;
  private isReady = false;
  private lastFrameTime = 0;
  private lastResult: PoseResult | null = null; // Stored for calibration access

  async initialize(): Promise<boolean> {
    if (!browser) return false;
    if (this.isReady) return true;

    try {
      console.log('⏳ [PoseService] Loading MediaPipe dynamically...');
      
      const mpModule = await import('@mediapipe/pose');
      
      let PoseConstructor = mpModule.Pose;
      if (!PoseConstructor && (mpModule as any).default) {
        PoseConstructor = (mpModule as any).default.Pose || (mpModule as any).default;
      }
      if (!PoseConstructor && (window as any).Pose) {
         PoseConstructor = (window as any).Pose;
      }

      if (!PoseConstructor) {
        throw new Error(`Could not find "Pose" constructor.`);
      }

      this.detector = new PoseConstructor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      this.detector.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      await this.detector.initialize();
      this.isReady = true;
      console.log('✅ [PoseService] MediaPipe initialized');
      return true;
    } catch (e) {
      console.error('❌ [PoseService] Initialization failed', e);
      return false;
    }
  }

  async process(input: HTMLVideoElement): Promise<PoseResult> {
    if (!this.detector || !this.isReady) return this.getEmptyResult();
    
    return new Promise((resolve) => {
      this.detector.onResults((results: Results) => {
        const processed = this.normalizeResults(results);
        this.lastResult = processed; // Store for synchronous access
        resolve(processed);
      });
      this.detector.send({ image: input });
    });
  }

  /**
   * Helper for UI components (like Calibration) to grab the latest data 
   * without waiting for the next frame loop.
   */
  getLastResult(): PoseResult | null {
    return this.lastResult;
  }

  private normalizeResults(results: Results): PoseResult {
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;
    const instantaneousFps = dt > 0 ? 1000 / dt : 0;

    const keypoints: Keypoint[] = results.poseLandmarks 
      ? results.poseLandmarks.map((lm, index) => ({
          x: lm.x, y: lm.y, z: lm.z, score: lm.visibility || 0
        })) 
      : [];
    
    // TODO: Implement robust Side Detection here later
    // For now, we return null and let FeatureBuilder default to Right
    
    return {
      timestamp: now,
      keypoints,
      worldLandmarks: [],
      side: null, 
      isHandOnBell: false,
      fps: Math.round(instantaneousFps),
      confidence: keypoints[0]?.score || 0
    };
  }

  private getEmptyResult(): PoseResult {
    return {
      timestamp: 0, keypoints: [], worldLandmarks: [], 
      side: null, isHandOnBell: false, fps: 0, confidence: 0
    };
  }
}

export const poseService = new PoseDetectorService();