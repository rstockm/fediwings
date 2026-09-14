<script lang="ts">
  import { _ } from 'svelte-i18n';
  import type { SavedHandle } from '../lib/history';

  let {
    value = $bindable(''),
    savedHandles = [],
    disabled = false,
    inputId,
    listboxId,
  }: {
    value?: string;
    savedHandles?: SavedHandle[];
    disabled?: boolean;
    inputId: string;
    listboxId: string;
  } = $props();

  let wrapEl = $state<HTMLElement | undefined>(undefined);
  let dropdownOpen = $state(false);
  let activeIndex = $state(-1);

  function openDropdown() {
    if (disabled || savedHandles.length === 0) return;
    dropdownOpen = true;
    if (activeIndex < 0) activeIndex = 0;
  }

  function closeDropdown() {
    dropdownOpen = false;
    activeIndex = -1;
  }

  function chooseHandle(selected: string) {
    value = selected;
    closeDropdown();
  }

  function onFocusout(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (next instanceof Node && wrapEl?.contains(next)) return;
    closeDropdown();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!dropdownOpen) {
        openDropdown();
      } else if (savedHandles.length > 0) {
        activeIndex = (activeIndex + 1) % savedHandles.length;
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (dropdownOpen && activeIndex >= 0) {
        activeIndex = (activeIndex - 1 + savedHandles.length) % savedHandles.length;
      }
    } else if (event.key === 'Enter' && dropdownOpen && activeIndex >= 0) {
      event.preventDefault();
      const selected = savedHandles[activeIndex];
      if (selected) chooseHandle(selected.handle);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
    }
  }
</script>

<div class="handle-wrap" bind:this={wrapEl} onfocusout={onFocusout}>
  <input
    id={inputId}
    bind:value
    placeholder={$_('combobox.placeholder')}
    autocomplete="off"
    spellcheck="false"
    required
    {disabled}
    role="combobox"
    aria-label={$_('combobox.handle')}
    aria-expanded={dropdownOpen}
    aria-controls={listboxId}
    aria-autocomplete="list"
    aria-activedescendant={dropdownOpen && activeIndex >= 0
      ? `${listboxId}-option-${activeIndex}`
      : undefined}
    onfocus={openDropdown}
    onkeydown={onKeydown}
  />
  {#if dropdownOpen && savedHandles.length > 0}
    <ul
      class="saved-handles-list"
      id={listboxId}
      role="listbox"
      aria-label={$_('combobox.listbox')}
    >
      <li class="list-label" role="presentation">{$_('combobox.listLabel')}</li>
      {#each savedHandles as saved, index (saved.handle)}
        <li
          id={`${listboxId}-option-${index}`}
          role="option"
          aria-selected={activeIndex === index}
          class:is-active={activeIndex === index}
          onmousedown={(event) => event.preventDefault()}
          onclick={() => chooseHandle(saved.handle)}
          onkeydown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              chooseHandle(saved.handle);
            }
          }}
        >
          <span class="saved-handle">{saved.handle}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
