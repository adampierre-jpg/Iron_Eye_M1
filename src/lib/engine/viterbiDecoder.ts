// src/lib/engine/viterbiDecoder.ts

export type SnatchPhase = 
  | 'STANDING' | 'HANDONBELL' | 'HIKE' | 'PULL' | 'FLOAT' 
  | 'LOCKOUT' | 'DROP' | 'CATCH' | 'PARK';

export const PHASES: SnatchPhase[] = [
  'STANDING', 'HANDONBELL', 'HIKE', 'PULL', 'FLOAT',
  'LOCKOUT', 'DROP', 'CATCH', 'PARK'
];

const PHASE_MAP = PHASES.reduce((acc, p, i) => { acc[p] = i; return acc; }, {} as Record<SnatchPhase, number>);

// Hyperparameters
const SELF_TRANSITION_BONUS = 2.0;   
const TRANSITION_PENALTY = 0.0;      
const ILLEGAL_PENALTY = -1000.0;     

const TRANSITION_GRAMMAR: Record<SnatchPhase, SnatchPhase[]> = {
  STANDING:    ['STANDING', 'HANDONBELL'],
  HANDONBELL:  ['HANDONBELL', 'HIKE', 'STANDING'], 
  HIKE:        ['HIKE', 'PULL'],
  PULL:        ['PULL', 'FLOAT', 'DROP'], 
  FLOAT:       ['FLOAT', 'LOCKOUT', 'DROP'],
  LOCKOUT:     ['LOCKOUT', 'DROP', 'PARK'],
  DROP:        ['DROP', 'CATCH', 'STANDING'], 
  CATCH:       ['CATCH', 'PARK', 'STANDING', 'PULL'], 
  PARK:        ['PARK', 'STANDING']
};

type TransitionMatrix = number[][];

export class ViterbiDecoder {
  private transitionMatrix: TransitionMatrix;
  private numClasses: number;
  public state: number; 

  constructor() {
    this.numClasses = PHASES.length;
    this.state = PHASE_MAP['STANDING'];
    this.transitionMatrix = this.buildTransitionMatrix();
  }

  private buildTransitionMatrix(): TransitionMatrix {
    const C = this.numClasses;
    const matrix = Array(C).fill(0).map(() => Array(C).fill(ILLEGAL_PENALTY));

    PHASES.forEach((fromPhase, fromIdx) => {
      const allowedTargets = TRANSITION_GRAMMAR[fromPhase];
      if (allowedTargets) {
        allowedTargets.forEach(toPhase => {
          const toIdx = PHASE_MAP[toPhase];
          matrix[fromIdx][toIdx] = (fromIdx === toIdx) 
            ? SELF_TRANSITION_BONUS 
            : TRANSITION_PENALTY;
        });
      }
    });
    return matrix;
  }

  public decodeLast(logits: Float32Array, steps: number): SnatchPhase {
    const C = this.numClasses;
    let prevScores = new Float32Array(C);
    let currScores = new Float32Array(C);

    for (let s = 0; s < C; s++) {
      const trans = this.transitionMatrix[this.state][s];
      prevScores[s] = trans + logits[s];
    }

    for (let t = 1; t < steps; t++) {
      const offset = t * C;
      for (let s = 0; s < C; s++) { 
        let maxScore = -Infinity;
        for (let p = 0; p < C; p++) { 
          const score = prevScores[p] + this.transitionMatrix[p][s] + logits[offset + s];
          if (score > maxScore) maxScore = score;
        }
        currScores[s] = maxScore;
      }
      prevScores.set(currScores);
    }

    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let s = 0; s < C; s++) {
      if (prevScores[s] > bestScore) {
        bestScore = prevScores[s];
        bestIdx = s;
      }
    }

    this.state = bestIdx;
    return PHASES[bestIdx];
  }
  
  public reset() {
    console.log('🔄 [Viterbi] RESET -> STANDING');
    this.state = PHASE_MAP['STANDING'];
  }

  // FORCE STATE: Allows the Referee (Engine) to override the Model.
  public forceState(phase: SnatchPhase) {
    const idx = PHASE_MAP[phase];
    if (idx !== undefined && this.state !== idx) {
      console.log(`⚡ [Viterbi] Forcing State: ${PHASES[this.state]} -> ${phase}`);
      this.state = idx;
    }
  }
}

export const viterbiDecoder = new ViterbiDecoder();