<script lang="ts">
  import { _, number as _number } from 'svelte-i18n';
  import type { MastodonAccount, ServerPlatform } from '../lib/types';

  let {
    account,
    origin,
    platform = null,
  }: { account: MastodonAccount; origin: string; platform?: ServerPlatform | null } = $props();
</script>

<section class="account-card" aria-labelledby="account-name">
  <div class="account-avatar-wrap">
    <img
      class="account-avatar"
      src={account.avatar_static}
      alt=""
      width="88"
      height="88"
      referrerpolicy="no-referrer"
    />
    <span class="account-presence" aria-hidden="true"></span>
  </div>

  <div class="account-identity">
    <p class="eyebrow">{$_('account.eyebrow')}</p>
    <h2 id="account-name">{account.display_name || account.username}</h2>
    <a href={account.url} target="_blank" rel="noreferrer">@{account.acct}</a>
  </div>

  <div class="account-stat">
    <span>{$_number(account.followers_count, { format: 'int' })}</span>
    <small>{$_('account.followersNote')}</small>
  </div>

  <div class="account-origin" title={origin}>
    <span class="status-dot"></span>
    {$_('account.dataFrom', { values: { host: new URL(origin).hostname } })}
    {#if platform}
      <span class="account-platform" title={$_('account.platformTitle')}>· {platform.name}</span>
    {/if}
  </div>
</section>
