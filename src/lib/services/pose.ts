// src/lib/services/pose.ts
import { browser } from '$app/environment';
import type { Results } from '@mediapipe/pose'; 
import type { PoseResult, Keypoint } from '$lib/types';
import { OneEuroFilter } from '$lib/engine/oneEuro'; // <--- Import

// We track 33 landmarks, each has x, y, z.
// 33 * 3 = 99 filters.
const LANDMARK_COUNT = 33;

class PoseDetectorService {
  private detector: any = null;
  private isReady = false;
  private lastResult: PoseResult | null = null;
  
  // Filter Bank: [landmarkIndex][coordinateIndex (0=x, 1=y, 2=z)]
  private filters: OneEuroFilter[][] = [];

  constructor() {
      this.initFilters();
  }

  private initFilters() {
      this.filters = [];
      for (let i = 0; i < LANDMARK_COUNT; i++) {
          // Matches Python: minCutoff=0.5, beta=0.05
          this.filters.push([
              new OneEuroFilter(0.5, 0.05), // x
              new OneEuroFilter(0.5, 0.05), // y
              new OneEuroFilter(0.5, 0.05)  // z
          ]);
      }
  }

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

      if (!PoseConstructor) throw new Error(`Could not find "Pose" constructor.`);

      this.detector = new PoseConstructor({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
      });

      this.detector.setOptions({
        modelComplexity: 1,
        smoothLandmarks: false, // <--- DISABLE internal smoothing. We are the captain now.
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

  // Reset filters when a new video loads or camera restarts
  public resetFilters() {
      this.filters.forEach(coords => coords.forEach(f => f.reset()));
  }

  async process(input: HTMLVideoElement): Promise<PoseResult> {
    if (!this.detector || !this.isReady) return this.getEmptyResult();
    
    return new Promise((resolve) => {
      this.detector.onResults((results: Results) => {
        const processed = this.normalizeResults(results);
        this.lastResult = processed; 
        resolve(processed);
      });
      this.detector.send({ image: input });
    });
  }

  getLastResult(): PoseResult | null {
    return this.lastResult;
  }

  private normalizeResults(results: Results): PoseResult {
    const now = performance.now();
    // FPS calculation is handled by UI/Stats stores, strictly speaking we just pass timestamp
    // But for "instantaneousFps" in debug, we can keep simple logic if needed.
    
    const keypoints: Keypoint[] = [];

    if (results.poseLandmarks) {
        results.poseLandmarks.forEach((lm, index) => {
            if (index < LANDMARK_COUNT) {
                // Apply Iron Smoothing
                const x = this.filters[index][0].filter(now, lm.x);
                const y = this.filters[index][1].filter(now, lm.y);
                const z = this.filters[index][2].filter(now, lm.z);
                
                keypoints.push({ x, y, z, score: lm.visibility || 0 });
            } else {
                keypoints.push({ x: lm.x, y: lm.y, z: lm.z, score: lm.visibility || 0 });
            }
        });
    }

    return {
      timestamp: now,
      keypoints,
      worldLandmarks: [],
      side: null, 
      isHandOnBell: false,
      fps: 0, // Let the UI calculate smoothed FPS
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