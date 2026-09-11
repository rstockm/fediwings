<script lang="ts">
  import DOMPurify from 'dompurify';
  import { _, date as _date, number as _number } from 'svelte-i18n';
  import type { PostReach } from '../lib/types';

  let { result, analyzedAt }: { result: PostReach; analyzedAt: string } = $props();

  const analysisDate = $derived($_date(new Date(analyzedAt), { format: 'standard' }));
  const entries = $derived(
    result.threadStatuses.map((status, index) => ({
      status,
      index,
      safeContent: DOMPurify.sanitize(status.content, {
        ALLOWED_TAGS: ['p', 'br', 'span', 'a', 'strong', 'em'],
        ALLOWED_ATTR: ['href', 'class', 'rel', 'target'],
      }),
    })),
  );
</script>

<main class="shared-page">
  <section class="shared-intro" aria-labelledby="shared-title">
    <div>
      <p class="kicker">Geteilte Analyse / 01</p>
      <h1 id="shared-title">
        <span class="shared-title-light">
          {result.threadStatuses.length === 1 ? $_('shared.titlePost') : $_('shared.titleThread')}
        </span><br />
        <em>{$_('shared.titleSuffix')}</em>
      </h1>
      <p>{$_('shared.intro')}</p>
    </div>
    <a class="shared-home-link" href="./">
      {$_('shared.homeLink')}
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12h14"></path>
        <path d="m13 6 6 6-6 6"></path>
      </svg>
    </a>
  </section>

  <section class="shared-layout" aria-label="Geteilte Thread-Analyse">
    <aside class="shared-stats-panel" aria-labelledby="shared-stats-title">
      <div class="shared-reach-stat">
        <p id="shared-stats-title">{$_('shared.statsTitle')}</p>
        <strong>{$_number(result.netReach, { format: 'int' })}</strong>
        <small>{$_('shared.statsNote')}</small>
      </div>

      <dl class="shared-stat-grid">
        <div>
          <dt>{$_('shared.likes')}</dt>
          <dd>{$_number(result.likes, { format: 'int' })}</dd>
        </div>
        <div>
          <dt>{$_('shared.boosts')}</dt>
          <dd>{$_number(result.boosts, { format: 'int' })}</dd>
        </div>
        <div>
          <dt>{$_('shared.postings')}</dt>
          <dd>{$_number(result.threadStatuses.length, { format: 'int' })}</dd>
        </div>
      </dl>

      <div class="shared-stat-breakdown">
        <p>{$_('shared.basis')}</p>
        <dl>
          <div>
            <dt>{$_('shared.gross')}</dt>
            <dd>{$_number(result.grossReach, { format: 'int' })}</dd>
          </div>
          <div>
            <dt>{$_('shared.authorFollowers')}</dt>
            <dd>{$_number(result.authorFollowers, { format: 'int' })}</dd>
          </div>
          <div>
            <dt>{$_('shared.boosterFollowers')}</dt>
            <dd>{$_number(result.boosterFollowers, { format: 'int' })}</dd>
          </div>
          <div>
            <dt>{$_('shared.publicBoosters')}</dt>
            <dd>{$_number(result.visibleBoosters, { format: 'int' })}</dd>
          </div>
        </dl>
      </div>

      {#if result.state !== 'complete' || result.threadTruncated}
        <div class="shared-data-note">
          <strong>{$_('shared.partial')}</strong>
          <p>
            {result.error ?? $_('shared.partialText')}
          </p>
        </div>
      {/if}

      <p class="shared-method-note">{$_('shared.methodNote')}</p>
    </aside>

    <article class="shared-thread-panel" aria-labelledby="shared-thread-title">
      <header class="shared-thread-header">
        <div>
          <p class="eyebrow">{$_('shared.contentEyebrow')}</p>
          <h2 id="shared-thread-title">
            {result.threadStatuses.length === 1
              ? $_('shared.postHeading')
              : $_('shared.threadHeading', { values: { count: result.threadStatuses.length } })}
          </h2>
        </div>
        <small>{$_('shared.analyzedAt', { values: { date: analysisDate } })}</small>
      </header>

      <ol class="shared-thread-list">
        {#each entries as entry (entry.status.id)}
          <li>
            <div class="shared-thread-rail" aria-hidden="true">
              <span>{String(entry.index + 1).padStart(2, '0')}</span>
            </div>
            <article class="shared-thread-entry">
              <header>
                <time datetime={entry.status.created_at}
                  >{$_date(new Date(entry.status.created_at), { format: 'standard' })}</time
                >
                {#if entry.status.url}
                  <a href={entry.status.url} target="_blank" rel="noreferrer">
                    {$_('shared.openOriginal')}
                    <span aria-hidden="true">↗</span>
                  </a>
                {/if}
              </header>

              {#if entry.status.spoiler_text}
                <p class="content-warning">CW: {entry.status.spoiler_text}</p>
              {/if}

              <div class="shared-thread-content">
                {#if entry.status.content}
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- HTML wird vorab via DOMPurify mit enger Allowlist bereinigt -->
                  {@html entry.safeContent}
                {:else}
                  <span class="post-empty">{$_('post.noContent')}</span>
                {/if}
              </div>

              {#if entry.status.media_attachments.length > 0}
                <div
                  class="shared-media-grid"
                  aria-label={$_('shared.mediaOfPosting', { values: { index: entry.index + 1 } })}
                >
                  {#each entry.status.media_attachments as attachment, attachmentIndex (`${attachment.url}-${attachmentIndex}`)}
                    <a
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
            </article>
          </li>
        {/each}
      </ol>
    </article>
  </section>
</main>
