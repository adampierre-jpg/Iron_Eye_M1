// src/lib/engine/snatchLogic.ts
import type { SnatchPhase, PoseResult, Side } from '$lib/types';

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

export class SnatchSessionEngine {
    // State exposed to the UI
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

    // Internal flags for the "Legal Rep" state machine
    private hasHiked = false;
    private hasHitLockout = false;
    
    /**
     * MAIN LOOP
     * Updates the session state based on the latest AI prediction and Geometry.
     */
    update(phase: SnatchPhase, pose: PoseResult, velocityMps: number): SnatchState {
        // 1. SESSION START (The "Trigger")
        if (!this.state.isSessionActive) {
            // We wait for the "Hand On Bell" phase to start the set.
            // Since the model is bilateral, we can trust it to find this posture 
            // even if we haven't perfectly locked the side yet (arms are symmetric here).
            if (phase === 'HANDONBELL') {
                this.startSession(pose);
            }
            // Pass through velocity for calibration feedback even when inactive
            this.state.currentVelocity = velocityMps;
            return this.state;
        }

        // 2. SIDE LOCK (Safety Check)
        // If we are active but somehow lost the side, re-acquire it.
        if (this.state.isSessionActive && !this.state.activeSide && phase === 'HANDONBELL') {
            this.state.activeSide = this.detectSide(pose);
        }

        // 3. VELOCITY GATE
        this.trackVelocity(phase, velocityMps);

        // 4. REP COUNTING
        this.handlePhaseTransitions(phase);

        this.state.lastPhase = phase;
        return this.state;
    }

    /**
     * Initialize the session and lock the active side.
     */
    private startSession(pose: PoseResult) {
        this.state.isSessionActive = true;
        this.state.repCount = 0;
        this.state.peakVelocity = 0;
        
        // CRITICAL: Determine which hand is holding the bell
        this.state.activeSide = this.detectSide(pose);
        
        this.state.feedback = `START: ${this.state.activeSide}`;
        console.log(`🚀 [Engine] Session Started. Locked Side: ${this.state.activeSide}`);
    }

    /**
     * GEOMETRY: Which hand is lower?
     * In the "Hand on Bell" setup, the working hand is on the bell (lower Y in 2D space),
     * while the non-working hand is usually "tamed" or out to the side.
     */
    private detectSide(pose: PoseResult): Side {
        if (!pose || pose.keypoints.length < 33) return 'RIGHT';

        // 15: Left Wrist, 16: Right Wrist
        // Note: Y increases downwards. Higher Y value = Lower to the floor.
        const leftWristY = pose.keypoints[15].y;
        const rightWristY = pose.keypoints[16].y;

        const diff = leftWristY - rightWristY;
        
        // Threshold (0.05) prevents flickering if hands are exactly even.
        // If Left is significantly "higher" (pixel value), it means it is PHYSICALLY LOWER.
        if (diff > 0.05) return 'LEFT'; 
        if (diff < -0.05) return 'RIGHT';
        
        // If unsure, stick to what we know or default to Right
        return this.state.activeSide || 'RIGHT'; 
    }

    private trackVelocity(phase: SnatchPhase, velocity: number) {
        this.state.currentVelocity = velocity;

        // Only track PEAK velocity during the Concentric (Upward) phase
        if (phase === 'PULL' || phase === 'FLOAT') {
            this.state.isInConcentric = true;
            if (velocity > this.state.peakVelocity) {
                this.state.peakVelocity = velocity;
            }
        } else if (phase === 'HIKE' || phase === 'DROP') {
            this.state.isInConcentric = false;
        }
    }

    private handlePhaseTransitions(current: SnatchPhase) {
        const prev = this.state.lastPhase;
        if (current === prev) return;

        // A. START OF REP (The Hike)
        if (current === 'HIKE') {
            this.hasHiked = true;
            this.hasHitLockout = false;
            this.state.peakVelocity = 0; // Reset for this new rep
            this.state.feedback = 'HIKE';
        }

        // B. THE TOP (Lockout)
        if (current === 'LOCKOUT' || current === 'CATCH') {
            if (this.hasHiked) {
                this.hasHitLockout = true;
                this.state.feedback = 'LOCKOUT';
            }
        }

        // C. REP COMPLETE (Gravity takes over)
        // A valid rep is HIKE -> LOCKOUT -> DROP
        if ((prev === 'LOCKOUT' || prev === 'CATCH') && (current === 'DROP' || current === 'PARK')) {
            if (this.hasHitLockout) {
                this.state.repCount++;
                this.state.feedback = `REP ${this.state.repCount}`;
                
                // Reset flags for the next rep
                this.hasHitLockout = false; 
                this.hasHiked = false;
            }
        }
    }

    // Accessor for the Analysis Service
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
    }
}

export const snatchSession = new SnatchSessionEngine();