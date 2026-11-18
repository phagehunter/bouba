<script lang="ts">
  import { band } from './lib';

  let { name, value, words, hint }: { name: string; value: number; words: Record<string, string>; hint: string } = $props();
  const R = 30;
  const C = 2 * Math.PI * R;
  let b = $derived(band(value));
</script>

<div class="dial">
  <svg viewBox="0 0 80 80" width="84" height="84" role="img" aria-label={`${name} ${value} out of 100: ${words[b]}`}>
    <circle cx="40" cy="40" r={R} class="track" />
    <circle cx="40" cy="40" r={R} class={'arc ' + b} stroke-dasharray={`${(value / 100) * C} ${C}`} transform="rotate(-90 40 40)" />
    <text x="40" y="46" text-anchor="middle" class="num">{value}</text>
  </svg>
  <div>
    <div class="dial-name">{name}</div>
    <div class={'dial-words ' + b}>{words[b]}</div>
    <div class="dial-hint">{hint}</div>
  </div>
</div>
