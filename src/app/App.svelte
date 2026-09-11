<script lang="ts">
  import { onMount } from 'svelte';
  import emblemUrl from '../assets/fediwings-emblem.png';
  import logoUrl from '../assets/fediwings-logo.png';
  import { _, locale } from 'svelte-i18n';
  import { setLocale } from '../lib/i18n';
  import AccountHeader from '../components/AccountHeader.svelte';
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
  import { buildPostingInsights } from '../lib/insights';
  import { detectPlatform } from '../lib/platform';
  import { decodeSharedPost, hasSharedThreadHash } from '../lib/share';
  import { msg } from '../lib/i18n';
  import type {
    AnalysisProgress,
    MastodonAccount,
    MastodonStatus,
    PostReach,
    ServerPlatform,
  } from '../lib/types';

  type Phase = 'idle' | 'resolving' | 'analyzing' | 'complete' | 'partial' | 'cancelled' | 'error';
  type Sort = 'date' | 'reach' | 'likes' | 'boosts';
  type ShareView = 'none' | 'loading' | 'ready' | 'error';
  type View = 'analyse' | 'methodik' | 'follower';

  function readView(): View {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('view');
    if (requested === 'methodik' || requested === 'follower') return requested;
    if (params.get('code') !== null || params.get('error') !== null) return 'follower';
    return 'analyse';
  }

  const view = $state<View>(readView());

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
    const onHashChange = () => void loadShareView();
    void loadShareView();
    window.addEventListener('hashchange', onHashChange);
    return () => {
      shareController?.abort();
      window.removeEventListener('hashchange', onHashChange);
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
    insightHistoryComplete = false;
    insightOldestFetchedAt = null;
    insightReachSelectionComplete = false;
    progress = { completedPosts: 0, totalPosts: 0, requests: 0 };

    try {
      const target = await resolveHandle(handle, controller.signal);
      origin = target.origin;
      const [detectedPlatform, accountResult] = await Promise.all([
        detectPlatform(target.origin, controller.signal),
        getAccount(target.origin, target.acct, controller.signal),
      ]);
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
      message = phase === 'partial' ? msg('notice.partial') : msg('notice.complete');

      try {
        sessionStorage.setItem(
          'fediscope:last-snapshot-v1',
          JSON.stringify({
            handle: `@${target.acct}`,
            acct: target.acct,
            followers: account?.followers_count ?? 0,
            origin: target.origin,
            platformId: platform?.id ?? 'unknown',
            platformName: platform?.name ?? 'ActivityPub-Server',
          }),
        );
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
  <a class="brand" href="./" aria-label={$_('header.home')}>
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
    <img class="brand-logo brand-logo-emblem" src={emblemUrl} alt="" width="58" height="28" />
  </a>
  <nav class="view-tabs" aria-label="Hauptnavigation">
    <a href="./" aria-current={view === 'analyse' ? 'page' : undefined}
      >{$_('header.navAnalysis')}</a
    >
    <a href="./?view=follower" aria-current={view === 'follower' ? 'page' : undefined}
      >{$_('header.navFollower')}</a
    >
    <a href="./?view=methodik" aria-current={view === 'methodik' ? 'page' : undefined}
      >{$_('header.navMethodology')}</a
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
    <div class="header-meta">
      <span></span>
      {$_(
        view === 'methodik'
          ? 'header.metaMethodology'
          : view === 'follower'
            ? 'header.metaFollower'
            : 'header.metaLive',
      )}
    </div>
  </div>
</header>

{#if view === 'methodik'}
  <MethodologyPage />
{:else if view === 'follower' && shareView === 'none'}
  <FollowerPage
    prefillHandle={handle}
    {savedHandles}
    snapshot={account ? { account, platform, origin } : null}
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
        <p class="kicker">Federated signal analysis / 01</p>
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
              <PostCard result={post} {maxNetReach} {index} />
            {/each}
          </div>
        {/if}
      </section>
    {/if}
  </main>
{/if}

<footer>
  <span>{$_('results.footerMvp')}</span>
  <a
    href="https://docs.joinmastodon.org/methods/statuses/#reblogged_by"
    target="_blank"
    rel="noreferrer"
  >
    {$_('results.footerApiRef')}
  </a>
</footer>
