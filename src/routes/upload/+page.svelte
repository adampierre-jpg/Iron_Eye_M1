<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { CalibrationPanel } from '$lib/components';
  import { 
    getVideoIngestService, 
    destroyVideoIngestService 
  } from '$lib/services/videoIngest';
  import {
    calibration,
    calibrationStatus,
    overlay,
    ui,
    videoIngest,
    trackingStatus,
    sideLockStatus
  } from '$lib/stores';
  import type { FrameData, SnatchPhase } from '$lib/types';

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
  
  // State
  // svelte-ignore non_reactive_update
  let videoElement: HTMLVideoElement;
  // svelte-ignore non_reactive_update
  let canvasElement: HTMLCanvasElement; // [FIX] Added canvas ref
  // svelte-ignore non_reactive_update
  let fileInput: HTMLInputElement;
  
  let videoFile = $state<File | null>(null);
  let videoUrl = $state<string | null>(null);
  let isDragOver = $state(false);
  let isVideoLoaded = $state(false);
  let isCalibrated = $state(false);
  let isProcessing = $state(false);
  let showDebug = $state(false);
  
  // Video ingest service
  let videoService: ReturnType<typeof getVideoIngestService> | null = null;
  
  // Handle file selection
  async function handleFileSelect(file: File) {
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    videoFile = file;
    videoUrl = URL.createObjectURL(file);
    console.log('Selected file:', file);
    console.log('Generated videoUrl:', videoUrl);
    isVideoLoaded = false;
    isProcessing = false;
    
    overlay.reset();
  }
  
  // Handle video loaded
  async function handleVideoLoaded() {
    if (!videoElement || !videoFile) return;
    isVideoLoaded = true;
    
    videoService = getVideoIngestService();
    const success = await videoService.initializeUploadVideo(
      videoElement,
      videoFile,
      handleFrame
    );
    
    if (success) {
      try {
        await videoElement.play();
      } catch (e) {
        console.warn('Auto-play failed', e);
        videoElement.controls = true; 
      }
      console.log('[Upload] Video ready for processing');
    }
  }
  
  // Handle frame processing
  function handleFrame(frame: FrameData) {
    overlay.updateFps($videoIngest.actualFps);
    
    // [FIX] Draw video frame to canvas
    if (canvasElement && videoElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        // Sync canvas size if needed
        if (canvasElement.width !== videoElement.videoWidth || 
            canvasElement.height !== videoElement.videoHeight) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
        }

        // Draw the raw video frame
        ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

        // TODO: Milestone 2+ Draw skeletons/overlays here using ctx
      }
    }
  }
  
  // Handle calibration confirm
  function handleCalibrationConfirm() {
    isCalibrated = true;
  }
  
  // Start processing
  function handleStartProcessing() {
    if (!videoService || !isCalibrated) return;
    isProcessing = true;
    videoService.startFrameLoop();
    videoElement?.play();
  }
  
  // Stop processing
  function handleStopProcessing() {
    isProcessing = false;
    videoService?.stopFrameLoop();
    videoElement?.pause();
  }
  
  // Handle drag events
  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }
  
  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
  }
  
  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }
  
  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }
  
  function handleInputChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }
  
  onDestroy(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    destroyVideoIngestService();
    overlay.reset();
  });
</script>

<svelte:head>
  <title>Iron Eye — Upload Video</title>
</svelte:head>

<main class="upload-screen">
  <header class="upload-header">
    <button class="back-btn" onclick={() => goto('/')}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      <span>Back</span>
    </button>
    
    <h1>Upload Video</h1>
    
    <div class="header-spacer"></div>
  </header>
  
  <div class="upload-content">
    {#if !videoUrl}
      <div 
        class="drop-zone"
        class:dragover={isDragOver}
        ondragenter={handleDragEnter}
        ondragleave={handleDragLeave}
        ondragover={handleDragOver}
        ondrop={handleDrop}
        onclick={() => fileInput?.click()}
        role="button"
        tabindex="0"
        onkeydown={(e) => e.key === 'Enter' && fileInput?.click()}
      >
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p class="upload-text">
          <strong>Drop video here</strong>
          <br />
          or click to browse
        </p>
        <p class="upload-hint">MP4, MOV, WebM supported</p>
        
        <input 
          type="file"
          accept="video/*"
          bind:this={fileInput}
          onchange={handleInputChange}
          class="sr-only"
        />
      </div>
    {:else}
      <div class="video-section">
        <div class="video-container">
          <video 
            bind:this={videoElement}
            src={videoUrl}
            playsinline
            loop
            muted
            controls={!isProcessing}
            onloadedmetadata={handleVideoLoaded}
            onerror={() => { console.error('Video failed to load', videoUrl, videoFile); }}
            class="upload-video"
          ></video>

          <canvas
            bind:this={canvasElement}
            class="upload-canvas"
            class:hidden={!isProcessing}
          ></canvas>
          
        </div>
        
        {#if isVideoLoaded}
          <div class="video-info">
            <span class="video-filename">{videoFile?.name}</span>
            <span class="video-dimensions">
              {videoElement?.videoWidth}×{videoElement?.videoHeight}
            </span>
          </div>
        {/if}
      </div>

      {#if isProcessing}
        <div class="stats-panel">
          <div class="stat-item">
            <span class="stat-label">Phase</span>
            <span class="stat-value">{phaseLabels[$overlay.phase]}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Side</span>
            <span class="stat-value">{$sideLockStatus.label}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Reps</span>
            <span class="stat-value">{$overlay.repCount}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Velocity</span>
            <span class="stat-value">{formatVelocity($overlay.currentVelocity)} m/s</span>
          </div>
          {#if $overlay.peakVelocity > 0}
            <div class="stat-item">
              <span class="stat-label">Peak</span>
              <span class="stat-value highlight">{formatVelocity($overlay.peakVelocity)} m/s</span>
            </div>
          {/if}
          {#if showDebug}
            <div class="stat-item">
              <span class="stat-label">FPS</span>
              <span class="stat-value">{$overlay.fps}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if $overlay.alert}
        <div class="alert-banner-inline">
          {$overlay.alert.message}
        </div>
      {/if}

      <div class="control-panel">
        {#if !isCalibrated}
          <div class="panel-section">
            <CalibrationPanel compact={true} onConfirm={handleCalibrationConfirm} />
          </div>
        {:else}
          <div class="panel-section calibrated">
            <div class="calibration-status">
              <span class="status-dot active"></span>
              <span>Calibrated — {$calibration.heightInches}″</span>
            </div>
            <button class="btn btn-ghost btn-sm" onclick={() => isCalibrated = false}>
              Recalibrate
            </button>
          </div>
        {/if}
        
        <div class="panel-section">
          {#if !isProcessing}
            <button 
              class="btn btn-primary" 
              onclick={handleStartProcessing}
              disabled={!isCalibrated || !isVideoLoaded}
            >
              Start Processing
            </button>
          {:else}
            <button class="btn btn-warning" onclick={handleStopProcessing}>
              Stop Processing
            </button>
          {/if}
          
          <button class="btn btn-secondary" onclick={() => {
            if (videoUrl) URL.revokeObjectURL(videoUrl);
            videoFile = null;
            videoUrl = null;
            isVideoLoaded = false;
            isCalibrated = false;
            isProcessing = false;
          }}>
            Choose Different Video
          </button>
        </div>
        
        <div class="panel-section debug-section">
          <label class="debug-label">
            <input 
              type="checkbox" 
              bind:checked={showDebug}
            />
            <span>Show Debug HUD</span>
          </label>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  .upload-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-black);
  }
  
  /* Header */
  .upload-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-4);
    border-bottom: 1px solid var(--color-black-lighter);
  }
  
  .back-btn {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: transparent;
    border: none;
    color: var(--color-copper);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    cursor: pointer;
    border-radius: var(--radius-md);
    transition: all var(--transition-fast);
  }
  
  .back-btn:hover {
    background-color: var(--color-black-lighter);
  }
  
  .back-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .upload-header h1 {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }
  
  .header-spacer {
    width: 80px;
  }
  
  /* Content */
  .upload-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-6);
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }
  
  /* Drop zone */
  .upload-icon {
    width: 64px;
    height: 64px;
    color: var(--color-muted);
    margin-bottom: var(--space-4);
    transition: color var(--transition-normal);
  }
  
  .drop-zone:hover .upload-icon,
  .drop-zone.dragover .upload-icon {
    color: var(--color-copper);
  }
  
  .upload-text {
    color: var(--color-white);
    margin-bottom: var(--space-2);
  }
  
  .upload-text strong {
    font-size: var(--font-size-lg);
  }
  
  .upload-hint {
    color: var(--color-muted);
    font-size: var(--font-size-sm);
    margin-bottom: 0;
  }
  
  /* Video section */
  .video-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }
  
  /* [FIX] Updated container for stacking */
  .video-container {
    position: relative; /* Critical for absolute children */
    background-color: var(--color-black-light);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--color-black-lighter);
    min-height: 240px;
    aspect-ratio: 16 / 9;
  }
  
  /* [FIX] Video absolute positioning */
  .upload-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: black;
    z-index: 1;
  }

  /* [FIX] Canvas absolute positioning */
  .upload-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    z-index: 2;
    pointer-events: none; /* Let clicks pass through to video controls */
  }

  /* Helper to hide canvas when not processing */
  .hidden {
    display: none;
  }
  
  .video-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--space-2);
  }
  
  .video-filename {
    font-size: var(--font-size-sm);
    color: var(--color-white);
    font-weight: var(--font-weight-medium);
  }
  
  .video-dimensions {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
    font-variant-numeric: tabular-nums;
  }
  
  /* Control panel */
  .control-panel {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .panel-section {
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
  }
  
  .panel-section.calibrated {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .calibration-status {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-copper);
  }
  
  .panel-section:not(.calibrated) {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .panel-section:has(.btn-primary) {
    flex-direction: row;
    gap: var(--space-3);
  }
  
  .panel-section:has(.btn-primary) .btn {
    flex: 1;
  }
  
  /* Debug section */
  .debug-section {
    padding: var(--space-3);
  }
  
  .debug-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    color: var(--color-muted);
    font-size: var(--font-size-sm);
  }
  
  .debug-label input {
    width: 16px;
    height: 16px;
  }

  /* Stats HUD Panel */
  .stats-panel {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-4);
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 80px;
  }

  .stat-label {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    text-transform: uppercase;
  }

  .stat-value {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--color-white);
  }

  .stat-value.highlight {
    color: var(--color-copper-bright);
  }

  .alert-banner-inline {
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-oxblood);
    color: var(--color-white);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-4);
    text-align: center;
    font-weight: var(--font-weight-medium);
  }

  /* Responsive */
  @media (max-width: 768px) {
    .upload-content {
      padding: var(--space-4);
    }
    
    .panel-section:has(.btn-primary) {
      flex-direction: column;
    }
    
    .panel-section:has(.btn-primary) .btn {
      width: 100%;
    }
  }
</style>