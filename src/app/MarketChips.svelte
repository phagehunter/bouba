<script lang="ts">
  // The six languages as a row of buttons. Each one carries the language name only.
  import { LANGUAGES } from './lib';

  // `full` is set where choosing a language opens that language's full result.
  let { current, onpick, full = false, label = false }: { current: string; onpick: (id: string) => void; full?: boolean; label?: boolean } = $props();
</script>

<div class="mchips" role="group" aria-label="As said by speakers of">
  {#if label}<span class="mchips-label">As said by speakers of</span>{/if}
  {#each LANGUAGES as l (l.id)}
    <button class="mchip" class:selected={l.id === current} aria-pressed={l.id === current} title={full ? `Show the full ${l.name} result` : undefined} onclick={() => onpick(l.id)}>
      {l.name}
    </button>
  {/each}
</div>
