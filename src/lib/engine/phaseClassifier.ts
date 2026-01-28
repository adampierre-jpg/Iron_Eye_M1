import * as ort from 'onnxruntime-web';
import { ViterbiDecoder } from './viterbiDecoder';
import config from '../config.json';

export interface ClassificationResult {
    phaseIndex: number;
    phaseName: string;
    logits: Float32Array;
    inferenceTime: number;
}

export class PhaseClassifier {
    private session: ort.InferenceSession | null = null;
    private viterbi: ViterbiDecoder;
    private inputName: string = '';
    
    // Buffer for sliding window: [FrameWindow, FeatureDim]
    // We flatten it for ONNX input
    private featureBuffer: Float32Array;
    private frameCount: number = 0;

    constructor() {
        this.viterbi = new ViterbiDecoder();
        // Initialize buffer with zeros
        const size = config.model.frame_window * config.model.feature_dim;
        this.featureBuffer = new Float32Array(size);
    }

    /**
     * Initializes the ONNX Runtime session.
     * Ensure the .onnx file is in the public folder.
     */
    async initialize() {
        try {
            // Set backend to WebGL for performance
            ort.env.wasm.numThreads = 1; // Adjust based on device
            
            const sessionOption: ort.InferenceSession.SessionOptions = {
                executionProviders: ['webgl', 'wasm'],
                graphOptimizationLevel: 'all'
            };

            this.session = await ort.InferenceSession.create(config.model.path, sessionOption);
            this.inputName = this.session.inputNames[0];
            
            console.log(`[PhaseClassifier] Model loaded: ${this.inputName}`);
        } catch (e) {
            console.error('[PhaseClassifier] Failed to init session:', e);
            throw e;
        }
    }

    /**
     * Adds a new frame of features and runs inference.
     * @param features Normalized features for the current frame (Float32Array[12])
     */
    async processFrame(features: Float32Array): Promise {
        if (!this.session) return null;

        // 1. Update Buffer (Shift Left, Push New)
        // Shift existing data: move index featureDim to 0
        const dim = config.model.feature_dim;
        const totalSize = this.featureBuffer.length;
        
        // Efficient shift using subarray copy
        this.featureBuffer.copyWithin(0, dim);
        // Insert new at end
        this.featureBuffer.set(features, totalSize - dim);
        
        this.frameCount++;

        // Warmup period: don't classify until buffer is full? 
        // Or just classify zeros (handled by Viterbi usually)
        if (this.frameCount < config.model.frame_window) {
            return null; // or return STANDING
        }

        const start = performance.now();

        // 2. Prepare Tensor [1, 36, 12]
        // Note: Check if model expects flattened [1, 36, 12] or specific layout
        const tensor = new ort.Tensor('float32', this.featureBuffer, config.model.input_shape);

        // 3. Run Inference
        const feeds: Record = {};
        feeds[this.inputName] = tensor;
        
        const results = await this.session.run(feeds);
        
        // 4. Get Logits
        // Output name usually generic, taking first output
        const outputName = this.session.outputNames[0];
        const logits = results[outputName].data as Float32Array;

        // 5. Viterbi Decode
        // The model output might be sequence [1, 36, 9] or single dense [1, 9]
        // If 1D CNN returns sequence, we pass full sequence.
        // If it returns single classification for the window, we pass that.
        // Assuming Model Output is Sequence [1, 36, 9] based on Viterbi usage:
        const seqLen = config.model.frame_window;
        const phaseIdx = this.viterbi.decode(logits, seqLen);

        const end = performance.now();

        return {
            phaseIndex: phaseIdx,
            phaseName: this.viterbi.getClassName(phaseIdx),
            logits: logits,
            inferenceTime: end - start
        };
    }
}