<script module lang="ts">
  import type { MastodonAccount as CachedAccount } from '../lib/types';
  let accountCache: { key: string; at: number; account: CachedAccount } | null = null;
</script>

<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { _, locale } from 'svelte-i18n';
  import ReportCharts from './ReportCharts.svelte';
  import ReportPdfDialog from './ReportPdfDialog.svelte';
  import { preparePdfSnapshot, hydrateSnapshotMedia } from '../lib/reportPdf/prepare';
  import type { ReportPdfSnapshot } from '../lib/reportPdf/model';
  import { prepareAnnualComparison } from '../lib/reportPdf/comparisons';
  import { getAccount, getStatus } from '../lib/api';
  import { canonicalAcct } from '../lib/oauth';
  import { loadReport, REPORT_CACHE_MS, type ReportLoadProgress } from '../lib/reportLoader';
  import { loadReportInteractions } from '../lib/reportInteractions';
  import type { FollowerProgress } from '../lib/followers';
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
    sessionKey = '',
    notificationToken,
    loadFollowerHistory,
    onbusy,
  }: {
    account: MastodonAccount;
    origin: string;
    platform: ServerPlatform | null;
    followerHistory?: ReportFollowerHistory | null;
    sessionKey?: string;
    notificationToken?: string;
    loadFollowerHistory?: (
      account: MastodonAccount,
      signal: AbortSignal,
      onProgress: (progress: FollowerProgress) => void,
      refresh: boolean,
    ) => Promise<void>;
    onbusy?: (busy: boolean) => void;
  } = $props();

  let year = $state(new Date().getFullYear());
  let report = $state<AggregatedReport | null>(null);
  let pdfSnapshot = $state<ReportPdfSnapshot | null>(null);
  let mediaTask: Promise<void> | null = null;
  let pdfOpen = $state(false);
  let comparisonLoading = $state(false);
  let comparisonUnavailable = $state(false);
  let comparisonController: AbortController | null = null;
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
  let followerProgress = $state<FollowerProgress | null>(null);
  let interactionRequests = $state(0);
  let followersDone = $state(false);
  let reportDone = $state(false);
  const measurable = $derived(
    !reportDone && progress?.phase === 'reach' && (progress.analysis?.totalPosts ?? 0) > 0,
  );
  const percent = $derived(
    measurable && progress?.analysis
      ? Math.round((progress.analysis.completedPosts / progress.analysis.totalPosts) * 100)
      : null,
  );
  const requests = $derived(
    (progress?.requests ?? 0) +
      (progress?.analysis?.requests ?? 0) +
      (followerProgress?.requests ?? 0) +
      interactionRequests,
  );
  let controller: AbortController | null = null;
  let previousIdentity = '';
  let previousYear: number | null = null;
  let reportOperation = 0;

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
  const interactionPartial = $derived(
    report?.interactionBasis
      ? [...report.months, report.total].map((period) => period.interactionsComplete === false)
      : undefined,
  );
  const interactionNote = $derived(
    $_(report?.interactionBasis ? 'reports.interactionNote' : 'reports.legacyInteractionNote'),
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
      {
        key: 'interactions',
        label: $_('reports.interactions'),
        values: period('interactions'),
        partial: interactionPartial,
      },
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
            `${$_('reports.modelNote')} ${interactionNote}` +
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
          rows: interactionPartial?.some(Boolean)
            ? rows.flatMap((row) =>
                row.key === 'interactions'
                  ? [
                      row,
                      {
                        label: $_('reports.interactionCoverage'),
                        values: interactionPartial.map((partial, index) =>
                          !partial
                            ? null
                            : $_(
                                row.values[index] === null
                                  ? 'reports.unknown'
                                  : 'reports.partialValue',
                              ),
                        ),
                      },
                    ]
                  : [row],
              )
            : rows,
        }
      : null,
  );

  $effect(() => {
    const identity = `${sessionKey}|${origin}|${account.id}|${account.acct}`;
    if (identity === previousIdentity) return;
    previousIdentity = identity;
    controller?.abort();
    report = null;
    pdfSnapshot = null;
    pdfOpen = false;
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
    pdfSnapshot = null;
    pdfOpen = false;
    currentAccount = null;
    observations = [];
    savedAt = '';
    message = '';
    actionMessage = '';
    actionError = false;
    if (!validYear) return;
    untrack(() => void load());
  });

  onDestroy(() => {
    controller?.abort();
    comparisonController?.abort();
  });

  function closePdf(): void {
    comparisonController?.abort();
    comparisonController = null;
    comparisonLoading = false;
    pdfOpen = false;
  }

  async function openPdf(): Promise<void> {
    if (mediaTask) await mediaTask;
    const selected = pdfSnapshot;
    if (!selected || busy || !currentAccount) return;
    // Retry missing metadata at export time too: a failed restoration must not
    // permanently decide whether this report contains pictures.
    if (
      selected.origin !== 'legacy' &&
      (!selected.avatarUrl ||
        selected.topPosts.some((post) => !post.imageUrl && !post.sensitive && !post.contentWarning))
    ) {
      const enriched = await hydrateSnapshotMedia(
        $state.snapshot(selected),
        currentAccount.avatar_static,
        (id) => getStatus(origin, id, AbortSignal.timeout(6000)),
      );
      if (busy || pdfSnapshot !== selected) return;
      pdfSnapshot = enriched;
    }
    const base = pdfSnapshot;
    if (!base || busy || !currentAccount) return;
    pdfOpen = true;
    comparisonUnavailable = false;
    if (
      base.annualComparison ||
      base.origin !== 'live' ||
      (!base.report.total.counterComplete && !base.report.total.reachComplete)
    )
      return;
    comparisonController?.abort();
    const active = new AbortController();
    comparisonController = active;
    comparisonLoading = true;
    try {
      const [previous, interactions] = await Promise.all([
        loadReport(
          origin,
          currentAccount.id,
          currentAccount.followers_count,
          base.year - 1,
          active.signal,
          () => {},
          platform?.id !== 'pixelfed',
          sessionKey ? { cacheKey: sessionKey } : undefined,
        ),
        base.report.interactionBasis
          ? loadReportInteractions(
              origin,
              notificationToken,
              base.year - 1,
              active.signal,
              undefined,
              sessionKey ? { cacheKey: sessionKey } : undefined,
            )
          : undefined,
      ]);
      if (active.signal.aborted || pdfSnapshot !== base) return;
      pdfSnapshot = {
        ...$state.snapshot(base),
        annualComparison: prepareAnnualComparison(
          base.year,
          base.analyzedAt,
          previous,
          interactions,
        ),
      };
    } catch {
      if (!active.signal.aborted) comparisonUnavailable = true;
    } finally {
      if (comparisonController === active) {
        comparisonLoading = false;
        comparisonController = null;
      }
    }
  }

  export async function refresh(): Promise<void> {
    await load(true);
  }

  async function load(refresh = false): Promise<void> {
    closePdf();
    reportOperation += 1;
    if (!validYear) {
      message = $_('reports.invalidYear');
      return;
    }
    controller?.abort();
    const active = new AbortController();
    controller = active;
    busy = true;
    onbusy?.(true);
    report = null;
    pdfSnapshot = null;
    pdfOpen = false;
    actionMessage = '';
    progress = null;
    comparisonLoading = false;
    followerProgress = null;
    interactionRequests = 0;
    followersDone = !loadFollowerHistory;
    reportDone = false;
    message = '';
    try {
      const identity = `${sessionKey}|${origin}|${account.id}`;
      const reuseAccount =
        !refresh &&
        accountCache?.key === identity &&
        Date.now() - accountCache.at < REPORT_CACHE_MS;
      const fresh =
        reuseAccount && accountCache
          ? accountCache.account
          : await getAccount(origin, canonicalAcct(account, origin), active.signal, platform?.id);
      if (active.signal.aborted) return;
      if (!reuseAccount) accountCache = { key: identity, at: Date.now(), account: fresh };
      const observedAt = new Date(accountCache!.at).toISOString();
      const followerTask = loadFollowerHistory
        ? loadFollowerHistory(
            fresh,
            active.signal,
            (value) => {
              if (!active.signal.aborted) followerProgress = value;
            },
            refresh,
          ).finally(() => {
            if (!active.signal.aborted) followersDone = true;
          })
        : Promise.resolve();
      const reportTask = loadReport(
        origin,
        fresh.id,
        fresh.followers_count,
        year,
        active.signal,
        (value) => {
          if (!active.signal.aborted) progress = value;
        },
        platform?.id !== 'pixelfed',
        sessionKey ? { cacheKey: sessionKey, refresh } : undefined,
      );
      const interactionTask = loadReportInteractions(
        origin,
        fresh.id === account.id ? notificationToken : undefined,
        year,
        active.signal,
        (count) => {
          if (!active.signal.aborted) interactionRequests = count;
        },
        sessionKey ? { cacheKey: sessionKey, refresh } : undefined,
      );
      const reportResults = Promise.allSettled([reportTask, interactionTask]).then((results) => {
        if (!active.signal.aborted) reportDone = true;
        return results;
      });
      const [[loaded, interactions], history] = await Promise.all([
        reportResults,
        Promise.allSettled([followerTask]).then(([result]) => result),
      ]);
      if (active.signal.aborted) return;
      if (loaded.status === 'rejected') throw loaded.reason;
      const result = loaded.value;
      currentAccount = fresh;
      accountObservedAt = observedAt;
      analyzedAt = new Date(
        Math.max(
          Date.parse(result.analyzedAt ?? new Date().toISOString()),
          interactions.status === 'fulfilled' ? interactions.value.observedAt : 0,
        ),
      ).toISOString();
      report = aggregateReport(
        year,
        result.posts,
        new Date(analyzedAt),
        result.historyComplete,
        interactions.status === 'fulfilled'
          ? interactions.value
          : { oldest: null, timestamps: [], observedAt: Date.parse(analyzedAt) },
      );
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
      if (history.status === 'rejected') message = $_('reports.partial');
      pdfSnapshot = preparePdfSnapshot({
        handle: canonicalAcct(fresh, origin),
        displayName: fresh.display_name,
        avatarUrl: fresh.avatar_static,
        report: $state.snapshot(report),
        analyzedAt,
        followerObservation: { count: fresh.followers_count, observedAt },
        posts: result.posts,
        observations: $state.snapshot(observations),
        history: history.status === 'rejected' ? null : $state.snapshot(followerHistory),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        message = error instanceof Error ? error.message : $_('reports.error');
      }
    } finally {
      if (controller === active) {
        busy = false;
        onbusy?.(false);
        controller = null;
      }
    }
  }

  async function store(): Promise<void> {
    if (!report || !currentAccount || !accountKey || !pdfSnapshot) return;
    if (saved && !window.confirm($_('reports.replaceConfirm'))) return;
    const storedAt = new Date().toISOString();
    try {
      await saveReport(
        {
          version: 2,
          pdfSnapshot: $state.snapshot(pdfSnapshot),
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
    const operation = ++reportOperation;
    const selectedYear = year;
    const selectedIdentity = `${origin}|${account.id}`;
    const stillSelected = () =>
      operation === reportOperation &&
      selectedYear === year &&
      selectedIdentity === `${origin}|${account.id}`;
    try {
      const fresh = await getAccount(
        origin,
        canonicalAcct(account, origin),
        undefined,
        platform?.id,
      );
      if (!stillSelected()) return;
      const key = reportAccountKey(origin, fresh.id);
      const stored = await readReport(key, selectedYear);
      if (!stillSelected()) return;
      if (!stored) {
        message = $_('reports.notFound');
        return;
      }
      currentAccount = fresh;
      accountObservedAt = new Date().toISOString();
      report = stored.version === 2 ? stored.pdfSnapshot.report : stored.report;
      pdfOpen = false;
      pdfSnapshot =
        stored.version === 2
          ? { ...stored.pdfSnapshot, origin: 'stored' }
          : preparePdfSnapshot({
              handle: stored.handle,
              displayName: stored.handle,
              report: stored.report,
              analyzedAt: stored.analyzedAt,
              legacy: true,
            });
      analyzedAt = stored.analyzedAt;
      const restored = pdfSnapshot;
      const missingMedia =
        restored &&
        (!restored.avatarUrl ||
          restored.topPosts.some(
            (post) => !post.imageUrl && !post.sensitive && !post.contentWarning,
          ));
      if (restored && missingMedia) {
        const hydration = hydrateSnapshotMedia(restored, fresh.avatar_static, (id) =>
          getStatus(origin, id, AbortSignal.timeout(6000)),
        )
          .then((enriched) => {
            if (!stillSelected() || !pdfSnapshot) return;
            if (
              pdfSnapshot.year !== restored.year ||
              pdfSnapshot.analyzedAt !== restored.analyzedAt
            )
              return;
            pdfSnapshot = {
              ...pdfSnapshot,
              avatarUrl: pdfSnapshot.avatarUrl ?? enriched.avatarUrl,
              topPosts: enriched.topPosts,
            };
          })
          .catch(() => {});
        mediaTask = hydration;
        void hydration.finally(() => {
          if (mediaTask === hydration) mediaTask = null;
        });
      }
      const restoredObservations = await listFollowerObservations(key);
      if (!stillSelected()) return;
      observations = restoredObservations;
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
  <div class="reports-toolbar">
    <form
      class="reports-actions"
      onsubmit={(event) => {
        event.preventDefault();
        void refresh();
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
    {#if report && !busy}
      <div class="reports-export" role="group" aria-label={$_('reports.exportGroup')}>
        <button
          type="button"
          disabled={!pdfSnapshot}
          onclick={() => {
            void openPdf();
          }}
        >
          {$_('reports.pdf.action')}
        </button>
        <button type="button" onclick={() => void copy()}>{$_('reports.copy')}</button>
        <button type="button" onclick={download}>{$_('reports.csv')}</button>
      </div>
    {/if}
  </div>
  {#if report && !busy && actionMessage}
    <p class="reports-action-status" class:reports-action-status-error={actionError} role="status">
      {actionMessage}
    </p>
  {/if}
  {#if !report && !busy}<p class="reports-hint">{$_('reports.saveHint')}</p>{/if}
  {#if busy}
    <div class="follower-progress-block reports-progress" role="status" aria-live="polite">
      <div class="follower-progress-head">
        <strong>{$_('reports.combinedLoading')}</strong>
        <span
          >{percent === null
            ? $_('reports.preparing')
            : `${$_('reports.analyzing')} · ${percent}%`}</span
        >
      </div>
      <div
        class="follower-progress-track"
        class:track-pending={percent === null}
        role="progressbar"
        aria-label={$_('reports.combinedLoading')}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percent ?? undefined}
      >
        <span style:width={`${percent ?? 30}%`}></span>
      </div>
      <p class="follower-progress">
        {reportDone
          ? followersDone
            ? $_('reports.finalizing')
            : $_('reports.waitingFollowers')
          : progress?.phase === 'reach'
            ? $_('reports.analyzing')
            : $_('reports.fetching')}
        {#if progress?.analysis && progress.analysis.totalPosts > 0}
          · {progress.analysis.completedPosts}/{progress.analysis.totalPosts}
        {/if}
        · {$_('reports.requestCount', { values: { count: requests } })}
        {#if followerProgress}
          · {$_('follower.progressEvents', { values: { events: followerProgress.events } })}
        {/if}
        {#if progress?.analysis?.waitingUntil}
          · {$_('reports.rateLimitWait')}
        {/if}
      </p>
    </div>
  {/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if report && !busy}
    <p>
      {$_('reports.asOf')}: {new Date(analyzedAt).toLocaleString($locale === 'en' ? 'en' : 'de')} · {$_(
        'reports.modelNote',
      )}
    </p>
    <p>{interactionNote}</p>
    {#if interactionPartial?.some(Boolean)}<p>{$_('reports.interactionPartial')}</p>{/if}
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
    <div class="reports-saved-state">
      <span>
        {#if savedAt}
          {$_('reports.savedState')}:
          {new Date(savedAt).toLocaleString($locale === 'en' ? 'en' : 'de', {
            timeZone: 'Europe/Berlin',
          })}
        {:else}
          {$_('reports.noSavedState')}
        {/if}
      </span>
      {#if saved}
        <button type="button" class="reports-delete" onclick={() => void remove()}
          >{$_('reports.delete')}</button
        >
      {/if}
    </div>
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
              ><th scope="row">{row.label}</th>{#each row.values as cell, index (index)}<td>
                  {#if cell === null}
                    <span aria-label={row.partial?.[index] ? $_('reports.unknown') : undefined}
                      >—</span
                    >
                  {:else}
                    {new Intl.NumberFormat($locale === 'en' ? 'en' : 'de', {
                      maximumFractionDigits: 1,
                    }).format(cell)}{#if row.partial?.[index]}&nbsp;
                      <abbr title={$_('reports.partialValue')}>!</abbr>{/if}
                  {/if}
                </td>{/each}</tr
            >
          {/each}
        </tbody>
      </table>
    </div>
    <ReportCharts {labels} {rows} />
    <p>{$_('reports.storageNote')}</p>
  {/if}
</section>

{#if pdfOpen && pdfSnapshot && !busy}
  <ReportPdfDialog
    snapshot={pdfSnapshot}
    preparing={comparisonLoading}
    {comparisonUnavailable}
    onclose={() => {
      closePdf();
    }}
  />
{/if}

<style>
  .reports-panel {
    min-width: 0;
  }
  .reports-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    margin: 1rem 0 0.4rem;
  }
  .reports-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem;
    align-items: center;
  }
  .reports-export {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
  }
  .reports-export button {
    min-height: 38px;
    padding: 0.4rem 0.7rem;
    border: 1px solid var(--line-dark);
    border-radius: var(--radius);
    color: var(--paper);
    background: transparent;
    font: 700 0.64rem var(--mono);
    cursor: pointer;
  }
  .reports-export button:hover:not(:disabled) {
    border-color: var(--lime);
    color: var(--lime);
  }
  .reports-export button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .reports-hint,
  .reports-saved-state {
    margin: 0 0 0.8rem;
    color: var(--text-on-dark);
    font-size: 0.8rem;
  }
  .reports-saved-state {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.75rem;
  }
  .reports-delete {
    padding: 0;
    border: 0;
    color: inherit;
    background: none;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 0.18em;
    cursor: pointer;
  }
  .reports-delete:hover {
    color: var(--chart-decline);
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
  .reports-export :focus-visible,
  .reports-delete:focus-visible,
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
  th[scope='row'] {
    white-space: normal;
    max-width: 12rem;
  }
  @media (max-width: 720px) {
    .reports-export {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      width: 100%;
      margin-left: 0;
    }
    .reports-export button {
      min-height: 44px;
      padding: 0.35rem 0.4rem;
      line-height: 1.2;
    }
  }
</style>
