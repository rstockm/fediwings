<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import ReportCharts from './ReportCharts.svelte';
  import { getAccount } from '../lib/api';
  import { canonicalAcct } from '../lib/oauth';
  import { loadReport, type ReportLoadProgress } from '../lib/reportLoader';
  import { aggregateReport, type AggregatedReport } from '../lib/reports';
  import {
    listFollowerObservations,
    followerGrowth,
    monthEndFollowers,
    readReport,
    removeReport,
    reportAccountKey,
    reportKey,
    saveReport,
    type FollowerObservation,
  } from '../lib/reportStorage';
  import { reportAsCsv, reportAsTsv, type ReportExport } from '../lib/reportExport';
  import { reportFollowerHistory, type ReportFollowerHistory } from '../lib/reportFollowers';
  import type { MastodonAccount, ServerPlatform } from '../lib/types';

  let {
    account,
    origin,
    platform,
    followerHistory = null,
  }: {
    account: MastodonAccount;
    origin: string;
    platform: ServerPlatform | null;
    followerHistory?: ReportFollowerHistory | null;
  } = $props();

  let year = $state(new Date().getFullYear());
  let report = $state<AggregatedReport | null>(null);
  let analyzedAt = $state('');
  let accountObservedAt = $state('');
  let currentAccount = $state<MastodonAccount | null>(null);
  let observations = $state<FollowerObservation[]>([]);
  let savedAt = $state('');
  let busy = $state(false);
  let message = $state('');
  let actionMessage = $state('');
  let actionError = $state(false);
  let progress = $state<ReportLoadProgress | null>(null);
  let controller: AbortController | null = null;
  let previousIdentity = '';
  let previousYear: number | null = null;

  const accountKey = $derived(currentAccount ? reportAccountKey(origin, currentAccount.id) : '');
  const saved = $derived(savedAt !== '');
  const months = $derived(monthEndFollowers(observations, year));
  const historyValues = $derived(
    followerHistory ? reportFollowerHistory(followerHistory, year) : null,
  );
  const hasHistoryValues = $derived(
    historyValues !== null && historyValues.follows.some((value) => value !== null),
  );
  const currentBerlin = $derived(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
    }).formatToParts(new Date()),
  );
  const currentYear = $derived(Number(currentBerlin.find((part) => part.type === 'year')?.value));
  const currentMonth = $derived(Number(currentBerlin.find((part) => part.type === 'month')?.value));
  const validYear = $derived(Number.isInteger(year) && year >= 2006 && year <= currentYear);
  const years = $derived(
    Array.from({ length: currentYear - 2006 + 1 }, (_, index) => currentYear - index),
  );
  const labelYear = $derived(validYear ? year : currentYear);
  const latestObserved = $derived(
    [...observations].reverse().find((item) => {
      const date = new Date(item.observedAt);
      return (
        Number.isFinite(date.getTime()) &&
        new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Europe/Berlin' }).format(
          date,
        ) === String(year)
      );
    }) ?? null,
  );
  const labels = $derived(
    Array.from(
      { length: 12 },
      (_, index) =>
        new Intl.DateTimeFormat($locale === 'en' ? 'en' : 'de', {
          month: 'short',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(labelYear, index, 1))) +
        (labelYear === currentYear && index + 1 === currentMonth ? '*' : ''),
    ),
  );
  const rows = $derived.by(() => {
    const currentReport = report;
    if (!currentReport) return [];
    const growth = followerGrowth(observations, year);
    const followerValues = months.map(
      (item, index) => item?.count ?? historyValues?.followers[index] ?? null,
    );
    const growthValues = growth.map(
      (value, index) => value ?? historyValues?.follows[index] ?? null,
    );
    const annualFollowers =
      year === currentYear && currentAccount
        ? currentAccount.followers_count
        : ([...followerValues].reverse().find((value) => value !== null) ?? null);
    const annualGrowth = growthValues.some((value) => value !== null)
      ? growthValues.reduce<number>((sum, value) => sum + (value ?? 0), 0)
      : null;
    const period = (key: 'reach' | 'interactions' | 'engagement' | 'threads') => [
      ...currentReport.months.map((month) => month[key]),
      currentReport.total[key],
    ];
    return [
      {
        key: 'followers',
        label: $_('reports.followers'),
        values: [...followerValues, annualFollowers],
      },
      { key: 'growth', label: $_('reports.growth'), values: [...growthValues, annualGrowth] },
      { key: 'reach', label: $_('reports.reach'), values: period('reach') },
      { key: 'interactions', label: $_('reports.interactions'), values: period('interactions') },
      { key: 'engagement', label: $_('reports.engagement'), values: period('engagement') },
      { key: 'threads', label: $_('reports.threads'), values: period('threads') },
    ];
  });
  const exportData = $derived<ReportExport | null>(
    report && currentAccount
      ? {
          handle: canonicalAcct(currentAccount, origin),
          year,
          analyzedAt,
          modelNote:
            $_('reports.modelNote') +
            (year === currentYear ? ` ${$_('reports.currentMonth')}.` : '') +
            (latestObserved
              ? ` ${$_('reports.followerAsOf')}: ${latestObserved.observedAt}.`
              : '') +
            (hasHistoryValues ? ` ${$_('reports.followerHistoryNote')}` : '') +
            (hasHistoryValues && followerHistory?.partial
              ? ` ${$_('reports.followerHistoryPartial')}`
              : '') +
            (!report.total.counterComplete || !report.total.reachComplete
              ? ` ${$_('reports.partial')}`
              : ''),
          locale: $locale === 'en' ? 'en' : 'de',
          headers: [...labels, $_('reports.yearTotal')],
          rows,
        }
      : null,
  );

  $effect(() => {
    const identity = `${origin}|${account.id}|${account.acct}`;
    if (identity === previousIdentity) return;
    previousIdentity = identity;
    controller?.abort();
    report = null;
    currentAccount = null;
    observations = [];
    savedAt = '';
    message = '';
    actionMessage = '';
    actionError = false;
    untrack(() => void load());
  });

  $effect(() => {
    if (previousYear === null) {
      previousYear = year;
      return;
    }
    if (year === previousYear) return;
    previousYear = year;
    controller?.abort();
    report = null;
    currentAccount = null;
    observations = [];
    savedAt = '';
    message = '';
    actionMessage = '';
    actionError = false;
    if (!validYear) return;
    untrack(() => void load());
  });

  onDestroy(() => controller?.abort());

  async function load(): Promise<void> {
    if (!validYear) {
      message = $_('reports.invalidYear');
      return;
    }
    controller?.abort();
    const active = new AbortController();
    controller = active;
    busy = true;
    progress = null;
    message = '';
    try {
      const fresh = await getAccount(
        origin,
        canonicalAcct(account, origin),
        active.signal,
        platform?.id,
      );
      const observedAt = new Date().toISOString();
      const result = await loadReport(
        origin,
        fresh.id,
        fresh.followers_count,
        year,
        active.signal,
        (value) => {
          progress = value;
        },
        platform?.id !== 'pixelfed',
      );
      if (active.signal.aborted) return;
      currentAccount = fresh;
      accountObservedAt = observedAt;
      analyzedAt = new Date().toISOString();
      report = aggregateReport(year, result.posts, new Date(analyzedAt), result.historyComplete);
      const key = reportAccountKey(origin, fresh.id);
      try {
        const [storedObservations, storedReport] = await Promise.all([
          listFollowerObservations(key),
          readReport(key, year),
        ]);
        if (active.signal.aborted) return;
        observations = storedObservations;
        savedAt = storedReport?.savedAt ?? '';
      } catch {
        if (active.signal.aborted) return;
        message = $_('reports.storageError');
      }
      if (
        !result.historyComplete ||
        result.posts.some((post) => post.state !== 'complete' || post.threadTruncated)
      ) {
        message = $_('reports.partial');
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        message = error instanceof Error ? error.message : $_('reports.error');
      }
    } finally {
      if (controller === active) {
        busy = false;
        controller = null;
      }
    }
  }

  async function store(): Promise<void> {
    if (!report || !currentAccount || !accountKey) return;
    if (saved && !window.confirm($_('reports.replaceConfirm'))) return;
    const storedAt = new Date().toISOString();
    try {
      await saveReport(
        {
          version: 1,
          key: reportKey(accountKey, year),
          accountKey,
          handle: canonicalAcct(currentAccount, origin),
          savedAt: storedAt,
          analyzedAt,
          model: 'net-reach-v1',
          report: $state.snapshot(report),
        },
        { accountKey, observedAt: accountObservedAt, followers: currentAccount.followers_count },
      );
      observations = await listFollowerObservations(accountKey);
      savedAt = storedAt;
      message = $_('reports.saved');
    } catch {
      message = $_('reports.storageError');
    }
  }

  async function restore(): Promise<void> {
    if (!validYear) {
      message = $_('reports.invalidYear');
      return;
    }
    try {
      const fresh = await getAccount(
        origin,
        canonicalAcct(account, origin),
        undefined,
        platform?.id,
      );
      const key = reportAccountKey(origin, fresh.id);
      const stored = await readReport(key, year);
      if (!stored) {
        message = $_('reports.notFound');
        return;
      }
      currentAccount = fresh;
      accountObservedAt = new Date().toISOString();
      report = stored.report;
      analyzedAt = stored.analyzedAt;
      observations = await listFollowerObservations(key);
      savedAt = stored.savedAt;
      message = $_('reports.restored');
    } catch {
      message = $_('reports.storageError');
    }
  }

  async function remove(): Promise<void> {
    if (!accountKey || !window.confirm($_('reports.deleteConfirm'))) return;
    try {
      await removeReport(accountKey, year);
      savedAt = '';
      actionMessage = $_('reports.deleted');
      actionError = false;
    } catch {
      actionMessage = $_('reports.storageError');
      actionError = true;
    }
  }

  async function copy(): Promise<void> {
    if (!exportData) return;
    try {
      await navigator.clipboard.writeText(reportAsTsv(exportData));
      actionMessage = $_('reports.copied');
      actionError = false;
    } catch {
      actionMessage = $_('reports.copyError');
      actionError = true;
    }
  }

  function download(): void {
    if (!exportData) return;
    const url = URL.createObjectURL(
      new Blob([reportAsCsv(exportData)], { type: 'text/csv;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `fediwings-report-${year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
</script>

<section class="follower-card reports-panel" aria-labelledby="reports-title">
  <h2 id="reports-title">{$_('reports.title')}</h2>
  <p>{$_('reports.intro')}</p>
  <form
    class="reports-actions reports-toolbar"
    onsubmit={(event) => {
      event.preventDefault();
      void load();
    }}
  >
    <label for="report-year">{$_('reports.year')}</label>
    <select id="report-year" bind:value={year}>
      {#each years as option (option)}
        <option value={option}>{option}</option>
      {/each}
    </select>
    <button type="submit" disabled={busy}>{$_('reports.load')}</button>
    {#if busy}<button type="button" onclick={() => controller?.abort()}
        >{$_('follower.cancel')}</button
      >{/if}
    <button type="button" disabled={busy} onclick={() => void restore()}
      >{$_('reports.restore')}</button
    >
    <button
      type="button"
      disabled={busy || !report}
      title={!report ? $_('reports.saveHint') : undefined}
      onclick={() => void store()}>{$_('reports.save')}</button
    >
  </form>
  {#if !report && !busy}<p class="reports-hint">{$_('reports.saveHint')}</p>{/if}
  {#if busy}
    <p role="status">
      {$_('reports.loading')}
      {progress?.requests ?? 0}
      {#if progress?.analysis}
        · {progress.analysis.completedPosts}/{progress.analysis.totalPosts}{/if}
    </p>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if report}
    <p>
      {$_('reports.asOf')}: {new Date(analyzedAt).toLocaleString($locale === 'en' ? 'en' : 'de')} · {$_(
        'reports.modelNote',
      )}
    </p>
    {#if !report.total.counterComplete || !report.total.reachComplete}<p>
        {$_('reports.partial')}
      </p>{/if}
    {#if year === currentYear}<p>{$_('reports.currentMonth')}</p>{/if}
    {#if latestObserved}
      <p>
        {$_('reports.followerAsOf')}:
        {new Date(latestObserved.observedAt).toLocaleString($locale === 'en' ? 'en' : 'de', {
          timeZone: 'Europe/Berlin',
        })}
      </p>
    {/if}
    {#if hasHistoryValues}
      <p>{$_('reports.followerHistoryNote')}</p>
      {#if followerHistory?.partial}<p>{$_('reports.followerHistoryPartial')}</p>{/if}
    {/if}
    <p class="reports-saved-state">
      {#if savedAt}
        {$_('reports.savedState')}:
        {new Date(savedAt).toLocaleString($locale === 'en' ? 'en' : 'de', {
          timeZone: 'Europe/Berlin',
        })}
      {:else}
        {$_('reports.noSavedState')}
      {/if}
    </p>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Scrollable table needs keyboard focus.) -->
    <div class="reports-scroll" role="region" aria-label={$_('reports.title')} tabindex="0">
      <table>
        <thead
          ><tr
            ><th scope="col">{$_('reports.metric')}</th>{#each labels as label, index (index)}<th
                scope="col">{label}</th
              >{/each}<th scope="col">{$_('reports.yearTotal')}</th></tr
          ></thead
        >
        <tbody>
          {#each rows as row (row.label)}
            <tr
              ><th scope="row">{row.label}</th>{#each row.values as cell, index (index)}<td
                  >{cell === null
                    ? '—'
                    : new Intl.NumberFormat($locale === 'en' ? 'en' : 'de', {
                        maximumFractionDigits: 1,
                      }).format(cell)}</td
                >{/each}</tr
            >
          {/each}
        </tbody>
      </table>
    </div>
    <ReportCharts {labels} {rows} />
    <div class="reports-actions">
      <button type="button" disabled={!saved} onclick={() => void remove()}
        >{$_('reports.delete')}</button
      >
      <button type="button" onclick={() => void copy()}>{$_('reports.copy')}</button>
      <button type="button" onclick={download}>{$_('reports.csv')}</button>
    </div>
    {#if actionMessage}
      <p
        class="reports-action-status"
        class:reports-action-status-error={actionError}
        role="status"
      >
        {actionMessage}
      </p>
    {/if}
    <p>{$_('reports.storageNote')}</p>
  {/if}
</section>

<style>
  .reports-panel {
    min-width: 0;
  }
  .reports-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
    margin: 1rem 0;
  }
  .reports-toolbar {
    margin-bottom: 0.4rem;
  }
  .reports-hint,
  .reports-saved-state {
    margin: 0 0 0.8rem;
    color: var(--text-on-dark);
    font-size: 0.8rem;
  }
  .reports-action-status {
    margin: -0.2rem 0 0.8rem;
    color: var(--lime);
    font: 0.72rem var(--mono);
  }
  .reports-action-status-error {
    color: var(--chart-decline);
  }
  .reports-actions select {
    width: 6.5rem;
    min-height: 44px;
    padding: 0 2.4rem 0 0.8rem;
    border: 1px solid var(--line-dark);
    border-radius: var(--radius);
    color: var(--paper);
    background-color: transparent;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5 6 6.5 11 1.5' fill='none' stroke='%23f1eee5' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.9rem center;
    font: inherit;
    appearance: none;
    color-scheme: dark;
  }
  .reports-actions select option {
    color: var(--paper);
    background: #202125;
  }
  .reports-actions button {
    min-height: 44px;
    padding: 0.65rem 1rem;
    border: 1px solid var(--line-dark);
    border-radius: var(--radius);
    color: var(--paper);
    background: transparent;
    font: 700 0.7rem var(--mono);
    cursor: pointer;
  }
  .reports-actions button[type='submit'] {
    border-color: var(--lime);
    color: var(--ink);
    background: var(--lime);
  }
  .reports-actions button:hover:not(:disabled) {
    filter: brightness(1.2);
  }
  .reports-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .reports-actions :focus-visible,
  .reports-scroll:focus-visible {
    outline: 2px solid var(--lime);
    outline-offset: 3px;
  }
  .reports-scroll {
    max-width: 100%;
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    min-width: 54rem;
  }
  th,
  td {
    padding: 0.55rem;
    text-align: right;
    border-bottom: 1px solid var(--line-dark);
    white-space: nowrap;
  }
  th:first-child {
    text-align: left;
  }
</style>
