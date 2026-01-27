<!--
  Live Screen (Screen C)
  Edge-to-edge camera view, mobile-first
  
  Elements (≤5 visible):
  - Phase label (top-left)
  - Side lock + confidence (top-right)
  - Velocity display (bottom-center)
  - Rep counter (bottom-left)
  - Alert banner (when active)
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { VideoOverlay, FramingGuide, CalibrationPanel } from '$lib/components';
  import { 
    getVideoIngestService, 
    destroyVideoIngestService 
  } from '$lib/services/videoIngest';
  import { 
    sessionConfig, 
    calibration, 
    calibrationStatus, 
    overlay, 
    ui, 
    videoIngest 
  } from '$lib/stores';
  import type { FrameData, PoseResult } from '$lib/types';
  
  // State
  let videoElement: HTMLVideoElement;
  let isSetupPhase = $state(true);
  let isCalibrating = $state(true);
  let cameraError = $state<string | null>(null);
  let framingQuality = $state<'waiting' | 'good' | 'adjust'>('waiting');
  let showDebug = $state(false);
  
  // Video ingest service
  let videoService = getVideoIngestService();
  
  // Initialize camera on mount
  onMount(async () => {
    if (!browser) return;
    
    ui.setLoading(true);
    
    try {
      const success = await videoService.initialize(
        videoElement,
        handleFrame,
        {
          targetFps: 60,
          facingMode: 'environment'
        }
      );
      
      if (!success) {
        cameraError = 'Could not access camera. Please check permissions.';
        return;
      }
      
      // Start frame loop
      videoService.startFrameLoop();
      
      // Simulate framing detection after delay
      // Real implementation would use pose detection
      setTimeout(() => {
        framingQuality = 'good';
      }, 2000);
      
    } catch (err) {
      console.error('[Live] Camera init error:', err);
      cameraError = 'Camera initialization failed.';
    } finally {
      ui.setLoading(false);
    }
  });
  
  // Cleanup on destroy
  onDestroy(() => {
    destroyVideoIngestService();
    overlay.reset();
  });
  
  // Handle incoming frames
  function handleFrame(poseResult: PoseResult) {
    // Update FPS in overlay
    overlay.updateFps(videoIngest.actualFps);
    
    // TODO: Milestone 2+ will add pose detection and phase classification here
    // For now, just tracking that frames are being processed
  }
  
  // Handle calibration confirm
  function handleCalibrationConfirm() {
    isCalibrating = false;
  }
  
  // Handle start session (exit setup phase)
  function handleStartSession() {
    isSetupPhase = false;
    // Clear framing guide
    framingQuality = 'good';
  }
  
  // Handle exit
  function handleExit() {
    destroyVideoIngestService();
    goto('/');
  }
  
  // Handle end session
  function handleEndSession() {
    // TODO: Navigate to summary with session data
    destroyVideoIngestService();
    goto('/summary');
  }
  
  // Toggle debug mode
  function toggleDebug() {
    showDebug = !showDebug;
  }
</script>

<svelte:head>
  <title>Iron Eye — Live Session</title>
</svelte:head>

<!-- Prevent scroll and enable fullscreen -->
<svelte:window on:touchmove|preventDefault={() => {}} />

<main class="live-screen">
  <!-- Video container (edge-to-edge) -->
  <div class="video-fullscreen">
    <!-- Camera video -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video 
      bind:this={videoElement}
      playsinline
      muted
      class="camera-video"
    ></video>
    
    <!-- Setup overlay (calibration + framing) -->
    {#if isSetupPhase}
      <div class="setup-overlay safe-all">
        <!-- Framing guide -->
        {#if !isCalibrating}
          <FramingGuide visible={true} quality={framingQuality} />
        {/if}
        
        <!-- Calibration panel (modal style) -->
        {#if isCalibrating}
          <div class="calibration-modal">
            <button class="close-btn" onclick={handleExit} aria-label="Close and exit">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            
            <CalibrationPanel onConfirm={handleCalibrationConfirm} />
          </div>
        {:else}
          <!-- Ready to start -->
          <div class="setup-controls">
            <div class="setup-status">
              <span class="status-dot active"></span>
              <span>Ready — {$calibration.heightInches}″</span>
            </div>
            
            <button class="btn btn-primary btn-lg" onclick={handleStartSession}>
              Begin Session
            </button>
            
            <button class="btn btn-ghost" onclick={() => isCalibrating = true}>
              Recalibrate
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Active session overlay -->
      <VideoOverlay showFps={true} debugMode={showDebug} />
      
      <!-- Exit button (top-left, behind overlay) -->
      <button class="exit-btn safe-top" onclick={handleEndSession}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
        </svg>
        <span>End</span>
      </button>
      
      <!-- Debug toggle (hidden, tap corner to show) -->
      <button class="debug-toggle safe-bottom" onclick={toggleDebug}>
        {showDebug ? 'Hide Debug' : ''}
      </button>
    {/if}
  </div>
  
  <!-- Error state -->
  {#if cameraError}
    <div class="error-overlay safe-all">
      <div class="error-content">
        <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
        <h2>Camera Error</h2>
        <p>{cameraError}</p>
        <button class="btn btn-primary" onclick={handleExit}>
          Go Back
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Loading state -->
  {#if $ui.isLoading}
    <div class="loading-overlay safe-all">
      <div class="spinner"></div>
      <p>Starting camera...</p>
    </div>
  {/if}
</main>

<style>
  .live-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    background-color: var(--color-black);
    overflow: hidden;
  }
  
  /* Camera video */
  .camera-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scaleX(-1); /* Mirror for front camera */
  }
  
  /* Setup overlay */
  .setup-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.3);
  }
  
  /* Calibration modal */
  .calibration-modal {
    position: relative;
    width: 90%;
    max-width: 360px;
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    padding: var(--space-5);
    margin: var(--space-4);
  }
  
  .close-btn {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--color-muted);
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }
  
  .close-btn:hover {
    color: var(--color-white);
    background-color: var(--color-black-lighter);
  }
  
  .close-btn svg {
    width: 20px;
    height: 20px;
  }
  
  /* Setup controls */
  .setup-controls {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6);
    padding-bottom: calc(var(--space-6) + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
  }
  
  .setup-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: rgba(0, 0, 0, 0.6);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    color: var(--color-copper);
  }
  
  /* Exit button */
  .exit-btn {
    position: absolute;
    top: var(--space-4);
    left: var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-oxblood);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    z-index: calc(var(--z-overlay) + 1);
    transition: all var(--transition-fast);
  }
  
  .exit-btn:hover {
    background-color: var(--color-oxblood);
    color: var(--color-white);
  }
  
  .exit-btn svg {
    width: 18px;
    height: 18px;
  }
  
  /* Debug toggle (invisible tap target) */
  .debug-toggle {
    position: absolute;
    bottom: var(--space-4);
    right: var(--space-4);
    padding: var(--space-2);
    background: transparent;
    border: none;
    color: var(--color-muted);
    font-size: var(--font-size-xs);
    cursor: pointer;
    opacity: 0.5;
    min-width: 44px;
    min-height: 44px;
  }
  
  /* Error overlay */
  .error-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    background-color: var(--color-black);
    z-index: var(--z-modal);
  }
  
  .error-content {
    text-align: center;
    padding: var(--space-6);
    max-width: 320px;
  }
  
  .error-icon {
    width: 64px;
    height: 64px;
    color: var(--color-oxblood);
    margin-bottom: var(--space-4);
  }
  
  .error-content h2 {
    margin-bottom: var(--space-2);
  }
  
  .error-content p {
    color: var(--color-muted);
    margin-bottom: var(--space-5);
  }
  
  /* Loading overlay */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--space-4);
    background-color: var(--color-black);
    z-index: var(--z-modal);
  }
  
  .loading-overlay p {
    color: var(--color-muted);
    margin: 0;
  }
</style>
