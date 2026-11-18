<script lang="ts">
  // The brand mark. Without `band` it is drawn in the brand colors; with `band` it is drawn in that band's color.
  // The shape never changes. It is decoration: the words beside it carry the meaning.
  import { MARK_BIG, MARK_SMALL, MARK_VIEWBOX } from './mark';
  import type { Band } from './lib';

  let { band }: { band?: Band } = $props();
</script>

<svg class={'bmark' + (band ? ' ' + band : '')} viewBox={MARK_VIEWBOX} aria-hidden="true" focusable="false">
  <path class="bmark-small" d={MARK_SMALL} />
  <path class="bmark-big" d={MARK_BIG} />
</svg>
