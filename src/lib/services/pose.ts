// src/lib/services/pose.ts
import { browser } from '$app/environment';
import type { Results } from '@mediapipe/pose'; // Type-only import is safe
import type { PoseResult, Keypoint } from '$lib/types';

class PoseDetectorService {
  private detector: any = null;
  private isReady = false;
  private lastFrameTime = 0;

  async initialize(): Promise<boolean> {
    if (!browser) return false;
    if (this.isReady) return true;

    try {
      console.log('⏳ [PoseService] Loading MediaPipe dynamically...');
      
      const mpModule = await import('@mediapipe/pose');
      console.log('📦 [PoseService] Keys:', Object.keys(mpModule)); // Debugging aid

      // AGGRESSIVE SEARCH STRATEGY
      // 1. Check Standard Named Export
      let PoseConstructor = mpModule.Pose;
      
      // 2. Check Default Export (CommonJS Interop)
      if (!PoseConstructor && (mpModule as any).default) {
        PoseConstructor = (mpModule as any).default.Pose || (mpModule as any).default;
      }

      // 3. Fallback: Check Global Scope (Window)
      // Sometimes Vite puts it on window.Pose or window.MediaPipe
      if (!PoseConstructor && (window as any).Pose) {
         console.warn('⚠️ [PoseService] Found Pose on window object.');
         PoseConstructor = (window as any).Pose;
      }

      if (!PoseConstructor) {
        throw new Error(`Could not find "Pose" constructor. Available keys: ${Object.keys(mpModule).join(', ')}`);
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

  // ... rest of the file (process, normalizeResults, getEmptyResult) remains identical ...
  // (Paste the existing process/normalize logic here)

  async process(input: HTMLVideoElement): Promise<PoseResult> {
    if (!this.detector || !this.isReady) return this.getEmptyResult();
    
    return new Promise((resolve) => {
      this.detector.onResults((results: Results) => {
        resolve(this.normalizeResults(results));
      });
      this.detector.send({ image: input });
    });
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