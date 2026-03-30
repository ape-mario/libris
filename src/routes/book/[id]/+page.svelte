<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount, onDestroy } from 'svelte';
  import { getBookById, updateBook, deleteBook, getBooksBySeries, getBooks } from '$lib/services/books';
  import { getUserBookData, setUserBookData } from '$lib/services/userbooks';
  import { resizeImage } from '$lib/services/covers';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import { q } from '$lib/db';
  import type { Book, UserBookData, Series, Shelf } from '$lib/db';
  import { showConfirm, showPrompt } from '$lib/stores/dialog.svelte';
  import { showToast } from '$lib/stores/toast.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { cacheCoverIfNeeded, getCoverBase64, setCoverBase64 } from '$lib/services/coverCache';
  import { getUserShelves, addBookToShelf, removeBookFromShelf } from '$lib/services/shelves';
  import BookEditForm from '$lib/components/book/BookEditForm.svelte';
  import BookQuotes from '$lib/components/book/BookQuotes.svelte';
  import BookTags from '$lib/components/book/BookTags.svelte';
  import BookAcquisition from '$lib/components/book/BookAcquisition.svelte';
  import BookRereadHistory from '$lib/components/book/BookRereadHistory.svelte';
  import BookDnfDetails from '$lib/components/book/BookDnfDetails.svelte';
  import BookRelated from '$lib/components/book/BookRelated.svelte';

  let book = $state<Book | null>(null);
  let userData = $state<UserBookData | null>(null);
  let shelves = $state<Shelf[]>([]);
  let bookShelfIds = $state<Set<string>>(new Set());
  let user = $derived(getCurrentUser());
  let editing = $state(false);
  let coverSrc = $state<string | null>(null);
  let seriesName = $state('');

  let unsubBook: (() => void)[] = [];

  function reloadBookData() {
    const id = page.params.id;
    if (!id) return;
    book = getBookById(id) || null;
    if (!book) return;
    if (user) {
      userData = getUserBookData(user.id, book.id);
      shelves = getUserShelves(user.id);
      bookShelfIds = new Set(shelves.filter(s => s.bookIds.includes(book!.id)).map(s => s.id));
    }
    if (book.seriesId) {
      const s = q.getItem('series', book.seriesId) as Series | undefined;
      if (s) seriesName = s.name;
    }
  }

  onMount(async () => {
    reloadBookData();
    // Load cover from cache or URL
    if (book) {
      const base64 = await getCoverBase64(book.id);
      coverSrc = base64 || book.coverUrl || null;
      cacheCoverIfNeeded(book.id);
    }
    unsubBook = [
      q.observe('books', () => reloadBookData()),
      q.observe('userBookData', () => reloadBookData()),
      q.observe('shelves', () => reloadBookData())
    ];
  });

  onDestroy(() => unsubBook.forEach(f => f()));

  function handleEditSave(updates: Partial<Book>) {
    if (!book) return;
    try {
      updateBook(book.id, updates);
      book = getBookById(book.id) || null;
      if (book?.seriesId) {
        const s = q.getItem('series', book.seriesId) as Series | undefined;
        seriesName = s?.name || '';
      } else {
        seriesName = '';
      }
      showToast(t('toast.book_updated'), 'success');
      editing = false;
    } catch {
      showToast(t('add.error_save_failed'), 'error');
    }
  }

  function updateStatus(status: 'unread' | 'reading' | 'read' | 'dnf') {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { status });
  }

  function updateRating(star: number) {
    if (!user || !book) return;
    const current = userData?.rating || 0;
    let newRating: number | undefined;
    if (current === star) {
      newRating = star - 0.5;
    } else if (current === star - 0.5) {
      newRating = undefined;
    } else {
      newRating = star;
    }
    const clamped = newRating != null ? Math.max(0.5, Math.min(5, newRating)) : undefined;
    userData = setUserBookData(user.id, book.id, { rating: clamped });
  }

  function updateNotes(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { notes: textarea.value });
  }

  function toggleWishlist() {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { isWishlist: !userData?.isWishlist });
  }

  async function handleLend() {
    if (!user || !book) return;
    const name = await showPrompt({
      title: t('dialog.lend_title'),
      message: t('dialog.lend_message'),
      placeholder: t('dialog.lend_placeholder'),
      confirmLabel: t('dialog.lend_confirm')
    });
    if (!name) return;
    userData = setUserBookData(user.id, book.id, { lentTo: name, lentDate: new Date().toISOString() });
    showToast(t('toast.lent', { name }), 'success');
  }

  function handleReturn() {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { lentTo: undefined, lentDate: undefined });
    showToast(t('toast.returned'), 'success');
  }

  async function handleCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !book) return;
    try {
      const blob = await resizeImage(file);
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await setCoverBase64(book.id, base64);
      coverSrc = base64;
    } catch {
      showToast(t('add.error_save_failed'), 'error');
    }
  }

  async function handleDelete() {
    if (!book) return;
    const confirmed = await showConfirm({
      title: t('dialog.delete_title'),
      message: t('dialog.delete_message', { title: book.title }),
      confirmLabel: t('dialog.delete_confirm'),
      danger: true
    });
    if (!confirmed) return;
    deleteBook(book.id);
    showToast(t('toast.deleted'), 'info');
    goto(`${base}/`);
  }

  let progressPercent = $derived(
    userData?.currentPage && userData?.totalPages && userData.totalPages > 0
      ? Math.min(100, Math.round((userData.currentPage / userData.totalPages) * 100))
      : null
  );

  function updateProgress(field: 'currentPage' | 'totalPages', value: string) {
    if (!user || !book) return;
    const num = parseInt(value) || undefined;
    const updates: Record<string, unknown> = { [field]: num };

    if (field === 'currentPage' && num) {
      const today = new Date().toISOString().slice(0, 10);
      const history = [...(userData?.progressHistory || [])];
      const todayIdx = history.findIndex(h => h.date === today);
      if (todayIdx >= 0) {
        history[todayIdx] = { date: today, page: num };
      } else {
        history.push({ date: today, page: num });
      }
      updates.progressHistory = history.slice(-90);
    }

    userData = setUserBookData(user.id, book.id, updates);
  }

  function toggleShelf(shelf: Shelf) {
    if (!book) return;
    if (bookShelfIds.has(shelf.id)) {
      removeBookFromShelf(shelf.id, book.id);
      bookShelfIds.delete(shelf.id);
      bookShelfIds = new Set(bookShelfIds);
      showToast(t('toast.book_removed_from_shelf', { name: shelf.name }), 'info');
    } else {
      addBookToShelf(shelf.id, book.id);
      bookShelfIds.add(shelf.id);
      bookShelfIds = new Set(bookShelfIds);
      showToast(t('toast.book_added_to_shelf', { name: shelf.name }), 'success');
    }
  }

  let relatedBooks = $derived.by(() => {
    const current = book;
    if (!current) return [];
    const seen = new Set<string>([current.id]);
    const result: Book[] = [];
    if (current.seriesId) {
      for (const b of getBooksBySeries(current.seriesId)) {
        if (!seen.has(b.id)) { seen.add(b.id); result.push(b); }
      }
    }
    const allBooks = getBooks();
    for (const b of allBooks) {
      if (seen.has(b.id)) continue;
      if (b.authors.some(a => current.authors.includes(a))) {
        seen.add(b.id); result.push(b);
      }
    }
    for (const b of allBooks) {
      if (seen.has(b.id)) continue;
      if (b.categories.some(c => current.categories.includes(c))) {
        seen.add(b.id); result.push(b);
      }
    }
    return result.slice(0, 6);
  });

  function handleQuotesUpdate(quotes: { text: string; page?: number; note?: string }[]) {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { quotes });
  }

  function handleTagsUpdate(tags: string[]) {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { tags });
  }

  function handleAcquisitionUpdate(field: string, value: string) {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { [field]: value || undefined });
  }

  function handleRereadUpdate(readHistory: { dateStarted?: string; dateFinished?: string; rating?: number; notes?: string }[]) {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { readHistory });
  }

  function handleDnfUpdate(field: string, value: any) {
    if (!user || !book) return;
    userData = setUserBookData(user.id, book.id, { [field]: value });
  }

  let statusConfig = $derived({
    unread: { label: t('book.status_unread'), color: 'bg-warm-200 text-warm-700' },
    reading: { label: t('book.status_reading'), color: 'bg-accent/10 text-accent' },
    read: { label: t('book.status_read'), color: 'bg-sage-light text-sage' },
    dnf: { label: t('book.status_dnf'), color: 'bg-berry/10 text-berry' }
  });
</script>

{#if !book}
  <p class="text-ink-muted text-center py-12">{t('book.not_found')}</p>
{:else}
  <div class="max-w-lg mx-auto animate-fade-up">
    <button onclick={() => history.back()} class="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4 transition-colors">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      {t('common.back')}
    </button>

    {#if editing}
      <BookEditForm {book} {coverSrc} onSave={handleEditSave} onCancel={() => editing = false} />
    {:else}
      <div class="flex gap-6 mb-8">
        <div class="flex-shrink-0">
          <div class="w-32 h-44 rounded-lg overflow-hidden book-shadow-lg bg-warm-100">
            {#if coverSrc}
              <img src={coverSrc} alt={book.title} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-warm-100 to-warm-200 text-ink-muted text-xs text-center px-3 font-display">
                {book.title}
              </div>
            {/if}
          </div>
          <label class="block mt-2 text-xs text-accent cursor-pointer text-center font-medium hover:text-accent-dark transition-colors">
            {t('book.change_cover')}
            <input type="file" accept="image/*" class="hidden" onchange={handleCoverUpload} />
          </label>
        </div>

        <div class="flex flex-col justify-center min-w-0">
          <div class="flex items-start gap-1.5">
            <h1 class="font-display text-2xl font-bold text-ink tracking-tight leading-snug flex-1">{book.title}</h1>
            <button onclick={toggleWishlist} class="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all {userData?.isWishlist ? 'text-accent bg-accent/10' : 'text-warm-300 hover:text-accent hover:bg-accent/5'}" aria-label="{userData?.isWishlist ? t('book.wishlist_in') : t('book.wishlist_add')}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="{userData?.isWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button onclick={() => { if (!book) return; editing = true; }} class="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-warm-300 hover:text-accent hover:bg-accent/5 transition-colors" aria-label={t('book.edit')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            </button>
          </div>
          <p class="text-sm text-ink-muted mt-1">{book.authors.join(', ')}</p>
          {#if book.publisher || book.publishYear}
            <p class="text-xs text-ink-muted mt-1">
              {book.publisher || ''}{#if book.publisher && book.publishYear}, {/if}{book.publishYear || ''}
              {#if book.edition}<span class="text-warm-400"> · {book.edition}</span>{/if}
            </p>
          {/if}
          {#if book.isbn}<p class="text-xs text-warm-400 mt-1 font-mono">ISBN {book.isbn}</p>{/if}

          {#if book.categories.length}
            <div class="flex gap-1.5 mt-3 flex-wrap">
              {#each book.categories as cat}
                <span class="text-xs px-2.5 py-0.5 bg-warm-100 text-ink-muted rounded-full capitalize font-medium">{cat}</span>
              {/each}
            </div>
          {/if}

          {#if seriesName}
            <p class="text-xs text-accent mt-2 font-medium">
              {seriesName}{#if book.seriesOrder} &middot; {t('book.book_number', { n: book.seriesOrder })}{/if}
            </p>
          {/if}

          <div class="flex gap-0.5 mt-3" role="radiogroup" aria-label="Rating">
            {#each [1, 2, 3, 4, 5] as star}
              {@const rating = userData?.rating || 0}
              {@const isFull = rating >= star}
              {@const isHalf = !isFull && rating >= star - 0.5}
              <button
                class="star-btn {isFull ? 'star-active' : isHalf ? 'star-active opacity-50' : 'star-inactive'}"
                onclick={() => updateRating(star)}
                onkeydown={(e) => {
                  if (e.key === 'ArrowRight' && star < 5) updateRating(star + 1);
                  if (e.key === 'ArrowLeft' && star > 1) updateRating(star - 1);
                }}
                role="radio"
                aria-checked={rating === star || rating === star - 0.5}
                aria-label="{star} star{star > 1 ? 's' : ''}"
              >&#9733;</button>
            {/each}
            {#if userData?.rating}
              <span class="text-xs text-ink-muted ml-1 self-center">{userData.rating}</span>
            {/if}
          </div>
        </div>
      </div>

      <div class="mb-6">
        <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.status')}</h2>
        <div class="flex gap-2">
          {#each (['unread', 'reading', 'read', 'dnf'] as const) as status}
            <button
              class="tab-pill {userData?.status === status ? 'tab-pill-active' : 'tab-pill-inactive'}"
              onclick={() => updateStatus(status)}
            >{statusConfig[status].label}</button>
          {/each}
        </div>
      </div>

      {#if userData?.status === 'read'}
        <div class="mb-6 animate-fade-up">
          <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.date_read')}</h2>
          <div class="card p-4">
            <div class="flex gap-2 items-end">
              <label class="flex flex-col gap-1 flex-1">
                <span class="text-xs text-ink-muted">{t('book.date_read.precision')}</span>
                <select
                  class="input-field !py-1.5 text-sm"
                  value={userData?.dateRead ? (userData.dateRead.length <= 4 ? 'year' : userData.dateRead.length <= 7 ? 'month' : 'exact') : 'year'}
                  onchange={(e) => {
                    if (!user || !book) return;
                    const precision = (e.target as HTMLSelectElement).value;
                    const current = userData?.dateRead || '';
                    let newDate = '';
                    if (precision === 'year') newDate = current.slice(0, 4) || new Date().getFullYear().toString();
                    else if (precision === 'month') newDate = current.slice(0, 7) || new Date().toISOString().slice(0, 7);
                    else newDate = current.length > 10 ? current : (current.length === 7 ? current + '-01' : current.length === 4 ? current + '-01-01' : new Date().toISOString());
                    userData = setUserBookData(user.id, book.id, { dateRead: newDate });
                  }}
                >
                  <option value="exact">{t('book.date_read.exact')}</option>
                  <option value="month">{t('book.date_read.month')}</option>
                  <option value="year">{t('book.date_read.year')}</option>
                </select>
              </label>
              {#if userData?.dateRead}
                {@const precision = userData.dateRead.length <= 4 ? 'year' : userData.dateRead.length <= 7 ? 'month' : 'exact'}
                {#if precision === 'exact'}
                  <input
                    type="date"
                    value={userData.dateRead.slice(0, 10)}
                    onchange={(e) => { if (user && book) userData = setUserBookData(user.id, book.id, { dateRead: (e.target as HTMLInputElement).value }); }}
                    class="input-field !py-1.5 text-sm flex-1"
                  />
                {:else if precision === 'month'}
                  <input
                    type="month"
                    value={userData.dateRead.slice(0, 7)}
                    onchange={(e) => { if (user && book) userData = setUserBookData(user.id, book.id, { dateRead: (e.target as HTMLInputElement).value }); }}
                    class="input-field !py-1.5 text-sm flex-1"
                  />
                {:else}
                  <input
                    type="number"
                    min="1900"
                    max={new Date().getFullYear()}
                    value={userData.dateRead.slice(0, 4)}
                    onchange={(e) => { if (user && book) userData = setUserBookData(user.id, book.id, { dateRead: (e.target as HTMLInputElement).value }); }}
                    class="input-field !py-1.5 text-sm w-24"
                    placeholder="2020"
                  />
                {/if}
              {/if}
            </div>
          </div>
        </div>

        <!-- Re-read History -->
        <BookRereadHistory readHistory={userData?.readHistory || []} onUpdate={handleRereadUpdate} />
      {/if}

      {#if userData?.status === 'reading'}
        <div class="mb-6 animate-fade-up">
          <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.date_started')}</h2>
          <div class="card p-4">
            <input
              type="date"
              value={userData?.dateStarted?.slice(0, 10) || ''}
              onchange={(e) => { if (user && book) userData = setUserBookData(user.id, book.id, { dateStarted: (e.target as HTMLInputElement).value || undefined }); }}
              class="input-field !py-1.5 text-sm w-auto"
            />
          </div>
        </div>
        <div class="mb-6 animate-fade-up">
          <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.progress')}</h2>
          <div class="card p-4">
            <div class="flex gap-3 mb-3">
              <label class="flex-1 flex flex-col gap-1">
                <span class="text-xs text-ink-muted">{t('book.progress.current_page')}</span>
                <input
                  type="number"
                  min="0"
                  max={userData?.totalPages || undefined}
                  value={userData?.currentPage || ''}
                  onblur={(e) => updateProgress('currentPage', (e.target as HTMLInputElement).value)}
                  class="input-field !py-1.5 text-sm text-center"
                />
              </label>
              <label class="flex-1 flex flex-col gap-1">
                <span class="text-xs text-ink-muted">{t('book.progress.total_pages')}</span>
                <input
                  type="number"
                  min="1"
                  value={userData?.totalPages || ''}
                  onblur={(e) => updateProgress('totalPages', (e.target as HTMLInputElement).value)}
                  class="input-field !py-1.5 text-sm text-center"
                />
              </label>
            </div>
            {#if progressPercent !== null}
              <div class="flex items-center gap-3">
                <div class="flex-1 h-2 rounded-full bg-warm-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-accent transition-all duration-500 ease-out"
                    style="width: {progressPercent}%"
                  ></div>
                </div>
                <span class="text-xs font-medium text-accent flex-shrink-0">
                  {t('book.progress.percent', { percent: progressPercent })}
                </span>
              </div>
              {#if userData?.currentPage && userData?.totalPages}
                <p class="text-xs text-ink-muted mt-1.5">{t('book.progress.pages', { current: userData.currentPage, total: userData.totalPages })}</p>
              {/if}
            {/if}

            <!-- Progress sparkline -->
            {#if userData?.progressHistory && userData.progressHistory.length >= 2}
              {@const history = userData.progressHistory.slice(-14)}
              {@const maxPage = userData.totalPages || Math.max(...history.map(h => h.page))}
              {@const points = history.map((h, i) => `${(i / (history.length - 1)) * 100},${100 - (h.page / maxPage) * 100}`).join(' ')}
              <div class="mt-3">
                <p class="text-xs text-ink-muted mb-1">{t('book.progress.history')}</p>
                <svg viewBox="0 0 100 100" class="w-full h-12" preserveAspectRatio="none">
                  <polyline
                    points={points}
                    fill="none"
                    stroke="var(--color-accent)"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
                <div class="flex justify-between text-[9px] text-warm-400">
                  <span>{history[0].date.slice(5)}</span>
                  <span>{history[history.length - 1].date.slice(5)}</span>
                </div>
              </div>
            {/if}
          </div>
        </div>
      {/if}

      {#if userData?.status === 'dnf'}
        <BookDnfDetails dnfReason={userData?.dnfReason} dnfPage={userData?.dnfPage} onUpdate={handleDnfUpdate} />
      {/if}

      <div class="mb-6">
        <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.notes')}</h2>
        <textarea
          class="input-field resize-none h-24 text-sm"
          placeholder={t('book.notes_placeholder')}
          value={userData?.notes || ''}
          onblur={updateNotes}
        ></textarea>
      </div>

      <!-- Quotes -->
      <BookQuotes quotes={userData?.quotes || []} onUpdate={handleQuotesUpdate} />

      <!-- Tags -->
      <BookTags tags={userData?.tags || []} onUpdate={handleTagsUpdate} />

      <!-- Acquisition -->
      <BookAcquisition
        acquiredFrom={userData?.acquiredFrom}
        acquiredPrice={userData?.acquiredPrice}
        acquiredDate={userData?.acquiredDate}
        onUpdate={handleAcquisitionUpdate}
      />

      <div class="mb-6">
        <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.lending')}</h2>
        {#if userData?.lentTo}
          <div class="card flex items-center justify-between p-4">
            <div>
              <span class="text-sm text-ink">{t('book.lent_to')} <strong class="font-semibold">{userData.lentTo}</strong></span>
            </div>
            <button class="text-sm text-accent font-medium hover:text-accent-dark transition-colors" onclick={handleReturn}>{t('book.return')}</button>
          </div>
        {:else}
          <button class="btn-secondary" onclick={handleLend}>
            {t('book.lend')}
          </button>
        {/if}
      </div>

      <div class="mb-6">
        <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('shelves.add_to')}</h2>
        {#if shelves.length > 0}
          <div class="flex gap-2 flex-wrap">
            {#each shelves as shelf}
              <button
                class="tab-pill !py-1 !px-3 !text-xs {bookShelfIds.has(shelf.id) ? 'tab-pill-active' : 'tab-pill-inactive'}"
                onclick={() => toggleShelf(shelf)}
              >{shelf.name}</button>
            {/each}
          </div>
        {:else}
          <a href="{base}/shelves" class="text-xs text-accent hover:text-accent-dark transition-colors font-medium">
            + {t('shelves.create')}
          </a>
        {/if}
      </div>

      <BookRelated books={relatedBooks} />

      <div class="mt-8 pt-6 border-t border-warm-100">
        <button
          class="text-xs text-warm-400 hover:text-berry transition-colors"
          onclick={handleDelete}
        >{t('book.delete')}</button>
      </div>
    {/if}
  </div>
{/if}
