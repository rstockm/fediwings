<script lang="ts">
  import { _ } from 'svelte-i18n';
  import {
    CardServiceError,
    createCardShare,
    createCardSnapshot,
    createSharedThreadUrl,
  } from '../lib/share';
  import type { CardServiceResponse, MastodonAccount, PostReach } from '../lib/types';

  let {
    open,
    result,
    account,
    analyzedAt,
    onclose,
  }: {
    open: boolean;
    result: PostReach;
    account: MastodonAccount;
    analyzedAt: string;
    onclose: () => void;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let phase = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
  let card = $state<CardServiceResponse | null>(null);
  let error = $state('');
  let feedback = $state('');
  let idempotencyKey = $state('');

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      idempotencyKey = crypto.randomUUID();
      void createCard();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function close(): void {
    onclose();
  }

  function errorMessage(cause: unknown): string {
    if (!(cause instanceof CardServiceError)) return $_('shareDialog.failed');
    if (cause.code === 'rateLimited') return $_('shareDialog.rateLimited');
    if (cause.code === 'rejected') return $_('shareDialog.rejected');
    if (cause.code === 'unavailable') return $_('shareDialog.unavailable');
    return $_('shareDialog.failed');
  }

  async function createCard(): Promise<void> {
    phase = 'loading';
    card = null;
    error = '';
    feedback = '';
    try {
      card = await createCardShare(createCardSnapshot(result, account, analyzedAt), idempotencyKey);
      phase = 'ready';
    } catch (cause) {
      error = errorMessage(cause);
      phase = 'error';
    }
  }

  function legacyUrl(): string {
    return createSharedThreadUrl(result.status.url, window.location.href);
  }

  async function copy(url: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        return;
      } catch {
        // Continue with the legacy clipboard fallback when permission is denied.
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
    if (!copied) throw new Error('copy-failed');
  }

  async function share(url: string): Promise<void> {
    try {
      if (navigator.share) {
        await navigator.share({ title: $_('post.shareTitle'), text: $_('post.shareText'), url });
        feedback = $_('shareDialog.shared');
      } else {
        await copy(url);
        feedback = $_('shareDialog.copied');
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      feedback = $_('post.shareFailed');
    }
  }

  async function copyWithFeedback(url: string): Promise<void> {
    try {
      await copy(url);
      feedback = $_('shareDialog.copied');
    } catch {
      feedback = $_('post.copyFailed');
    }
  }
</script>

<dialog
  class="share-dialog"
  bind:this={dialog}
  aria-labelledby="share-dialog-title"
  onclose={close}
>
  <div class="share-dialog-panel">
    <header>
      <div>
        <p class="kicker">FediWings / Share</p>
        <h2 id="share-dialog-title">{$_('shareDialog.title')}</h2>
      </div>
      <button
        type="button"
        class="share-dialog-close"
        aria-label={$_('shareDialog.close')}
        onclick={close}
      >
        <span aria-hidden="true">×</span>
      </button>
    </header>

    {#if phase === 'loading'}
      <div class="share-dialog-state" role="status" aria-live="polite">
        <span class="share-dialog-spinner" aria-hidden="true"></span>
        <p>{$_('shareDialog.creating')}</p>
      </div>
    {:else if phase === 'ready' && card}
      <div class="share-dialog-ready">
        <img src={card.imageUrl} alt={$_('shareDialog.cardAlt')} referrerpolicy="no-referrer" />
        <p role="status">{$_('shareDialog.ready')}</p>
        <div class="share-dialog-actions">
          <button type="button" class="share-dialog-primary" onclick={() => void share(card!.url)}>
            {$_('shareDialog.share')}
          </button>
          <button type="button" onclick={() => void copyWithFeedback(card!.url)}>
            {$_('shareDialog.copy')}
          </button>
        </div>
      </div>
    {:else if phase === 'error'}
      <div class="share-dialog-state" role="status" aria-live="polite">
        <p>{error}</p>
        <p class="share-dialog-fallback">{$_('shareDialog.fallback')}</p>
        <div class="share-dialog-actions">
          <button
            type="button"
            class="share-dialog-primary"
            onclick={() => void share(legacyUrl())}
          >
            {$_('shareDialog.shareDirect')}
          </button>
          <button type="button" onclick={() => void copyWithFeedback(legacyUrl())}>
            {$_('shareDialog.copyDirect')}
          </button>
          <button type="button" onclick={() => void createCard()}>{$_('shareDialog.retry')}</button>
        </div>
      </div>
    {/if}

    <p class="share-dialog-feedback" role="status" aria-live="polite">{feedback}</p>
  </div>
</dialog>
