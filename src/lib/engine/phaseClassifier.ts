import * as ort from 'onnxruntime-web';
import { viterbiDecoder, type SnatchPhase } from './viterbiDecoder';

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

interface Config {
  sequence_length: number; // 36
  num_features: number;    // 12
  model_version: string;
}

export class PhaseClassifier {
  private session: ort.InferenceSession | null = null;
  private config: Config | null = null;
  private buffer: Float32Array;
  private bufIdx = 0;

  constructor() {
    // Pre-allocate buffer (Max size assumption or resize later)
    this.buffer = new Float32Array(100 * 12); 
  }

  async load(modelPath: string, configPath: string): Promise<void> {
    try {
      this.config = await (await fetch(configPath)).json();
      
      // Initialize Session
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
      
      // Resize buffer to exact model dimensions
      if (this.config) {
         this.buffer = new Float32Array(this.config.sequence_length * this.config.num_features);
      }

      console.log('✅ [Classifier] Loaded. Input Name:', this.session.inputNames[0]);
    } catch (e) {
      console.error('❌ [Classifier] Load failed:', e);
    }
  }

  addFrame(features: number[]): void {
    if (!this.config) return;
    const { sequence_length: T, num_features: F } = this.config;

    // Rolling Buffer Logic: Shift Left, Append Right
    if (this.bufIdx >= T) {
      this.buffer.copyWithin(0, F); // Shift everything left by F
      const start = (T - 1) * F;
      for (let i = 0; i < F; i++) this.buffer[start + i] = features[i];
    } else {
      // Filling up
      const start = this.bufIdx * F;
      for (let i = 0; i < F; i++) this.buffer[start + i] = features[i];
      this.bufIdx++;
    }
  }

  async classify(): Promise<SnatchPhase | null> {
    if (!this.session || !this.config) return null;
    
    const { sequence_length: T, num_features: F } = this.config;

    // 1. Wait for Buffer to Fill (Crucial!)
    // The model needs 36 frames of context before it can speak.
    if (this.bufIdx < T) {
       // Optional: console.debug(`[Classifier] Buffering... ${this.bufIdx}/${T}`);
       return null;
    }

    try {
      // 2. Prepare Tensor
      // Shape must be [1, T, F] -> [1, 36, 12]
      const inputTensor = new ort.Tensor('float32', this.buffer, [1, T, F]);
      
      // 3. Run Inference (Dynamic Input Name)
      // We read the input name directly from the loaded session
      const inputName = this.session.inputNames[0]; 
      const feeds = { [inputName]: inputTensor };
      
      const results = await this.session.run(feeds);
      
      // 4. Get Output (Logits)
      const outputName = this.session.outputNames[0];
      const logits = results[outputName].data as Float32Array;

      // 5. Decode
      // We only care about the *last* frame's prediction in the sequence
      return viterbiDecoder.decodeLast(logits, T);

    } catch (e) {
      console.error('❌ [Classifier] Inference error:', e);
      return null;
    }
  }
}