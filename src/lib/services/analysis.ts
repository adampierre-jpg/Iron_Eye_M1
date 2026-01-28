import { featureBuilder } from '$lib/engine/features';
import { PhaseClassifier } from '$lib/engine/phaseClassifier'; 
import type { PoseResult, SnatchPhase } from '$lib/types';
import { browser } from '$app/environment';

class AnalysisService {
  private classifier: PhaseClassifier;
  private isReady = false;

  // Track the current phase to update UI stores
  public currentPhase: SnatchPhase = 'STANDING';
  
  // Track last valid update to prevent stale data
  private lastUpdate = 0;

  constructor() {
    this.classifier = new PhaseClassifier();
  }

  /**
   * Initialize the AI Brain (ONNX Model).
   * Call this once when the app starts or the page loads.
   */
  async initialize(): Promise<void> {
    if (!browser) return;
    if (this.isReady) return;

    try {
      console.log('🧠 [Analysis] Loading ONNX Model...');
      
      // Paths relative to 'static/'
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
   * 1. Extract features from Pose.
   * 2. Feed features to Classifier.
   * 3. Return the decoded Phase.
   */
  async process(pose: PoseResult): Promise<SnatchPhase> {
    if (!this.isReady || !pose) return 'STANDING';

    // 1. Convert Pose -> Math (Vector)
    const features = featureBuilder.extract(pose);
    
    // If tracking is lost (features is null), just return the last known phase
    // or maybe fallback to STANDING if lost for too long.
    if (!features) {
       // Optional: Timeout logic if lost for > 2 seconds
       return this.currentPhase; 
    }

    // 2. Feed the Beast 
    // The classifier handles the rolling buffer internally
    this.classifier.addFrame(features);

    // 3. Ask for Decision (Async Inference)
    const newPhase = await this.classifier.classify();
    
    if (newPhase) {
      this.currentPhase = newPhase;
      this.lastUpdate = performance.now();
    }

    return this.currentPhase;
  }

  reset() {
    this.currentPhase = 'STANDING';
    // Ideally we would also clear the classifier's internal buffer
    // this.classifier.reset(); // TODO: Implement reset in classifier if needed
  }
}

export const analysisService = new AnalysisService();