<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import { getUserBooks, getLentBooks } from '$lib/services/userbooks';
  import { getBookById } from '$lib/services/books';
  import { q } from '$lib/db';
  import type { Book, UserBookData } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';
  import { t } from '$lib/i18n/index.svelte';

  let user = $derived(getCurrentUser());
  let tab = $state<'reading' | 'wishlist' | 'lent' | 'read' | 'dnf' | 'timeline'>('reading');

  const tabOrder: typeof tab[] = ['reading', 'wishlist', 'lent', 'read', 'dnf', 'timeline'];
  let books = $state<(UserBookData & { book: Book })[]>([]);
  let timelineGroups = $state<{ label: string; items: (UserBookData & { book: Book })[] }[]>([]);
  let loading = $state(true);
  let swipeDirection = $state<'left' | 'right' | null>(null);

  // Swipe detection
  let touchStartX = 0;
  let touchStartY = 0;

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function handleTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only trigger if horizontal swipe is dominant
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;

    const currentIndex = tabOrder.indexOf(tab);
    if (dx < 0 && currentIndex < tabOrder.length - 1) {
      // Swipe left -> next tab
      swipeDirection = 'left';
      tab = tabOrder[currentIndex + 1];
      loadTab();
    } else if (dx > 0 && currentIndex > 0) {
      // Swipe right -> previous tab
      swipeDirection = 'right';
      tab = tabOrder[currentIndex - 1];
      loadTab();
    }
    // Reset animation
    setTimeout(() => { swipeDirection = null; }, 300);
  }

  let unsub: (() => void)[] = [];
  let syncTimer: ReturnType<typeof setTimeout> | null = null;
  function debouncedLoadTab() {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => loadTab(), 300);
  }
  onMount(() => {
    loadTab();
    unsub = [q.observe('userBookData', debouncedLoadTab), q.observe('books', debouncedLoadTab)];
  });
  onDestroy(() => { unsub.forEach(f => f()); if (syncTimer) clearTimeout(syncTimer); });

  function parseDateLabel(dateRead: string | undefined): { sortKey: string; label: string } {
    if (!dateRead) return { sortKey: '0000', label: t('mine.timeline.unknown') };
    if (dateRead.length <= 4) return { sortKey: dateRead, label: dateRead };
    if (dateRead.length <= 7) {
      const [y, m] = dateRead.split('-');
      const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      return { sortKey: dateRead, label: monthName };
    }
    const d = new Date(dateRead);
    const monthName = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return { sortKey: dateRead.slice(0, 7), label: monthName };
  }

  function loadTab() {
    if (!user) return;
    loading = true;

    if (tab === 'timeline') {
      const data = getUserBooks(user.id, { status: 'read' });
      const enriched = data
        .map((d) => {
          const book = getBookById(d.bookId);
          return book ? { ...d, book } : null;
        })
        .filter(Boolean) as (UserBookData & { book: Book })[];

      // Group by date label
      const groups = new Map<string, { sortKey: string; label: string; items: (UserBookData & { book: Book })[] }>();
      for (const item of enriched) {
        const { sortKey, label } = parseDateLabel(item.dateRead);
        if (!groups.has(label)) groups.set(label, { sortKey, label, items: [] });
        groups.get(label)!.items.push(item);
      }

      // Sort groups: newest first, "unknown" last
      timelineGroups = [...groups.values()].sort((a, b) => {
        if (a.sortKey === '0000') return 1;
        if (b.sortKey === '0000') return -1;
        return b.sortKey.localeCompare(a.sortKey);
      });

      books = [];
      loading = false;
      return;
    }

    let data: UserBookData[];

    if (tab === 'reading') {
      data = getUserBooks(user.id, { status: 'reading' });
    } else if (tab === 'wishlist') {
      data = getUserBooks(user.id, { isWishlist: true });
    } else if (tab === 'lent') {
      data = getLentBooks(user.id);
    } else if (tab === 'dnf') {
      data = getUserBooks(user.id, { status: 'dnf' });
    } else {
      data = getUserBooks(user.id, { status: 'read' });
    }

    const enriched = data.map((d) => {
      const book = getBookById(d.bookId);
      return book ? { ...d, book } : null;
    });
    books = enriched.filter(Boolean) as (UserBookData & { book: Book })[];
    loading = false;
  }
</script>

<div class="animate-fade-up">
  <div class="mb-4">
    <h1 class="font-display text-2xl font-bold text-ink tracking-tight">{t('mine.title')}</h1>
  </div>

  <div class="flex gap-2 mb-4 overflow-x-auto pb-1">
    {#each [
      { key: 'reading', label: t('mine.reading') },
      { key: 'read', label: t('mine.finished') },
      { key: 'dnf', label: t('mine.dnf') },
      { key: 'wishlist', label: t('mine.wishlist') },
      { key: 'lent', label: t('mine.lent') },
      { key: 'timeline', label: t('mine.timeline') }
    ] as tab_item}
      <button
        class="tab-pill {tab === tab_item.key ? 'tab-pill-active' : 'tab-pill-inactive'}"
        onclick={() => { tab = tab_item.key as typeof tab; loadTab(); }}
      >{tab_item.label}</button>
    {/each}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="swipe-content {swipeDirection === 'left' ? 'slide-from-right' : swipeDirection === 'right' ? 'slide-from-left' : ''}"
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
  {#if loading}
    <div class="flex justify-center py-10">
      <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
    </div>
  {:else if books.length === 0 && tab !== 'timeline'}
    <div class="text-center py-10">
      <div class="w-16 h-16 rounded-2xl bg-warm-100 mx-auto mb-4 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
      </div>
      <p class="font-display text-lg text-ink-light mb-1">{t('mine.empty')}</p>
    </div>
  {:else if tab === 'timeline'}
    {#if timelineGroups.length === 0}
      <div class="text-center py-10">
        <div class="w-16 h-16 rounded-2xl bg-warm-100 mx-auto mb-4 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
        </div>
        <p class="font-display text-lg text-ink-light mb-1">{t('mine.empty')}</p>
      </div>
    {:else}
      <div class="flex flex-col gap-6">
        {#each timelineGroups as group}
          <div>
            <div class="flex items-center gap-3 mb-3">
              <h3 class="text-xs font-semibold text-ink-muted uppercase tracking-wider">{group.label}</h3>
              <div class="flex-1 h-px bg-warm-100"></div>
              <span class="text-xs text-warm-400">{group.items.length}</span>
            </div>
            <div class="flex flex-col gap-2">
              {#each group.items as item}
                <button
                  class="card flex items-center gap-3 p-3 text-left hover:shadow-md transition-shadow w-full"
                  onclick={() => goto(`${base}/book/${item.bookId}`)}
                >
                  <div class="w-10 h-14 rounded overflow-hidden book-shadow bg-warm-100 flex-shrink-0">
                    {#if item.book.coverUrl}
                      <img src={item.book.coverUrl} alt={item.book.title} class="w-full h-full object-cover" />
                    {/if}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-display text-sm font-semibold text-ink truncate">{item.book.title}</div>
                    <div class="text-xs text-ink-muted truncate">{(item.book.authors || []).join(', ')}</div>
                  </div>
                  {#if item.rating}
                    <span class="text-xs text-gold flex-shrink-0">{'★'.repeat(item.rating)}</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {:else}
    {#if tab === 'lent'}
      <div class="flex flex-col gap-2">
        {#each books as item, i}
          <button
            class="card flex items-center gap-3 p-3 text-left hover:shadow-md transition-shadow w-full animate-fade-up"
            style="animation-delay: {i * 40}ms"
            onclick={() => goto(`${base}/book/${item.bookId}`)}
          >
            <div class="w-10 h-14 rounded overflow-hidden book-shadow bg-warm-100 flex-shrink-0">
              {#if item.book.coverUrl}
                <img src={item.book.coverUrl} alt={item.book.title} class="w-full h-full object-cover" />
              {/if}
            </div>
            <div class="min-w-0">
              <div class="font-display text-sm font-semibold text-ink truncate">{item.book.title}</div>
              <div class="text-xs text-ink-muted">{t('mine.lent_to')} <span class="font-medium text-accent">{item.lentTo}</span></div>
            </div>
          </button>
        {/each}
      </div>
    {:else}
      <div class="flex flex-wrap gap-x-4 gap-y-6">
        {#each books as item, i}
          <div style={i < 20 ? `animation-delay: ${i * 40}ms` : ''} class={i < 20 ? 'animate-fade-up' : ''}>
            <BookCard book={item.book} onclick={() => goto(`${base}/book/${item.bookId}`)} />
          </div>
        {/each}
      </div>
    {/if}
  {/if}
  </div>
</div>

<style>
  .swipe-content {
    min-height: 200px;
  }
  .slide-from-right {
    animation: slideFromRight 0.3s ease-out;
  }
  .slide-from-left {
    animation: slideFromLeft 0.3s ease-out;
  }
  @keyframes slideFromRight {
    from { transform: translateX(40px); opacity: 0.5; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideFromLeft {
    from { transform: translateX(-40px); opacity: 0.5; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
