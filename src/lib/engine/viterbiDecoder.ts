import config from '../config.json';

type TransitionMatrix = number[][];

export class ViterbiDecoder {
  private transitionMatrix: TransitionMatrix;
  private numClasses: number;
  private state: number; // Persistent state for streaming/windowed inference

  constructor() {
    this.numClasses = config.classes.length;
    this.state = 0; // Default start state (STANDING)
    this.transitionMatrix = this.buildTransitionMatrix();
  }

  /**
   * Constructs the log-probability transition matrix from the grammar config.
   */
  private buildTransitionMatrix(): TransitionMatrix {
    const matrix = Array(this.numClasses).fill(0).map(() => Array(this.numClasses).fill(-Infinity));
    const phases = config.classes;
    const grammar = config.viterbi.grammar as Record;

    phases.forEach((fromPhase, fromIdx) => {
      const allowedTargets = grammar[fromPhase];
      
      // Fill allowed transitions
      if (allowedTargets) {
        allowedTargets.forEach(toPhase => {
          const toIdx = phases.indexOf(toPhase);
          if (toIdx !== -1) {
            const isSelf = fromIdx === toIdx;
            // Use bonus for self-loop to encourage stability, generic penalty for legal switches
            matrix[fromIdx][toIdx] = isSelf 
              ? config.viterbi.self_transition_bonus 
              : config.viterbi.transition_penalty;
          }
        });
      }
      
      // Implicit: Illegal transitions remain -Infinity (or very low negative number)
    });

    return matrix;
  }

  /**
   * Decodes a sequence of logits using the Viterbi algorithm.
   * Adapted for a sliding window where we care most about the *final* state.
   * 
   * @param logits Flat Float32Array of shape [T * numClasses]
   * @param steps Time steps (T)
   * @returns The index of the most likely class at the final step.
   */
  public decode(logits: Float32Array, steps: number): number {
    const C = this.numClasses;
    // DP Table: vit[t][s] = max prob of path ending in state s at time t
    // We only need previous step to compute current, but keeping full table for clarity/debugging if needed.
    // Optimization: We can reduce memory to O(C) since we only stream forward.
    
    let prevScores = new Float32Array(C);
    let currScores = new Float32Array(C);

    // Initialization (t=0) based on persistent state
    // We enforce that the sequence MUST start from a valid transition of the previous window's end state
    for (let s = 0; s < C; s++) {
      const transitionScore = this.transitionMatrix[this.state][s];
      // Logits are raw, let's assume they are somewhat normalized or just use them directly as scores
      // Ideally input should be log-softmax, but raw logits work for max-sum Viterbi too if consistent.
      prevScores[s] = (transitionScore > -900 ? transitionScore : config.viterbi.illegal_penalty) + logits[s];
    }

    // Forward Pass
    for (let t = 1; t < steps; t++) {
      const offset = t * C;
      for (let s = 0; s < C; s++) { // s = current state
        let maxScore = -Infinity;
        
        for (let p = 0; p < C; p++) { // p = previous state
           // Score = PrevPathScore + Transition(p->s) + Emission(s)
           const trans = this.transitionMatrix[p][s] > -900 ? this.transitionMatrix[p][s] : config.viterbi.illegal_penalty;
           const score = prevScores[p] + trans + logits[offset + s];
           
           if (score > maxScore) {
             maxScore = score;
           }
        }
        currScores[s] = maxScore;
      }
      
      // Swap arrays
      prevScores.set(currScores);
    }

    // Termination: Find max score in the last timestep
    let bestScore = -Infinity;
    let bestState = 0;
    
    for (let s = 0; s < C; s++) {
      if (prevScores[s] > bestScore) {
        bestScore = prevScores[s];
        bestState = s;
      }
    }

    // Update persistent state for next window
    this.state = bestState;
    return bestState;
  }
  
  public getClassName(idx: number): string {
      return config.classes[idx] || "UNKNOWN";
  }
}