<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import { showToast } from '$lib/stores/toast.svelte';

  let { onImported, onSkip }: { onImported: (count: number) => void; onSkip: () => void } = $props();

  let step1Mode = $state<'choose' | 'isbn' | 'done'>('choose');
  let importing = $state(false);
  let isbnText = $state('');
  let isbnLooking = $state(false);
  let importedCount = $state(0);

  // File input refs
  let goodreadsInput: HTMLInputElement;
  let xlsxInput: HTMLInputElement;

  function user() {
    return getCurrentUser();
  }

  // Goodreads CSV import
  async function handleGoodreads(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    const u = user();
    if (!file || !u) return;
    importing = true;
    try {
      const { importGoodreadsCSV } = await import('$lib/services/goodreads');
      const csv = await file.text();
      const count = importGoodreadsCSV(csv, u.id);
      importedCount = count;
      step1Mode = 'done';
    } catch {
      showToast(t('toast.goodreads_failed'), 'error');
    }
    importing = false;
    input.value = '';
  }

  // XLSX/CSV import
  async function handleXLSX(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    const u = user();
    if (!file || !u) return;
    importing = true;
    try {
      if (file.name.endsWith('.csv')) {
        const { importGoodreadsCSV } = await import('$lib/services/goodreads');
        const csv = await file.text();
        const count = importGoodreadsCSV(csv, u.id);
        importedCount = count;
      } else {
        const { importXLSX } = await import('$lib/services/backup');
        const buf = await file.arrayBuffer();
        const count = await importXLSX(buf, u.id);
        importedCount = count;
      }
      step1Mode = 'done';
    } catch {
      showToast(t('toast.xlsx_import_failed'), 'error');
    }
    importing = false;
    input.value = '';
  }

  // Bulk ISBN
  async function handleBulkISBN() {
    const u = user();
    if (!u) return;
    const lines = isbnText
      .split(/[\n,;]+/)
      .map((l) => l.replace(/[-\s]/g, '').trim())
      .filter((l) => /^\d{10,13}$/.test(l));

    if (lines.length === 0) return;

    isbnLooking = true;
    let count = 0;
    const { lookupByISBN } = await import('$lib/services/bookLookup');
    const { addBook } = await import('$lib/services/books');

    // Process with concurrency limit of 3
    const queue = [...lines];
    const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length > 0) {
        const isbn = queue.shift()!;
        try {
          const result = await lookupByISBN(isbn);
          if (result) {
            const book = addBook(
              {
                title: result.title,
                authors: result.authors,
                isbn: result.isbn,
                coverUrl: result.coverUrl,
                publisher: result.publisher,
                publishYear: result.publishYear,
                categories: []
              },
              false
            );
            if (book) count++;
          }
        } catch {
          // skip failed lookups
        }
      }
    });

    await Promise.all(workers);
    importedCount = count;
    isbnLooking = false;
    step1Mode = 'done';
  }
</script>

<!-- Hidden file inputs -->
<input bind:this={goodreadsInput} type="file" accept=".csv" class="hidden" onchange={handleGoodreads} />
<input bind:this={xlsxInput} type="file" accept=".xlsx,.xls,.csv" class="hidden" onchange={handleXLSX} />

<h2 class="font-display text-xl font-bold text-ink tracking-tight text-center mb-6">
  {t('onboarding.step1.title')}
</h2>

{#if step1Mode === 'choose'}
  <div class="space-y-3">
    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => goodreadsInput.click()}
      disabled={importing}
    >
      <div class="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-sage"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step1.goodreads')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step1.goodreads_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => xlsxInput.click()}
      disabled={importing}
    >
      <div class="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-gold"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step1.xlsx')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step1.xlsx_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => { step1Mode = 'isbn'; }}
    >
      <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-accent"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step1.isbn')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step1.isbn_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => onSkip()}
    >
      <div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step1.scratch')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step1.scratch_desc')}</p>
      </div>
    </button>
  </div>
{:else if step1Mode === 'isbn'}
  <div class="space-y-4">
    <textarea
      bind:value={isbnText}
      placeholder={t('add.bulk.input_placeholder')}
      class="input-field w-full h-40 font-mono text-sm resize-none"
    ></textarea>
    <button
      class="btn-primary w-full"
      onclick={handleBulkISBN}
      disabled={isbnLooking || !isbnText.trim()}
    >
      {isbnLooking ? t('add.bulk.looking_up') : t('onboarding.step1.isbn')}
    </button>
    <button class="text-sm text-ink-muted hover:text-ink transition-colors" onclick={() => { step1Mode = 'choose'; }}>
      {t('onboarding.back')}
    </button>
  </div>
{:else if step1Mode === 'done'}
  <div class="text-center space-y-4">
    <div class="w-16 h-16 rounded-2xl bg-sage/10 mx-auto flex items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-sage"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <p class="font-display text-lg font-semibold text-ink">
      {t('onboarding.step1.imported', { count: importedCount.toString() })}
    </p>
    <button class="btn-primary" onclick={() => onImported(importedCount)}>{t('onboarding.next')}</button>
  </div>
{/if}

{#if importing}
  <div class="flex items-center justify-center gap-2 mt-4">
    <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
    <span class="text-sm text-ink-muted">{t('app.loading')}</span>
  </div>
{/if}
