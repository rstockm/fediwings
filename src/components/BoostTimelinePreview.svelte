<script lang="ts">
  import { _ } from 'svelte-i18n';

  let { onconnect }: { onconnect: () => void } = $props();
</script>

<section class="boost-timeline boost-timeline-preview" aria-label={$_('boostHistory.title')}>
  <div class="boost-timeline-heading">
    <h3>{$_('boostHistory.title')}</h3>
    <span class="boost-preview-label">{$_('boostHistory.preview')}</span>
  </div>
  <svg
    class="boost-curve boost-preview-curve"
    viewBox="0 0 380 194"
    aria-hidden="true"
    focusable="false"
  >
    <line class="boost-curve-grid" x1="50" x2="370" y1="16" y2="16"></line>
    <line class="boost-curve-grid" x1="50" x2="370" y1="79" y2="79"></line>
    <line class="boost-curve-baseline" x1="50" x2="370" y1="142" y2="142"></line>
    <path
      class="boost-preview-area"
      d="M50 142 C65 142 75 90 100 75 S145 54 175 48 S250 38 285 32 S345 25 370 23 L370 142 Z"
    ></path>
    <path
      class="boost-preview-line"
      d="M50 142 C65 142 75 90 100 75 S145 54 175 48 S250 38 285 32 S345 25 370 23"
    ></path>
    <text class="boost-curve-axis-title" x="198" y="184" text-anchor="middle"
      >{$_('boostHistory.xAxis')}</text
    >
  </svg>
  <p class="boost-preview-hint">{$_('boostHistory.connectHint')}</p>
  <button class="boost-preview-connect" type="button" onclick={onconnect}>
    {$_('boostHistory.connect')}
  </button>
</section>
