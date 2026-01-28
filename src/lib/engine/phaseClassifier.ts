import * as ort from 'onnxruntime-web';
import { viterbiDecoder, type SnatchPhase } from './viterbiDecoder';

// Point ONNX to the root (where we copied the .wasm and .mjs files)
ort.env.wasm.wasmPaths = "/"; 
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;

// --- UPDATED INTERFACE TO MATCH YOUR JSON ---
interface Config {
  model: {
    frame_window: number; // Was 'sequence_length'
    feature_dim: number;  // Was 'num_features'
  };
}

export class PhaseClassifier {
  private session: ort.InferenceSession | null = null;
  private config: Config | null = null;
  private buffer: Float32Array;
  private bufIdx = 0;

  constructor() {
    // Pre-allocate buffer (Max size assumption: 100 * 12)
    this.buffer = new Float32Array(100 * 12); 
  }

  async load(modelPath: string, configPath: string): Promise<void> {
    try {
      this.config = await (await fetch(configPath)).json();
      
      // Initialize Session
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
      
      // Resize buffer to exact model dimensions if config is loaded
      if (this.config) {
         const { frame_window, feature_dim } = this.config.model;
         this.buffer = new Float32Array(frame_window * feature_dim);
      }

      console.log('✅ [Classifier] Loaded. Input Name:', this.session.inputNames[0]);
    } catch (e) {
      console.error('❌ [Classifier] Load failed:', e);
    }
  }

  addFrame(features: number[]): void {
    if (!this.config) return;
    
    // --- UPDATED ACCESSORS ---
    const T = this.config.model.frame_window;
    const F = this.config.model.feature_dim;

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
    
    // --- UPDATED ACCESSORS ---
    const T = this.config.model.frame_window;
    const F = this.config.model.feature_dim;

    // 1. Wait for Buffer to Fill
    if (this.bufIdx < T) {
       return null;
    }

    try {
      // 2. Prepare Tensor
      // Shape is [1, T, F] (e.g., [1, 36, 12])
      const inputTensor = new ort.Tensor('float32', this.buffer, [1, T, F]);
      
      // 3. Run Inference
      const inputName = this.session.inputNames[0]; 
      const feeds = { [inputName]: inputTensor };
      
      const results = await this.session.run(feeds);
      
      // 4. Get Output (Logits)
      const outputName = this.session.outputNames[0];
      const logits = results[outputName].data as Float32Array;

      // 5. Decode
      return viterbiDecoder.decodeLast(logits, T);

    } catch (e) {
      console.error('❌ [Classifier] Inference error:', e);
      return null;
    }
  }
}