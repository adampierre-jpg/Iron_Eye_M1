<script lang="ts">
  import { calibration, calibrationStatus } from '$lib/stores';
  import { poseService } from '$lib/services/pose';
  import type { CalibrationQuality, PoseResult } from '$lib/types';

  // Props
  let { 
    onConfirm,
    compact = false
  }: { 
    onConfirm?: () => void;
    compact?: boolean;
  } = $props();
  
  // Local State
  let feet = $state(Math.floor($calibration.heightInches / 12));
  let inches = $state($calibration.heightInches % 12);
  
  // The Calibration State Machine
  type Phase = 'setup' | 'countdown' | 'scan' | 'success';
  let phase = $state<Phase>('setup');
  
  // Countdown State
  let countdownValue = $state(5);
  
  // T-Pose Scan State
  let tPoseProgress = $state(0);
  let scanFrameId: number;

  // Constants
  const REQUIRED_HOLD_MS = 1500; // 1.5s hold is snappy enough
  const T_POSE_TOLERANCE = 0.15;

  // ---------------------------------------------------------
  // 1. Actions
  // ---------------------------------------------------------

  function updateHeight() {
    calibration.setHeight((feet * 12) + inches);
  }

  function startSequence() {
    updateHeight();
    phase = 'countdown';
    countdownValue = 5;
    
    // Start Countdown Tick
    const timer = setInterval(() => {
        countdownValue--;
        if (countdownValue <= 0) {
            clearInterval(timer);
            phase = 'scan';
            startScanning();
        }
    }, 1000);
  }

  function cancelSequence() {
    phase = 'setup';
    if (scanFrameId) cancelAnimationFrame(scanFrameId);
    tPoseProgress = 0;
  }

  // ---------------------------------------------------------
  // 2. The Scanning Loop (Only active during 'scan')
  // ---------------------------------------------------------
  
  function checkTPose(pose: PoseResult | null): boolean {
    if (!pose || pose.keypoints.length < 33) return false;
    const kp = pose.keypoints;
    const features = [11, 12, 13, 14, 15, 16]; // Shoulders, Elbows, Wrists
    
    // Visibility Check
    if (features.some(i => (kp[i]?.score || 0) < 0.6)) return false;

    // Extension Check (Wrists outside shoulders)
    const torsoWidth = Math.abs(kp[11].x - kp[12].x);
    if (Math.abs(kp[15].x - kp[11].x) < torsoWidth * 0.8) return false;
    if (Math.abs(kp[16].x - kp[12].x) < torsoWidth * 0.8) return false;

    // Flatness Check (Y-axis alignment)
    const avgShoulderY = (kp[11].y + kp[12].y) / 2;
    return Math.abs(kp[15].y - avgShoulderY) < T_POSE_TOLERANCE && 
           Math.abs(kp[16].y - avgShoulderY) < T_POSE_TOLERANCE;
  }

  function startScanning() {
    let holdStartTime: number | null = null;

    const loop = () => {
        if (phase !== 'scan') return;

        const pose = poseService.getLastResult();
        const isPose = checkTPose(pose);

        if (isPose) {
            if (!holdStartTime) holdStartTime = performance.now();
            const elapsed = performance.now() - holdStartTime;
            tPoseProgress = Math.min(elapsed / REQUIRED_HOLD_MS, 1);

            if (tPoseProgress >= 1) {
                completeCalibration(pose!);
                return; 
            }
        } else {
            holdStartTime = null;
            tPoseProgress = Math.max(tPoseProgress - 0.1, 0); // Fast decay
        }

        scanFrameId = requestAnimationFrame(loop);
    };

    scanFrameId = requestAnimationFrame(loop);
  }

  function completeCalibration(pose: PoseResult) {
    calibration.calibrateFromPose(pose);
    phase = 'success';
    
    // Auto-advance after showing "READY!" for a moment
    setTimeout(() => {
        onConfirm?.();
        // Optional: Reset to setup if they come back later
        setTimeout(() => phase = 'setup', 500); 
    }, 1500);
  }

  // Quality Colors
  const qualityColors: Record<CalibrationQuality, string> = {
    good: 'var(--color-copper-bright)',
    ok: 'var(--color-copper)',
    poor: 'var(--color-oxblood)',
    none: 'var(--color-muted)'
  };
</script>

<div class="calibration-panel" class:compact>
  
  <div class="calibration-header">
    <h3>
        {#if phase === 'setup'}Calibration Setup
        {:else if phase === 'countdown'}Get Ready...
        {:else if phase === 'scan'}Hold T-Pose
        {:else}CALIBRATED!
        {/if}
    </h3>
    
    {#if phase === 'setup' || phase === 'success'}
        <div class="quality-indicator">
            <span class="status-dot" style="background-color: {qualityColors[$calibration.quality]}"></span>
            <span class="quality-label">{$calibrationStatus.qualityLabel}</span>
        </div>
    {/if}
  </div>

  {#if phase === 'setup'}
      <div class="setup-form">
        <div class="height-input-group">
            <label for="height-feet">Your Height</label>
            <div class="height-inputs">
                <div class="input-with-unit">
                    <input type="number" id="height-feet" bind:value={feet} onchange={updateHeight} class="height-input" />
                    <span class="input-unit">ft</span>
                </div>
                <div class="input-with-unit">
                    <input type="number" id="height-inches" bind:value={inches} onchange={updateHeight} class="height-input" />
                    <span class="input-unit">in</span>
                </div>
            </div>
            <p class="height-hint">Enter height to enable velocity metrics.</p>
        </div>
        
        <button class="btn btn-primary btn-lg" onclick={startSequence}>
            Start Calibration
        </button>
      </div>

  {:else if phase === 'countdown'}
      <div class="overlay-center">
          <div class="countdown-number">{countdownValue}</div>
          <p class="instruction">Walk back & face camera</p>
          <button class="btn btn-text" onclick={cancelSequence}>Cancel</button>
      </div>

  {:else if phase === 'scan'}
      <div class="scan-feedback">
          <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: {tPoseProgress * 100}%"></div>
          </div>
          <p class="instruction">Arms Out (Iron Cross)</p>
          <button class="btn btn-text" onclick={cancelSequence}>Cancel</button>
      </div>

  {:else if phase === 'success'}
      <div class="overlay-center">
          <div class="success-message">READY!</div>
      </div>
  {/if}

</div>

<style>
  .calibration-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    min-height: 200px; /* Prevent layout shift */
  }

  /* Header */
  .calibration-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .calibration-header h3 {
    font-size: var(--font-size-lg);
    font-weight: bold;
    color: var(--color-copper);
    margin: 0;
  }

  /* Setup Form */
  .setup-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  .height-inputs { display: flex; gap: var(--space-3); }
  .input-with-unit { display: flex; align-items: center; gap: var(--space-2); flex: 1; }
  .height-input {
    width: 100%; text-align: center; font-size: var(--font-size-xl);
    font-weight: bold; padding: var(--space-3);
    background: var(--color-bg-surface); border: 1px solid var(--color-border);
    color: var(--color-white); border-radius: 4px;
  }
  .input-unit { color: var(--color-muted); font-size: var(--font-size-sm); }
  .height-hint { color: var(--color-muted); font-size: var(--font-size-xs); text-align: center; }

  /* Overlay Modes (Countdown & Success) */
  .overlay-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    animation: fadeIn 0.3s ease;
  }
  
  .countdown-number {
    font-size: 6rem;
    font-weight: 900;
    line-height: 1;
    color: var(--color-copper-bright);
    font-variant-numeric: tabular-nums;
  }

  .success-message {
    font-size: 3rem;
    font-weight: 900;
    color: var(--color-copper-bright);
    text-shadow: 0 0 20px rgba(200, 100, 50, 0.5);
  }

  /* Scan Feedback */
  .scan-feedback {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    align-items: center;
  }
  .progress-bar-bg {
    width: 100%; height: 8px; background: #333;
    border-radius: 4px; overflow: hidden;
  }
  .progress-bar-fill {
    height: 100%; background: var(--color-copper-bright);
    transition: width 0.1s linear;
  }
  .instruction {
    font-size: var(--font-size-lg);
    font-weight: bold;
    text-transform: uppercase;
    color: var(--color-white);
  }

  .btn-text {
    background: none; border: none; color: var(--color-muted);
    text-decoration: underline; cursor: pointer;
  }

  /* Quality Dot */
  .quality-indicator { display: flex; align-items: center; gap: var(--space-2); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; }
  .quality-label { font-size: var(--font-size-sm); color: var(--color-muted); }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
</style>