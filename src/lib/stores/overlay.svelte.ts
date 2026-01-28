import type { SnatchPhase, ConfidenceLevel } from '$lib/types';

class OverlayStore {
    // State
    phase = $state<SnatchPhase>('STANDING'); 
    phaseConfidence = $state(0);
    
    repCount = $state(0);
    currentVelocity = $state(0);
    peakVelocity = $state(0);
    fps = $state(0);
    
    trackingConfidence = $state<ConfidenceLevel>('lost');
    
    // Derived: Tracking Status (Moved from index.ts)
    trackingStatus = $derived.by(() => {
        const conf = this.trackingConfidence;
        return {
            confidence: conf,
            isTracking: conf !== 'lost',
            label: {
                high: 'Tracking',
                medium: 'Tracking',
                low: 'Low Confidence',
                lost: 'No Tracking'
            }[conf] || 'No Tracking',
            color: {
                high: 'var(--color-copper)',
                medium: 'var(--color-copper)',
                low: 'var(--color-oxblood)',
                lost: 'var(--color-muted)'
            }[conf] || 'var(--color-muted)'
        };
    });

    alert = $state<{ message: string } | null>(null);

    reset() {
        this.phase = 'STANDING';
        this.repCount = 0;
        this.currentVelocity = 0;
        this.peakVelocity = 0;
        this.alert = null;
        this.trackingConfidence = 'lost';
    }

    updateFps(val: number) {
        this.fps = val;
    }
}

export const overlay = new OverlayStore();