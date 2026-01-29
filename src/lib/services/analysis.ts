// src/lib/services/analysis.ts
import { featureBuilder } from '$lib/engine/features';
import { PhaseClassifier } from '$lib/engine/phaseClassifier'; 
import { snatchSession } from '$lib/engine/snatchLogic'; // <--- NEW ENGINE
import { overlay } from '$lib/stores'; // Direct store update for speed
import type { PoseResult, SnatchPhase } from '$lib/types';
import { browser } from '$app/environment';

class AnalysisService {
  private classifier: PhaseClassifier;
  private isReady = false;

  public currentPhase: SnatchPhase = 'STANDING';

  constructor() {
    this.classifier = new PhaseClassifier();
  }

  async initialize(): Promise<void> {
    if (!browser) return;
    if (this.isReady) return;

    try {
      console.log('🧠 [Analysis] Loading ONNX Model...');
      await this.classifier.load(
        '/models/snatch_cnn_v4.onnx',
        '/models/config.json'
      );
      this.isReady = true;
      console.log('✅ [Analysis] Brain is online.');
    } catch (e) {
      console.error('❌ [Analysis] Failed to load model:', e);
    }
  }

  /**
   * Process a single frame.
   */
  async process(pose: PoseResult): Promise<SnatchPhase> {
    if (!this.isReady || !pose) return 'STANDING';

    // --------------------------------------------------------
    // 1. INJECT SIDE CONTEXT
    // --------------------------------------------------------
    // Ask the Engine: "Do we have a locked side?"
    const lockedSide = snatchSession.getActiveSide();
    
    // If YES, force the Pose object to carry that side.
    // This ensures featureBuilder extracts limbs from the ACTIVE side.
    if (lockedSide) {
        pose.side = lockedSide;
    }
    // If NO, we leave it null (defaulting to Right in featureBuilder),
    // which is fine for detecting the initial 'HANDONBELL' posture.

    // --------------------------------------------------------
    // 2. EXTRACT FEATURES & CLASSIFY
    // --------------------------------------------------------
    const features = featureBuilder.extract(pose);
    
    if (!features) return this.currentPhase; 

    this.classifier.addFrame(features);
    const newPhase = await this.classifier.classify();
    
    if (newPhase) {
      this.currentPhase = newPhase;
    }

    // --------------------------------------------------------
    // 3. UPDATE ENGINE & STORES
    // --------------------------------------------------------
    // Pull velocity (feature index 9) to pass to the engine
    const velocityMps = features[9] || 0;

    // Run the Referee Logic
    const sessionState = snatchSession.update(this.currentPhase, pose, velocityMps);

    // Sync to UI (Rune Store)
    overlay.phase = this.currentPhase;
    overlay.repCount = sessionState.repCount;
    overlay.currentVelocity = sessionState.currentVelocity;
    overlay.peakVelocity = sessionState.peakVelocity;
    
    // Confidence indicator
    overlay.trackingConfidence = (pose.confidence > 0.6) ? 'high' : 'low';
    
    // Optional: Update alert banner if the Engine has feedback
    if (sessionState.feedback && sessionState.feedback !== 'READY') {
         // You can wire this to overlay.alert if you want text updates on screen
    }

    return this.currentPhase;
  }

  reset() {
    this.currentPhase = 'STANDING';
    snatchSession.reset();
    overlay.reset();
  }
}

export const analysisService = new AnalysisService();