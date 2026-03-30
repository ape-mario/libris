<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    acquiredFrom?: string;
    acquiredPrice?: string;
    acquiredDate?: string;
    onUpdate: (field: string, value: string) => void;
  }

  let { acquiredFrom, acquiredPrice, acquiredDate, onUpdate }: Props = $props();

  let acquisitionOpen = $state(false);
</script>

<div class="mb-6">
  <button
    class="text-xs font-semibold text-ink-muted uppercase tracking-wider flex items-center gap-1 hover:text-ink transition-colors"
    onclick={() => acquisitionOpen = !acquisitionOpen}
  >
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform {acquisitionOpen ? 'rotate-90' : ''}"><path d="m9 18 6-6-6-6"/></svg>
    {t('book.acquisition')}
  </button>
  {#if acquisitionOpen}
    <div class="card p-4 mt-2.5 flex flex-col gap-3 animate-fade-up">
      <label class="flex flex-col gap-1">
        <span class="text-xs text-ink-muted">{t('book.acquisition.where')}</span>
        <input
          type="text"
          value={acquiredFrom || ''}
          onblur={(e) => onUpdate('acquiredFrom', (e.target as HTMLInputElement).value)}
          class="input-field !py-1.5 text-sm"
        />
      </label>
      <div class="flex gap-3">
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.acquisition.price')}</span>
          <input
            type="text"
            value={acquiredPrice || ''}
            onblur={(e) => onUpdate('acquiredPrice', (e.target as HTMLInputElement).value)}
            class="input-field !py-1.5 text-sm"
          />
        </label>
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.acquisition.date')}</span>
          <input
            type="date"
            value={acquiredDate?.slice(0, 10) || ''}
            onchange={(e) => onUpdate('acquiredDate', (e.target as HTMLInputElement).value)}
            class="input-field !py-1.5 text-sm"
          />
        </label>
      </div>
    </div>
  {/if}
</div>
