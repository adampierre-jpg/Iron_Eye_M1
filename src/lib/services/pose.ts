// src/lib/services/pose.ts
import { browser } from '$app/environment';
import type { Results } from '@mediapipe/pose'; // Type-only import is safe on server
import type { PoseResult, Keypoint } from '$lib/types';

class PoseDetectorService {
  private detector: any = null; // internal instance
  private isReady = false;
  private lastFrameTime = 0;

  async initialize(): Promise<boolean> {
    // 1. Safety check: If we are on the server, STOP.
    if (!browser) return false;
    
    if (this.isReady) return true;

    try {
      console.log('⏳ [PoseService] Loading MediaPipe dynamically...');
      
      // 2. Dynamic Import: This loads the library ONLY when this function runs
      const { Pose } = await import('@mediapipe/pose');

      this.detector = new Pose({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
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