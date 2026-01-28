<script lang="ts">
  import { calibration, calibrationStatus } from '$lib/stores';
  import { poseService } from '$lib/services/pose'; // Import Service
  import type { CalibrationQuality } from '$lib/types';
  
  // Props
  let { 
    onConfirm,
    compact = false
  }: { 
    onConfirm?: () => void;
    compact?: boolean;
  } = $props();
  
  // Local state for height input (feet/inches)
  let feet = $state(Math.floor($calibration.heightInches / 12));
  let inches = $state($calibration.heightInches % 12);
  
  // Convert and update on change
  function updateHeight() {
    const totalInches = (feet * 12) + inches;
    calibration.setHeight(totalInches);
  }
  
  // Handle confirm
  function handleConfirm() {
    updateHeight();

    // 1. Get the current pose from the service
    const currentPose = poseService.getLastResult();

    if (currentPose && currentPose.keypoints.length > 0) {
        // 2. Perform math in the store
        calibration.calibrateFromPose(currentPose);
        onConfirm?.();
    } else {
        // Fallback or Alert (Ideally use a Toast)
        console.warn("⚠️ Cannot calibrate: No pose detected.");
        alert("Please stand clearly in the frame to calibrate.");
    }
  }
  
  // Quality indicator colors
  const qualityColors: Record<CalibrationQuality, string> = {
    good: 'var(--color-copper-bright)',
    ok: 'var(--color-copper)',
    poor: 'var(--color-oxblood)',
    none: 'var(--color-muted)'
  };
</script>

<div class="calibration-panel" class:compact>
  <div class="calibration-header">
    <h3>Calibration</h3>
    <div class="quality-indicator">
      <span 
        class="status-dot" 
        class:active={$calibrationStatus.isCalibrated}
        style="background-color: {qualityColors[$calibration.quality]}"
      ></span>
      <span class="quality-label">{$calibrationStatus.qualityLabel}</span>
    </div>
  </div>
  
  <div class="height-input-group">
    <label for="height-feet">Your Height</label>
    <div class="height-inputs">
      <div class="input-with-unit">
        <input
          type="number"
          id="height-feet"
          bind:value={feet}
          onchange={updateHeight}
          min="4"
          max="7"
          class="height-input"
        />
        <span class="input-unit">ft</span>
      </div>
      <div class="input-with-unit">
        <input
          type="number"
          id="height-inches"
          bind:value={inches}
          onchange={updateHeight}
          min="0"
          max="11"
          class="height-input"
        />
        <span class="input-unit">in</span>
      </div>
    </div>
    <p class="height-hint">
      Stand in frame and click Confirm to calibrate velocity.
    </p>
  </div>
  
  <button 
    class="btn btn-primary" 
    class:btn-lg={!compact}
    onclick={handleConfirm}
  >
    Confirm Calibration
  </button>
</div>

<style>
  .calibration-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .calibration-panel.compact {
    gap: var(--space-3);
  }
  
  .calibration-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .calibration-header h3 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }
  
  .quality-indicator {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .quality-label {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
  }
  
  .height-input-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .height-input-group label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-white);
  }
  
  .height-inputs {
    display: flex;
    gap: var(--space-3);
  }
  
  .input-with-unit {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
  }
  
  .height-input {
    width: 100%;
    text-align: center;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    padding: var(--space-3);
  }
  
  .input-unit {
    color: var(--color-muted);
    font-size: var(--font-size-sm);
    min-width: 20px;
  }
  
  .height-hint {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    margin-bottom: 0;
  }
  
  .compact .height-input {
    padding: var(--space-2);
    font-size: var(--font-size-base);
  }
  
  .compact .calibration-header h3 {
    font-size: var(--font-size-base);
  }
</style>