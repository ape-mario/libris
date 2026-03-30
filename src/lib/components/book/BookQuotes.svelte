<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    quotes: { text: string; page?: number; note?: string }[];
    onUpdate: (quotes: { text: string; page?: number; note?: string }[]) => void;
  }

  let { quotes, onUpdate }: Props = $props();

  let addingQuote = $state(false);
  let newQuoteText = $state('');
  let newQuotePage = $state('');
  let newQuoteNote = $state('');

  function saveQuote() {
    if (!newQuoteText.trim()) return;
    const updated = [...quotes];
    updated.push({
      text: newQuoteText.trim(),
      page: newQuotePage ? parseInt(newQuotePage) : undefined,
      note: newQuoteNote.trim() || undefined
    });
    onUpdate(updated);
    newQuoteText = '';
    newQuotePage = '';
    newQuoteNote = '';
    addingQuote = false;
  }

  function removeQuote(index: number) {
    const updated = [...quotes];
    updated.splice(index, 1);
    onUpdate(updated);
  }
</script>

<div class="mb-6">
  <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.quotes')}</h2>
  {#if quotes.length}
    <div class="flex flex-col gap-2 mb-3">
      {#each quotes as quote, i}
        <div class="card p-3">
          <div class="flex justify-between items-start gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-sm text-ink italic">"{quote.text}"</p>
              <div class="flex gap-3 mt-1">
                {#if quote.page}<span class="text-xs text-ink-muted">{t('book.quotes.page')} {quote.page}</span>{/if}
                {#if quote.note}<span class="text-xs text-ink-muted">{quote.note}</span>{/if}
              </div>
            </div>
            <button class="w-7 h-7 flex items-center justify-center rounded-lg text-warm-400 hover:text-berry hover:bg-berry/10 transition-colors flex-shrink-0 text-sm" onclick={() => removeQuote(i)}>&times;</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
  {#if addingQuote}
    <div class="card p-4 flex flex-col gap-3 animate-fade-up">
      <textarea
        bind:value={newQuoteText}
        placeholder={t('book.quotes.text_placeholder')}
        class="input-field resize-none h-20 text-sm"
      ></textarea>
      <div class="flex gap-3">
        <label class="flex flex-col gap-1 w-24">
          <span class="text-xs text-ink-muted">{t('book.quotes.page')}</span>
          <input type="number" bind:value={newQuotePage} min="1" class="input-field !py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.quotes.note')}</span>
          <input type="text" bind:value={newQuoteNote} placeholder={t('book.quotes.note_placeholder')} class="input-field !py-1.5 text-sm" />
        </label>
      </div>
      <div class="flex gap-2">
        <button class="btn-primary-sm" onclick={saveQuote}>{t('book.quotes.save')}</button>
        <button class="btn-secondary text-sm" onclick={() => { addingQuote = false; newQuoteText = ''; newQuotePage = ''; newQuoteNote = ''; }}>{t('book.quotes.cancel')}</button>
      </div>
    </div>
  {:else}
    <button class="btn-secondary text-sm" onclick={() => addingQuote = true}>+ {t('book.quotes.add')}</button>
  {/if}
</div>
