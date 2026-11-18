<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import type { ReportPdfSnapshot } from '../lib/reportPdf/model';

  let {
    snapshot,
    onclose,
    preparing = false,
    comparisonUnavailable = false,
  }: {
    snapshot: ReportPdfSnapshot;
    onclose: () => void;
    preparing?: boolean;
    comparisonUnavailable?: boolean;
  } = $props();
  let dialog: HTMLDialogElement;
  let title = $state('');
  let organization = $state('');
  let language = $state<'de' | 'en'>('de');
  let phase = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let url = $state('');
  let generation = 0;

  function clear() {
    generation += 1;
    if (url) URL.revokeObjectURL(url);
    url = '';
    phase = 'idle';
  }
  $effect(() => {
    // A new account/year/data snapshot invalidates even an in-flight generation.
    const initial = snapshot;
    if (!initial) return;
    untrack(() => {
      clear();
      title = $_('reports.pdf.defaultTitle');
      language = $locale === 'en' ? 'en' : 'de';
      dialog?.showModal();
    });
  });
  onDestroy(clear);

  function close() {
    clear();
    dialog?.close();
    onclose();
  }
  function changed() {
    clear();
  }
  async function create() {
    if (preparing) return;
    clear();
    const active = generation;
    const frozen = structuredClone($state.snapshot(snapshot));
    const options = { title, organization, locale: language, createdAt: new Date().toISOString() };
    phase = 'loading';
    try {
      const { renderReportPdf } = await import('../lib/reportPdf/render');
      const blob = await renderReportPdf(frozen, options);
      if (active !== generation) return;
      url = URL.createObjectURL(blob);
      phase = 'ready';
    } catch {
      if (active === generation) phase = 'error';
    }
  }
</script>

<dialog
  bind:this={dialog}
  class="pdf-dialog"
  aria-labelledby="pdf-title"
  oncancel={(event) => {
    event.preventDefault();
    close();
  }}
>
  <header>
    <div>
      <p class="kicker">FEDIWINGS / PDF</p>
      <h2 id="pdf-title">{$_('reports.pdf.dialogTitle')}</h2>
    </div>
    <button type="button" onclick={close} aria-label={$_('reports.pdf.close')}>×</button>
  </header>
  <p class="pdf-local">{$_('reports.pdf.local')}</p>
  <p class="pdf-identity">{snapshot.handle} · {snapshot.year}</p>
  {#if preparing}<p role="status">{$_('reports.pdf.loadingPrevious')}</p>{/if}
  {#if comparisonUnavailable}<p role="status">{$_('reports.pdf.previousUnavailable')}</p>{/if}
  <form
    onsubmit={(event) => {
      event.preventDefault();
      void create();
    }}
  >
    <label for="pdf-report-title">{$_('reports.pdf.titleLabel')}</label>
    <input
      id="pdf-report-title"
      bind:value={title}
      maxlength="120"
      required
      oninput={changed}
      disabled={preparing}
    />
    <label for="pdf-organization">{$_('reports.pdf.organization')}</label>
    <input
      id="pdf-organization"
      bind:value={organization}
      maxlength="100"
      oninput={changed}
      disabled={preparing}
    />
    <label for="pdf-language">{$_('reports.pdf.language')}</label>
    <select id="pdf-language" bind:value={language} onchange={changed} disabled={preparing}>
      <option value="de">Deutsch</option><option value="en">English</option>
    </select>
    <button type="submit" class="pdf-primary" disabled={phase === 'loading' || preparing}
      >{$_('reports.pdf.create')}</button
    >
  </form>
  <p class="pdf-overview">{$_('reports.pdf.overview')}</p>
  {#if phase === 'loading'}<p role="status">{$_('reports.pdf.creating')}</p>{/if}
  {#if phase === 'error'}<p role="alert">{$_('reports.pdf.error')}</p>{/if}
  {#if phase === 'ready' && url}
    <p role="status">{$_('reports.pdf.ready')}</p>
    <div class="pdf-links">
      <a
        class="pdf-primary"
        href={url}
        download={`fediwings-report-${snapshot.year}-${language}.pdf`}
        >{$_('reports.pdf.download')}</a
      >
      <a href={url} target="_blank" rel="noopener">{$_('reports.pdf.open')}</a>
    </div>
    <iframe title={$_('reports.pdf.preview')} src={url}></iframe>
  {/if}
</dialog>

<style>
  .pdf-dialog {
    width: min(52rem, calc(100vw - 2rem));
    max-height: calc(100dvh - 2rem);
    box-sizing: border-box;
    overflow: auto;
    border: 1px solid var(--line-light);
    border-radius: 12px;
    padding: 1.5rem;
    background: var(--paper-raised);
    color: var(--ink);
  }
  .pdf-dialog::backdrop {
    background: rgba(0, 0, 0, 0.65);
  }
  header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
  }
  h2 {
    margin: 0;
    font: 700 2rem var(--sans-display);
  }
  .kicker {
    margin: 0 0 0.5rem;
    color: var(--violet-strong);
    font: 700 0.7rem var(--mono);
  }
  .pdf-local,
  .pdf-overview {
    color: var(--text-on-light);
    font-size: 0.85rem;
    line-height: 1.5;
  }
  .pdf-identity {
    overflow-wrap: anywhere;
  }
  form {
    display: grid;
    gap: 0.55rem;
    margin: 1.5rem 0;
  }
  label {
    font-size: 0.85rem;
    font-weight: 700;
  }
  input,
  select {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 0.6rem;
    background: white;
    color: var(--ink);
    border: 1px solid var(--text-on-light);
    border-radius: 4px;
    font: inherit;
  }
  button,
  a {
    min-height: 44px;
    box-sizing: border-box;
    padding: 0.7rem 1rem;
    border: 1px solid var(--violet-strong);
    border-radius: 4px;
    color: var(--violet-strong);
    font: 700 0.85rem var(--sans-display);
    cursor: pointer;
  }
  button {
    background: transparent;
  }
  button:disabled {
    opacity: 0.6;
    cursor: wait;
  }
  header button {
    padding: 0.5rem 0.85rem;
    font-size: 1.25rem;
  }
  .pdf-primary {
    background: var(--violet-strong);
    color: white;
  }
  form button {
    margin-top: 0.7rem;
  }
  .pdf-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin: 1rem 0;
  }
  .pdf-links a {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }
  iframe {
    width: 100%;
    height: 60vh;
    border: 1px solid var(--line-light);
  }
  :focus-visible {
    outline: 3px solid var(--violet-strong);
    outline-offset: 3px;
  }
  @media (max-width: 600px) {
    .pdf-dialog {
      padding: 1rem;
    }
    iframe {
      display: none;
    }
  }
</style>
