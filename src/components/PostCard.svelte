<script lang="ts">
  import DOMPurify from 'dompurify';
  import { onDestroy } from 'svelte';
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import ShareDialog from './ShareDialog.svelte';
  import { cardServiceAvailable, createSharedThreadUrl } from '../lib/share';
  import { msg } from '../lib/i18n';
  import type { MastodonAccount, PostReach } from '../lib/types';

  let {
    result,
    maxNetReach,
    index,
    account,
    analyzedAt,
  }: {
    result: PostReach;
    maxNetReach: number;
    index: number;
    account: MastodonAccount;
    analyzedAt: string;
  } = $props();
  let expanded = $state(false);
  let shareDialogOpen = $state(false);
  let shareFeedback = $state('');
  let shareResetTimer: number | undefined;

  const formattedDate = $derived(
    $_date(new Date(result.status.created_at), { format: 'standard' }),
  );

  function sanitizeContent(content: string): string {
    return DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['p', 'br', 'span', 'a', 'strong', 'em'],
      ALLOWED_ATTR: ['href', 'class', 'rel', 'target'],
    });
  }

  const safeContent = $derived(sanitizeContent(result.status.content));
  const quoteLabel = $derived(
    /^re:/i.test(result.status.content.replace(/<[^>]+>/g, '').trimStart())
      ? $_('post.quote')
      : null,
  );
  const additionalThreadEntries = $derived(
    result.threadStatuses
      .map((status, position) => ({
        status,
        position,
        safeContent: sanitizeContent(status.content),
      }))
      .filter((entry) => entry.status.id !== result.status.id),
  );
  function relativeReach(value: number): number {
    return maxNetReach > 0 && value > 0
      ? Math.max(1, Math.min(100, Math.round((value / maxNetReach) * 100)))
      : 0;
  }

  const netReachRatio = $derived(relativeReach(result.netReach));

  const threadLabel = $derived(
    result.threadSize > 1
      ? $_(result.threadTruncated ? 'post.threadTruncated' : 'post.thread', {
          values: { count: result.threadSize },
        })
      : null,
  );
  const detailsLabel = $derived(
    expanded
      ? result.threadSize > 1
        ? $_('post.threadCollapse')
        : $_('post.collapse')
      : result.threadSize > 1
        ? $_('post.threadExpand')
        : $_('post.expand'),
  );

  async function copyShareUrl(url: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return;
      } catch {
        // Fall through for browsers that expose the API but deny clipboard access.
      }
    }
    const textarea = document.createElement('textarea');
    textarea.value = url;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error(msg('post.copyFailed'));
  }

  function showShareFeedback(message: string): void {
    shareFeedback = message;
    if (shareResetTimer) window.clearTimeout(shareResetTimer);
    shareResetTimer = window.setTimeout(() => {
      shareFeedback = '';
    }, 3000);
  }

  async function shareThread(): Promise<void> {
    if (cardServiceAvailable()) {
      shareDialogOpen = true;
      return;
    }
    try {
      const url = createSharedThreadUrl(result.status.url, window.location.href);
      if (navigator.share) {
        await navigator.share({ title: msg('post.shareTitle'), text: msg('post.shareText'), url });
        showShareFeedback(msg('post.shared'));
      } else {
        await copyShareUrl(url);
        showShareFeedback(msg('post.copied'));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      showShareFeedback(error instanceof Error ? error.message : msg('post.shareFailed'));
    }
  }

  onDestroy(() => {
    if (shareResetTimer) window.clearTimeout(shareResetTimer);
  });
</script>

<article class:post-card-loading={result.state === 'loading'} class="post-card">
  <div class="post-card-summary">
    <div class="post-visual">
      {#if result.thumbnail}
        <div class="post-thumb">
          <img
            src={result.thumbnail.preview_url ?? result.thumbnail.url}
            alt={result.thumbnail.description ?? ''}
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </div>
      {:else}
        <div class="post-thumb post-thumb-empty" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" focusable="false">
            <rect x="4" y="5" width="16" height="14" rx="1"></rect>
            <circle cx="9" cy="10" r="1.5"></circle>
            <path d="m5 17 4.5-4 3 2.7 2.2-2 4.3 3.8"></path>
            <path class="preview-slash" d="M3 3 21 21"></path>
          </svg>
        </div>
      {/if}
      <span class="post-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
    </div>

    <div class="post-main">
      <div class="post-meta">
        {#if result.status.url}
          <a
            class="post-date-link"
            href={result.status.url}
            target="_blank"
            rel="noreferrer"
            aria-label={$_('post.openAt', { values: { date: formattedDate } })}
          >
            <time datetime={result.status.created_at}>{formattedDate}</time>
          </a>
        {:else}
          <time datetime={result.status.created_at}>{formattedDate}</time>
        {/if}
        {#if threadLabel}
          <span class="thread-badge">{threadLabel}</span>
        {/if}
        {#if quoteLabel}
          <span class="quote-badge">{quoteLabel}</span>
        {/if}
        {#if result.state !== 'complete'}
          <span class="state-pill state-{result.state}">{$_(`post.state.${result.state}`)}</span>
        {/if}
      </div>

      {#if result.status.spoiler_text}
        <p class="content-warning">CW: {result.status.spoiler_text}</p>
      {/if}
      <div class="post-content" class:post-content-preview={!expanded}>
        {#if result.status.content}
          <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML wird vorab via DOMPurify mit enger Allowlist bereinigt -->
          {@html safeContent}
        {:else}
          <span class="post-empty">{$_('post.noContent')}</span>
        {/if}
      </div>

      {#if expanded && result.status.media_attachments.length > 0}
        <div class="post-media-grid" aria-label={$_('post.mediaOfFirst')}>
          {#each result.status.media_attachments as attachment, attachmentIndex (`${attachment.url}-${attachmentIndex}`)}
            <a
              class="post-media-item"
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              aria-label={$_('post.openMedia', {
                values: { label: attachment.description ?? attachment.type },
              })}
            >
              {#if attachment.preview_url || attachment.type.startsWith('image')}
                <img
                  src={attachment.preview_url ?? attachment.url}
                  alt={attachment.description ?? ''}
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
              {:else}
                <span>{attachment.type}</span>
              {/if}
            </a>
          {/each}
        </div>
      {/if}

      {#if result.error}
        <p class="post-warning">{result.error}</p>
      {/if}
    </div>

    <dl class="post-metrics">
      <div class="reach-metric reach-metric-net">
        <dt class="reach-label">
          <span>{$_('post.netReach')}</span>
          {#if maxNetReach > 0}
            <small class="reach-level-max" aria-hidden="true"
              >{$_('post.maxLabel', {
                values: { value: $_number(maxNetReach, { format: 'int' }) },
              })}</small
            >
          {/if}
        </dt>
        <dd class="metric-primary-value">{$_number(result.netReach, { format: 'int' })}</dd>
        <dd
          class="reach-level"
          class:reach-level-empty={netReachRatio === 0}
          style={`--reach-level: ${netReachRatio}%`}
        >
          <div
            class="reach-level-track"
            role="progressbar"
            aria-label={$_('post.progressbar')}
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={netReachRatio}
            aria-valuetext={$_('post.progressValue', { values: { percent: netReachRatio } })}
          >
            <span class="reach-level-fill" class:reach-level-fill-complete={netReachRatio === 100}
            ></span>
          </div>
        </dd>
      </div>
      <div class="metric-secondary metric-likes">
        <dt>{$_('post.likes')}</dt>
        <dd>{$_number(result.likes, { format: 'int' })}</dd>
      </div>
      <div class="metric-secondary metric-boosts">
        <dt>{$_('post.boosts')}</dt>
        <dd>{$_number(result.boosts, { format: 'int' })}</dd>
      </div>
      <div class="metric-secondary metric-gross">
        <dt title={$_('post.grossTitle')}>{$_('post.gross')}</dt>
        <dd>{$_number(result.grossReach, { format: 'int' })}</dd>
      </div>
    </dl>
  </div>

  <div class="post-details-bar">
    <details class="post-details" bind:open={expanded}>
      <summary aria-label={detailsLabel}>
        <svg class="details-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m5 9 7 7 7-7"></path>
        </svg>
      </summary>

      {#if additionalThreadEntries.length > 0}
        <div class="thread-detail-body">
          <p class="thread-detail-heading">{$_('post.moreInThread')}</p>
          <ol class="thread-posts">
            {#each additionalThreadEntries as entry (entry.status.id)}
              <li>
                <span class="thread-step" aria-hidden="true"
                  >{String(entry.position + 1).padStart(2, '0')}</span
                >
                <div class="thread-entry">
                  <div class="thread-entry-meta">
                    {#if entry.status.url}
                      <a
                        class="post-date-link"
                        href={entry.status.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={$_('post.openThreadAt', {
                          values: { index: entry.position + 1 },
                        })}
                      >
                        <time datetime={entry.status.created_at}
                          >{$_date(new Date(entry.status.created_at), { format: 'standard' })}</time
                        >
                      </a>
                    {:else}
                      <time datetime={entry.status.created_at}
                        >{$_date(new Date(entry.status.created_at), { format: 'standard' })}</time
                      >
                    {/if}
                  </div>
                  {#if entry.status.spoiler_text}
                    <p class="content-warning">CW: {entry.status.spoiler_text}</p>
                  {/if}
                  <div class="thread-entry-content">
                    {#if entry.status.content}
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML wird vorab via DOMPurify mit enger Allowlist bereinigt -->
                      {@html entry.safeContent}
                    {:else}
                      <span class="post-empty">Kein Textinhalt</span>
                    {/if}
                  </div>

                  {#if entry.status.media_attachments.length > 0}
                    <div
                      class="post-media-grid"
                      aria-label={`Medien von Thread-Beitrag ${entry.position + 1}`}
                    >
                      {#each entry.status.media_attachments as attachment, attachmentIndex (`${attachment.url}-${attachmentIndex}`)}
                        <a
                          class="post-media-item"
                          href={attachment.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${attachment.description ?? attachment.type} öffnen`}
                        >
                          {#if attachment.preview_url || attachment.type.startsWith('image')}
                            <img
                              src={attachment.preview_url ?? attachment.url}
                              alt={attachment.description ?? ''}
                              loading="lazy"
                              referrerpolicy="no-referrer"
                            />
                          {:else}
                            <span>{attachment.type}</span>
                          {/if}
                        </a>
                      {/each}
                    </div>
                  {/if}
                </div>
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    </details>
    <div class="post-details-actions">
      <button
        type="button"
        class="post-details-action"
        aria-label={$_('post.share')}
        title={$_('post.share')}
        disabled={!result.status.url || (result.state !== 'complete' && result.state !== 'partial')}
        onclick={shareThread}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="18" cy="5" r="3"></circle>
          <circle cx="6" cy="12" r="3"></circle>
          <circle cx="18" cy="19" r="3"></circle>
          <path d="m8.6 10.5 6.8-4"></path>
          <path d="m8.6 13.5 6.8 4"></path>
        </svg>
      </button>
      <span class="share-feedback" role="status" aria-live="polite">{shareFeedback}</span>
    </div>
  </div>
  <ShareDialog
    open={shareDialogOpen}
    {result}
    {account}
    {analyzedAt}
    onclose={() => (shareDialogOpen = false)}
  />
</article>
