// src/lib/engine/phaseClassifier.ts
import * as ort from 'onnxruntime-web';
import { viterbiDecoder, type SnatchPhase } from './viterbiDecoder';
import { browser } from '$app/environment';

if (browser) {
    ort.env.wasm.wasmPaths = "/"; 
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
}

interface Config {
  model_version: string;
  sequence_length: number; 
  num_features: number;    
  phases: string[];
}

export class PhaseClassifier {
  private session: ort.InferenceSession | null = null;
  private config: Config | null = null;
  private buffer: Float32Array;
  private bufIdx = 0;

  constructor() {
    this.buffer = new Float32Array(30 * 12); 
  }

  async load(modelPath: string, configPath: string): Promise<void> {
    try {
      this.config = await (await fetch(configPath)).json();
      
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ['wasm'],
      });
      
      if (this.config) {
         const { sequence_length, num_features } = this.config;
         this.buffer = new Float32Array(sequence_length * num_features);
      }

      console.log('✅ [Classifier] Loaded. Input:', this.session.inputNames[0]);
    } catch (e) {
      console.error('❌ [Classifier] Load failed:', e);
      throw e; 
    }
  }

  addFrame(features: number[]): void {
    if (!this.config) return;
    
    const T = this.config.sequence_length;
    const F = this.config.num_features;

    // Rolling Buffer Logic
    if (this.bufIdx >= T) {
      this.buffer.copyWithin(0, F); 
      const start = (T - 1) * F;
      for (let i = 0; i < F; i++) this.buffer[start + i] = features[i];
    } else {
      const start = this.bufIdx * F;
      for (let i = 0; i < F; i++) this.buffer[start + i] = features[i];
      this.bufIdx++;
    }
  }

  async classify(): Promise<SnatchPhase | null> {
    if (!this.session || !this.config) return null;
    
    const T = this.config.sequence_length;
    const F = this.config.num_features;

    if (this.bufIdx < T) return null;

    try {
      const inputTensor = new ort.Tensor('float32', this.buffer, [1, T, F]);
      const inputName = this.session.inputNames[0]; 
      
      const results = await this.session.run({ [inputName]: inputTensor });
      
      const outputName = this.session.outputNames[0];
      const logits = results[outputName].data as Float32Array;

      // CRITICAL FIX: LogSoftmax Normalization
      // Viterbi expects Log-Probabilities to add to transition penalties.
      const logProbs = this.logSoftmax(logits);

      return viterbiDecoder.decodeLast(logProbs, 1);

    } catch (e) {
      console.error('❌ [Classifier] Inference error:', e);
      return null;
    }
  }

  // Numerical Stability Helper
  private logSoftmax(logits: Float32Array): Float32Array {
    let max = -Infinity;
    // Find Max
    for (let i = 0; i < logits.length; i++) {
        if (logits[i] > max) max = logits[i];
    }
    
    // Sum Exp
    let sum = 0;
    for (let i = 0; i < logits.length; i++) {
        sum += Math.exp(logits[i] - max);
    }
    
    const logSum = Math.log(sum);
    const result = new Float32Array(logits.length);
    
    // Result = x - max - log(sumExp)
    for (let i = 0; i < logits.length; i++) {
        result[i] = logits[i] - max - logSum;
    }
    return result;
  }
}