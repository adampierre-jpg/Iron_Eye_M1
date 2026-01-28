// src/lib/engine/viterbiDecoder.ts

export type SnatchPhase = 
  | 'STANDING' | 'HANDONBELL' | 'HIKE' | 'PULL' | 'FLOAT' 
  | 'LOCKOUT' | 'DROP' | 'CATCH' | 'PARK';

export const PHASES: SnatchPhase[] = [
  'STANDING', 'HANDONBELL', 'HIKE', 'PULL', 'FLOAT',
  'LOCKOUT', 'DROP', 'CATCH', 'PARK'
];

// Phase constants to avoid magic strings/numbers
const PHASE_MAP = PHASES.reduce((acc, p, i) => { acc[p] = i; return acc; }, {} as Record<SnatchPhase, number>);

// Tunable parameters (Hyperparameters)
const SELF_TRANSITION_BONUS = 2.0;   // Encourages sticking to current phase
const TRANSITION_PENALTY = 0.0;      // Neutral cost for legal switches
const ILLEGAL_PENALTY = -1000.0;     // Effectively impossible

// The Rules of the Sport (State Machine)
const TRANSITION_GRAMMAR: Record<SnatchPhase, SnatchPhase[]> = {
  STANDING:    ['STANDING', 'HANDONBELL'],
  HANDONBELL:  ['HANDONBELL', 'HIKE', 'STANDING'], // Allow reset to standing
  HIKE:        ['HIKE', 'PULL'],
  PULL:        ['PULL', 'FLOAT', 'DROP'], // Bailout to drop allowed
  FLOAT:       ['FLOAT', 'LOCKOUT', 'DROP'],
  LOCKOUT:     ['LOCKOUT', 'DROP', 'PARK'],
  DROP:        ['DROP', 'CATCH', 'STANDING'], // Reset if missed catch
  CATCH:       ['CATCH', 'PARK', 'STANDING', 'PULL'], // PULL allows chaining reps
  PARK:        ['PARK', 'STANDING']
};

type TransitionMatrix = number[][];

export class ViterbiDecoder {
  private transitionMatrix: TransitionMatrix;
  private numClasses: number;
  private state: number; // Persistent state index for streaming

  constructor() {
    this.numClasses = PHASES.length;
    this.state = PHASE_MAP['STANDING'];
    this.transitionMatrix = this.buildTransitionMatrix();
  }

  private buildTransitionMatrix(): TransitionMatrix {
    const C = this.numClasses;
    // Fill with illegal penalty by default
    const matrix = Array(C).fill(0).map(() => Array(C).fill(ILLEGAL_PENALTY));

    PHASES.forEach((fromPhase, fromIdx) => {
      const allowedTargets = TRANSITION_GRAMMAR[fromPhase];
      if (allowedTargets) {
        allowedTargets.forEach(toPhase => {
          const toIdx = PHASE_MAP[toPhase];
          // Diagonal (Self-loop) gets bonus, valid moves get 0 penalty
          matrix[fromIdx][toIdx] = (fromIdx === toIdx) 
            ? SELF_TRANSITION_BONUS 
            : TRANSITION_PENALTY;
        });
      }
    });

    return matrix;
  }

  /**
   * Decodes the logits to find the most likely current phase.
   * Matches the API expected by PhaseClassifier.
   */
  public decodeLast(logits: Float32Array, steps: number): SnatchPhase {
    const C = this.numClasses;
    
    // DP Tables (Reuse arrays would be better for memory, but this is cleaner)
    let prevScores = new Float32Array(C);
    let currScores = new Float32Array(C);

    // 1. Initialize t=0 based on the PERSISTENT previous state
    // This connects the previous window to the current window
    for (let s = 0; s < C; s++) {
      const trans = this.transitionMatrix[this.state][s];
      // logits are flattened: [T, C]. First C elements are t=0
      prevScores[s] = trans + logits[s];
    }

    // 2. Forward Viterbi (Max-Sum)
    for (let t = 1; t < steps; t++) {
      const offset = t * C;
      
      for (let s = 0; s < C; s++) { // s = current candidate
        let maxScore = -Infinity;
        
        for (let p = 0; p < C; p++) { // p = previous candidate
          const score = prevScores[p] + this.transitionMatrix[p][s] + logits[offset + s];
          if (score > maxScore) maxScore = score;
        }
        currScores[s] = maxScore;
      }
      
      // Swap buffers
      prevScores.set(currScores);
    }

    // 3. Select Winner
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let s = 0; s < C; s++) {
      if (prevScores[s] > bestScore) {
        bestScore = prevScores[s];
        bestIdx = s;
      }
    }

    // 4. Update Persistence & Return
    this.state = bestIdx;
    return PHASES[bestIdx];
  }
  
  // Helper to force a reset if UI needs it
  public reset() {
    this.state = PHASE_MAP['STANDING'];
  }
}

// Export singleton to match PhaseClassifier imports
export const viterbiDecoder = new ViterbiDecoder();