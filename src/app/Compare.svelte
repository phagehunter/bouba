<script lang="ts">
  import {
    FIT_WORDS, LANGUAGES, SURVIVAL_WORDS, allChanges, band, checkMarkets, copyText, download, easeWords, engine, fitBand, headline, profileLabel, severity,
    sortMarkets, toCsv, type Language,
  } from './lib';
  import { parseNames } from './state';

  // `list` is the shortlist kept by the app: the same one the Check screen adds to.
  let { list = $bindable(), profile, lang, onopen }: { list: string; profile: string; lang: Language; onopen: (name: string) => void } = $props();

  let copied = $state(false);

  let rows = $derived(
    parseNames(list)
      .map((name) => {
        const r = engine.check(name, lang.id);
        const o = r.overall[profile];
        const top = allChanges(r, profile).filter((x) => severity(x.change) !== 'minor').sort((a, b) => b.change.loss - a.change.loss)[0];
        const markets = checkMarkets(name); // one entry per language, in the app's language order
        return {
          name, said: o.respelling, script: o.script, ease: o.ease, survival: o.survival, total: Math.round((o.ease + o.survival) / 2),
          fit: fitBand(o.ease, o.survival), main: top ? headline(top.change, lang) : 'No real change',
          guessed: r.words.some((w) => w.soundsFrom === 'guessed'), markets, closest: sortMarkets(markets)[0].lang.country,
        };
      })
      .sort((a, b) => b.total - a.total || b.survival - a.survival));

  let group = $derived(profileLabel(lang, profile));

  function table(): (string | number)[][] {
    return [
      ['Rank', 'Name', 'Likely said as', `Likely ${lang.name} spelling`, 'Ease', 'Survival', 'Change', 'Main change', 'Least change in', 'Language', 'Speaker group',
        ...LANGUAGES.map((l) => `${l.name} (${l.country})`)],
      ...rows.map((r, i) => [i + 1, r.name, r.said, r.script, r.ease, r.survival, FIT_WORDS[r.fit], r.main, r.closest, lang.name, group, ...r.markets.map((m) => m.total)]),
    ];
  }
  async function copy() {
    copied = await copyText(table().map((r) => r.join('\t')).join('\n'));
    setTimeout(() => (copied = false), 1800);
  }
</script>

{#snippet nameCell(r: (typeof rows)[number])}
  <button class="link" onclick={() => onopen(r.name)} title="Open the full result">{r.name}</button>{#if r.guessed}<span class="guess" title="This name is missing from the English dictionary, so its English reading was guessed from the spelling">guessed</span>{/if}
{/snippet}

<div class="grid compare">
  <section class="pane input-pane" aria-label="Names to compare">
    <label for="list">Write candidate names here, one per line</label>
    <textarea id="list" bind:value={list} rows="8" spellcheck="false" autocomplete="off" placeholder="One name or phrase per line"></textarea>
    <p class="fine">Up to 50 names. They are ranked for {lang.country}, as said by the group "{group}". Change the language at the top to see another ranking.</p>
    <p class="fine">This list is the shortlist. It is kept on this device.</p>
  </section>

  <section class="pane result-pane" id="result" tabindex="-1" aria-label="Ranking">
    {#if rows.length === 0}
      <div class="empty"><p class="empty-title">Add two or more names to rank them.</p></div>
    {:else}
      <div class="table-head">
        <h2>Markets</h2>
        <div class="said-actions">
          <button class="btn" onclick={copy}>{copied ? 'Copied' : 'Copy table'}</button>
          <button class="btn" onclick={() => download(`name-comparison-${lang.id}.csv`, toCsv(table()))}>Save as spreadsheet</button>
        </div>
      </div>
      <p class="fine above-table">Each figure is the average of Ease and Survival, using each language's first speaker group. Scores for different languages have not been calibrated against each other.</p>
      <div class="table-scroll">
        <table class="cards market-grid">
          <thead>
            <tr><th scope="col">Name</th>{#each LANGUAGES as l (l.id)}<th scope="col" class="num" class:current={l.id === lang.id}>{l.name}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each rows as r, i (i + r.name)}
              <tr>
                <th scope="row">{@render nameCell(r)}</th>
                {#each r.markets as m (m.lang.id)}
                  <td class="num" class:current={m.lang.id === lang.id} data-label={m.lang.name}><span class={'fit ' + m.fit} title={FIT_WORDS[m.fit]}>{m.total}<span class="sr-only">, {FIT_WORDS[m.fit]}</span></span></td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <h2>Ranked for {lang.country}</h2>
      <p class="checked-note above-table">{lang.pack.validation.note}</p>
      <div class="table-scroll">
        <table class="cards rank-table">
          <thead>
            <tr><th scope="col">#</th><th scope="col">Name</th><th scope="col">Likely said as</th><th scope="col" class="num">Ease</th><th scope="col" class="num">Survival</th><th scope="col">Change</th><th scope="col">Main change</th><th scope="col">Least change in</th></tr>
          </thead>
          <tbody>
            {#each rows as r, i (i + r.name)}
              <tr>
                <td class="num rank" data-label="#">{i + 1}</td>
                <th scope="row">{@render nameCell(r)}</th>
                <td data-label="Likely said as"><span><span class="said-cell">{r.said}</span>{#if r.script}<span class="thai-cell" lang={lang.id} dir="auto">{r.script}</span>{/if}</span></td>
                <td class={'num ' + band(r.ease)} data-label="Ease" title={easeWords(lang)[band(r.ease)]}>{r.ease}</td>
                <td class={'num ' + band(r.survival)} data-label="Survival" title={SURVIVAL_WORDS[band(r.survival)]}>{r.survival}</td>
                <td data-label="Change"><span class={'fit ' + r.fit}>{FIT_WORDS[r.fit]}</span></td>
                <td class="main-cell" data-label="Main change">{r.main}</td>
                <td data-label="Least change in">{r.closest}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p class="fine">Ranked by the average of Ease and Survival, which are provisional scores. "Least change in" names the covered country where that average is highest. Select a name for its full result.</p>
    {/if}
  </section>
</div>
