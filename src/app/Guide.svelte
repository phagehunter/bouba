<script lang="ts">
  import { LANGUAGES, millions, type Language } from './lib';
  import Mark from './Mark.svelte';

  let { lang }: { lang: Language } = $props();
  let pack = $derived(lang.pack);
  let pts = $derived(pack.effortPoints);
</script>

<div class="guide">
  <section class="pane">
    <h2>What <span class="inline-lockup"><Mark /><span class="wordmark">bouba</span></span> does</h2>
    <p>Bouba predicts how native speakers of another language are likely to <strong>say</strong> a name or phrase written in English spelling. Each language has a fixed set of sounds and rules about which of them can sit side by side. When a name breaks those rules, speakers repair it in regular ways. Bouba then predicts the repairs.</p>
    <h2>Languages covered</h2>
    <table class="cards">
      <thead><tr><th scope="col">Language</th><th scope="col">Country</th><th scope="col">Speakers there</th><th scope="col">Checked by native speakers</th></tr></thead>
      <tbody>
        {#each LANGUAGES as l (l.id)}
          <tr><th scope="row">{l.name}</th><td data-label="Country">{l.country}</td><td data-label="Speakers there">{millions(l.speakers)}</td><td data-label="Checked by native speakers">{l.pack.validation.nativeChecked ? 'Yes' : 'No'}</td></tr>
        {/each}
      </tbody>
    </table>
    <p class="fine">Speaker counts are approximate and come from the Unicode country-language table. The rest of this page describes {lang.name}; choose another language at the top to see its notes.</p>
  </section>

  <section class="pane">
    <h2>Reading a {lang.name} result</h2>
    <dl class="defs">
      <dt>Likely said as</dt>
      <dd>An easy respelling, syllable by syllable. Read it as plain English with these values:
        <ul class="key">{#each pack.respellingKey as [a, b] (a)}<li><code>{a}</code> {b}</li>{/each}</ul>
      </dd>
      {#if pack.scriptNote}
        <dt>Likely {lang.name} spelling</dt>
        <dd>{pack.scriptNote}</dd>
      {/if}
      <dt>Ease (0 to 100)</dt>
      <dd>How little the name has to be repaired to fit {lang.name}. It starts at 100, and each repair takes points off: an added vowel {pts.epenthesis}, a changed ending {pts.finalChanged}, an ending sound that is dropped {pts.finalDropped}, a sound {lang.name} does not have {pts.substitution}.</dd>
      <dt>Survival (0 to 100)</dt>
      <dd>How much of the original sound is left. Each sound that is dropped counts as fully lost. Each sound that is swapped counts as partly lost, by how different the new sound is, measured with a published table of sound features. An added vowel counts as half a sound. The total is taken as a share of the name's sounds.</dd>
      <dt>Colors</dt>
      <dd>85 and above is green, 70 to 84 amber, below 70 red. These cutoffs are provisional.</dd>
      <dt>Speaker groups</dt>
      <dd>
        <ul class="terms">{#each lang.profiles as p (p.id)}<li><span class="term">{p.label}:</span> {p.hint}</li>{/each}</ul>
        {#if pack.speakerNote}<p>{pack.speakerNote}</p>{/if}
      </dd>
      <dt>Confidence</dt>
      <dd>
        <ul class="terms">
          <li><span class="term">High:</span> stated in a published study.</li>
          <li><span class="term">Medium:</span> from a summary of a study, from spelling rules, or from recorded loanwords.</li>
          <li><span class="term">Low:</span> an estimate with no published source.</li>
        </ul>
      </dd>
    </dl>
  </section>

  <section class="pane">
    <h2>What <span class="inline-lockup"><Mark /><span class="wordmark">bouba</span></span> can do</h2>
    <ul>
      <li>Predict the likely everyday pronunciation of an English-spelled name or phrase in each covered language.</li>
      <li>Show the letters that change or go silent, and explain each change in plain words.</li>
      <li>Suggest the kind of change that would keep more of the name.</li>
      <li>Rank several candidate names on the same two scores.</li>
      <li>Rank the covered countries for one name.</li>
      <li>Accept a typed hint when an invented name was read wrongly.</li>
    </ul>
    <h2>What <span class="inline-lockup"><Mark /><span class="wordmark">bouba</span></span> cannot do</h2>
    <ul>
      {#each pack.limits as l (l)}<li>{l}</li>{/each}
      <li>It does not check meanings, rude sound-alikes, trademarks or cultural associations.</li>
      <li>It does not predict whether a name will sell. Line, for example, is pronounced "lai" in Thailand, and the scores would mark that as a large change.</li>
      <li>It cannot say how any one person will pronounce a name; it describes the usual pattern.</li>
      <li>Numbers are skipped; type them as words.</li>
      <li>Scores for different languages come from different rule sets and have not been calibrated against each other. Treat the country ranking as a rough guide.</li>
      <li>It does not replace a final check with native speakers before a launch.</li>
    </ul>
  </section>

  <section class="pane">
    <h2>Accuracy so far: {lang.name}</h2>
    <p>{pack.accuracy}</p>
    <p>{pack.validation.note}</p>
    <h2>Where the {lang.name} rules come from</h2>
    <ul>
      {#each Object.entries(pack.sources) as [id, s] (id)}{#if id !== 'unverified'}<li>{s}</li>{/if}{/each}
    </ul>
    <p>English pronunciations come from the CMU Pronouncing Dictionary. Sound similarity uses the PanPhon feature table. The rules are plain data and are meant to be corrected by people who know the language.</p>
  </section>
</div>
