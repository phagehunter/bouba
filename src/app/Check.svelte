<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import Dial from './Dial.svelte';
  import Mark from './Mark.svelte';
  import MarketChips from './MarketChips.svelte';
  import {
    FIT_WORDS, SOURCE_WORDS, SURVIVAL_WORDS, allChanges, checkMarkets, copyText, easeWords, engine, englishReading, groupMarkets, headline, millions,
    profileLabel, resultAsText, severity, tips, verdict, type Language,
  } from './lib';
  import { encodeState, inShortlist } from './state';
  import { reducedMotion } from './store';

  let { text = $bindable(), profile, lang, recent, shortlist, onlang, onrecord, onclearrecent, onshortlist }: {
    text: string; profile: string; lang: Language; recent: string[]; shortlist: string;
    onlang: (id: string) => void; onrecord: (name: string) => void; onclearrecent: () => void; onshortlist: (name: string) => void;
  } = $props();

  const EXAMPLES = ['Shell', 'Starbucks', 'Tesla', 'Line', 'Sprite', 'Zyntrova', 'Fresh starts here'];
  const FIRST_REASONS = 2; // reasons shown before the "Show more" control
  const narrow = new MediaQuery('max-width: 640px');

  let sayAs = $state<Record<string, string>>({});
  let active = $state<string | null>(null);
  let copied = $state(false);
  let linkCopied = $state(false);
  let showAll = $state(false);
  let pastVerdict = $state(false);
  let voices = $state<SpeechSynthesisVoice[]>([]);
  let voiceChecked = $state(false);
  let nameEl = $state<HTMLTextAreaElement>();
  let bodyEl = $state<HTMLElement>();
  let verdictEl = $state<HTMLElement>();

  // The result follows `query` and `sayAsUsed`, which catch up with the boxes a moment after typing stops.
  let query = $state(untrack(() => text));
  let sayAsUsed = $state<Record<string, string>>({});
  let typing = false;
  let unrecorded = false;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let recordTimer: ReturnType<typeof setTimeout> | undefined;

  function settle() {
    clearTimeout(settleTimer);
    typing = false;
    query = text;
    sayAsUsed = sayAs;
  }
  function typed() {
    typing = true;
    active = null;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, 200);
  }
  function nameTyped() {
    typed();
    unrecorded = true;
    clearTimeout(recordTimer);
    recordTimer = setTimeout(record, 1500);
  }
  /** Adds the typed name to the recent names. Names chosen from the pills are not added. */
  function record() {
    clearTimeout(recordTimer);
    if (!unrecorded) return;
    unrecorded = false;
    onrecord(text);
  }
  function leaveName() {
    if (typing) settle();
    record();
  }
  function choose(name: string) {
    clearTimeout(recordTimer);
    unrecorded = false;
    text = name;
    active = null;
    settle();
  }
  // A name that arrives from outside (the address, the Compare screen) is shown at once.
  $effect(() => {
    const t = text;
    if (!typing && t !== untrack(() => query)) query = t;
  });
  onDestroy(() => {
    clearTimeout(settleTimer);
    record();
  });

  let result = $derived(engine.check(query, lang.id, { sayAs: sayAsUsed }));
  let has = $derived(result.words.length > 0);
  let overall = $derived(result.overall[profile]);
  let other = $derived(lang.profiles.find((p) => p.id !== profile)!);
  let otherResult = $derived(result.overall[other.id]);
  let differs = $derived(has && (otherResult.respelling !== overall.respelling || otherResult.script !== overall.script));
  let v = $derived(has ? verdict(result, profile, lang) : null);
  let changes = $derived(has ? allChanges(result, profile) : []);
  let shown = $derived(changes.filter((x) => severity(x.change) !== 'minor'));
  let minor = $derived(changes.filter((x) => severity(x.change) === 'minor'));
  let advice = $derived(has ? tips(result, profile) : []);
  let alternative = $derived(has ? result.words.map((w) => w.profiles[profile].alternative?.respelling ?? w.profiles[profile].respelling).join(' ') : '');
  let altNote = $derived(result.words.map((w) => w.profiles[profile].alternative?.note).find(Boolean));
  let markets = $derived(has ? checkMarkets(query, sayAsUsed) : []);
  let groups = $derived(groupMarkets(markets));
  let listed = $derived(inShortlist(shortlist, query));
  let voice = $derived(lang.pack.voiceLang ? voices.find((x) => x.lang.toLowerCase().startsWith(lang.pack.voiceLang)) ?? null : null);

  // The typed name, cut into plain and highlighted pieces.
  let pieces = $derived(result.words.map((w, wi) => {
    const marks = w.profiles[profile].changes
      .map((c, ci) => ({ c, key: `${wi}-${ci}` }))
      .filter((m) => m.c.span && severity(m.c) !== 'minor')
      .sort((a, b) => a.c.span![0] - b.c.span![0]);
    const out: { text: string; key?: string; level?: string; label?: string }[] = [];
    let pos = 0;
    for (const m of marks) {
      const [s, e] = m.c.span!;
      if (s < pos) continue;
      if (s > pos) out.push({ text: w.word.slice(pos, s) });
      out.push({ text: w.word.slice(s, e), key: m.key, level: severity(m.c), label: headline(m.c, lang) });
      pos = e;
    }
    if (pos < w.word.length) out.push({ text: w.word.slice(pos) });
    return out;
  }));

  const scrolling = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth');

  async function pick(key: string) {
    active = active === key ? null : key;
    if (active && shown.findIndex((x) => x.key === key) >= FIRST_REASONS) showAll = true;
    await tick();
    if (active) document.getElementById('change-' + key)?.scrollIntoView({ block: 'nearest', behavior: scrolling() });
  }

  // A new name or language starts with the short list of reasons again.
  $effect(() => {
    query; lang.id;
    showAll = false;
  });

  // Fade the result in when a new name has been worked out, and more slowly when the language changes.
  let firstResult = true;
  let shownLang = untrack(() => lang.id);
  $effect(() => {
    query; sayAsUsed;
    const id = lang.id;
    const el = bodyEl;
    if (firstResult) { firstResult = false; return; }
    const duration = id !== shownLang ? 350 : 150;
    shownLang = id;
    if (el && typeof el.animate === 'function' && !reducedMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: 'ease-out' });
  });

  // On narrow screens the name box is one line high and grows with what is typed.
  let grown = false;
  $effect(() => {
    text;
    const el = nameEl;
    if (!el) return;
    if (narrow.current) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + (el.offsetHeight - el.clientHeight) + 'px';
      grown = true;
    } else if (grown) {
      el.style.height = '';
      grown = false;
    }
  });

  // Select the starting name the first time the box is used, so typing replaces it.
  let selectedOnce = false;
  let holdSelection = false;
  function focusName() {
    if (selectedOnce) return;
    selectedOnce = true;
    nameEl?.select();
    holdSelection = true;
    setTimeout(() => (holdSelection = false), 500);
  }
  function mouseUpName(e: MouseEvent) {
    // Some browsers drop the selection when the mouse button is released.
    if (holdSelection) { e.preventDefault(); holdSelection = false; }
  }

  // Note when the verdict has scrolled off the top, for the slim bar on narrow screens.
  $effect(() => {
    const el = verdictEl;
    if (!el || !('IntersectionObserver' in window)) { pastVerdict = false; return; }
    const io = new IntersectionObserver(([e]) => (pastVerdict = !e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  });
  const toTop = () => window.scrollTo({ top: 0, behavior: scrolling() });

  onMount(() => {
    if (!('speechSynthesis' in window)) { voiceChecked = true; return; }
    const load = () => { voices = speechSynthesis.getVoices(); voiceChecked = true; };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    return () => speechSynthesis.removeEventListener('voiceschanged', load);
  });

  function listen() {
    if (!voice) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(overall.script);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.8;
    speechSynthesis.speak(u);
  }

  async function copy() {
    copied = await copyText(resultAsText(result, profile, lang));
    setTimeout(() => (copied = false), 1800);
  }
  async function copyLink() {
    linkCopied = await copyText(location.href.split('#')[0] + '#' + encodeState({ name: query, lang: lang.id }));
    setTimeout(() => (linkCopied = false), 1800);
  }
</script>

{#snippet reading()}
  {#each result.words as w, wi (wi)}
    <div class="reading-row">
      <div class="reading-text">
        <strong>{w.word}</strong>
        <span class="reading-sounds">{englishReading(w.englishSounds)}</span>
        <span class={'src ' + w.soundsFrom}>{SOURCE_WORDS[w.soundsFrom]}</span>
      </div>
      {#if w.soundsFrom !== 'dictionary' && w.soundsFrom !== 'letters'}
        <label class="sayas">
          <span>If that is wrong, type how it should sound</span>
          <input type="text" placeholder="e.g. zin troh va" value={sayAs[w.word.toLowerCase()] ?? ''}
            oninput={(e) => { sayAs = { ...sayAs, [w.word.toLowerCase()]: e.currentTarget.value }; typed(); }} />
        </label>
      {/if}
    </div>
  {/each}
{/snippet}

<div class="grid">
  <section class="pane input-pane" aria-label="Name to check">
    <label for="name">Company name, product name or tagline</label>
    <textarea id="name" bind:this={nameEl} bind:value={text} rows={narrow.current ? 1 : 2} spellcheck="false" autocomplete="off" placeholder="Type a name…"
      oninput={nameTyped} onfocus={focusName} onmouseup={mouseUpName} onblur={leaveName}></textarea>
    <div class="examples">
      <span>Try</span>
      {#each EXAMPLES as ex (ex)}
        <button class="pill" onclick={() => choose(ex)}>{ex}</button>
      {/each}
    </div>
    {#if recent.length}
      <div class="examples recent">
        <span>Recent names</span>
        {#each recent as name (name)}
          <button class="pill" onclick={() => choose(name)}>{name}</button>
        {/each}
        <button class="pill clear" aria-label="Clear recent names" onclick={onclearrecent}>Clear</button>
      </div>
    {/if}

    {#if has && !narrow.current}
      <div class="reading">
        <h2>How <span class="inline-lockup"><Mark /><span class="wordmark">bouba</span></span> read it in English</h2>
        {@render reading()}
        {#each result.notes as n (n)}<p class="warn">{n}</p>{/each}
      </div>
    {:else if has}
      {#each result.notes as n (n)}<p class="warn">{n}</p>{/each}
    {/if}
  </section>

  <section class="pane result-pane" id="result" tabindex="-1" aria-label="Result">
    <div class="result-body" bind:this={bodyEl}>
      {#if has && v}
        <p class="print-only print-title">"{result.input}" for {lang.name} speakers ({profileLabel(lang, profile)})</p>
        <div class={'verdict ' + v.tone} aria-live="polite" bind:this={verdictEl}>
          <Mark band={v.tone} />
          <div class="verdict-text">
            <p class={'band-word ' + v.tone}>{FIT_WORDS[v.tone]}</p>
            <p class="verdict-lead">{v.lead}</p>
            {#if v.detail}<p class="verdict-detail">{v.detail}</p>{/if}
          </div>
        </div>
      {/if}
      <MarketChips current={lang.id} onpick={onlang} full />
      {#if !has || !v}
        <div class="empty">
          <p class="empty-title">Type a name to see how {lang.name} speakers are likely to say it.</p>
        </div>
      {:else}
        <p class="checked-note">{lang.pack.validation.note}</p>

        <div class="said">
          <div class="said-main">
            <div class="label">Likely said as</div>
            <div class="respelling">{overall.respelling}</div>
            {#if alternative !== overall.respelling}
              <div class="alt">Also heard: <strong>{alternative}</strong>. {altNote}</div>
            {/if}
            {#if overall.script}
              <div class="script" lang={lang.id}>Likely {lang.name} spelling: <strong dir="auto">{overall.script}</strong></div>
            {/if}
          </div>
          <div class="said-actions">
            {#if overall.script && lang.pack.voiceLang}
              <button class="btn" onclick={listen} disabled={!voice} title={`Reads the ${lang.name} spelling with this device's ${lang.name} voice. It is approximate.`}>
                <span aria-hidden="true">▶</span> Listen
              </button>
            {/if}
            <button class="btn" onclick={copy}>{copied ? 'Copied' : 'Copy result'}</button>
            <button class="btn" onclick={copyLink}>{linkCopied ? 'Copied' : 'Copy link'}</button>
            <button class="btn" onclick={() => onshortlist(query)} disabled={listed}>{listed ? 'In shortlist' : 'Add to shortlist'}</button>
            <button class="btn" onclick={() => window.print()}>Print summary</button>
          </div>
        </div>
        {#if overall.script && lang.pack.voiceLang}
          {#if voiceChecked && !voice}
            <p class="fine listen-note">Listen is unavailable because this device has no {lang.name} voice. One can be added in the device's speech settings.</p>
          {:else if voice}
            <p class="fine listen-note">Listen uses this device's {lang.name} voice reading the {lang.name} spelling. It is approximate.</p>
          {/if}
        {/if}
        {#if differs}
          <div class="other-group">
            <div class="label">{other.label}</div>
            <p>Likely said as <strong>{otherResult.respelling}</strong>{#if otherResult.script}, spelled <strong lang={lang.id} dir="auto">{otherResult.script}</strong>{/if}.</p>
            <p class="fine">{other.hint}</p>
          </div>
        {/if}

        <div class="marked">
          <div class="label">Where the changes are</div>
          <div class="marked-name">
            {#each pieces as word, wi (wi)}
              <span class="marked-word">
                {#each word as p, pi (pi)}
                  {#if p.key}
                    <button class={'mark ' + p.level} class:active={active === p.key} aria-label={`${p.text}: ${p.label}`} title={p.label} onclick={() => pick(p.key!)}>{p.text}</button>
                  {:else}<span>{p.text}</span>{/if}
                {/each}
              </span>
            {/each}
          </div>
          <div class="legend">
            <span><i class="swatch lost" aria-hidden="true"></i> not said</span>
            <span><i class="swatch changed" aria-hidden="true"></i> changed or added to</span>
            <span class="legend-hint">Tap a marked letter for the reason.</span>
          </div>
        </div>

        <div class="dials">
          <Dial name="Ease" value={overall.ease} words={easeWords(lang)} hint={`How little the name must be repaired to fit ${lang.name}.`} />
          <Dial name="Survival" value={overall.survival} words={SURVIVAL_WORDS} hint="How much of the original sound is left." />
        </div>
        <p class="fine">Scores are provisional. The Guide explains how they are worked out.</p>

        <h2>Why each change happens</h2>
        {#if shown.length === 0}
          <p>No sound needs a real change.</p>
        {:else}
          <ul class="changes" id="reasons">
            {#each shown as x, i (x.key)}
              <li id={'change-' + x.key} class={'change ' + severity(x.change)} class:active={active === x.key} class:folded={i >= FIRST_REASONS && !showAll}>
                <div class="change-head">
                  <span class="change-title"><i class={'swatch ' + severity(x.change)} aria-hidden="true"></i>{result.words.length > 1 ? x.word + ': ' : ''}{headline(x.change, lang)}</span>
                  <span class={'chip ' + x.change.confidence} title={x.change.source}>{x.change.confidence} confidence</span>
                </div>
                <p class="change-why">{x.change.why}</p>
              </li>
            {/each}
          </ul>
          {#if shown.length > FIRST_REASONS}
            <button class="btn more" aria-expanded={showAll} aria-controls="reasons" onclick={() => (showAll = !showAll)}>
              {showAll ? 'Show fewer' : `Show ${shown.length - FIRST_REASONS} more`}
            </button>
          {/if}
        {/if}
        {#if minor.length}
          <details class="minor">
            <summary>{minor.length} smaller {minor.length === 1 ? 'change' : 'changes'}</summary>
            <ul>
              {#each minor as x (x.key)}<li>{result.words.length > 1 ? x.word + ': ' : ''}{headline(x.change, lang)}. {x.change.why}</li>{/each}
            </ul>
          </details>
        {/if}
        {#if narrow.current}
          <details class="minor reading-fold">
            <summary>How <span class="inline-lockup"><Mark /><span class="wordmark">bouba</span></span> read it in English</summary>
            {@render reading()}
          </details>
        {/if}

        {#if advice.length}
          <h2>To keep more of the name in {lang.name}</h2>
          <ul class="advice">
            {#each advice as a (a)}<li>{a}</li>{/each}
          </ul>
        {/if}

        <h2>Markets</h2>
        <p class="fine above-table">Grouped by the lower of Ease and Survival, using each language's first speaker group. {markets.length} languages are covered so far. Speaker counts are approximate and come from the Unicode country-language table.</p>
        <table class="markets-table cards">
          <thead>
            <tr><th scope="col">Country</th><th scope="col">Likely said as</th><th scope="col" class="num">Ease</th><th scope="col" class="num">Survival</th></tr>
          </thead>
          {#each groups as g (g.band)}
            <tbody>
              <tr class="band-row"><th colspan="4" scope="rowgroup"><span class="band-head"><Mark band={g.band} />{FIT_WORDS[g.band]}</span></th></tr>
              {#each g.rows as m (m.lang.id)}
                <tr class:current={m.lang.id === lang.id}>
                  <th scope="row">
                    <button class="link" onclick={() => onlang(m.lang.id)} title={`Show the full ${m.lang.name} result`}>{m.lang.country}</button>
                    <span class="thai-cell">{m.lang.name} · {millions(m.lang.speakers)} speakers</span>
                  </th>
                  <td data-label="Likely said as"><span class="said-cell">{m.said}</span></td>
                  <td class="num" data-label="Ease">{m.ease}</td>
                  <td class="num" data-label="Survival">{m.survival}</td>
                </tr>
              {/each}
            </tbody>
          {/each}
        </table>
      {/if}
    </div>
  </section>
</div>

{#if narrow.current && has && pastVerdict}
  <button class="peek" onclick={toTop}>
    <span class="sr-only">Back to top.</span>
    <strong>{result.input}</strong>
    <span class="peek-said">{overall.respelling}</span>
  </button>
{/if}
