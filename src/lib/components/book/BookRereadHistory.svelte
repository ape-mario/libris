<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    readHistory: { dateStarted?: string; dateFinished?: string; rating?: number; notes?: string }[];
    onUpdate: (history: { dateStarted?: string; dateFinished?: string; rating?: number; notes?: string }[]) => void;
  }

  let { readHistory, onUpdate }: Props = $props();

  let addingReread = $state(false);
  let rereadStarted = $state('');
  let rereadFinished = $state('');
  let rereadRating = $state('');
  let rereadNotes = $state('');

  function saveReread() {
    const history = [...readHistory];
    history.push({
      dateStarted: rereadStarted || undefined,
      dateFinished: rereadFinished || undefined,
      rating: rereadRating ? parseFloat(rereadRating) : undefined,
      notes: rereadNotes.trim() || undefined
    });
    onUpdate(history);
    rereadStarted = '';
    rereadFinished = '';
    rereadRating = '';
    rereadNotes = '';
    addingReread = false;
  }

  function removeReread(index: number) {
    const history = [...readHistory];
    history.splice(index, 1);
    onUpdate(history);
  }
</script>

<div class="mb-6 animate-fade-up">
  <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.reread_history')}</h2>
  {#if readHistory.length}
    <div class="flex flex-col gap-2 mb-3">
      {#each readHistory as entry, i}
        <div class="card p-3 flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="text-sm text-ink">
              <span>{entry.dateStarted?.slice(0, 10) || t('book.reread_history.no_date')}</span>
              <span class="text-ink-muted mx-1">&rarr;</span>
              <span>{entry.dateFinished?.slice(0, 10) || t('book.reread_history.no_date')}</span>
            </div>
            <div class="flex gap-2 mt-0.5">
              {#if entry.rating}
                <span class="text-xs text-accent">{'&#9733;'.repeat(Math.floor(entry.rating))}{entry.rating % 1 ? '&#189;' : ''}</span>
              {/if}
              {#if entry.notes}
                <span class="text-xs text-ink-muted truncate">{entry.notes}</span>
              {/if}
            </div>
          </div>
          <button class="w-7 h-7 flex items-center justify-center rounded-lg text-warm-400 hover:text-berry hover:bg-berry/10 transition-colors flex-shrink-0 text-sm" onclick={() => removeReread(i)}>&times;</button>
        </div>
      {/each}
    </div>
  {/if}
  {#if addingReread}
    <div class="card p-4 flex flex-col gap-3 animate-fade-up">
      <div class="flex gap-3">
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.reread_history.started')}</span>
          <input type="date" bind:value={rereadStarted} class="input-field !py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.reread_history.finished')}</span>
          <input type="date" bind:value={rereadFinished} class="input-field !py-1.5 text-sm" />
        </label>
      </div>
      <div class="flex gap-3">
        <label class="flex flex-col gap-1 w-20">
          <span class="text-xs text-ink-muted">{t('library.sort.rating')}</span>
          <input type="number" bind:value={rereadRating} min="0.5" max="5" step="0.5" class="input-field !py-1.5 text-sm" />
        </label>
        <label class="flex flex-col gap-1 flex-1">
          <span class="text-xs text-ink-muted">{t('book.notes')}</span>
          <input type="text" bind:value={rereadNotes} class="input-field !py-1.5 text-sm" />
        </label>
      </div>
      <div class="flex gap-2">
        <button class="btn-primary-sm" onclick={saveReread}>{t('book.quotes.save')}</button>
        <button class="btn-secondary text-sm" onclick={() => { addingReread = false; rereadStarted = ''; rereadFinished = ''; rereadRating = ''; rereadNotes = ''; }}>{t('book.quotes.cancel')}</button>
      </div>
    </div>
  {:else}
    <button class="btn-secondary text-sm" onclick={() => addingReread = true}>+ {t('book.reread_history.add')}</button>
  {/if}
</div>
