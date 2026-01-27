<!--
  VideoOverlay Component
  Shared overlay for both Live and Upload modes
  
  Elements (≤5 visible):
  - Top-left: Phase label (small)
  - Top-right: Side lock + confidence dot
  - Bottom-center: Live velocity + Peak after rep
  - Bottom-left: Rep counter
  - Alert banner (when active)
-->

<script lang="ts">
  import { overlay, trackingStatus, sideLockStatus } from '$lib/stores';
  import type { SnatchPhase } from '$lib/types';
  
  // Props
  let { 
    showFps = false,
    debugMode = false 
  }: { 
    showFps?: boolean;
    debugMode?: boolean;
  } = $props();
  
  // Phase display names
  const phaseLabels: Record<SnatchPhase, string> = {
    STANDING: 'Standing',
    HANDONBELL: 'Ready',
    HIKE: 'Hike',
    PULL: 'Pull',
    FLOAT: 'Float',
    LOCKOUT: 'Lockout',
    DROP: 'Drop',
    CATCH: 'Catch',
    PARK: 'Park'
  };
  
  // Format velocity for display
  function formatVelocity(mps: number): string {
    if (mps <= 0) return '—';
    return mps.toFixed(2);
  }
  
  // Determine if we're in a concentric phase
  function isConcentricPhase(phase: SnatchPhase): boolean {
    return phase === 'PULL' || phase === 'FLOAT' || phase === 'LOCKOUT';
  }
</script>

<!-- Overlay Layer -->
<div class="overlay-layer safe-all">
  
  <!-- Top Row -->
  <div class="overlay-top">
    <!-- Phase Label (left) -->
    <div class="phase-badge" class:active={isConcentricPhase($overlay.phase)}>
      <span class="phase-label">{phaseLabels[$overlay.phase]}</span>
    </div>
    
    <!-- Side Lock + Confidence (right) -->
    <div class="side-status">
      <span 
        class="status-dot" 
        class:active={$sideLockStatus.isLocked}
        class:pulse={!$sideLockStatus.isLocked}
        class:inactive={!$trackingStatus.isTracking}
      ></span>
      <span class="side-label">{$sideLockStatus.label}</span>
    </div>
  </div>
  
  <!-- Bottom Row -->
  <div class="overlay-bottom">
    <!-- Rep Counter (left) -->
    <div class="rep-counter">
      <span class="rep-count">{$overlay.repCount}</span>
      <span class="rep-label">reps</span>
    </div>
    
    <!-- Velocity Display (center) -->
    <div class="velocity-display" class:active={isConcentricPhase($overlay.phase)}>
      {#if isConcentricPhase($overlay.phase)}
        <span class="velocity-current">{formatVelocity($overlay.currentVelocity)}</span>
        <span class="velocity-unit">m/s</span>
      {:else if $overlay.peakVelocity > 0}
        <span class="velocity-peak-label">Peak</span>
        <span class="velocity-peak">{formatVelocity($overlay.peakVelocity)}</span>
        <span class="velocity-unit">m/s</span>
      {:else}
        <span class="velocity-placeholder">—</span>
      {/if}
    </div>
    
    <!-- FPS (right, optional) -->
    {#if showFps}
      <div class="fps-display">
        <span class="fps-value">{$overlay.fps}</span>
        <span class="fps-label">fps</span>
      </div>
    {/if}
  </div>
  
  <!-- Alert Banner -->
  {#if $overlay.alert}
    <div class="alert-banner visible">
      {$overlay.alert.message}
    </div>
  {/if}
</div>

<!-- Debug HUD (hidden by default) -->
{#if debugMode}
  <div class="debug-hud">
    <dl>
      <dt>Phase</dt>
      <dd>{$overlay.phase} ({($overlay.phaseConfidence * 100).toFixed(0)}%)</dd>
      
      <dt>Side</dt>
      <dd>{$overlay.side || '—'} ({$overlay.sideLocked ? 'locked' : 'unlocked'})</dd>
      
      <dt>Tracking</dt>
      <dd>{$trackingStatus.label}</dd>
      
      <dt>Velocity</dt>
      <dd>{formatVelocity($overlay.currentVelocity)} / {formatVelocity($overlay.peakVelocity)}</dd>
      
      <dt>Reps</dt>
      <dd>{$overlay.repCount} (Set {$overlay.setCount})</dd>
      
      <dt>FPS</dt>
      <dd>{$overlay.fps}</dd>
    </dl>
  </div>
{/if}

<style>
  /* Overlay positioning */
  .overlay-layer {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: var(--space-4);
  }
  
  /* Top row */
  .overlay-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  /* Phase badge */
  .phase-badge {
    background-color: rgba(0, 0, 0, 0.6);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
    border: 1px solid transparent;
    transition: all var(--transition-fast);
  }
  
  .phase-badge.active {
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.2);
  }
  
  .phase-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-white);
  }
  
  .phase-badge.active .phase-label {
    color: var(--color-copper-bright);
  }
  
  /* Side status */
  .side-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    background-color: rgba(0, 0, 0, 0.6);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
  }
  
  .side-label {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
  }
  
  /* Bottom row */
  .overlay-bottom {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }
  
  /* Rep counter */
  .rep-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.6);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
    min-width: 60px;
  }
  
  .rep-count {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-white);
    line-height: 1;
  }
  
  .rep-label {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    text-transform: uppercase;
  }
  
  /* Velocity display */
  .velocity-display {
    display: flex;
    align-items: baseline;
    gap: var(--space-2);
    background-color: rgba(0, 0, 0, 0.6);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
    border: 2px solid transparent;
    transition: all var(--transition-fast);
  }
  
  .velocity-display.active {
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.15);
  }
  
  .velocity-current,
  .velocity-peak {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-copper-bright);
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  
  .velocity-peak-label {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    text-transform: uppercase;
  }
  
  .velocity-unit {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
  }
  
  .velocity-placeholder {
    font-size: var(--font-size-2xl);
    color: var(--color-muted);
  }
  
  /* FPS display */
  .fps-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.6);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
  }
  
  .fps-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-copper);
    font-variant-numeric: tabular-nums;
  }
  
  .fps-label {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
  }
  
  /* Alert banner override for overlay context */
  :global(.alert-banner) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: var(--space-3) var(--space-4);
    padding-top: calc(var(--space-3) + env(safe-area-inset-top, 0px));
  }
  
  /* Mobile adjustments */
  @media (max-width: 640px) {
    .velocity-current,
    .velocity-peak {
      font-size: var(--font-size-2xl);
    }
    
    .rep-count {
      font-size: var(--font-size-xl);
    }
    
    .rep-counter {
      min-width: 50px;
      padding: var(--space-2);
    }
  }
</style>
