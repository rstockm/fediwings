<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import HandleCombobox from './HandleCombobox.svelte';
  import { getAccount, MastodonApiError } from '../lib/api';
  import {
    buildAnchoredSeries,
    buildMonthlySeries,
    DEFAULT_MAX_PAGES,
    fetchFollowerEvents,
    type AnchoredSeries,
    type FollowerProgress,
    type MonthlyPoint,
  } from '../lib/followers';
  import { resolveHandle } from '../lib/handle';
  import type { SavedHandle } from '../lib/history';
  import {
    buildAuthorizeUrl,
    clearFollowerSession,
    clearHandshake,
    createPkcePair,
    exchangeCode,
    loadFollowerSession,
    loadHandshake,
    OAuthError,
    parseCallback,
    randomState,
    registerApp,
    revokeToken,
    saveFollowerSession,
    saveHandshake,
    verifyCredentials,
    type FollowerSession,
    type OAuthClient,
    type OAuthHandshake,
  } from '../lib/oauth';
  import { detectPlatform } from '../lib/platform';
  import { readLastAccount, writeLastAccount } from '../lib/lastAccount';
  import type { MastodonAccount, ServerPlatform } from '../lib/types';
  import { msg } from '../lib/i18n';

  let {
    prefillHandle = '',
    savedHandles = [],
    snapshot = null,
  }: {
    prefillHandle?: string;
    savedHandles?: SavedHandle[];
    snapshot?: {
      account: MastodonAccount;
      platform: ServerPlatform | null;
      origin: string;
    } | null;
  } = $props();

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
  type AuthPhase = 'idle' | 'connecting' | 'connected' | 'error';
  type HistoryPhase = 'idle' | 'loading' | 'ready' | 'partial' | 'error';

  let handle = $state('');
  let anonPhase = $state<AnonPhase>('idle');
  let anonMessage = $state('');
  let account = $state<MastodonAccount | null>(null);
  let platform = $state<ServerPlatform | null>(null);
  let origin = $state('');

  let authPhase = $state<AuthPhase>('idle');
  let authMessage = $state('');
  let authSession = $state<FollowerSession | null>(null);

  let historyPhase = $state<HistoryPhase>('idle');
  let historyMessage = $state('');
  let monthly = $state<MonthlyPoint[]>([]);
  let anchored = $state<AnchoredSeries | null>(null);
  let eventsCount = $state(0);
  let requestsUsed = $state(0);
  let oldestDate = $state('');
  let historyIncomplete = $state(false);
  let historyController: AbortController | null = null;
  let loginController: AbortController | null = null;
  let pendingLogin: { origin: string; client: OAuthClient; token: string } | null = null;
  let destroyed = false;

  const hasHistory = $derived(historyPhase === 'ready' || historyPhase === 'partial');
  const heroCollapsed = $derived(anonPhase === 'loading' || account !== null);
  const progressPercent = $derived(
    Math.min(100, Math.round((requestsUsed / DEFAULT_MAX_PAGES) * 100)),
  );
  const months = $derived(monthly.map((point) => point.month));
  const monthLabels = $derived.by(() => {
    const every = Math.max(1, Math.ceil(months.length / 6));
    return months.map((month, index) =>
      index % every === 0 || index === months.length - 1
        ? $_date(new Date(`${month}-01T00:00:00Z`), { format: 'month' })
        : '',
    );
  });

  function cleanCallbackUrl(): void {
    window.history.replaceState(null, '', './?view=follower');
  }

  function followerViewActive(): boolean {
    return new URLSearchParams(window.location.search).get('view') === 'follower';
  }

  function canonicalAcct(candidate: MastodonAccount, sessionOrigin: string): string {
    return candidate.acct.includes('@')
      ? candidate.acct
      : `${candidate.acct}@${new URL(sessionOrigin).hostname}`;
  }

  function applyFollowerSession(session: FollowerSession): void {
    authSession = session;
    origin = session.origin;
    handle = `@${canonicalAcct(session.account, session.origin)}`;
    account = session.account;
    anonPhase = 'ready';
    authPhase = 'connected';
  }

  function cancelPendingLogin(): void {
    loginController?.abort();
    const pending = pendingLogin;
    pendingLogin = null;
    if (pending)
      void revokeToken(pending.origin, pending.client, pending.token).catch(() => undefined);
  }

  onMount(() => {
    const followerSession = loadFollowerSession();
    if (followerSession) {
      applyFollowerSession(followerSession);
    } else {
      const stored = readLastAccount();
      if (stored?.source === 'follower') {
        applyStoredAccount(stored);
      } else if (snapshot) {
        handle = prefillHandle || `@${snapshot.account.acct}`;
        account = snapshot.account;
        platform = snapshot.platform;
        origin = snapshot.origin;
        anonPhase = 'ready';
      } else if (stored) {
        applyStoredAccount(stored);
      } else if (prefillHandle) {
        handle = prefillHandle;
      }
    }

    const callback = parseCallback(window.location);
    if (!callback) return;
    cleanCallbackUrl();
    const handshake = loadHandshake();
    clearHandshake();
    if ('invalid' in callback) {
      if (authSession) {
        anonMessage = msg('follower.loginInvalid');
      } else {
        authPhase = 'error';
        authMessage = msg('follower.loginInvalid');
      }
      return;
    }
    if ('error' in callback) {
      if (!handshake || !callback.state || handshake.state !== callback.state) {
        if (authSession) {
          anonMessage = msg('follower.loginInvalid');
        } else {
          authPhase = 'error';
          authMessage = msg('follower.loginInvalid');
        }
        return;
      }
      authPhase = 'error';
      authMessage =
        callback.error === 'access_denied'
          ? msg('follower.accessDenied')
          : msg('follower.loginRejected', { error: callback.error });
      return;
    }

    if (!handshake || handshake.state !== callback.state) {
      authPhase = 'error';
      authMessage = msg('follower.loginInvalid');
      return;
    }

    void completeLogin(handshake, callback.code);
  });

  async function completeLogin(handshake: OAuthHandshake, code: string): Promise<void> {
    authPhase = 'connecting';
    origin = handshake.origin;
    const client = { clientId: handshake.clientId, clientSecret: handshake.clientSecret };
    loginController?.abort();
    loginController = new AbortController();
    const signal = loginController.signal;
    let issuedToken = '';
    let revocationFailed = false;
    try {
      issuedToken = await exchangeCode(handshake.origin, client, code, handshake.verifier, signal);
      pendingLogin = { origin: handshake.origin, client, token: issuedToken };
      const verifiedAccount = await verifyCredentials(handshake.origin, issuedToken, signal);
      if (destroyed || signal.aborted || !followerViewActive()) {
        throw new DOMException('Abgebrochen', 'AbortError');
      }
      if (verifiedAccount.id !== handshake.accountId) {
        throw new OAuthError(msg('follower.accountMismatch', { account: verifiedAccount.acct }));
      }

      const session: FollowerSession = {
        token: issuedToken,
        origin: handshake.origin,
        clientId: handshake.clientId,
        clientSecret: handshake.clientSecret,
        account: verifiedAccount,
        savedAt: new Date().toISOString(),
      };
      saveFollowerSession(session);
      pendingLogin = null;
      applyFollowerSession(session);

      const acct = canonicalAcct(verifiedAccount, handshake.origin);
      const previous = readLastAccount();
      const sameAccount = previous?.acct === acct;
      writeLastAccount({
        handle: `@${acct}`,
        acct,
        origin: handshake.origin,
        followers: verifiedAccount.followers_count,
        platformId: sameAccount ? (previous?.platformId ?? 'unknown') : 'unknown',
        platformName: sameAccount
          ? (previous?.platformName ?? 'ActivityPub-Server')
          : 'ActivityPub-Server',
        source: 'follower',
      });
      await loadHistory();
    } catch (error) {
      const pending = pendingLogin;
      pendingLogin = null;
      if (pending) {
        try {
          await revokeToken(pending.origin, pending.client, pending.token);
        } catch {
          revocationFailed = true;
        }
      }
      clearFollowerSession();
      authSession = null;
      if (destroyed) return;
      authPhase = 'error';
      const message =
        error instanceof OAuthError || error instanceof Error
          ? error.message
          : msg('follower.loginFailed');
      authMessage = revocationFailed ? `${message} ${msg('follower.revokeFailed')}` : message;
    }
  }

  async function loadAnonymous(): Promise<void> {
    if (authSession) return;
    anonPhase = 'loading';
    anonMessage = '';
    account = null;
    platform = null;
    try {
      const target = await resolveHandle(handle);
      origin = target.origin;
      const [accountResult, platformResult] = await Promise.all([
        getAccount(target.origin, target.acct),
        detectPlatform(target.origin),
      ]);
      account = accountResult;
      platform = platformResult;
      writeLastAccount({
        handle: `@${accountResult.acct.includes('@') ? accountResult.acct : `${accountResult.acct}@${new URL(target.origin).hostname}`}`,
        acct: accountResult.acct.includes('@')
          ? accountResult.acct
          : `${accountResult.acct}@${new URL(target.origin).hostname}`,
        origin: target.origin,
        followers: accountResult.followers_count,
        platformId: platformResult?.id ?? 'unknown',
        platformName: platformResult?.name ?? 'ActivityPub-Server',
        source: 'follower',
      });
      anonPhase = 'ready';
    } catch (error) {
      anonPhase = 'error';
      anonMessage =
        error instanceof MastodonApiError || error instanceof Error
          ? error.message
          : msg('follower.accountFailed');
    }
  }

  async function startLogin(): Promise<void> {
    if (!account || authSession) return;
    authPhase = 'connecting';
    authMessage = '';
    loginController?.abort();
    loginController = new AbortController();
    const signal = loginController.signal;
    try {
      const selectedAccount = account.id
        ? account
        : await getAccount(origin, canonicalAcct(account, origin));
      account = selectedAccount;
      const client = await registerApp(origin, signal);
      if (destroyed || signal.aborted) return;
      const { verifier, challenge } = await createPkcePair();
      const state = randomState();
      saveHandshake({
        origin,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        verifier,
        state,
        accountId: selectedAccount.id,
        acct: canonicalAcct(selectedAccount, origin),
      });
      window.location.assign(buildAuthorizeUrl(origin, client.clientId, challenge, state));
    } catch (error) {
      if (
        destroyed ||
        (error instanceof DOMException && error.name === 'AbortError' && signal.aborted)
      )
        return;
      authPhase = 'error';
      authMessage =
        error instanceof OAuthError || error instanceof Error
          ? error.message
          : msg('follower.loginStartFailed');
    }
  }

  async function loadHistory(): Promise<void> {
    const session = authSession;
    if (!session) return;
    historyController?.abort();
    historyController = new AbortController();
    const signal = historyController.signal;
    historyPhase = 'loading';
    historyMessage = '';

    try {
      const currentFollowers = session.account.followers_count;
      const result = await fetchFollowerEvents(
        session.origin,
        session.token,
        signal,
        (progress: FollowerProgress) => {
          eventsCount = progress.events;
          requestsUsed = progress.requests;
          oldestDate = progress.oldest ?? '';
        },
      );
      if (signal.aborted) return;

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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof Error && error.message === msg('error.followersExpired')) {
        clearFollowerSession();
        authSession = null;
        authPhase = 'idle';
        anonPhase = 'ready';
        anonMessage = error.message;
        return;
      }
      historyPhase = 'error';
      historyMessage = error instanceof Error ? error.message : msg('follower.historyFailed');
    }
  }

  function stopHistory(): void {
    historyController?.abort();
  }

  onDestroy(() => {
    destroyed = true;
    cancelPendingLogin();
    historyController?.abort();
  });

  async function logout(): Promise<void> {
    const session = authSession;
    historyController?.abort();
    clearFollowerSession();
    authSession = null;
    authPhase = 'idle';
    authMessage = '';
    historyPhase = 'idle';
    historyMessage = '';
    monthly = [];
    anchored = null;
    eventsCount = 0;
    requestsUsed = 0;
    oldestDate = '';
    historyIncomplete = false;
    if (!session) return;
    try {
      await revokeToken(
        session.origin,
        { clientId: session.clientId, clientSecret: session.clientSecret },
        session.token,
      );
    } catch {
      anonMessage = msg('follower.revokeFailed');
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
        void loadAnonymous();
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
          disabled={anonPhase === 'loading' || authSession !== null}
        />
        <button
          type="submit"
          disabled={anonPhase === 'loading' || authSession !== null || handle.trim().length === 0}
        >
          {anonPhase === 'loading' ? $_('follower.loading') : $_('follower.load')}
        </button>
      </div>
    </form>

    {#if anonMessage}
      <p class="follower-error" role="alert">{anonMessage}</p>
    {/if}

    {#if anonPhase === 'ready' && account}
      <div class="follower-snapshot">
        <div>
          <span>@{account.acct}</span>
          <strong>{$_number(account.followers_count, { format: 'int' })}</strong>
          <small>{$_('follower.followersNote')}</small>
        </div>
        <div>
          <span aria-hidden="true">&nbsp;</span>
          <strong>{platform?.name ?? 'ActivityPub'}</strong>
          <small>{$_('follower.serverSoftware')}</small>
        </div>
        {#if authSession === null}
          <button type="button" class="login-button" onclick={() => void startLogin()}>
            {authPhase === 'connecting' ? $_('hero.connecting') : $_('follower.loginButton')}
          </button>
        {/if}
      </div>
    {/if}
  </section>

  {#if authPhase === 'error'}
    <p class="follower-error" role="alert">{authMessage}</p>
  {/if}

  {#if authPhase === 'connecting'}
    <section class="follower-card" aria-busy="true">
      <p class="eyebrow">{$_('follower.stepLogin')}</p>
      <h2>{$_('follower.redirecting')}</h2>
      <p class="follower-muted">{$_('follower.authorizeNote')}</p>
    </section>
  {/if}

  {#if authPhase === 'connected' && account}
    <section class="follower-card" aria-labelledby="history-title">
      <p class="eyebrow">{$_('follower.stepHistory')}</p>
      <h2 id="history-title">@{account.acct}</h2>

      {#if historyPhase === 'loading'}
        <div class="follower-progress-block" role="status" aria-live="polite">
          <div class="follower-progress-head">
            <strong>{$_('follower.progressLabel')}</strong>
            <span
              >{$_('follower.progressPages', {
                values: { requests: requestsUsed, budget: DEFAULT_MAX_PAGES },
              })}</span
            >
          </div>
          <div
            class="follower-progress-track"
            class:track-pending={requestsUsed === 0}
            role="progressbar"
            aria-label={$_('follower.progressLabel')}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={requestsUsed === 0 ? null : progressPercent}
          >
            <span
              class:track-complete={progressPercent === 100}
              style:width={`${requestsUsed === 0 ? 30 : progressPercent}%`}
            ></span>
          </div>
          <p class="follower-progress">
            {$_('follower.progressEvents', { values: { events: eventsCount } })}
            {#if oldestDate}
              · {$_('follower.progressOldest', {
                values: { date: $_date(new Date(oldestDate), { format: 'date' }) },
              })}
            {/if}
          </p>
        </div>
        <div class="follower-actions">
          <button type="button" onclick={stopHistory}>{$_('follower.cancel')}</button>
        </div>
      {/if}

      {#if historyPhase === 'error'}
        <p class="follower-error" role="alert">{historyMessage}</p>
        <div class="follower-actions">
          <button type="button" onclick={() => void loadHistory()}>{$_('follower.retry')}</button>
          <button type="button" class="logout-button" onclick={() => void logout()}
            >{$_('follower.signOut')}</button
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
          <button type="button" onclick={() => void loadHistory()}>{$_('follower.reload')}</button>
          <button type="button" class="logout-button" onclick={() => void logout()}
            >{$_('follower.signOut')}</button
          >
        </div>
      {:else if historyPhase === 'idle'}
        <p class="follower-muted">{$_('follower.idle')}</p>
        <div class="follower-actions">
          <button type="button" onclick={() => void loadHistory()}>{$_('follower.reload')}</button>
          <button type="button" class="logout-button" onclick={() => void logout()}
            >{$_('follower.signOut')}</button
          >
        </div>
      {/if}
    </section>
  {/if}
</main>
