<script lang="ts">
  import Check from './Check.svelte';
  import Compare from './Compare.svelte';
  import Guide from './Guide.svelte';
  import Mark from './Mark.svelte';
  import MarketChips from './MarketChips.svelte';
  import { LANGUAGES, languageOf } from './lib';
  import { addRecent, addToShortlist, cleanRecent, decodeState } from './state';
  import { KEYS, clearHash, load, reducedMotion, remove, save } from './store';

  const TABS = [
    { id: 'check', label: 'Check a name' },
    { id: 'compare', label: 'Compare names' },
    { id: 'guide', label: 'Guide' },
  ];
  const IDS = LANGUAGES.map((l) => l.id);
  const FIRST_SHORTLIST = 'Shell\nStarbucks\nTesla\nLotus\nSprite\nZoom';

  // The address wins over what the device remembers.
  // index.html has already moved a shared link out of the address and into this variable.
  const fromAddress = decodeState(window.__boubaLink || location.hash, IDS);
  const savedLang = load(KEYS.lang);
  const savedShortlist = load(KEYS.shortlist);

  let tab = $state('check');
  let langId = $state(fromAddress.lang ?? (typeof savedLang === 'string' && IDS.includes(savedLang) ? savedLang : IDS[0]));
  let text = $state(fromAddress.name ?? 'Starbucks');
  let recent = $state(cleanRecent(load(KEYS.recent)));
  let shortlist = $state(typeof savedShortlist === 'string' ? savedShortlist : FIRST_SHORTLIST);
  let lang = $derived(languageOf(langId));
  // The result is shown for the pack's first speaker group. The other group appears as a note when it differs.
  let profile = $derived(lang.profiles[0].id);

  $effect(() => save(KEYS.lang, langId));
  $effect(() => save(KEYS.shortlist, shortlist));
  // The typed name is never kept in the address. A shared link is read once and then removed from it,
  // so no script on the hosting page can read the name from the address. "Copy link" builds a link on request.
  clearHash();

  function readAddress() {
    const s = decodeState(location.hash, IDS);
    clearHash();
    if (s.lang) langId = s.lang;
    if (s.name !== undefined) {
      text = s.name;
      tab = 'check';
    }
  }

  function openInCheck(name: string) {
    text = name;
    tab = 'check';
  }
  function recordName(name: string) {
    recent = addRecent(recent, name);
    save(KEYS.recent, recent);
  }
  function clearRecent() {
    recent = [];
    remove(KEYS.recent);
  }
  // The header mark swells once when a name joins the shortlist.
  let markEl = $state<HTMLElement>();
  function addName(name: string) {
    const next = addToShortlist(shortlist, name);
    if (next === shortlist) return;
    shortlist = next;
    if (markEl && typeof markEl.animate === 'function' && !reducedMotion()) {
      markEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 400, easing: 'ease-in-out' });
    }
  }
  function skipToResult(e: MouseEvent) {
    e.preventDefault();
    const target = document.getElementById('result') ?? document.getElementById('main');
    target?.focus();
    target?.scrollIntoView({ block: 'start' });
  }
</script>

<svelte:window onhashchange={readAddress} />

<a class="skip" href="#result" onclick={skipToResult}>Skip to result</a>

<header class="top">
  <div class="wrap top-row">
    <div class="brand">
      <div>
        <h1 class="lockup"><span class="lockup-mark" bind:this={markEl}><Mark /></span><span class="wordmark">bouba</span></h1>
        <p class="sr-only">Shows how people in another country are likely to pronounce a name. It does not translate.</p>
      </div>
    </div>
  </div>
  <div class="wrap bar">
    <div class="tabs" role="tablist" aria-label="Sections">
      {#each TABS as t (t.id)}
        <button role="tab" id={'tab-' + t.id} aria-selected={tab === t.id} aria-controls={'panel-' + t.id} class:active={tab === t.id} onclick={() => (tab = t.id)}>{t.label}</button>
      {/each}
    </div>
  </div>
</header>

<main class="wrap" id="main" tabindex="-1">
  <div id={'panel-' + tab} role="tabpanel" aria-labelledby={'tab-' + tab}>
  {#if tab === 'check'}
    <Check bind:text {profile} {lang} {recent} {shortlist} onlang={(id) => (langId = id)} onrecord={recordName} onclearrecent={clearRecent}
      onshortlist={addName} />
  {:else}
    <div class="lang-row"><MarketChips current={langId} onpick={(id) => (langId = id)} label /></div>
    {#if tab === 'compare'}
      <Compare bind:list={shortlist} {profile} {lang} onopen={openInCheck} />
    {:else}
      <Guide {lang} />
    {/if}
  {/if}
  </div>
</main>

<footer class="wrap foot">
  Pilot in development · version {__APP_VERSION__} · {lang.name} rules {lang.pack.packVersion} · Bouba runs entirely on this device, so nothing typed here is sent anywhere.
</footer>
