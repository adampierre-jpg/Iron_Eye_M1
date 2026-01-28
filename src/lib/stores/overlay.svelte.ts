import type { SnatchPhase } from '$lib/types';

class OverlayStore {
    // 1. Initialize with specific string type 'STANDING' to prevent '---'
    phase = $state<SnatchPhase>('STANDING'); 
    
    repCount = $state(0);
    currentVelocity = $state(0);
    peakVelocity = $state(0);
    fps = $state(0);
    alert = $state<{ message: string } | null>(null);

    reset() {
        this.phase = 'STANDING';
        this.repCount = 0;
        this.currentVelocity = 0;
        this.peakVelocity = 0;
        this.alert = null;
    }

    updateFps(val: number) {
        this.fps = val;
    }
}

export const overlay = new OverlayStore();