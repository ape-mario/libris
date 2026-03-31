<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import { showToast } from '$lib/stores/toast.svelte';
  import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';

  let { onDone, importedCount }: { onDone: () => void; importedCount: number } = $props();

  let step2Mode = $state<'choose' | 'scan' | 'search' | 'done'>('choose');
  let searchQuery = $state('');
  let searchResults = $state<any[]>([]);
  let searching = $state(false);
  let searchDone = $state(false);
  let addedInStep2 = $state(false);

  // Barcode state
  let barcodeProcessing = $state(false);
  let barcodeResult = $state<'found' | 'not_found' | 'no_barcode' | null>(null);
  let barcodeTitle = $state('');
  let barcodeISBN = $state('');

  // Search Open Library
  async function handleSearch() {
    if (!searchQuery.trim()) return;
    if (!navigator.onLine) {
      showToast(t('add.error_offline'), 'error');
      return;
    }
    searching = true;
    searchDone = false;
    searchResults = [];
    try {
      const { searchOpenLibrary } = await import('$lib/services/bookLookup');
      searchResults = await searchOpenLibrary(searchQuery);
    } catch {
      showToast(t('add.error_save_failed'), 'error');
      searchResults = [];
    }
    searching = false;
    searchDone = true;
  }

  // Add book from search result
  async function handleAddFromSearch(result: any, overrideIsbn?: string) {
    try {
      const { addBook } = await import('$lib/services/books');
      const book = addBook(
        {
          title: result.title,
          authors: result.authors || [],
          isbn: overrideIsbn || result.isbn,
          coverUrl: result.coverUrl,
          publisher: result.publisher,
          publishYear: result.publishYear,
          categories: []
        },
        true
      );
      if (book) {
        addedInStep2 = true;
        barcodeTitle = result.title;
        barcodeResult = 'found';
        searchResults = [];
        searchQuery = '';
      } else {
        showToast(t('add.error_save_failed'), 'error');
      }
    } catch {
      showToast(t('add.error_save_failed'), 'error');
    }
  }

  function handleSearchSelect(result: any) {
    handleAddFromSearch(result, barcodeISBN);
  }

  // Barcode
  async function handleBarcode(code: string) {
    step2Mode = 'scan';
    barcodeProcessing = true;
    barcodeResult = null;
    barcodeISBN = code;

    const { lookupByISBN } = await import('$lib/services/bookLookup');
    const { addBook } = await import('$lib/services/books');
    const result = await lookupByISBN(code);
    barcodeProcessing = false;

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
        true
      );
      if (book) {
        barcodeTitle = result.title;
        barcodeResult = 'found';
        addedInStep2 = true;
      }
    } else {
      barcodeResult = 'not_found';
    }
  }
</script>

<h2 class="font-display text-xl font-bold text-ink tracking-tight text-center mb-6">
  {t('onboarding.step2.title')}
</h2>

{#if step2Mode === 'choose'}
  <div class="space-y-3">
    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => { step2Mode = 'search'; }}
    >
      <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-accent"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step2.search')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step2.search_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => { step2Mode = 'scan'; }}
    >
      <div class="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-sage"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step2.scan')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step2.scan_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => onDone()}
    >
      <div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step2.skip')}</p>
      </div>
    </button>
  </div>

{:else if step2Mode === 'scan'}
  {#if barcodeProcessing}
    <!-- Loading: looking up ISBN -->
    <div class="card p-6 text-center animate-fade-in">
      <div class="w-8 h-0.5 bg-accent rounded-full animate-pulse mx-auto mb-3"></div>
      <p class="text-sm text-ink-muted">{t('add.barcode_searching')}</p>
      <p class="text-xs text-warm-400 font-mono mt-1">{barcodeISBN}</p>
    </div>

  {:else if barcodeResult === 'found'}
    <!-- Success: book found and added -->
    <div class="card p-6 text-center animate-fade-in">
      <div class="w-12 h-12 rounded-full bg-sage/10 flex items-center justify-center mx-auto mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-sage"><path d="M20 6 9 17l-5-5"/></svg>
      </div>
      <p class="font-display text-sm font-semibold text-ink mb-1">{barcodeTitle}</p>
      <p class="text-xs text-ink-muted mb-4">{t('add.barcode_found', { title: barcodeTitle })}</p>
      <div class="flex gap-2 justify-center">
        <button class="btn-primary-sm" onclick={() => onDone()}>{t('onboarding.next')}</button>
        <button class="btn-secondary text-sm" onclick={() => { barcodeResult = null; }}>{t('onboarding.step2.scan_another')}</button>
      </div>
    </div>

  {:else if barcodeResult === 'not_found'}
    <!-- ISBN detected but book not in database — offer title search -->
    <div class="card p-6 animate-fade-in">
      <div class="text-center mb-4">
        <div class="w-12 h-12 rounded-full bg-warm-200/50 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
        </div>
        <p class="font-display text-sm font-semibold text-ink mb-1">{t('onboarding.barcode_not_found_title')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.barcode_not_found_search')}</p>
        <p class="text-xs text-warm-400 font-mono mt-1">ISBN: {barcodeISBN}</p>
      </div>

      <!-- Inline title search -->
      <form class="flex gap-2 mb-3" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder={t('add.search_placeholder')}
          class="input-field flex-1 text-sm"
          autofocus
        />
        <button type="submit" class="btn-primary-sm" disabled={searching}>
          {searching ? '...' : t('add.search')}
        </button>
      </form>

      {#if searching}
        <div class="flex justify-center py-4">
          <div class="w-8 h-0.5 bg-accent rounded-full animate-pulse"></div>
        </div>
      {:else if searchDone && searchResults.length === 0}
        <p class="text-xs text-ink-muted text-center py-3">{t('add.no_results')}</p>
      {/if}

      {#if searchResults.length > 0}
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto mb-3">
          {#each searchResults as result}
            <button
              class="card p-3 flex gap-3 text-left hover:shadow-md transition-shadow w-full"
              onclick={() => handleSearchSelect(result)}
            >
              {#if result.coverUrl}
                <img src={result.coverUrl} alt={result.title} class="w-8 h-12 object-cover rounded flex-shrink-0" />
              {/if}
              <div class="min-w-0">
                <p class="text-sm font-medium text-ink truncate">{result.title}</p>
                <p class="text-xs text-ink-muted truncate">{result.authors.join(', ')}</p>
              </div>
            </button>
          {/each}
        </div>
      {/if}

      <div class="flex gap-2 justify-center">
        <button class="btn-secondary text-sm" onclick={() => { barcodeResult = null; }}>{t('onboarding.step2.scan_another')}</button>
        <button class="btn-secondary text-sm" onclick={() => onDone()}>{t('onboarding.step2.skip')}</button>
      </div>
    </div>

  {:else if barcodeResult === 'no_barcode'}
    <!-- Photo taken but no barcode detected -->
    <div class="card p-6 text-center animate-fade-in">
      <div class="w-12 h-12 rounded-full bg-berry/10 flex items-center justify-center mx-auto mb-3">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-berry"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </div>
      <p class="font-display text-sm font-semibold text-ink mb-1">{t('onboarding.no_barcode_title')}</p>
      <p class="text-xs text-ink-muted mb-4">{t('onboarding.no_barcode_desc')}</p>
      <button class="btn-secondary text-sm" onclick={() => { barcodeResult = null; }}>{t('onboarding.try_again')}</button>
    </div>

  {:else}
    <!-- Scanner ready -->
    <BarcodeScanner
      onDetected={handleBarcode}
      onError={() => { barcodeResult = 'no_barcode'; }}
    />
  {/if}
  <button class="text-sm text-ink-muted hover:text-ink transition-colors mt-4" onclick={() => { step2Mode = 'choose'; barcodeProcessing = false; barcodeResult = null; }}>
    {t('onboarding.back')}
  </button>

{:else if step2Mode === 'search'}
  <div class="space-y-4">
    <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder={t('add.search_placeholder')}
        class="input-field flex-1"
      />
      <button type="submit" class="btn-primary" disabled={searching}>
        {searching ? '...' : t('add.search')}
      </button>
    </form>

    {#if searching}
      <div class="flex justify-center py-6">
        <div class="w-8 h-0.5 bg-accent rounded-full animate-pulse"></div>
      </div>
    {:else if searchDone && searchResults.length === 0}
      <p class="text-sm text-ink-muted text-center py-4">{t('add.no_results')}</p>
    {/if}

    {#if searchResults.length > 0}
      <div class="space-y-2 max-h-64 overflow-y-auto">
        {#each searchResults as result}
          <button
            class="card p-3 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
            onclick={() => handleAddFromSearch(result)}
          >
            {#if result.coverUrl}
              <img src={result.coverUrl} alt="" class="w-10 h-14 object-cover rounded" />
            {:else}
              <div class="w-10 h-14 bg-warm-100 rounded flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
              </div>
            {/if}
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-ink truncate">{result.title}</p>
              <p class="text-xs text-ink-muted truncate">{result.authors?.join(', ') || ''}</p>
              {#if result.publishYear}
                <p class="text-xs text-ink-muted">{result.publishYear}</p>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    {/if}

    <button class="text-sm text-ink-muted hover:text-ink transition-colors" onclick={() => { step2Mode = 'choose'; searchResults = []; searchQuery = ''; }}>
      {t('onboarding.back')}
    </button>
  </div>

{:else if step2Mode === 'done'}
  <div class="text-center space-y-4">
    <div class="w-16 h-16 rounded-2xl bg-sage/10 mx-auto flex items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-sage"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <p class="font-display text-lg font-semibold text-ink">
      {t('onboarding.step1.imported', { count: '1' })}
    </p>
    <button class="btn-primary" onclick={() => onDone()}>{t('onboarding.next')}</button>
  </div>
{/if}
