<script lang="ts">
  import { onMount, tick } from 'svelte';
  import emblemUrl from '../assets/fediwings-emblem.png';
  import logoUrl from '../assets/fediwings-logo.png';
  import { _, locale } from 'svelte-i18n';
  import { setLocale } from '../lib/i18n';
  import AccountHeader from '../components/AccountHeader.svelte';
  import ConnectionPanel, { type ConnectionCandidate } from '../components/ConnectionPanel.svelte';
  import FollowerPage from '../components/FollowerPage.svelte';
  import HandleCombobox from '../components/HandleCombobox.svelte';
  import MethodologyPage from '../components/MethodologyPage.svelte';
  import PostCard from '../components/PostCard.svelte';
  import PostingInsights from '../components/PostingInsights.svelte';
  import SharedThreadPage from '../components/SharedThreadPage.svelte';
  import {
    getAccount,
    getPixelfedStatuses,
    getStatus,
    getStatusContext,
    getStatuses,
  } from '../lib/api';
  import { analyzePosts, preparePosts, prepareSharedPost } from '../lib/analysis';
  import { resolveHandle } from '../lib/handle';
  import { loadSavedHandles, saveHandleToHistory, type SavedHandle } from '../lib/history';
  import { readLastAccount, writeLastAccount } from '../lib/lastAccount';
  import { buildPostingInsights } from '../lib/insights';
  import { detectPlatform } from '../lib/platform';
  import { decodeSharedPost, hasSharedThreadHash } from '../lib/share';
  import { msg } from '../lib/i18n';
  import {
    buildAuthorizeUrl,
    canonicalAcct,
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
    type OAuthClient,
    type OAuthHandshake,
    type OAuthSession,
  } from '../lib/oauth';
  import {
    clearOAuthReturn,
    consumeOAuthReturn,
    saveOAuthReturn,
    type OAuthReturnAnalysis,
  } from '../lib/oauthReturn';
  import {
    AuthenticatedNotificationError,
    ReblogNotificationCache,
  } from '../lib/reblogNotifications';
  import type {
    AnalysisProgress,
    BoostHistoryState,
    MastodonAccount,
    MastodonStatus,
    PostReach,
    ServerPlatform,
  } from '../lib/types';

  type Phase = 'idle' | 'resolving' | 'analyzing' | 'complete' | 'partial' | 'cancelled' | 'error';
  type Sort = 'date' | 'reach' | 'likes' | 'boosts';
  type ShareView = 'none' | 'loading' | 'ready' | 'error';
  type View = 'analyse' | 'methodik' | 'follower';
  type AuthPhase = 'idle' | 'connecting' | 'connected' | 'error';

  function readView(): View {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('view');
    if (requested === 'methodik' || requested === 'follower') return requested;
    if (params.get('code') !== null || params.get('error') !== null) {
      return loadHandshake()?.returnView ?? 'follower';
    }
    return 'analyse';
  }

  let view = $state<View>(readView());

  let handle = $state('');
  let postLimit = $state(80);
  let rememberHandles = $state(false);
  let savedHandles = $state<SavedHandle[]>(loadSavedHandles());
  let phase = $state<Phase>('idle');
  let message = $state('');
  let origin = $state('');
  let account = $state<MastodonAccount | null>(null);
  let platform = $state<ServerPlatform | null>(null);
  let posts = $state<PostReach[]>([]);
  let insightStatuses = $state<MastodonStatus[]>([]);
  let insightReferenceTime = $state(Date.now());
  let analyzedAt = $state('');
  let insightHistoryComplete = $state(false);
  let insightOldestFetchedAt = $state<string | null>(null);
  let insightReachSelectionComplete = $state(false);
  let progress = $state<AnalysisProgress>({ completedPosts: 0, totalPosts: 0, requests: 0 });
  let sort = $state<Sort>('date');
  let controller = $state<AbortController | null>(null);
  let shareView = $state<ShareView>(hasSharedThreadHash(window.location.hash) ? 'loading' : 'none');
  let sharedThread = $state<PostReach | null>(null);
  let sharedAnalyzedAt = $state('');
  let sharedProgress = $state(msg('shareView.loading'));
  let sharedThreadError = $state('');
  let shareController: AbortController | null = null;
  let shareLoadId = 0;
  let authSession = $state<OAuthSession | null>(null);
  let authPhase = $state<AuthPhase>('idle');
  let authMessage = $state('');
  let connectionOpen = $state(false);
  let connectionCandidate = $state<ConnectionCandidate | null>(null);
  let expandedStatusIds = $state<string[]>([]);
  let loginController: AbortController | null = null;
  let pendingLogin: { origin: string; client: OAuthClient; token: string } | null = null;
  let reblogCache: ReblogNotificationCache | null = null;
  let reblogCacheKey = '';
  let boostHistories = $state<Record<string, BoostHistoryState>>({});
  let boostController: AbortController | null = null;

  $effect(() => {
    if (view !== 'analyse') return;
    const last = readLastAccount();
    if (last?.source === 'follower') handle = last.handle;
  });

  function navigate(next: View): void {
    window.history.pushState(null, '', next === 'analyse' ? './' : `./?view=${next}`);
    view = next;
  }

  function navClick(event: MouseEvent, next: View): void {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    navigate(next);
  }

  function currentConnectionCandidate(): ConnectionCandidate | null {
    return account && origin ? { account, origin } : null;
  }

  function openConnection(
    candidate: ConnectionCandidate | null = currentConnectionCandidate(),
  ): void {
    connectionCandidate = candidate;
    authMessage = '';
    connectionOpen = true;
  }

  function closeConnection(): void {
    if (authPhase === 'connecting') return;
    connectionOpen = false;
  }

  function buildReturnAnalysis(): OAuthReturnAnalysis | null {
    if (
      !account ||
      !origin ||
      (phase !== 'complete' && phase !== 'partial' && phase !== 'cancelled')
    ) {
      return null;
    }
    return {
      handle,
      postLimit,
      rememberHandles,
      phase,
      message,
      origin,
      account,
      platform,
      posts,
      insightStatuses,
      insightReferenceTime,
      analyzedAt,
      insightHistoryComplete,
      insightOldestFetchedAt,
      insightReachSelectionComplete,
      progress,
      sort,
      expandedStatusIds,
      scrollY: Math.max(0, window.scrollY),
    };
  }

  async function startConnection(candidate: ConnectionCandidate): Promise<void> {
    if (busy || authSession) return;
    authPhase = 'connecting';
    authMessage = '';
    loginController?.abort();
    loginController = new AbortController();
    const signal = loginController.signal;
    try {
      const selectedAccount = candidate.account.id
        ? candidate.account
        : await getAccount(
            candidate.origin,
            canonicalAcct(candidate.account, candidate.origin),
            signal,
          );
      const { verifier, challenge } = await createPkcePair();
      const state = randomState();
      saveOAuthReturn({
        version: 1,
        state,
        savedAt: new Date().toISOString(),
        view: view === 'follower' ? 'follower' : 'analyse',
        analysis: buildReturnAnalysis(),
      });
      const client = await registerApp(candidate.origin, signal);
      saveHandshake({
        origin: candidate.origin,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        verifier,
        state,
        accountId: selectedAccount.id,
        acct: canonicalAcct(selectedAccount, candidate.origin),
        returnView: view === 'follower' ? 'follower' : 'analyse',
      });
      window.location.assign(
        buildAuthorizeUrl(candidate.origin, client.clientId, challenge, state),
      );
    } catch (error) {
      clearOAuthReturn();
      clearHandshake();
      if (error instanceof DOMException && error.name === 'AbortError') return;
      authPhase = 'error';
      authMessage =
        error instanceof Error && error.message === 'oauth-return-storage'
          ? msg('connection.storageError')
          : error instanceof Error
            ? error.message
            : msg('follower.loginStartFailed');
    }
  }

  function restoreReturnAnalysis(snapshot: OAuthReturnAnalysis | null): void {
    if (!snapshot) return;
    handle = snapshot.handle;
    postLimit = snapshot.postLimit;
    rememberHandles = snapshot.rememberHandles;
    phase = snapshot.phase;
    message = snapshot.message;
    origin = snapshot.origin;
    account = snapshot.account;
    platform = snapshot.platform;
    posts = snapshot.posts;
    insightStatuses = snapshot.insightStatuses;
    insightReferenceTime = snapshot.insightReferenceTime;
    analyzedAt = snapshot.analyzedAt;
    insightHistoryComplete = snapshot.insightHistoryComplete;
    insightOldestFetchedAt = snapshot.insightOldestFetchedAt;
    insightReachSelectionComplete = snapshot.insightReachSelectionComplete;
    progress = snapshot.progress;
    sort = snapshot.sort;
    expandedStatusIds = snapshot.expandedStatusIds;
    void tick().then(() => window.scrollTo({ top: snapshot.scrollY }));
  }

  function cleanCallbackUrl(target: 'analyse' | 'follower'): void {
    window.history.replaceState(null, '', target === 'follower' ? './?view=follower' : './');
    view = target;
  }

  async function completeLogin(handshake: OAuthHandshake, code: string): Promise<void> {
    authPhase = 'connecting';
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
      if (verifiedAccount.id !== handshake.accountId) {
        throw new OAuthError(
          msg('follower.accountMismatch', {
            account: canonicalAcct(verifiedAccount, handshake.origin),
          }),
        );
      }
      const session: OAuthSession = {
        token: issuedToken,
        origin: handshake.origin,
        clientId: handshake.clientId,
        clientSecret: handshake.clientSecret,
        account: verifiedAccount,
        savedAt: new Date().toISOString(),
      };
      saveFollowerSession(session);
      pendingLogin = null;
      authSession = session;
      authPhase = 'connected';
      authMessage = '';
      connectionOpen = false;
      for (const post of posts) {
        if (expandedStatusIds.includes(post.status.id)) void loadBoostHistory(post);
      }

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
      authPhase = 'error';
      const detail = error instanceof Error ? error.message : msg('follower.loginFailed');
      authMessage = revocationFailed ? `${detail} ${msg('follower.revokeFailed')}` : detail;
      connectionOpen = true;
    }
  }

  async function disconnect(): Promise<void> {
    const session = authSession;
    clearFollowerSession();
    authSession = null;
    authPhase = 'idle';
    authMessage = '';
    if (!session) return;
    try {
      await revokeToken(
        session.origin,
        { clientId: session.clientId, clientSecret: session.clientSecret },
        session.token,
      );
    } catch {
      authMessage = msg('follower.revokeFailed');
      authPhase = 'error';
    }
  }

  function invalidateSession(message: string): void {
    clearFollowerSession();
    authSession = null;
    authPhase = 'idle';
    authMessage = message;
  }

  const busy = $derived(phase === 'resolving' || phase === 'analyzing');
  const heroCollapsed = $derived(busy || posts.length > 0);
  const progressPercent = $derived(
    progress.totalPosts > 0 ? Math.round((progress.completedPosts / progress.totalPosts) * 100) : 0,
  );
  const sortedPosts = $derived.by(() => {
    const copy = [...posts];
    if (sort === 'reach') return copy.sort((a, b) => b.netReach - a.netReach);
    if (sort === 'likes') return copy.sort((a, b) => b.likes - a.likes);
    if (sort === 'boosts') return copy.sort((a, b) => b.boosts - a.boosts);
    return copy.sort(
      (a, b) => new Date(b.status.created_at).getTime() - new Date(a.status.created_at).getTime(),
    );
  });
  const maxNetReach = $derived(Math.max(0, ...posts.map((post) => post.netReach)));
  const postingInsights = $derived(
    buildPostingInsights(
      insightStatuses,
      new Date(insightReferenceTime),
      {
        historyComplete: insightHistoryComplete,
        oldestFetchedAt: insightOldestFetchedAt,
        reachSelectionComplete: insightReachSelectionComplete,
      },
      posts.map((post) => ({
        id: post.status.id,
        createdAt: post.status.created_at,
        value: post.netReach,
      })),
    ),
  );

  $effect(() => {
    const nextKey = authSession
      ? `${authSession.origin}|${authSession.account.id}|${authSession.token}`
      : '';
    if (nextKey === reblogCacheKey) return;
    boostController?.abort();
    reblogCache = null;
    reblogCacheKey = nextKey;
    boostHistories = {};
  });

  function canLoadBoostHistory(post: PostReach): boolean {
    return Boolean(
      authSession &&
      account &&
      post.boosts > 0 &&
      authSession.origin === origin &&
      authSession.account.id === account.id,
    );
  }

  function emptyBoostHistory(): BoostHistoryState {
    return { phase: 'idle', events: [], pages: 0, canLoadMore: false, budgetReached: false };
  }

  function boostHistoryFor(post: PostReach): BoostHistoryState | null {
    if (!canLoadBoostHistory(post)) return null;
    return boostHistories[post.status.id] ?? emptyBoostHistory();
  }

  function refreshBoostHistories(): void {
    const cache = reblogCache;
    if (!cache) return;
    const next = { ...boostHistories };
    for (const post of posts) {
      if (!(post.status.id in next)) continue;
      const ids = post.threadStatuses.map((status) => status.id);
      const publishedAt = post.threadStatuses.reduce(
        (oldest, status) =>
          Date.parse(status.created_at) < Date.parse(oldest) ? status.created_at : oldest,
        post.threadStatuses[0]?.created_at ?? post.status.created_at,
      );
      const covered = cache.covers(publishedAt);
      next[post.status.id] = {
        phase: covered ? 'ready' : 'partial',
        events: cache.eventsFor(ids),
        pages: cache.requests,
        canLoadMore: !covered && !cache.exhausted && !cache.budgetReached,
        budgetReached: cache.budgetReached,
      };
    }
    boostHistories = next;
  }

  async function loadBoostHistory(post: PostReach): Promise<void> {
    const session = authSession;
    if (!session || !canLoadBoostHistory(post)) return;
    const sessionKey = `${session.origin}|${session.account.id}|${session.token}`;
    if (sessionKey !== reblogCacheKey) {
      boostController?.abort();
      reblogCache = null;
      reblogCacheKey = sessionKey;
      boostHistories = {};
    }
    if (!reblogCache) reblogCache = new ReblogNotificationCache(session.origin, session.token);
    const current = boostHistories[post.status.id];
    if (current?.phase === 'loading' || current?.phase === 'ready') return;

    boostHistories = {
      ...boostHistories,
      [post.status.id]: {
        ...(current ?? emptyBoostHistory()),
        phase: 'loading',
      },
    };
    boostController?.abort();
    boostController = new AbortController();
    try {
      await reblogCache.loadNext(boostController.signal);
      refreshBoostHistories();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (error instanceof AuthenticatedNotificationError && error.status === 401) {
        invalidateSession(msg('error.followersExpired'));
      }
      boostHistories = {
        ...boostHistories,
        [post.status.id]: {
          phase: 'error',
          events: current?.events ?? [],
          pages: current?.pages ?? 0,
          canLoadMore: false,
          budgetReached: false,
          error:
            error instanceof AuthenticatedNotificationError && error.status === 403
              ? msg('boostHistory.unavailable')
              : msg('error.followersInvalidResponse'),
        },
      };
    }
  }

  function setPostExpanded(post: PostReach, open: boolean): void {
    expandedStatusIds = open
      ? [...new Set([...expandedStatusIds, post.status.id])]
      : expandedStatusIds.filter((id) => id !== post.status.id);
    if (open) void loadBoostHistory(post);
  }

  async function loadShareView(): Promise<void> {
    shareController?.abort();
    const hash = window.location.hash;
    if (!hasSharedThreadHash(hash)) {
      shareLoadId += 1;
      shareView = 'none';
      sharedThread = null;
      sharedAnalyzedAt = '';
      sharedThreadError = '';
      return;
    }

    const currentLoadId = ++shareLoadId;
    const currentController = new AbortController();
    shareController = currentController;
    shareView = 'loading';
    sharedThread = null;
    sharedAnalyzedAt = '';
    sharedProgress = msg('shareView.loading');
    sharedThreadError = '';

    try {
      const target = decodeSharedPost(hash);
      const [status, context] = await Promise.all([
        getStatus(target.origin, target.statusId, currentController.signal),
        getStatusContext(target.origin, target.statusId, currentController.signal),
      ]);
      const initial = prepareSharedPost(status, context);
      sharedProgress = msg('shareView.analyzingBoosters');
      const [result] = await analyzePosts(target.origin, [initial], currentController.signal, {
        onPost: () => {},
        onProgress: (next) => {
          if (next.requests > 0) {
            sharedProgress = msg('shareView.requests', { count: next.requests });
          }
        },
      });
      if (currentLoadId !== shareLoadId) return;
      sharedThread = result;
      sharedAnalyzedAt = new Date().toISOString();
      shareView = 'ready';
    } catch (error) {
      if (currentLoadId !== shareLoadId) return;
      if (error instanceof DOMException && error.name === 'AbortError') return;
      sharedThreadError = error instanceof Error ? error.message : msg('shareView.genericError');
      shareView = 'error';
    }
  }

  onMount(() => {
    const storedSession = loadFollowerSession();
    if (storedSession) {
      authSession = storedSession;
      authPhase = 'connected';
    }

    const callback = parseCallback(window.location);
    if (callback) {
      const handshake = loadHandshake();
      const callbackState = 'invalid' in callback ? null : callback.state;
      const restored =
        handshake && callbackState && handshake.state === callbackState
          ? consumeOAuthReturn(handshake.state)
          : null;
      clearHandshake();
      if (restored) restoreReturnAnalysis(restored.analysis);
      const returnView = restored?.view ?? handshake?.returnView ?? 'follower';
      cleanCallbackUrl(returnView);

      if (
        'invalid' in callback ||
        !handshake ||
        !callbackState ||
        handshake.state !== callbackState
      ) {
        clearOAuthReturn();
        authPhase = 'error';
        authMessage = msg('follower.loginInvalid');
        connectionOpen = true;
      } else if ('error' in callback) {
        authPhase = 'error';
        authMessage =
          callback.error === 'access_denied'
            ? msg('follower.accessDenied')
            : msg('follower.loginRejected', { error: callback.error });
        connectionOpen = true;
      } else {
        void completeLogin(handshake, callback.code);
      }
    }

    const onHashChange = () => void loadShareView();
    const onPopState = () => {
      view = readView();
    };
    void loadShareView();
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onPopState);
    return () => {
      shareController?.abort();
      loginController?.abort();
      const pending = pendingLogin;
      pendingLogin = null;
      if (pending)
        void revokeToken(pending.origin, pending.client, pending.token).catch(() => undefined);
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onPopState);
    };
  });

  async function startAnalysis() {
    controller?.abort();
    controller = new AbortController();
    phase = 'resolving';
    message = '';
    account = null;
    platform = null;
    posts = [];
    insightStatuses = [];
    insightReferenceTime = Date.now();
    analyzedAt = '';
    insightHistoryComplete = false;
    insightOldestFetchedAt = null;
    insightReachSelectionComplete = false;
    progress = { completedPosts: 0, totalPosts: 0, requests: 0 };
    boostController?.abort();
    reblogCache = null;
    boostHistories = {};
    expandedStatusIds = [];

    try {
      const target = await resolveHandle(handle, controller.signal);
      origin = target.origin;
      const detectedPlatform = await detectPlatform(target.origin, controller.signal);
      const accountResult = await getAccount(
        target.origin,
        target.acct,
        controller.signal,
        detectedPlatform.id,
      );
      platform = detectedPlatform;
      account = accountResult;
      const pixelfed = platform?.id === 'pixelfed';
      const { statuses, requests, historyComplete, oldestFetchedAt } = pixelfed
        ? await getPixelfedStatuses(target.origin, account.id, controller.signal)
        : await getStatuses(target.origin, account.id, controller.signal);

      insightStatuses = statuses;
      insightHistoryComplete = historyComplete;
      insightOldestFetchedAt = oldestFetchedAt;
      const preparedPosts = preparePosts(statuses, account.followers_count, account.id);
      insightReachSelectionComplete = preparedPosts.length <= postLimit;
      posts = preparedPosts.slice(0, postLimit);
      progress = {
        completedPosts: posts.filter((post) => post.state === 'complete').length,
        totalPosts: posts.length,
        requests: requests + 2,
      };

      if (posts.length === 0) {
        phase = 'complete';
        message = msg('notice.noPosts');
        return;
      }

      phase = 'analyzing';
      posts = await analyzePosts(
        target.origin,
        posts,
        controller.signal,
        {
          onPost: (index, result) => {
            posts = posts.map((post, current) => (current === index ? result : post));
          },
          onProgress: (next) => {
            progress = { ...next, requests: next.requests + 2 };
          },
        },
        { boosterLists: !pixelfed },
      );

      if (rememberHandles) {
        savedHandles = saveHandleToHistory(target.acct);
      }

      phase = posts.some((post) => post.state === 'partial' || post.state === 'error')
        ? 'partial'
        : 'complete';
      analyzedAt = new Date().toISOString();
      message = phase === 'partial' ? msg('notice.partial') : msg('notice.complete');

      try {
        writeLastAccount({
          handle: `@${target.acct}`,
          acct: target.acct,
          followers: account?.followers_count ?? 0,
          origin: target.origin,
          platformId: platform?.id ?? 'unknown',
          platformName: platform?.name ?? 'ActivityPub-Server',
          source: 'analyse',
        });
      } catch {
        // Sitzungsspeicher nicht verfügbar: Übergabe an den Follower-Tab entfällt.
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        phase = 'cancelled';
        message = msg('notice.cancelled');
      } else {
        phase = 'error';
        message = error instanceof Error ? error.message : msg('notice.genericError');
      }
    }
  }

  function stopAnalysis() {
    controller?.abort();
  }
</script>

<svelte:head>
  <title
    >{$_(
      view === 'methodik'
        ? 'title.methodology'
        : view === 'follower'
          ? 'title.follower'
          : shareView === 'none'
            ? 'title.analyse'
            : 'title.share',
    )}</title
  >
</svelte:head>

<header class="site-header">
  <a
    class="brand"
    href="./"
    aria-label={$_('header.home')}
    onclick={(event) => navClick(event, 'analyse')}
  >
    <span class="brand-logo-lockup" aria-hidden="true">
      <img
        class="brand-logo brand-logo-lockup-part brand-logo-lockup-mark"
        src={logoUrl}
        alt=""
        width="160"
        height="30"
      />
      <img
        class="brand-logo brand-logo-lockup-part brand-logo-lockup-word"
        src={logoUrl}
        alt=""
        width="160"
        height="30"
      />
    </span>
  </a>
  <a
    class="brand-mobile-emblem"
    href="./"
    aria-label={$_('header.home')}
    onclick={(event) => navClick(event, 'analyse')}
  >
    <img class="brand-logo" src={emblemUrl} alt="" width="58" height="28" />
  </a>
  <nav class="view-tabs" aria-label="Hauptnavigation">
    <a
      href="./"
      aria-current={view === 'analyse' ? 'page' : undefined}
      onclick={(event) => navClick(event, 'analyse')}>{$_('header.navAnalysis')}</a
    >
    <a
      href="./?view=follower"
      aria-current={view === 'follower' ? 'page' : undefined}
      onclick={(event) => navClick(event, 'follower')}>{$_('header.navFollower')}</a
    >
    <a
      href="./?view=methodik"
      aria-current={view === 'methodik' ? 'page' : undefined}
      onclick={(event) => navClick(event, 'methodik')}>{$_('header.navMethodology')}</a
    >
  </nav>
  <div class="header-right">
    <div class="header-lang" role="group" aria-label={$_('header.language')}>
      <button type="button" aria-pressed={$locale === 'de'} onclick={() => setLocale('de')}
        >DE</button
      >
      <button type="button" aria-pressed={$locale === 'en'} onclick={() => setLocale('en')}
        >EN</button
      >
    </div>
    {#if (view === 'analyse' || view === 'follower') && shareView === 'none'}
      <button
        type="button"
        class="connection-trigger"
        class:connection-trigger-active={authSession !== null}
        aria-expanded={connectionOpen}
        aria-controls="instance-connection-panel"
        title={busy
          ? $_('connection.triggerDisabled')
          : authSession
            ? $_('connection.triggerConnected', {
                values: { account: authSession.account.username },
              })
            : $_('connection.trigger')}
        disabled={busy}
        onclick={() => openConnection()}
      >
        <span aria-hidden="true"></span>
        {authSession
          ? $_('connection.triggerConnected', { values: { account: authSession.account.username } })
          : $_('connection.trigger')}
      </button>
    {:else}
      <div class="header-meta">
        <span></span>
        {$_(view === 'methodik' ? 'header.metaMethodology' : 'header.metaLive')}
      </div>
    {/if}
  </div>
</header>

<div id="instance-connection-panel">
  <ConnectionPanel
    open={connectionOpen}
    phase={authPhase}
    message={authMessage}
    session={authSession}
    candidate={connectionCandidate ?? currentConnectionCandidate()}
    {savedHandles}
    onclose={closeConnection}
    onconnect={startConnection}
    ondisconnect={disconnect}
  />
</div>

{#if view === 'methodik'}
  <MethodologyPage />
{:else if view === 'follower' && shareView === 'none'}
  <FollowerPage
    prefillHandle={handle}
    {savedHandles}
    snapshot={account ? { account, platform, origin } : null}
    {authSession}
    {authPhase}
    onopenconnection={openConnection}
    oninvalidatesession={invalidateSession}
  />
{:else if shareView === 'ready' && sharedThread}
  <SharedThreadPage result={sharedThread} analyzedAt={sharedAnalyzedAt} />
{:else if shareView === 'loading'}
  <main class="share-state-page" aria-live="polite">
    <p class="kicker">{$_('shareView.kicker')}</p>
    <h1>{$_('shareView.loadingTitle')}</h1>
    <p>{sharedProgress}</p>
  </main>
{:else if shareView === 'error'}
  <main class="share-state-page">
    <p class="kicker">{$_('shareView.errorKicker')}</p>
    <h1>{$_('shareView.errorTitle')}</h1>
    <p>{sharedThreadError}</p>
    <a href="./">{$_('shareView.backHome')}</a>
  </main>
{:else}
  <main>
    <section class="hero" class:hero-collapsed={heroCollapsed} aria-labelledby="page-title">
      <div class="hero-copy">
        <img class="hero-emblem" src={emblemUrl} alt="" aria-hidden="true" />
        <p class="kicker">von Ralf Stockmann</p>
        <!-- eslint-disable-next-line svelte/no-at-html-tags -- statischer, eigener Dictionary-Text ohne Nutzerinhalte -->
        <h1 id="page-title">{@html $_('hero.title')}</h1>
        <p class="intro">{$_('hero.intro')}</p>
      </div>

      <div class="search-shell">
        <div class="signal-orbit" aria-hidden="true">
          <span></span><span></span><span></span><b></b>
        </div>
        <form
          class="search-form"
          onsubmit={(event) => {
            event.preventDefault();
            startAnalysis();
          }}
        >
          <label for="handle">{$_('hero.handle')}</label>
          <div class="input-row">
            <HandleCombobox
              inputId="handle"
              listboxId="saved-handles-listbox"
              bind:value={handle}
              {savedHandles}
              disabled={busy}
            />
            <button type="submit" disabled={busy || !handle.trim()}>
              {phase === 'resolving' ? $_('hero.connecting') : $_('hero.analyze')}
            </button>
          </div>

          {#if phase === 'resolving'}
            <button type="button" class="abort-button" onclick={stopAnalysis}>
              {$_('hero.abortConnection')}
            </button>
          {/if}

          <div class="options-row">
            <label>
              <span>{$_('hero.threads')}</span>
              <select bind:value={postLimit} disabled={busy}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={40}>40</option>
                <option value={80}>80</option>
              </select>
            </label>
            <label class="check-label">
              <input type="checkbox" bind:checked={rememberHandles} disabled={busy} />
              <span>{$_('hero.remember')}</span>
            </label>
          </div>
        </form>
      </div>
    </section>

    {#if message}
      <div class:error-banner={phase === 'error'} class="notice" role="status" aria-live="polite">
        <span>{phase === 'error' ? '!' : 'i'}</span>
        <p>{message}</p>
      </div>
    {/if}

    {#if account}
      <section class="results" aria-label={$_('results.region')}>
        <AccountHeader {account} {origin} {platform} />

        <div class="analysis-bar">
          <div>
            <p class="eyebrow">{$_('results.progressLabel')}</p>
            <strong
              >{$_('results.progressThreads', {
                values: {
                  done: progress.completedPosts,
                  total: progress.totalPosts,
                },
              })}</strong
            >
          </div>
          <div
            class="progress-track"
            role="progressbar"
            aria-label="Analysefortschritt"
            aria-valuenow={progressPercent}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span
              class:progress-complete={progressPercent === 100}
              style:width={`${progressPercent}%`}
            ></span>
          </div>
          <div class="request-counter">
            <span>{progress.requests}</span>
            <small>{$_('results.apiRequests')}</small>
          </div>
          {#if busy}
            <button class="stop-button" type="button" onclick={stopAnalysis}
              >{$_('hero.stop')}</button
            >
          {/if}
        </div>

        {#if posts.length > 0}
          <PostingInsights insights={postingInsights} />

          <div class="result-heading">
            <div>
              <p class="kicker">{$_('results.breakdown')}</p>
              <h2>{$_('results.individualThreads')}</h2>
            </div>
            <label class="sort-control">
              {$_('results.sortBy')}
              <select bind:value={sort}>
                <option value="date">{$_('results.sortDate')}</option>
                <option value="reach">{$_('results.sortReach')}</option>
                <option value="likes">{$_('results.sortLikes')}</option>
                <option value="boosts">{$_('results.sortBoosts')}</option>
              </select>
            </label>
          </div>

          <div class="post-list">
            {#each sortedPosts as post, index (post.status.id)}
              <PostCard
                result={post}
                {maxNetReach}
                {index}
                {account}
                {analyzedAt}
                expanded={expandedStatusIds.includes(post.status.id)}
                boostHistory={boostHistoryFor(post)}
                onexpandedchange={(open) => setPostExpanded(post, open)}
                onloadolderboosts={() => void loadBoostHistory(post)}
              />
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </main>
{/if}

<footer>
  <a
    class="footer-github"
    href="https://github.com/rstockm/fediwings"
    target="_blank"
    rel="noreferrer"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 4.419 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-1.025-.013-1.86-2.782.604-3.369-1.18-3.369-1.18-.455-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.004.07 1.532 1.03 1.532 1.03.892 1.529 2.341 1.087 2.91.831.091-.646.349-1.087.635-1.337-2.221-.253-4.556-1.111-4.556-4.944 0-1.092.39-1.985 1.029-2.685-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.026A9.564 9.564 0 0 1 12 6.756c.85.004 1.706.115 2.504.337 1.909-1.295 2.748-1.026 2.748-1.026.546 1.377.203 2.394.1 2.647.64.7 1.028 1.593 1.028 2.685 0 3.842-2.339 4.688-4.566 4.936.359.31.679.92.679 1.855 0 1.34-.012 2.418-.012 2.747 0 .267.18.578.688.48A10.001 10.001 0 0 0 22 12c0-5.523-4.477-10-10-10Z"
      ></path>
    </svg>
    GitHub
  </a>
  <a class="footer-fedisuite" href="https://www.fedisuite.com/" target="_blank" rel="noreferrer">
    <span class="footer-fedisuite-long">{$_('results.footerFedisuite')}</span>
    <span class="footer-fedisuite-short">{$_('results.footerFedisuiteShort')}</span>
  </a>
  <a
    href="https://docs.joinmastodon.org/methods/statuses/#reblogged_by"
    target="_blank"
    rel="noreferrer"
  >
    {$_('results.footerApiRef')}
  </a>
</footer>
