<!--
  Summary Screen (Screen E)
  Post-session summary with key metrics
  
  Features:
  - Best peak velocity, avg, drop-off %
  - Alerts triggered + reasons
  - Export status (Notion)
  - Rep list drilldown (optional)
-->

<script lang="ts">
  import { goto } from '$app/navigation';
  import { sessionData, sessionConfig } from '$lib/stores';
  
  // Get session data (or use placeholder for M1)
  const session = $sessionData;
  
  // Placeholder data for M1 demo
  const demoData = {
    repCount: 0,
    setCount: 1,
    bestPeakVelocity: 0,
    avgPeakVelocity: 0,
    velocityDropPct: 0,
    alerts: [] as Array<{ message: string; severity: string }>,
    duration: '0:00'
  };
  
  // Format velocity
  function formatVelocity(mps: number): string {
    if (mps <= 0) return '—';
    return mps.toFixed(2);
  }
  
  // Handle new session
  function handleNewSession() {
    sessionData.clear();
    goto('/');
  }
  
  // Handle export (placeholder for M1)
  function handleExport() {
    // TODO: Milestone 6 - Notion export
    alert('Notion export will be available in a future update.');
  }
</script>

<svelte:head>
  <title>Iron Eye — Session Summary</title>
</svelte:head>

<main class="summary-screen safe-all">
  <header class="summary-header">
    <h1>Session Complete</h1>
    <p class="summary-meta">
      {$sessionConfig.movement.charAt(0).toUpperCase() + $sessionConfig.movement.slice(1)} 
      • {$sessionConfig.mode === 'live' ? 'Live' : 'Upload'}
    </p>
  </header>
  
  <section class="summary-content">
    <!-- Primary Metrics -->
    <div class="metrics-grid">
      <div class="metric-card primary">
        <span class="metric-value">
          {formatVelocity(session?.bestPeakVelocityMps ?? demoData.bestPeakVelocity)}
        </span>
        <span class="metric-label">Best Peak (m/s)</span>
      </div>
      
      <div class="metric-card">
        <span class="metric-value">
          {formatVelocity(session?.avgPeakVelocityMps ?? demoData.avgPeakVelocity)}
        </span>
        <span class="metric-label">Avg Peak (m/s)</span>
      </div>
      
      <div class="metric-card">
        <span class="metric-value">
          {(session?.velocityDropPct ?? demoData.velocityDropPct).toFixed(0)}%
        </span>
        <span class="metric-label">Drop-off</span>
      </div>
      
      <div class="metric-card">
        <span class="metric-value">
          {session?.reps?.length ?? demoData.repCount}
        </span>
        <span class="metric-label">Total Reps</span>
      </div>
    </div>
    
    <!-- Alerts Section -->
    {#if (session?.alerts?.length ?? demoData.alerts.length) > 0}
      <div class="alerts-section card">
        <h3 class="card-title">Alerts</h3>
        <ul class="alert-list">
          {#each (session?.alerts ?? demoData.alerts) as alert}
            <li class="alert-item">
              <span class="alert-dot" class:warning={alert.severity === 'warning'}></span>
              <span class="alert-message">{alert.message}</span>
            </li>
          {/each}
        </ul>
      </div>
    {:else}
      <div class="no-alerts card">
        <span class="check-icon">✓</span>
        <p>No alerts during this session</p>
      </div>
    {/if}
    
    <!-- Calibration Info -->
    <div class="info-section card">
      <h3 class="card-title">Session Info</h3>
      <dl class="info-list">
        <div class="info-row">
          <dt>Height</dt>
          <dd>{session?.heightInches ?? 70}″</dd>
        </div>
        <div class="info-row">
          <dt>Calibration</dt>
          <dd>{session?.calibrationQuality ?? 'ok'}</dd>
        </div>
        <div class="info-row">
          <dt>Model</dt>
          <dd>{session?.modelVersion ?? '1.0.0-cnn'}</dd>
        </div>
      </dl>
    </div>
    
    <!-- Rep Details (collapsed by default) -->
    {#if (session?.reps?.length ?? 0) > 0}
      <details class="reps-section card">
        <summary class="reps-toggle">
          <span>Rep Details</span>
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </summary>
        <div class="reps-content">
          <table class="reps-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Side</th>
                <th>Peak</th>
                <th>Time to Peak</th>
              </tr>
            </thead>
            <tbody>
              {#each session?.reps ?? [] as rep, i}
                <tr>
                  <td>{i + 1}</td>
                  <td>{rep.side ?? '—'}</td>
                  <td>{formatVelocity(rep.peakVelocityMps)}</td>
                  <td>{rep.timeToPeakMs}ms</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </details>
    {/if}
  </section>
  
  <!-- Actions -->
  <footer class="summary-footer">
    {#if $sessionConfig.notionExportEnabled}
      <button class="btn btn-secondary" onclick={handleExport}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="btn-icon">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export to Notion
      </button>
    {/if}
    
    <button class="btn btn-primary btn-lg" onclick={handleNewSession}>
      New Session
    </button>
  </footer>
</main>

<style>
  .summary-screen {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: var(--space-6) var(--space-4);
    max-width: 600px;
    margin: 0 auto;
  }
  
  /* Header */
  .summary-header {
    text-align: center;
    margin-bottom: var(--space-6);
  }
  
  .summary-header h1 {
    font-size: var(--font-size-2xl);
    margin-bottom: var(--space-2);
  }
  
  .summary-meta {
    color: var(--color-muted);
    margin-bottom: 0;
  }
  
  /* Content */
  .summary-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  /* Metrics Grid */
  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
  }
  
  .metric-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-4);
    background-color: var(--color-black-light);
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
  }
  
  .metric-card.primary {
    grid-column: span 2;
    border-color: var(--color-copper);
    background-color: rgba(184, 115, 51, 0.1);
  }
  
  .metric-value {
    font-size: var(--font-size-2xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-white);
    font-variant-numeric: tabular-nums;
  }
  
  .metric-card.primary .metric-value {
    font-size: var(--font-size-3xl);
    color: var(--color-copper-bright);
  }
  
  .metric-label {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
    margin-top: var(--space-1);
  }
  
  /* Alerts */
  .alerts-section {
    padding: var(--space-4);
  }
  
  .alert-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .alert-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background-color: var(--color-black-lighter);
    border-radius: var(--radius-md);
  }
  
  .alert-dot {
    width: 8px;
    height: 8px;
    border-radius: var(--radius-full);
    background-color: var(--color-muted);
  }
  
  .alert-dot.warning {
    background-color: var(--color-oxblood);
  }
  
  .alert-message {
    font-size: var(--font-size-sm);
    color: var(--color-white);
  }
  
  .no-alerts {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4);
    color: var(--color-muted);
  }
  
  .check-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(184, 115, 51, 0.2);
    color: var(--color-copper);
    border-radius: var(--radius-full);
    font-size: var(--font-size-lg);
  }
  
  .no-alerts p {
    margin: 0;
  }
  
  /* Info section */
  .info-section {
    padding: var(--space-4);
  }
  
  .info-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  
  .info-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-black-lighter);
  }
  
  .info-row:last-child {
    border-bottom: none;
  }
  
  .info-row dt {
    color: var(--color-muted);
    font-size: var(--font-size-sm);
  }
  
  .info-row dd {
    color: var(--color-white);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin: 0;
  }
  
  /* Reps section */
  .reps-section {
    border: 1px solid var(--color-black-lighter);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  .reps-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-4);
    background-color: var(--color-black-light);
    cursor: pointer;
    list-style: none;
    font-weight: var(--font-weight-medium);
  }
  
  .reps-toggle::-webkit-details-marker {
    display: none;
  }
  
  .chevron {
    width: 20px;
    height: 20px;
    color: var(--color-muted);
    transition: transform var(--transition-normal);
  }
  
  .reps-section[open] .chevron {
    transform: rotate(180deg);
  }
  
  .reps-content {
    padding: var(--space-3);
    border-top: 1px solid var(--color-black-lighter);
  }
  
  .reps-table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--font-size-sm);
  }
  
  .reps-table th,
  .reps-table td {
    padding: var(--space-2);
    text-align: left;
  }
  
  .reps-table th {
    color: var(--color-muted);
    font-weight: var(--font-weight-medium);
    border-bottom: 1px solid var(--color-black-lighter);
  }
  
  .reps-table td {
    font-variant-numeric: tabular-nums;
  }
  
  /* Footer */
  .summary-footer {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-top: var(--space-6);
  }
  
  .btn-icon {
    width: 18px;
    height: 18px;
  }
</style>
