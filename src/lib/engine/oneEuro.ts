export class OneEuroFilter {
    private minCutoff: number;
    private beta: number;
    private dCutoff: number;
    
    private xPrev: number | null = null;
    private dxPrev: number | null = null;
    private tPrev: number | null = null; // In Seconds

    constructor(minCutoff = 0.5, beta = 0.05, dCutoff = 1.0) {
        this.minCutoff = minCutoff;
        this.beta = beta;
        this.dCutoff = dCutoff;
    }

    /**
     * Resets the filter state. Call this when a new session starts 
     * or when the camera is toggled.
     */
    reset() {
        this.xPrev = null;
        this.dxPrev = null;
        this.tPrev = null;
    }

    /**
     * Filters a single value.
     * @param tMs Timestamp in MILLISECONDS (performance.now)
     * @param x The raw value to filter
     */
    filter(tMs: number, x: number): number {
        const t = tMs / 1000.0; // Convert to Seconds for Hz math

        // CRITICAL FIX: Detect Loop/Seek (Time Travel)
        // If current time is LESS than previous time, the video looped. Reset immediately.
        if (this.tPrev !== null && t < this.tPrev) {
            this.reset();
        }

        if (this.tPrev === null) {
            this.xPrev = x;
            this.dxPrev = 0.0;
            this.tPrev = t;
            return x;
        }

        const te = t - this.tPrev;
        
        // Prevent division by zero or glitches
        if (te <= 0.0) return this.xPrev!; 

        // 1. Estimate the derivative (velocity) of the signal
        const ad = this.smoothingFactor(te, this.dCutoff);
        const dx = (x - this.xPrev!) / te;
        const dxHat = this.exponentialSmoothing(ad, dx, this.dxPrev!);

        // 2. Adjust cutoff based on velocity (Beta * |velocity|)
        // High velocity = Higher cutoff = Less lag
        // Low velocity = Lower cutoff = More smoothing
        const cutoff = this.minCutoff + (this.beta * Math.abs(dxHat));
        const a = this.smoothingFactor(te, cutoff);
        const xHat = this.exponentialSmoothing(a, x, this.xPrev!);

        // 3. Update state
        this.xPrev = xHat;
        this.dxPrev = dxHat;
        this.tPrev = t;

        return xHat;
    }

    private smoothingFactor(te: number, cutoff: number): number {
        const r = 2 * Math.PI * cutoff * te;
        return r / (r + 1);
    }

    private exponentialSmoothing(a: number, x: number, xPrev: number): number {
        return a * x + (1 - a) * xPrev;
    }
}