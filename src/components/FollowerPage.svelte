<script module lang="ts">
  import type {
    AnchoredSeries as CachedAnchoredSeries,
    MonthlyPoint as CachedMonthlyPoint,
  } from '../lib/followers';
  import type { OAuthSession as CachedOAuthSession } from '../lib/oauth';
  import type {
    MastodonAccount as CachedMastodonAccount,
    ServerPlatform as CachedPlatform,
  } from '../lib/types';

  export interface AccountSelection {
    account: CachedMastodonAccount;
    platform: CachedPlatform | null;
    origin: string;
  }

  interface HistoryCache {
    createdAt: number;
    sessionKey: string;
    phase: 'ready' | 'partial';
    message: string;
    monthly: CachedMonthlyPoint[];
    anchored: CachedAnchoredSeries;
    eventsCount: number;
    requestsUsed: number;
    oldestDate: string;
    historyIncomplete: boolean;
  }

  // Keeps completed results while the component is unmounted during an in-app view change.
  let historyCache: HistoryCache | null = null;

  function historySessionKey(session: CachedOAuthSession): string {
    return `${session.origin}|${session.account.id}|${session.token}`;
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte';
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import HandleCombobox from './HandleCombobox.svelte';
  import ReportsPanel from './ReportsPanel.svelte';
  import { getAccount, MastodonApiError } from '../lib/api';
  import {
    buildAnchoredSeries,
    buildMonthlySeries,
    fetchFollowerEvents,
    type AnchoredSeries,
    type FollowerProgress,
    type MonthlyPoint,
  } from '../lib/followers';
  import { resolveHandle } from '../lib/handle';
  import type { SavedHandle } from '../lib/history';
  import { canonicalAcct, type OAuthSession } from '../lib/oauth';
  import type { ConnectionCandidate } from './ConnectionPanel.svelte';
  import { detectPlatform } from '../lib/platform';
  import { readLastAccount, writeLastAccount } from '../lib/lastAccount';
  import type { MastodonAccount, ServerPlatform } from '../lib/types';
  import { msg } from '../lib/i18n';
  import { REPORT_CACHE_MS } from '../lib/reportLoader';

  let {
    prefillHandle = '',
    savedHandles = [],
    snapshot = null,
    authSession = null,
    authPhase = 'idle',
    onopenconnection,
    oninvalidatesession,
    onselectaccount,
  }: {
    prefillHandle?: string;
    savedHandles?: SavedHandle[];
    snapshot?: AccountSelection | null;
    authSession?: OAuthSession | null;
    authPhase?: 'idle' | 'connecting' | 'connected' | 'error';
    onopenconnection: (candidate: ConnectionCandidate | null) => void;
    oninvalidatesession: (message: string) => void;
    onselectaccount?: (selection: AccountSelection) => void;
  } = $props();

  function selectionKey(value: { account: MastodonAccount; origin: string } | null): string {
    if (!value) return '';
    return `${value.origin}|${value.account.id || value.account.acct}`;
  }

  function applyStoredAccount(stored: NonNullable<ReturnType<typeof readLastAccount>>): void {
    const username = stored.acct.split('@')[0] ?? stored.acct;
    handle = stored.handle;
    origin = stored.origin;
    platform =
      stored.platformId === 'unknown'
        ? null
        : { id: stored.platformId, name: stored.platformName, mastodonApi: true };
    account = {
      id: '',
      username,
      acct: stored.acct,
      display_name: username,
      url: `https://${stored.origin.replace(/^https:\/\//, '')}/@${username}`,
      avatar_static: '',
      followers_count: stored.followers,
    };
    anonPhase = 'ready';
  }

  type AnonPhase = 'idle' | 'loading' | 'ready' | 'error';
  type HistoryPhase = 'idle' | 'loading' | 'ready' | 'partial' | 'error';

  let handle = $state('');
  let anonPhase = $state<AnonPhase>('idle');
  let anonMessage = $state('');
  let account = $state<MastodonAccount | null>(null);
  let platform = $state<ServerPlatform | null>(null);
  let origin = $state('');

  let historyPhase = $state<HistoryPhase>('idle');
  let historyMessage = $state('');
  let monthly = $state<MonthlyPoint[]>([]);
  let anchored = $state<AnchoredSeries | null>(null);
  let eventsCount = $state(0);
  let requestsUsed = $state(0);
  let oldestDate = $state('');
  let historyIncomplete = $state(false);
  let appliedSession = '';
  let appliedSelection = $state('');
  let initialized = $state(false);
  let historyRun = 0;
  let reportBusy = $state(true);
  let reportsPanel = $state<ReportsPanel>();

  const hasHistory = $derived(historyPhase === 'ready' || historyPhase === 'partial');
  const connectedAccount = $derived(
    authSession !== null &&
      account !== null &&
      authSession.origin === origin &&
      authSession.account.id === account.id,
  );
  const heroCollapsed = $derived(anonPhase === 'loading' || account !== null);
  const months = $derived(monthly.map((point) => point.month));
  const monthLabels = $derived.by(() => {
    const every = Math.max(1, Math.ceil(months.length / 6));
    return months.map((month, index) =>
      index % every === 0 || index === months.length - 1
        ? $_date(new Date(`${month}-01T00:00:00Z`), { format: 'month' })
        : '',
    );
  });
  const handleMatchesSession = $derived(
    authSession !== null &&
      normalizedHandle(handle) ===
        canonicalAcct(authSession.account, authSession.origin).toLowerCase(),
  );

  function normalizedHandle(value: string): string {
    return value.trim().replace(/^@/, '').toLowerCase();
  }

  function applyFollowerSession(session: OAuthSession): void {
    origin = session.origin;
    handle = `@${canonicalAcct(session.account, session.origin)}`;
    account = session.account;
    anonPhase = 'ready';
    appliedSelection = selectionKey(session);
  }

  function applySelection(selection: AccountSelection): void {
    handle = `@${canonicalAcct(selection.account, selection.origin)}`;
    origin = selection.origin;
    account = selection.account;
    platform = selection.platform;
    anonPhase = 'ready';
    appliedSelection = selectionKey(selection);
  }

  function restoreHistory(session: OAuthSession): boolean {
    if (!historyCache || historyCache.sessionKey !== historySessionKey(session)) return false;
    if (Date.now() - historyCache.createdAt > REPORT_CACHE_MS) return false;
    historyPhase = historyCache.phase;
    historyMessage = historyCache.message;
    monthly = historyCache.monthly;
    anchored = historyCache.anchored;
    eventsCount = historyCache.eventsCount;
    requestsUsed = historyCache.requestsUsed;
    oldestDate = historyCache.oldestDate;
    historyIncomplete = historyCache.historyIncomplete;
    return true;
  }

  function resetHistory(): void {
    historyRun += 1;
    historyPhase = 'idle';
    historyMessage = '';
    monthly = [];
    anchored = null;
    eventsCount = 0;
    requestsUsed = 0;
    oldestDate = '';
    historyIncomplete = false;
  }

  onMount(() => {
    if (snapshot) {
      // An explicit in-app selection (analysis or Reports) beats a stale stored account.
      applySelection(snapshot);
    } else if (authSession) {
      applyFollowerSession(authSession);
    } else {
      const stored = readLastAccount();
      if (stored) {
        applyStoredAccount(stored);
      } else if (prefillHandle) {
        handle = prefillHandle;
      }
    }
    initialized = true;
  });

  // Adopt account changes that originate outside this component (for example a finished
  // OAuth switch). The key guard prevents the local selection echo from resetting state.
  $effect(() => {
    if (!initialized || !snapshot) return;
    if (selectionKey(snapshot) === appliedSelection) return;
    applySelection(snapshot);
  });

  // OAuth redirects restore the account, but not the in-memory software detection.
  // Reuse the software recorded for this server before querying NodeInfo again.
  $effect(() => {
    if (!initialized || !connectedAccount || platform || !account) return;
    const stored = readLastAccount();
    if (stored?.origin === origin && stored.platformId !== 'unknown') {
      platform = {
        id: stored.platformId,
        name: stored.platformName,
        mastodonApi: true,
      };
      return;
    }
    const controller = new AbortController();
    const selectedAccount = account;
    const selectedOrigin = origin;
    void detectPlatform(selectedOrigin, controller.signal)
      .then((detected) => {
        if (controller.signal.aborted) return;
        platform = detected;
        onselectaccount?.({ account: selectedAccount, origin: selectedOrigin, platform: detected });
      })
      .catch(() => {
        // Cleanup aborts detection when the selected account or view changes.
      });
    return () => controller.abort();
  });

  $effect(() => {
    if (!initialized) return;
    if (authSession && connectedAccount) {
      if (authSession.token !== appliedSession) {
        appliedSession = authSession.token;
        resetHistory();
        restoreHistory(authSession);
      }
      return;
    }
    // A session exists for another account (or none at all): never show its history here.
    if (appliedSession) {
      appliedSession = '';
      resetHistory();
    }
  });

  async function loadAccount(): Promise<void> {
    if (anonPhase === 'loading') return;
    anonPhase = 'loading';
    anonMessage = '';
    account = null;
    platform = null;
    try {
      const target = await resolveHandle(handle);
      origin = target.origin;
      const platformResult = await detectPlatform(target.origin);
      const accountResult = await getAccount(
        target.origin,
        target.acct,
        undefined,
        platformResult.id,
      );
      const acct = canonicalAcct(accountResult, target.origin);
      account = accountResult;
      platform = platformResult;
      handle = `@${acct}`;
      writeLastAccount({
        handle: `@${acct}`,
        acct,
        origin: target.origin,
        followers: accountResult.followers_count,
        platformId: platformResult?.id ?? 'unknown',
        platformName: platformResult?.name ?? 'ActivityPub-Server',
        source: 'follower',
      });
      anonPhase = 'ready';
      appliedSelection = selectionKey({ account: accountResult, origin: target.origin });
      onselectaccount?.({
        account: accountResult,
        platform: platformResult,
        origin: target.origin,
      });
      const sessionMatches =
        authSession !== null &&
        authSession.origin === target.origin &&
        authSession.account.id === accountResult.id;
      if (!sessionMatches) onopenconnection({ account: accountResult, origin: target.origin });
    } catch (error) {
      anonPhase = 'error';
      anonMessage =
        error instanceof MastodonApiError || error instanceof Error
          ? error.message
          : msg('follower.accountFailed');
    }
  }

  async function loadHistory(
    fresh: MastodonAccount,
    signal: AbortSignal,
    onProgress: (progress: FollowerProgress) => void,
    refresh: boolean,
  ): Promise<void> {
    const run = ++historyRun;
    const session = authSession;
    if (!session) return;
    if (!refresh && restoreHistory(session)) {
      // Re-anchor cached events to the same current count used by the report.
      const delta = fresh.followers_count - (anchored?.current ?? fresh.followers_count);
      if (anchored && delta !== 0) {
        anchored = {
          ...anchored,
          start: anchored.start + delta,
          current: fresh.followers_count,
          points: anchored.points.map((value) => value + delta),
          historyIncomplete: anchored.start + delta < 0,
        };
        historyIncomplete = anchored.historyIncomplete;
        if (historyCache) {
          historyCache.anchored = anchored;
          historyCache.historyIncomplete = historyIncomplete;
        }
      }
      return;
    }
    historyPhase = 'loading';
    historyMessage = '';

    try {
      const currentFollowers = fresh.followers_count;
      const result = await fetchFollowerEvents(
        session.origin,
        session.token,
        signal,
        (progress: FollowerProgress) => {
          if (signal.aborted || run !== historyRun) return;
          eventsCount = progress.events;
          requestsUsed = progress.requests;
          oldestDate = progress.oldest ?? '';
          onProgress(progress);
        },
      );
      if (signal.aborted || run !== historyRun) return;

      eventsCount = result.events.length;
      requestsUsed = result.requests;
      oldestDate = result.events[0]?.date ?? '';
      monthly = buildMonthlySeries(result.events);
      anchored = buildAnchoredSeries(result.events, currentFollowers);
      historyIncomplete = anchored.historyIncomplete;
      historyPhase = result.truncated ? 'partial' : 'ready';
      if (result.events.length === 0) {
        historyMessage = msg('follower.emptyHistory');
      }
      historyCache = {
        createdAt: Date.now(),
        sessionKey: historySessionKey(session),
        phase: historyPhase,
        message: historyMessage,
        monthly,
        anchored,
        eventsCount,
        requestsUsed,
        oldestDate,
        historyIncomplete,
      };
    } catch (error) {
      if (run !== historyRun) return;
      if (signal.aborted) {
        historyPhase = 'idle';
        return;
      }
      if (error instanceof Error && error.message === msg('error.followersExpired')) {
        anonPhase = 'ready';
        anonMessage = error.message;
        oninvalidatesession(error.message);
        return;
      }
      historyPhase = 'error';
      historyMessage = error instanceof Error ? error.message : msg('follower.historyFailed');
    }
  }

  const chartA = { left: 38, right: 348, top: 14, bottom: 148 };
  const chartB = { left: 38, right: 348, top: 14, bottom: 148 };

  const monthlyMax = $derived(Math.max(1, ...monthly.map((point) => point.count)));
  const monthlyTicks = $derived([...new Set([0, Math.round(monthlyMax / 2), monthlyMax])]);
  const monthlyY = $derived(
    monthly.map((point, index) => ({
      x:
        chartA.left +
        (monthly.length === 1
          ? (chartA.right - chartA.left) / 2
          : (index / (monthly.length - 1)) * (chartA.right - chartA.left)),
      y: chartA.bottom - (point.count / monthlyMax) * (chartA.bottom - chartA.top),
    })),
  );
  const monthlyLinePath = $derived(
    monthlyY
      .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' '),
  );
  const monthlyAreaPath = $derived(
    monthlyY.length > 0
      ? `${monthlyLinePath} L${monthlyY[monthlyY.length - 1]!.x.toFixed(1)},${chartA.bottom} L${monthlyY[0]!.x.toFixed(1)},${chartA.bottom} Z`
      : '',
  );
  const monthlyTickY = $derived(
    monthlyTicks.map((tick) => chartA.bottom - (tick / monthlyMax) * (chartA.bottom - chartA.top)),
  );
  const monthlyTickX = $derived(
    months.map(
      (_, index) =>
        chartA.left +
        (months.length === 1
          ? (chartA.right - chartA.left) / 2
          : (index / (months.length - 1)) * (chartA.right - chartA.left)),
    ),
  );

  const anchoredValues = $derived(anchored ? [anchored.start, ...anchored.points] : []);
  const anchoredMin = $derived(anchored ? Math.min(anchored.start, anchored.current) : 0);
  const anchoredMax = $derived(anchored ? Math.max(anchored.start, anchored.current) : 1);
  const anchoredSpan = $derived(Math.max(1, anchoredMax - anchoredMin));
  const anchoredY = $derived(
    anchoredValues.map((value, index) => ({
      x:
        chartB.left +
        (index / Math.max(1, anchoredValues.length - 1)) * (chartB.right - chartB.left),
      y: chartB.bottom - ((value - anchoredMin) / anchoredSpan) * (chartB.bottom - chartB.top),
    })),
  );
  const anchoredLinePath = $derived(
    anchoredY
      .map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
      .join(' '),
  );
  const anchoredTicks = $derived(
    Array.from({ length: 5 }, (_, index) => anchoredMin + (anchoredSpan * index) / 4),
  );
  const anchoredTickY = $derived(
    anchoredTicks.map(
      (tick) =>
        chartB.bottom - ((tick - anchoredMin) / anchoredSpan) * (chartB.bottom - chartB.top),
    ),
  );
  const anchoredAreaPath = $derived(
    anchoredY.length > 1
      ? `${anchoredLinePath} L${anchoredY[anchoredY.length - 1]!.x.toFixed(1)},${chartB.bottom} L${anchoredY[0]!.x.toFixed(1)},${chartB.bottom} Z`
      : '',
  );
  const anchoredTickX = $derived(
    months.map(
      (_, index) =>
        chartB.left + ((index + 1) / Math.max(1, months.length)) * (chartB.right - chartB.left),
    ),
  );

  let hoverMonth = $state<number | null>(null);
  let hoverAnchored = $state<number | null>(null);

  function pointerIndex(
    event: PointerEvent,
    left: number,
    right: number,
    count: number,
  ): number | null {
    if (count === 0) return null;
    const rect = (event.currentTarget as Element).getBoundingClientRect();
    const viewX = ((event.clientX - rect.left) / rect.width) * 360;
    const fraction = Math.min(1, Math.max(0, (viewX - left) / (right - left)));
    return Math.round(fraction * (count - 1));
  }
</script>

<main class="follower-page" class:follower-page-collapsed={heroCollapsed}>
  <section
    class="follower-hero"
    class:follower-hero-collapsed={heroCollapsed}
    aria-labelledby="follower-title"
  >
    <p class="kicker">Federated signal analysis / 02</p>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
    <h1 id="follower-title">{@html $_('follower.titleHtml')}</h1>
    <p>{$_('follower.intro')}</p>
  </section>

  <section class="search-shell follower-shell" aria-labelledby="anon-title">
    <form
      class="search-form"
      onsubmit={(event) => {
        event.preventDefault();
        void loadAccount();
      }}
    >
      <p class="eyebrow" id="anon-title">{$_('follower.stepAnon')}</p>
      <label for="follower-handle">{$_('combobox.handle')}</label>
      <div class="input-row">
        <HandleCombobox
          inputId="follower-handle"
          listboxId="follower-saved-handles-listbox"
          bind:value={handle}
          {savedHandles}
          disabled={anonPhase === 'loading'}
        />
        <button
          type="submit"
          disabled={anonPhase === 'loading' || authPhase === 'connecting' || !handle.trim()}
        >
          {anonPhase === 'loading'
            ? $_('hero.connecting')
            : handleMatchesSession
              ? $_('follower.load')
              : $_('follower.loginButton')}
        </button>
      </div>
    </form>

    {#if anonMessage}
      <p class="follower-error" role="alert">{anonMessage}</p>
    {/if}

    {#if connectedAccount && anonPhase === 'ready' && account}
      <div class="follower-snapshot">
        <div>
          <span>@{account.acct}</span>
          <strong>{$_number(account.followers_count, { format: 'int' })}</strong>
          <small>{$_('follower.followersNote')}</small>
        </div>
        <div>
          <span aria-hidden="true">&nbsp;</span>
          <strong
            >{!platform
              ? $_('follower.detectingSoftware')
              : platform.id === 'unknown'
                ? $_('follower.unknownSoftware')
                : platform.name}</strong
          >
          <small>{$_('follower.serverSoftware')}</small>
        </div>
      </div>
    {:else if authSession && account && anonPhase === 'ready' && !connectedAccount}
      <p class="follower-note" role="status">
        {$_('follower.connectMismatch', { values: { account: account.acct } })}
      </p>
    {/if}
  </section>

  {#if connectedAccount && anonPhase === 'ready' && account && origin && platform}
    <ReportsPanel
      bind:this={reportsPanel}
      {account}
      {origin}
      {platform}
      notificationToken={authSession?.token}
      sessionKey={authSession ? historySessionKey(authSession) : ''}
      loadFollowerHistory={loadHistory}
      onbusy={(value) => (reportBusy = value)}
      followerHistory={authSession &&
      authSession.origin === origin &&
      authSession.account.id === account.id &&
      hasHistory &&
      anchored
        ? {
            monthly,
            anchored,
            partial: historyPhase === 'partial' || historyIncomplete,
          }
        : null}
    />
  {/if}

  {#if connectedAccount && authSession && account && !reportBusy}
    <section class="follower-card" aria-labelledby="history-title">
      <p class="eyebrow">{$_('follower.stepHistory')}</p>
      <h2 id="history-title">@{account.acct}</h2>

      {#if historyPhase === 'error'}
        <p class="follower-error" role="alert">{historyMessage}</p>
        <div class="follower-actions">
          <button type="button" onclick={() => void reportsPanel?.refresh()}
            >{$_('follower.retry')}</button
          >
          <button
            type="button"
            class="logout-button"
            onclick={() =>
              onopenconnection({ account: authSession.account, origin: authSession.origin })}
            >{$_('connection.manage')}</button
          >
        </div>
      {/if}

      {#if hasHistory}
        {#if historyPhase === 'partial'}
          <p class="follower-note" role="status">
            {$_('follower.partial', {
              values: {
                requests: requestsUsed,
                date: oldestDate
                  ? $_date(new Date(oldestDate), { format: 'date' })
                  : $_('follower.unknownDate'),
              },
            })}
          </p>
        {/if}
        {#if historyIncomplete}
          <p class="follower-note" role="status">
            {$_('follower.incompleteNote')}
          </p>
        {/if}

        <div class="follower-charts">
          <figure class="follower-chart">
            <figcaption>{$_('follower.monthlyCaption')}</figcaption>
            <svg
              viewBox="0 0 360 178"
              role="img"
              aria-label={$_('follower.monthlyAria', { values: { max: monthlyMax } })}
              onpointermove={(event) => {
                hoverMonth = pointerIndex(event, chartA.left, chartA.right, monthly.length);
              }}
              onpointerleave={() => (hoverMonth = null)}
            >
              {#each monthlyTicks as tick, index (index)}
                <line
                  class="chart-grid"
                  x1={chartA.left}
                  x2={chartA.right}
                  y1={monthlyTickY[index]}
                  y2={monthlyTickY[index]}
                ></line>
                <text
                  class="chart-axis"
                  x={chartA.left - 8}
                  y={monthlyTickY[index] + 3}
                  text-anchor="end">{$_number(tick, { format: 'int' })}</text
                >
              {/each}
              {#if monthly.length > 0}
                <path class="chart-area" d={monthlyAreaPath}></path>
                <path class="chart-line chart-line-violet" d={monthlyLinePath}></path>
              {/if}
              {#each monthLabels as label, index (index)}
                {#if label}
                  <text class="chart-axis" x={monthlyTickX[index]} y="172" text-anchor="middle"
                    >{label}</text
                  >
                {/if}
              {/each}
              {#if hoverMonth !== null && monthlyY[hoverMonth]}
                {@const point = monthlyY[hoverMonth]}
                {@const tooltipX = Math.min(Math.max(point.x, chartA.left + 62), chartA.right - 62)}
                <line
                  class="chart-crosshair"
                  x1={point.x}
                  x2={point.x}
                  y1={chartA.top}
                  y2={chartA.bottom}
                ></line>
                <circle class="chart-hover-dot" cx={point.x} cy={point.y} r="4"></circle>
                <g class="chart-tooltip">
                  <rect x={tooltipX - 60} y="2" width="120" height="17" rx="4"></rect>
                  <text x={tooltipX} y="14" text-anchor="middle">
                    {$_date(new Date(`${months[hoverMonth]}-01T00:00:00Z`), { format: 'month' })} ·
                    {$_number(monthly[hoverMonth]?.count ?? 0, { format: 'int' })}
                  </text>
                </g>
              {/if}
            </svg>
            <small>{$_('follower.monthlyNote')}</small>
          </figure>

          <figure class="follower-chart">
            <figcaption>{$_('follower.anchoredCaption')}</figcaption>
            <svg
              viewBox="0 0 360 178"
              role="img"
              aria-label={$_('follower.anchoredAria', {
                values: {
                  min: anchoredMin,
                  current: anchored?.current ?? 0,
                },
              })}
              onpointermove={(event) => {
                hoverAnchored = pointerIndex(
                  event,
                  chartB.left,
                  chartB.right,
                  anchoredValues.length,
                );
              }}
              onpointerleave={() => (hoverAnchored = null)}
            >
              {#each anchoredTicks as tick, index (index)}
                <line
                  class="chart-grid"
                  x1={chartB.left}
                  x2={chartB.right}
                  y1={anchoredTickY[index]}
                  y2={anchoredTickY[index]}
                ></line>
                <text
                  class="chart-axis"
                  x={chartB.left - 8}
                  y={anchoredTickY[index] + 3}
                  text-anchor="end">{$_number(Math.round(tick), { format: 'int' })}</text
                >
              {/each}
              {#if anchored}
                <path class="chart-area chart-area-lime" d={anchoredAreaPath}></path>
                <path class="chart-line chart-line-lime" d={anchoredLinePath}></path>
                <circle
                  class="chart-dot"
                  cx={anchoredY[anchoredY.length - 1]?.x}
                  cy={anchoredY[anchoredY.length - 1]?.y}
                  r="4"
                ></circle>
              {/if}
              {#each monthLabels as label, index (index)}
                {#if label}
                  <text class="chart-axis" x={anchoredTickX[index]} y="172" text-anchor="middle"
                    >{label}</text
                  >
                {/if}
              {/each}
              {#if hoverAnchored !== null && anchoredY[hoverAnchored]}
                {@const point = anchoredY[hoverAnchored]}
                {@const tooltipX = Math.min(Math.max(point.x, chartB.left + 66), chartB.right - 66)}
                {@const tooltipLabel =
                  hoverAnchored === 0
                    ? $_('follower.start')
                    : $_date(new Date(`${months[hoverAnchored - 1]}-01T00:00:00Z`), {
                        format: 'month',
                      })}
                <line
                  class="chart-crosshair"
                  x1={point.x}
                  x2={point.x}
                  y1={chartB.top}
                  y2={chartB.bottom}
                ></line>
                <circle class="chart-hover-dot" cx={point.x} cy={point.y} r="4"></circle>
                <g class="chart-tooltip">
                  <rect x={tooltipX - 66} y="2" width="132" height="17" rx="4"></rect>
                  <text x={tooltipX} y="14" text-anchor="middle">
                    {tooltipLabel} · {$_number(Math.round(anchoredValues[hoverAnchored] ?? 0), {
                      format: 'int',
                    })}
                  </text>
                </g>
              {/if}
            </svg>
            <small>
              {$_('follower.anchoredNote', {
                values: {
                  count: $_number(eventsCount, { format: 'int' }),
                  current: $_number(anchored?.current ?? 0, { format: 'int' }),
                },
              })}
            </small>
          </figure>
        </div>

        <div class="follower-actions">
          <button type="button" onclick={() => void reportsPanel?.refresh()}
            >{$_('follower.reload')}</button
          >
          <button
            type="button"
            class="logout-button"
            onclick={() =>
              onopenconnection({ account: authSession.account, origin: authSession.origin })}
            >{$_('connection.manage')}</button
          >
        </div>
      {:else if historyPhase === 'idle'}
        <p class="follower-muted">{$_('follower.idle')}</p>
        <div class="follower-actions">
          <button type="button" onclick={() => void reportsPanel?.refresh()}
            >{$_('follower.reload')}</button
          >
          <button
            type="button"
            class="logout-button"
            onclick={() =>
              onopenconnection({ account: authSession.account, origin: authSession.origin })}
            >{$_('connection.manage')}</button
          >
        </div>
      {/if}
    </section>
  {/if}
</main>
