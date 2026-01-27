
<!--
  FramingGuide Component
  Simple silhouette box to help user position themselves in frame
  Only shown during setup phase in Live mode
-->

<script lang="ts">
  let { 
    visible = true,
    quality = 'waiting' as 'waiting' | 'good' | 'adjust'
  }: { 
    visible?: boolean;
    quality?: 'waiting' | 'good' | 'adjust';
  } = $props();
  
  const qualityMessages = {
    waiting: 'Position yourself in frame',
    good: 'Good framing',
    adjust: 'Move back for full body view'
  };
</script>

{#if visible}
  <div class="framing-guide" class:good={quality === 'good'} class:adjust={quality === 'adjust'}>
    <!-- Silhouette outline -->
    <svg 
      class="silhouette" 
      viewBox="0 0 100 200" 
      preserveAspectRatio="xMidYMid meet"
    >
      <!-- Simple human silhouette -->
      <g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <!-- Head -->
        <circle cx="50" cy="20" r="12" />
        
        <!-- Body -->
        <line x1="50" y1="32" x2="50" y2="85" />
        
        <!-- Arms (slightly out, like holding a kettlebell) -->
        <line x1="50" y1="45" x2="25" y2="70" />
        <line x1="50" y1="45" x2="75" y2="70" />
        
        <!-- Legs -->
        <line x1="50" y1="85" x2="35" y2="140" />
        <line x1="50" y1="85" x2="65" y2="140" />
        
        <!-- Feet -->
        <line x1="35" y1="140" x2="30" y2="145" />
        <line x1="65" y1="140" x2="70" y2="145" />
        
        <!-- Kettlebell indicator (center low) -->
        <circle cx="50" cy="95" r="8" stroke-dasharray="3,2" />
      </g>
    </svg>
    
    <!-- Corner brackets -->
    <div class="corner top-left"></div>
    <div class="corner top-right"></div>
    <div class="corner bottom-left"></div>
    <div class="corner bottom-right"></div>
    
    <!-- Message -->
    <div class="framing-message">
      <span class="message-text">{qualityMessages[quality]}</span>
    </div>
  </div>
{/if}

<style>
  .framing-guide {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60%;
    max-width: 300px;
    aspect-ratio: 1 / 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  
  /* Silhouette */
  .silhouette {
    width: 70%;
    height: 70%;
    color: var(--color-muted);
    opacity: 0.5;
    transition: all var(--transition-normal);
  }
  
  .framing-guide.good .silhouette {
    color: var(--color-copper);
    opacity: 0.8;
  }
  
  .framing-guide.adjust .silhouette {
    color: var(--color-oxblood);
    opacity: 0.8;
  }
  
  /* Corner brackets */
  .corner {
    position: absolute;
    width: 30px;
    height: 30px;
    border-color: var(--color-muted);
    border-style: solid;
    border-width: 0;
    opacity: 0.6;
    transition: all var(--transition-normal);
  }
  
  .top-left {
    top: 0;
    left: 0;
    border-top-width: 2px;
    border-left-width: 2px;
  }
  
  .top-right {
    top: 0;
    right: 0;
    border-top-width: 2px;
    border-right-width: 2px;
  }
  
  .bottom-left {
    bottom: 0;
    left: 0;
    border-bottom-width: 2px;
    border-left-width: 2px;
  }
  
  .bottom-right {
    bottom: 0;
    right: 0;
    border-bottom-width: 2px;
    border-right-width: 2px;
  }
  
  .framing-guide.good .corner {
    border-color: var(--color-copper);
    opacity: 1;
  }
  
  .framing-guide.adjust .corner {
    border-color: var(--color-oxblood);
    opacity: 1;
  }
  
  /* Message */
  .framing-message {
    position: absolute;
    bottom: -40px;
    left: 50%;
    transform: translateX(-50%);
    white-space: nowrap;
    background-color: rgba(0, 0, 0, 0.7);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    backdrop-filter: blur(4px);
  }
  
  .message-text {
    font-size: var(--font-size-sm);
    color: var(--color-muted);
    transition: color var(--transition-normal);
  }
  
  .framing-guide.good .message-text {
    color: var(--color-copper);
  }
  
  .framing-guide.adjust .message-text {
    color: var(--color-oxblood);
  }
</style>
