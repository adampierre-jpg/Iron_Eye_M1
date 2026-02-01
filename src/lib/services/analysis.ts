// src/lib/services/analysis.ts
import { featureBuilder } from '$lib/engine/features';
import { PhaseClassifier } from '$lib/engine/phaseClassifier'; 
import { snatchSession } from '$lib/engine/snatchLogic';
import { viterbiDecoder } from '$lib/engine/viterbiDecoder'; 
import { overlay } from '$lib/stores'; 
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

  async process(pose: PoseResult): Promise<SnatchPhase> {
    if (!this.isReady || !pose) return 'STANDING';

    // 1. INJECT SIDE CONTEXT (From Geometric Engine)
    const lockedSide = snatchSession.getActiveSide();
    if (lockedSide) {
        pose.side = lockedSide;
    }

    // 2. EXTRACT FEATURES
    // Returns { vector, velocityMps } or null
    const result = featureBuilder.extract(pose);
    
    if (result) {
        const { vector, velocityMps } = result;

        // --- OPTIMO TRAP: DEBUGGING THE HIKE ---
        // If we are locked in 'HANDONBELL' but moving fast, log the vector.
        // This helps verify if the inputs are within the model's expected range.
        if (this.currentPhase === 'HANDONBELL' && Math.abs(vector[9]) > 0.5 && lockedSide) {
             console.groupCollapsed('🦁 [Optimo Trap] Golden Frame Data');
             console.log('Normalized Vector:', vector);
             console.log('Wrist Norm Velocity (Feat 9):', vector[9]);
             console.log('Real Velocity (m/s):', velocityMps);
             console.groupEnd();
        }

        // 3. CLASSIFY (Using Normalized Vector)
        this.classifier.addFrame(vector);
        const newPhase = await this.classifier.classify();
        if (newPhase) {
             this.currentPhase = newPhase;
        }

        // 4. UPDATE ENGINE (Using Real-World Velocity)
        const sessionState = snatchSession.update(this.currentPhase, pose, velocityMps);

        // 5. SYNC MODEL TO ENGINE (Viterbi Overrides)
        const isLocked = sessionState.isSessionActive;
        const repCount = sessionState.repCount;

        // RULE: If Geometry is Locked but Reps=0, force HANDONBELL (Prevent Drift)
        if (isLocked && repCount === 0) {
            if (this.currentPhase === 'STANDING') {
                 viterbiDecoder.forceState('HANDONBELL');
                 this.currentPhase = 'HANDONBELL';
            }
        }

        // RULE: If Session Unlock, Reset Viterbi
        if (!snatchSession.getActiveSide() && this.currentPhase !== 'STANDING') {
             viterbiDecoder.reset();
             this.currentPhase = 'STANDING';
        }

        // 6. UI UPDATES
        overlay.phase = this.currentPhase;
        overlay.repCount = sessionState.repCount;
        overlay.currentVelocity = sessionState.currentVelocity;
        overlay.peakVelocity = sessionState.peakVelocity;
        overlay.trackingConfidence = (pose.confidence > 0.6) ? 'high' : 'low';
    }

    return this.currentPhase;
  }

  reset() {
    this.currentPhase = 'STANDING';
    snatchSession.reset();
    viterbiDecoder.reset();
    overlay.reset();
  }
}

export const analysisService = new AnalysisService();