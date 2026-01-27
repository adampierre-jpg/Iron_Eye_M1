<!--
  Session Select Screen (Screen A)
  - Movement selection: Snatch (v1), others locked
  - Mode selection: Live / Upload
  - Toggles: Form Eval (off), Notion Export
  - Optional: Load, Notes
  
  Goal: 1-2 taps from open → camera/upload
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionConfig } from '$lib/stores';
  import type { Movement, SessionMode } from '$lib/types';
  
  // Movement options
  const movements: { id: Movement; label: string; available: boolean }[] = [
    { id: 'snatch', label: 'Snatch', available: true },
    { id: 'swing', label: 'Swing', available: false },
    { id: 'clean', label: 'Clean', available: false },
    { id: 'complex', label: 'Complex', available: false }
  ];
  
  // Local state bound to store
  let selectedMovement = $state($sessionConfig.movement);
  let selectedMode = $state<SessionMode>($sessionConfig.mode);
  let notionExport = $state($sessionConfig.notionExportEnabled);
  let loadKg = $state($sessionConfig.loadKg?.toString() || '');
  let notes = $state($sessionConfig.notes || '');
  
  // Handle start
  function handleStart() {
    // Update store
    sessionConfig.setMovement(selectedMovement);
    sessionConfig.setMode(selectedMode);
    sessionConfig.setNotionExport(notionExport);
    sessionConfig.setLoad(loadKg ? parseFloat(loadKg) : undefined);
    sessionConfig.setNotes(notes || undefined);
    
    // Navigate to appropriate mode
    if (selectedMode === 'live') {
      goto('/live');
    } else {
      goto('/upload');
    }
  }
</script>

<svelte:head>
  <title>Iron Eye — Session Setup</title>
</svelte:head>

<main class="select-screen safe-all">
  <header class="select-header">
    <h1 class="logo">
      <span class="logo-iron">Iron</span>
      <span class="logo-eye">Eye</span>
    </h1>
    <p class="tagline">Velocity-based kettlebell training</p>
  </header>
  
  <section class="select-content">
    <!-- Movement Selection -->
    <div class="form-group">
      <span class="form-label" id="movement-label">Movement</span>
      <div class="movement-grid" role="group" aria-labelledby="movement-label">
        {#each movements as movement}
          <button
            class="movement-btn"
            class:selected={selectedMovement === movement.id}
            class:locked={!movement.available}
            disabled={!movement.available}
            onclick={() => selectedMovement = movement.id}
          >
            <span class="movement-name">{movement.label}</span>
            {#if !movement.available}
              <span class="movement-badge">Soon</span>
            {/if}
          </button>
        {/each}
      </div>
    </div>
    
    <!-- Mode Selection -->
    <div class="form-group">
      <span class="form-label" id="mode-label">Mode</span>
      <div class="mode-toggle" role="group" aria-labelledby="mode-label">
        <button 
          class="mode-btn"
          class:selected={selectedMode === 'live'}
          onclick={() => selectedMode = 'live'}
        >
          <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>Live</span>
        </button>
        <button 
          class="mode-btn"
          class:selected={selectedMode === 'upload'}
          onclick={() => selectedMode = 'upload'}
        >
          <svg class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Upload</span>
        </button>
      </div>
    </div>
    
    <!-- Options (collapsible on mobile) -->
    <details class="options-section">
      <summary class="options-toggle">
        <span>Options</span>
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </summary>
      
      <div class="options-content">
        <!-- Notion Export Toggle -->
        <div class="option-row">
          <div class="option-info">
            <span class="option-label" id="notion-label">Notion Export</span>
            <span class="option-desc">Save session data to Notion</span>
          </div>
          <button 
            class="toggle"
            class:active={notionExport}
            onclick={() => notionExport = !notionExport}
            aria-pressed={notionExport}
            aria-labelledby="notion-label"
          ></button>
        </div>
        
        <!-- Load Input -->
        <div class="option-row vertical">
          <label for="load-input" class="option-label">Load (kg)</label>
          <input
            type="number"
            id="load-input"
            bind:value={loadKg}
            placeholder="Optional"
            min="4"
            max="100"
            step="2"
          />
        </div>
        
        <!-- Notes Input -->
        <div class="option-row vertical">
          <label for="notes-input" class="option-label">Notes</label>
          <textarea
            id="notes-input"
            bind:value={notes}
            placeholder="Optional notes..."
            rows="2"
          ></textarea>
        </div>
      </div>
    </details>
  </section>
  
  <!-- Start Button -->
  <footer class="select-footer">
    <button class="btn btn-primary btn-lg start-btn" onclick={handleStart}>
      {selectedMode === 'live' ? 'Start Camera' : 'Select Video'}
    </button>
  </footer>
</main>

<style>
  .select-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-4);
    max-width: 480px;
    margin: 0 auto;
  }
  
  /* Header */
  .select-header {
    text-align: center;
    margin-bottom: var(--space-8);
  }
  
  .logo {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-2);
  }
  
  .logo-iron {
    color: var(--color-white);
  }
  
  .logo-eye {
    color: var(--color-copper);
  }
  
  .tagline {
    color: var(--color-muted);
    font-size: var(--font-size-sm);
    margin-bottom: 0;
  }
  
  /* Content */
  .select-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  
  /* Form Groups */
  .form-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
  
  .form-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* Movement Grid */
  .movement-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  
  .movement-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 2px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    color: var(--color-white);
    transition: all var(--transition-normal);
  }
  
  .movement-btn:hover:not(:disabled) {
    border-color: var(--color-muted);
  }
  
  .movement-btn.selected {
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.1);
  }
  
  .movement-btn.locked {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .movement-name {
    font-weight: var(--font-weight-medium);
  }
  
  .movement-badge {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
    background-color: var(--color-black-lighter);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }
  
  /* Mode Toggle */
  .mode-toggle {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  
  .mode-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 2px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    color: var(--color-muted);
    transition: all var(--transition-normal);
  }
  
  .mode-btn:hover {
    border-color: var(--color-muted);
    color: var(--color-white);
  }
  
  .mode-btn.selected {
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.1);
    color: var(--color-copper-bright);
  }
  
  .mode-icon {
    width: 24px;
    height: 24px;
  }
  
  /* Options Section */
  .options-section {
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .options-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background-color: var(--color-black-light);
    cursor: pointer;
    list-style: none;
  }
  
  .options-toggle::-webkit-details-marker {
    display: none;
  }
  
  .options-toggle span {
    font-weight: var(--font-weight-medium);
    color: var(--color-muted);
  }
  
  .chevron {
    width: 20px;
    height: 20px;
    color: var(--color-muted);
    transition: transform var(--transition-normal);
  }
  
  .options-section[open] .chevron {
    transform: rotate(180deg);
  }
  
  .options-content {
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    border-top: 1px solid var(--color-black-lighter);
  }
  
  /* Option Rows */
  .option-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .option-row.vertical {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  
  .option-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .option-label {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-white);
  }
  
  .option-desc {
    font-size: var(--font-size-xs);
    color: var(--color-muted);
  }
  
  textarea {
    resize: none;
    min-height: 60px;
  }
  
  /* Footer */
  .select-footer {
    margin-top: var(--space-6);
    padding-bottom: var(--space-4);
  }
  
  .start-btn {
    width: 100%;
  }
</style>
