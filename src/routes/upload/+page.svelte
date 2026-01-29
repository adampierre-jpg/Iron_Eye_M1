<script lang="ts">
  import { onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  // Services
  import { 
    getVideoIngestService, 
    destroyVideoIngestService 
  } from '$lib/services/videoIngest';
  import { poseService } from '$lib/services/pose';       
  import { analysisService } from '$lib/services/analysis';
  
  // Stores
  import {
    calibration,
    videoIngest,
    sideLockStatus
  } from '$lib/stores';
  import { overlay } from '$lib/stores/overlay.svelte';
  
  // Types
  import type { SnatchPhase, PoseResult } from '$lib/types';
  // Remove CalibrationPanel import if not used elsewhere, or keep for other routes
  // import { CalibrationPanel } from '$lib/components'; 

  // --- CONFIG ---

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

  function formatVelocity(mps: number): string {
    return mps <= 0 ? '—' : mps.toFixed(2);
  }

  // --- STATE (Runes) ---

  // DOM Bindings
  let videoElement: HTMLVideoElement;
  let canvasElement: HTMLCanvasElement;
  let fileInput: HTMLInputElement;

  // Local Reactive State
  let videoFile = $state<File | null>(null);
  let videoUrl = $state<string | null>(null);
  let isDragOver = $state(false);
  let isVideoLoaded = $state(false);
  let isCalibrated = $state(false);
  let isProcessing = $state(false);
  
  // Manual Calibration State
  let feet = $state(5); // Default to generic height
  let inches = $state(10); 

  // Service Reference
  let videoService = getVideoIngestService();

  // --- LOGIC ---

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file (MP4, MOV, WebM).');
      return;
    }
    
    // Cleanup previous URL
    if (videoUrl) URL.revokeObjectURL(videoUrl);

    // Reset State
    videoFile = file;
    videoUrl = URL.createObjectURL(file);
    isVideoLoaded = false;
    isProcessing = false;
    isCalibrated = false; // Reset calibration on new file
  }

  async function handleVideoLoaded() {
    if (!videoElement || !videoFile) return;
    isVideoLoaded = true;
    console.log(`[Upload] Loaded: ${videoFile.name} (${videoElement.videoWidth}x${videoElement.videoHeight})`);
    
    // 1. Initialize the service in FILE mode (prevents camera takeover)
    await videoService.initialize(videoElement, handleFrame, { inputType: 'file' });
    
    // 2. Start the Loop (it will idle if paused)
    videoService.startFrameLoop();

    // 3. Manual Static Capture (Draw skeleton on first frame)
    try {
        const initialPose = await poseService.process(videoElement);
        if (initialPose) {
            const initialPhase = await analysisService.process(initialPose);
            overlay.phase = initialPhase;
            
            if (canvasElement) {
                canvasElement.width = videoElement.videoWidth;
                canvasElement.height = videoElement.videoHeight;
                const ctx = canvasElement.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoElement, 0, 0);
                    drawSkeleton(ctx, initialPose);
                }
            }
        }
    } catch (err) {
        console.warn('Could not render initial frame:', err);
    }
  }

  // ✅ NEW: Manual Calibration Handler
  async function handleManualCalibration() {
    if (!videoElement) return;

    // 1. Force process the CURRENT frame (even if video is paused)
    // The loop might skip paused frames, so we explicitly ask for this one.
    const currentPose = await poseService.process(videoElement);

    if (!currentPose || currentPose.keypoints.length === 0) {
        alert("No body detected! Please scrub to a frame where you are visible.");
        return;
    }

    // 2. Set Height in Store
    const totalInches = (feet * 12) + inches;
    calibration.setHeight(totalInches);

    // 3. Calibrate Metrics using the detected pose
    calibration.calibrateFromPose(currentPose);
    
    // 4. Unlock UI
    isCalibrated = true;
    console.log(`[Upload] Calibrated at ${totalInches}" using manual frame.`);
  }

  /**
   * THE LOOP: Called ~60 times per second by videoIngest.ts
   */
  function handleFrame(poseResult: PoseResult) {
    overlay.fps = poseResult.fps;
    
    if (canvasElement && videoElement) {
      const ctx = canvasElement.getContext('2d');
      if (ctx) {
        if (canvasElement.width !== videoElement.videoWidth) {
          canvasElement.width = videoElement.videoWidth;
          canvasElement.height = videoElement.videoHeight;
        }
        ctx.drawImage(videoElement, 0, 0);
        drawSkeleton(ctx, poseResult);
      }
    }
  }

  function drawSkeleton(ctx: CanvasRenderingContext2D, result: PoseResult) {
    ctx.fillStyle = '#00ff00';
    for (const kp of result.keypoints) {
      if (kp.score > 0.5) {
        ctx.beginPath();
        ctx.arc(kp.x * ctx.canvas.width, kp.y * ctx.canvas.height, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  function handleStartProcessing() {
    if (!isCalibrated) return;
    isProcessing = true;
    videoElement?.play();
  }

  function handleStopProcessing() {
    isProcessing = false;
    videoElement?.pause();
  }

  // --- CLEANUP ---
  onDestroy(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    destroyVideoIngestService();
  });
</script>

<svelte:head>
  <title>Iron Eye — Upload</title>
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
        ondragenter={(e) => { e.preventDefault(); isDragOver = true; }}
        ondragleave={(e) => { e.preventDefault(); isDragOver = false; }}
        ondragover={(e) => e.preventDefault()}
        ondrop={(e) => {
          e.preventDefault();
          isDragOver = false;
          if (e.dataTransfer?.files[0]) handleFileSelect(e.dataTransfer.files[0]);
        }}
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
        <p class="upload-text"><strong>Drop video here</strong><br />or click to browse</p>
        <p class="upload-hint">MP4, MOV, WebM supported</p>
        <input 
          type="file"
          accept="video/*"
          bind:this={fileInput}
          onchange={(e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files?.[0]) handleFileSelect(files[0]);
          }}
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
            class="upload-video"
          ></video>

          <canvas
            bind:this={canvasElement}
            class="upload-canvas"
          ></canvas>
        </div>
        
        {#if isVideoLoaded}
          <div class="video-info">
            <span class="video-filename">{videoFile?.name}</span>
            <span class="video-dimensions">{videoElement?.videoWidth}×{videoElement?.videoHeight}</span>
          </div>
        {/if}
      </div>

      {#if isVideoLoaded}
        <div class="stats-panel">
          <div class="stat-item">
            <span class="stat-label">Phase</span>
            <span class="stat-value">{phaseLabels[overlay.phase] ?? '-'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Side</span>
            <span class="stat-value">{sideLockStatus.label ?? '-'}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Reps</span>
            <span class="stat-value">{overlay.repCount ?? 0}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Velocity</span>
            <span class="stat-value">{formatVelocity(overlay.currentVelocity ?? 0)} m/s</span>
          </div>
          <div class="stat-item">
             <span class="stat-label">FPS</span>
             <span class="stat-value">{overlay.fps}</span>
          </div>
        </div>
      {/if}

      <div class="control-panel">
        {#if !isCalibrated}
          <div class="panel-section">
            <div class="manual-calibration">
                <h3>Calibration</h3>
                <p class="hint">Enter height and click to calibrate on the current frame.</p>
                
                <div class="height-inputs">
                    <div class="input-group">
                        <input type="number" bind:value={feet} min="3" max="8" />
                        <span>ft</span>
                    </div>
                    <div class="input-group">
                        <input type="number" bind:value={inches} min="0" max="11" />
                        <span>in</span>
                    </div>
                    <button class="btn btn-primary" onclick={handleManualCalibration}>
                        Confirm
                    </button>
                </div>
            </div>
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
            isCalibrated = false;
            isProcessing = false;
          }}>
            New Video
          </button>
        </div>
      </div>
    {/if}
  </div>
</main>

<style>
  /* Base styles inherited from previous version */
  .upload-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background-color: var(--color-black);
  }
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
    transition: all 0.2s;
  }
  .back-btn:hover { background-color: var(--color-black-lighter); }
  .back-btn svg { width: 20px; height: 20px; }
  .upload-header h1 { font-size: var(--font-size-lg); font-weight: bold; }
  .header-spacer { width: 80px; }
  
  .upload-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--space-6);
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  /* Drop Zone */
  .drop-zone {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 2px dashed var(--color-black-lighter);
    border-radius: var(--radius-lg);
    background-color: var(--color-black-light);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 400px;
  }
  .drop-zone:hover, .drop-zone.dragover {
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.05);
  }
  .upload-icon { width: 64px; height: 64px; color: var(--color-muted); margin-bottom: var(--space-4); }
  .drop-zone:hover .upload-icon { color: var(--color-copper); }
  .upload-text { color: var(--color-white); text-align: center; margin-bottom: var(--space-2); }
  .upload-hint { color: var(--color-muted); font-size: var(--font-size-sm); }

  /* Video Area */
  .video-section { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-5); }
  .video-container {
    position: relative;
    background-color: var(--color-black-light);
    border-radius: var(--radius-lg);
    overflow: hidden;
    border: 1px solid var(--color-black-lighter);
    aspect-ratio: 16 / 9;
  }
  .upload-video {
    position: absolute;
    top: 0; left: 0; width: 100%;
    height: 100%;
    object-fit: contain;
    background: black;
  }
  .upload-canvas {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: contain;
    pointer-events: none;
    z-index: 10;
  }
  .video-info { display: flex; justify-content: space-between; padding: 0 var(--space-2); color: var(--color-muted); font-size: var(--font-size-sm); }

  /* Stats */
  .stats-panel {
    display: flex; flex-wrap: wrap; gap: var(--space-4); padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    margin-bottom: var(--space-4);
  }
  .stat-item { display: flex; flex-direction: column; align-items: center; min-width: 80px; }
  .stat-label { font-size: var(--font-size-xs); color: var(--color-muted); text-transform: uppercase; }
  .stat-value { font-size: var(--font-size-lg); font-weight: bold; color: var(--color-white); }

  /* Controls */
  .control-panel { display: flex; flex-direction: column; gap: var(--space-4); }
  .panel-section {
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
  }
  .panel-section.calibrated { display: flex; justify-content: space-between; align-items: center; }
  .calibration-status { display: flex; align-items: center; gap: var(--space-2); color: var(--color-copper); }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; background-color: var(--color-copper); }
  
  /* ✅ NEW: Manual Calibration Styles */
  .manual-calibration h3 { color: var(--color-copper); font-size: var(--font-size-md); font-weight: bold; margin-bottom: var(--space-2); }
  .manual-calibration .hint { color: var(--color-muted); font-size: var(--font-size-sm); margin-bottom: var(--space-4); }
  .height-inputs { display: flex; gap: var(--space-3); align-items: center; }
  .input-group { display: flex; align-items: center; gap: var(--space-2); }
  .input-group input {
    background: var(--color-black); border: 1px solid var(--color-black-lighter);
    color: var(--color-white); padding: var(--space-2); border-radius: var(--radius-sm);
    width: 60px; text-align: center; font-weight: bold;
  }
  .input-group span { color: var(--color-muted); font-size: var(--font-size-sm); }

  /* Buttons */
  .btn {
    padding: var(--space-3);
    border-radius: var(--radius-md);
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  .btn-primary { background-color: var(--color-copper); color: var(--color-black); }
  .btn-primary:hover:not(:disabled) { background-color: var(--color-copper-bright); }
  .btn-primary:disabled { background-color: var(--color-black-lighter); color: var(--color-muted); cursor: not-allowed; }
  .btn-warning { background-color: var(--color-oxblood); color: white; }
  .btn-secondary { background-color: transparent; border: 1px solid var(--color-black-lighter); color: var(--color-white); }
  .btn-secondary:hover { border-color: var(--color-white); }
  .btn-ghost { background: transparent; color: var(--color-muted); padding: var(--space-2); }
  .btn-ghost:hover { color: var(--color-white); }
</style>