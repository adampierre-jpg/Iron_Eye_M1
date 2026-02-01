// src/lib/engine/snatchLogic.ts
import type { SnatchPhase, PoseResult, Side, Keypoint } from '$lib/types';

export interface SnatchState {
    isSessionActive: boolean;
    activeSide: Side | null;
    repCount: number;
    currentVelocity: number;
    peakVelocity: number;
    lastPhase: SnatchPhase;
    isInConcentric: boolean;
    feedback: string | null;
}

const THRESHOLDS = {
    SIDE_LOCK_NEAR_ANKLE: 0.12,     
    SIDE_LOCK_MIN_DIFF: 0.08,       
    SIDE_LOCK_MIN_BELOW_HIP: 0.05,
    PARK_VELOCITY_MAX: 0.50,        
    RESET_DURATION_FRAMES: 30,      
    RESET_TORSO_RATIO: 0.85,        
    CALIBRATION_FRAMES: 30
};

export class SnatchSessionEngine {
    private DEBUG_MODE = true; 

    public state: SnatchState = {
        isSessionActive: false,
        activeSide: null,
        repCount: 0,
        currentVelocity: 0,
        peakVelocity: 0,
        lastPhase: 'STANDING',
        isInConcentric: false,
        feedback: 'READY'
    };

    private hasHiked = false;
    private hasHitLockout = false;
    private isParked = false; 
    private parkTimer = 0;
    private standTimer = 0;

    private calibration = {
        isComplete: false,
        framesCaptured: 0,
        neutralWristOffset: 0, 
        maxTorsoLength: 0      
    };

    update(phase: SnatchPhase, pose: PoseResult, velocityMps: number): SnatchState {
        this.runAutoCalibration(pose);

        if (!this.state.isSessionActive) {
            const detectedSide = this.detectLockPattern(pose);
            if (detectedSide) this.lockSession(detectedSide);
        } else {
            this.manageActiveSession(pose, velocityMps);
            this.trackVelocity(phase, velocityMps);
            this.handlePhaseTransitions(phase);
        }

        this.state.lastPhase = phase;
        this.state.currentVelocity = velocityMps;
        return this.state;
    }

    private manageActiveSession(pose: PoseResult, velocityMps: number) {
        // 1. FALSE START CHECK (Rep 0)
        // If locked but no reps, checks if user aborts (Stands up)
        if (this.state.repCount === 0) {
            if (this.checkStandingReset(pose)) {
                this.standTimer++;
                if (this.standTimer > THRESHOLDS.RESET_DURATION_FRAMES) {
                    console.log('↩️ [Engine] False Start (No Reps). Resetting.');
                    this.reset();
                }
            } else {
                this.standTimer = 0;
            }
            return; // DO NOT Check Park if Reps == 0
        }

        // 2. PARK DETECTION (Reps > 0)
        const isHinged = this.checkSetupGeometry(pose, this.state.activeSide || 'RIGHT');
        const isStill = Math.abs(velocityMps) < THRESHOLDS.PARK_VELOCITY_MAX;

        if (isHinged && isStill) {
            this.parkTimer++;
            if (this.parkTimer > 15) { 
                if (!this.isParked) console.log('🅿️ [Engine] STATE: PARKED DETECTED');
                this.isParked = true;
            }
        } else {
            this.parkTimer = 0;
        }

        // 3. SESSION END (Unlock after Park)
        if (this.isParked) {
            if (this.checkStandingReset(pose)) {
                this.standTimer++;
                if (this.standTimer > THRESHOLDS.RESET_DURATION_FRAMES) {
                    console.log('🔓 [Engine] UNLOCK TRIGGERED');
                    this.reset();
                }
            } else {
                this.standTimer = 0;
            }
            
            if (Math.abs(velocityMps) > 3.0) {
                console.log(`⚠️ [Engine] Park Cancelled. Velocity ${velocityMps.toFixed(2)} > 3.0`);
                this.isParked = false;
                this.parkTimer = 0;
            }
        }
    }

    private detectLockPattern(pose: PoseResult): Side | null {
        if (!pose.keypoints) return null;
        if (this.checkSetupGeometry(pose, 'LEFT')) return 'LEFT';
        if (this.checkSetupGeometry(pose, 'RIGHT')) return 'RIGHT';
        return null;
    }

    private checkSetupGeometry(pose: PoseResult, side: Side): boolean {
        const idx = side === 'LEFT' ? { wrist: 15, knee: 25, ankle: 27 } : { wrist: 16, knee: 26, ankle: 28 };
        const kp = pose.keypoints;
        
        // Hinge: Wrist lower than Knee
        if (kp[idx.wrist].y < kp[idx.knee].y) return false;

        // Proximity: Wrist close to Ankle
        const dist = Math.abs(kp[idx.wrist].y - kp[idx.ankle].y);
        return dist < THRESHOLDS.SIDE_LOCK_NEAR_ANKLE;
    }

    private runAutoCalibration(pose: PoseResult) {
        if (!pose.keypoints || pose.keypoints.length < 33) return;
        const kp = pose.keypoints;
        const currentTorso = Math.max(Math.abs(kp[11].y - kp[23].y), Math.abs(kp[12].y - kp[24].y));

        if (currentTorso > this.calibration.maxTorsoLength) {
             this.calibration.maxTorsoLength = currentTorso;
        }

        if (!this.calibration.isComplete) {
            this.calibration.neutralWristOffset += ((kp[15].y - kp[23].y) + (kp[16].y - kp[24].y)) / 2;
            this.calibration.framesCaptured++;
            if (this.calibration.framesCaptured >= THRESHOLDS.CALIBRATION_FRAMES) {
                this.calibration.neutralWristOffset /= THRESHOLDS.CALIBRATION_FRAMES;
                this.calibration.isComplete = true;
                console.log('✅ [Engine] Calibration Locked.', this.calibration);
            }
        }
    }

    private checkStandingReset(pose: PoseResult): boolean {
        if (!this.calibration.isComplete) return false; 
        const kp = pose.keypoints;
        const currentTorso = Math.abs(kp[11].y - kp[23].y);
        const targetTorso = this.calibration.maxTorsoLength * THRESHOLDS.RESET_TORSO_RATIO;
        
        return (currentTorso > targetTorso) && 
               (kp[15].y > kp[23].y) && // Left wrist below hip
               (kp[16].y > kp[24].y);   // Right wrist below hip
    }

    private lockSession(side: Side) {
        this.state.activeSide = side;
        this.state.isSessionActive = true;
        this.state.feedback = `LOCKED: ${side}`;
        this.isParked = false; 
        console.log(`🔒 [Engine] Session Started: ${side}`);
    }

    private trackVelocity(phase: SnatchPhase, velocity: number) {
        if (phase === 'PULL' || phase === 'FLOAT') {
            this.state.isInConcentric = true;
            if (velocity > this.state.peakVelocity) this.state.peakVelocity = velocity;
        } else if (phase === 'HIKE' || phase === 'DROP') {
            this.state.isInConcentric = false;
        }
    }

    private handlePhaseTransitions(current: SnatchPhase) {
        const prev = this.state.lastPhase;
        if (current === prev) return;

        if (current === 'HIKE') {
            this.hasHiked = true;
            this.hasHitLockout = false;
            this.state.peakVelocity = 0; 
            this.state.feedback = 'HIKE';
        }
        if (current === 'LOCKOUT' || current === 'CATCH') {
            if (this.hasHiked) {
                this.hasHitLockout = true;
                this.state.feedback = 'LOCKOUT';
            }
        }
        if ((prev === 'LOCKOUT' || prev === 'CATCH') && (current === 'DROP' || current === 'PARK')) {
            if (this.hasHitLockout) {
                this.state.repCount++;
                this.state.feedback = `REP ${this.state.repCount}`;
                this.hasHitLockout = false; 
                this.hasHiked = false;
            }
        }
    }

    public getActiveSide(): Side | null {
        return this.state.activeSide;
    }

    reset() {
        this.state = {
            isSessionActive: false,
            activeSide: null,
            repCount: 0,
            currentVelocity: 0,
            peakVelocity: 0,
            lastPhase: 'STANDING',
            isInConcentric: false,
            feedback: 'READY'
        };
        this.hasHiked = false;
        this.hasHitLockout = false;
        this.isParked = false;
        this.parkTimer = 0;
        this.standTimer = 0;
    }
}

export const snatchSession = new SnatchSessionEngine();