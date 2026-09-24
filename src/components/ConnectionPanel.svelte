<script lang="ts">
  import { tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import HandleCombobox from './HandleCombobox.svelte';
  import { getAccount } from '../lib/api';
  import { resolveHandle } from '../lib/handle';
  import { detectPlatform } from '../lib/platform';
  import type { SavedHandle } from '../lib/history';
  import { canonicalAcct, type OAuthSession } from '../lib/oauth';
  import type { MastodonAccount } from '../lib/types';

  export interface ConnectionCandidate {
    account: MastodonAccount;
    origin: string;
  }

  let {
    open,
    phase,
    message = '',
    session = null,
    candidate = null,
    savedHandles = [],
    onclose,
    onconnect,
    ondisconnect,
  }: {
    open: boolean;
    phase: 'idle' | 'connecting' | 'connected' | 'error';
    message?: string;
    session?: OAuthSession | null;
    candidate?: ConnectionCandidate | null;
    savedHandles?: SavedHandle[];
    onclose: () => void;
    onconnect: (candidate: ConnectionCandidate) => Promise<void>;
    ondisconnect: () => Promise<void>;
  } = $props();

  let panel = $state<HTMLElement>();
  let handle = $state('');
  let selected = $state<ConnectionCandidate | null>(null);
  let resolving = $state(false);
  let resolveError = $state('');
  let wasOpen = false;

  $effect(() => {
    if (open && !wasOpen) {
      selected = candidate;
      handle = candidate ? `@${canonicalAcct(candidate.account, candidate.origin)}` : '';
      resolveError = '';
      void tick().then(() => panel?.focus());
    }
    wasOpen = open;
  });

  async function resolveCandidate(): Promise<void> {
    resolving = true;
    resolveError = '';
    try {
      const target = await resolveHandle(handle);
      const platform = await detectPlatform(target.origin);
      const account = await getAccount(target.origin, target.acct, undefined, platform.id);
      selected = { account, origin: target.origin };
      handle = `@${canonicalAcct(account, target.origin)}`;
    } catch (error) {
      resolveError = error instanceof Error ? error.message : String(error);
    } finally {
      resolving = false;
    }
  }

  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && phase !== 'connecting') onclose();
  }
</script>

{#if open}
  <div
    class="connection-backdrop"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget && phase !== 'connecting') onclose();
    }}
  >
    <div
      class="connection-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="connection-title"
      tabindex="-1"
      bind:this={panel}
      onkeydown={keydown}
    >
      <button
        class="connection-close"
        type="button"
        aria-label={$_('connection.close')}
        disabled={phase === 'connecting'}
        onclick={onclose}>×</button
      >

      <p class="eyebrow">FediWings · OAuth</p>
      <h2 id="connection-title">{$_('connection.title')}</h2>

      {#if session}
        <div class="connection-account">
          <img src={session.account.avatar_static} alt="" width="52" height="52" />
          <div>
            <small>{$_('connection.connected')}</small>
            <strong>@{canonicalAcct(session.account, session.origin)}</strong>
            <span>{new URL(session.origin).hostname} · {$_('connection.tabOnly')}</span>
          </div>
        </div>
        {#if candidate && (candidate.origin !== session.origin || candidate.account.id !== session.account.id)}
          <p class="connection-note">{$_('connection.otherAccount')}</p>
        {/if}
        {#if message}<p class="connection-error" role="alert">{message}</p>{/if}
        <div class="connection-actions">
          <button type="button" class="connection-disconnect" onclick={() => void ondisconnect()}>
            {$_('connection.disconnect')}
          </button>
          <button type="button" class="connection-secondary" onclick={onclose}>
            {$_('connection.close')}
          </button>
        </div>
      {:else}
        <p class="connection-intro">{$_('connection.intro')}</p>
        <ul class="connection-benefits">
          <li>{$_('connection.benefitBoosts')}</li>
          <li>{$_('connection.benefitFollowers')}</li>
        </ul>
        <p class="connection-privacy">{$_('connection.privacy')}</p>
        <details class="connection-details">
          <summary>{$_('connection.details')}</summary>
          <p>{$_('connection.detailsText')}</p>
        </details>

        {#if selected}
          <div class="connection-account connection-account-selected">
            <img src={selected.account.avatar_static} alt="" width="52" height="52" />
            <div>
              <small
                >{$_('connection.selectedAccount', {
                  values: { account: canonicalAcct(selected.account, selected.origin) },
                })}</small
              >
              <strong>{selected.account.display_name || selected.account.username}</strong>
              <span>{new URL(selected.origin).hostname}</span>
            </div>
          </div>
        {:else}
          <form
            class="connection-handle"
            onsubmit={(event) => {
              event.preventDefault();
              void resolveCandidate();
            }}
          >
            <label for="connection-handle">{$_('connection.chooseHandle')}</label>
            <HandleCombobox
              inputId="connection-handle"
              listboxId="connection-handles-listbox"
              bind:value={handle}
              {savedHandles}
              disabled={resolving || phase === 'connecting'}
            />
            <button type="submit" disabled={resolving || !handle.trim()}>
              {resolving ? $_('hero.connecting') : $_('connection.resolve')}
            </button>
          </form>
        {/if}

        {#if resolveError}<p class="connection-error" role="alert">{resolveError}</p>{/if}
        {#if message}<p class="connection-error" role="alert">{message}</p>{/if}

        <div class="connection-actions">
          {#if selected}
            <button
              type="button"
              disabled={phase === 'connecting'}
              onclick={() => void onconnect(selected!)}
            >
              {phase === 'connecting'
                ? $_('connection.connecting')
                : $_('connection.connectTo', {
                    values: { host: new URL(selected.origin).hostname },
                  })}
            </button>
          {/if}
          <button
            type="button"
            class="connection-secondary"
            disabled={phase === 'connecting'}
            onclick={onclose}>{$_('connection.cancel')}</button
          >
        </div>
      {/if}
    </div>
  </div>
{/if}
