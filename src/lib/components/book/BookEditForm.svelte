<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { getAllSeries, createSeries } from '$lib/services/series';
  import type { Book, Series } from '$lib/db';

  interface Props {
    book: Book;
    coverSrc: string | null;
    onSave: (updates: Partial<Book>) => void;
    onCancel: () => void;
  }

  let { book, coverSrc, onSave, onCancel }: Props = $props();

  // Edit form fields
  let editTitle = $state(book.title);
  let editAuthors = $state(book.authors.join(', '));
  let editIsbn = $state(book.isbn || '');
  let editCategories = $state(book.categories.join(', '));
  let editPublisher = $state(book.publisher || '');
  let editPublishYear = $state(book.publishYear?.toString() || '');
  let editEdition = $state(book.edition || '');
  let editSeriesId = $state(book.seriesId || '');
  let editSeriesOrder = $state(book.seriesOrder?.toString() || '');
  let seriesList = $state<Series[]>(getAllSeries());
  let newSeriesName = $state('');

  function saveEdit() {
    if (!editTitle.trim()) return;
    onSave({
      title: editTitle.trim(),
      authors: editAuthors.split(',').map(a => a.trim()).filter(Boolean),
      isbn: editIsbn.trim() || undefined,
      publisher: editPublisher.trim() || undefined,
      publishYear: editPublishYear ? parseInt(editPublishYear) : undefined,
      edition: editEdition.trim() || undefined,
      categories: editCategories.split(',').map(c => c.trim().toLowerCase()).filter(Boolean),
      seriesId: editSeriesId || undefined,
      seriesOrder: editSeriesOrder ? parseInt(editSeriesOrder) : undefined
    });
  }
</script>

<div class="flex gap-5 mb-6 items-start">
  <div class="w-20 h-28 rounded-lg overflow-hidden book-shadow bg-warm-100 flex-shrink-0">
    {#if coverSrc}
      <img src={coverSrc} alt={book.title} class="w-full h-full object-cover" />
    {:else}
      <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-warm-100 to-warm-200 text-ink-muted text-[10px] text-center px-2 font-display">{book.title}</div>
    {/if}
  </div>
  <div>
    <h2 class="font-display text-lg font-bold text-ink leading-snug">{t('book.edit')}</h2>
    <p class="text-xs text-ink-muted mt-0.5">{t('book.edit_subtitle')}</p>
  </div>
</div>

<form class="flex flex-col gap-4 animate-fade-up" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
  <div class="card p-5 flex flex-col gap-4">
    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.book_title')} *</span>
      <input type="text" bind:value={editTitle} class="input-field" />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.authors')}</span>
      <input type="text" bind:value={editAuthors} placeholder={t('add.authors_placeholder')} class="input-field" />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.isbn')}</span>
      <input type="text" bind:value={editIsbn} class="input-field font-mono" />
    </label>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.publisher')}</span>
      <input type="text" bind:value={editPublisher} placeholder={t('add.publisher_placeholder')} class="input-field" />
    </label>

    <div class="grid grid-cols-2 gap-3">
      <label class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.publish_year')}</span>
        <input type="number" bind:value={editPublishYear} placeholder="2024" class="input-field" />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.edition')}</span>
        <input type="text" bind:value={editEdition} placeholder={t('add.edition_placeholder')} class="input-field" />
      </label>
    </div>

    <label class="flex flex-col gap-1.5">
      <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.categories')}</span>
      <input type="text" bind:value={editCategories} placeholder={t('add.categories_placeholder')} class="input-field" />
    </label>
  </div>

  <div class="card p-5 flex flex-col gap-4">
    <h3 class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.series')}</h3>
    <select bind:value={editSeriesId} class="input-field">
      <option value="">{t('add.series_none')}</option>
      {#each seriesList as s}
        <option value={s.id}>{s.name}</option>
      {/each}
    </select>

    {#if editSeriesId}
      <label class="flex flex-col gap-1.5">
        <span class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{t('add.series_position')}</span>
        <input type="number" bind:value={editSeriesOrder} min="1" placeholder="1" class="input-field" />
      </label>
    {/if}

    <div class="flex gap-2">
      <input type="text" bind:value={newSeriesName} placeholder={t('add.series_create')}
        class="input-field flex-1" />
      <button type="button" class="btn-secondary"
        onclick={() => {
          if (!newSeriesName.trim()) return;
          const s = createSeries(newSeriesName.trim());
          seriesList = getAllSeries();
          editSeriesId = s.id;
          newSeriesName = '';
        }}>{t('add.series_add')}</button>
    </div>
  </div>

  <div class="flex gap-3 pt-1">
    <button type="submit" class="btn-primary flex-1">{t('book.save')}</button>
    <button type="button" class="btn-secondary" onclick={onCancel}>{t('dialog.cancel')}</button>
  </div>
</form>
