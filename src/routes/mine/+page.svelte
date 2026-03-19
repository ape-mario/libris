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
  let tab = $state<'reading' | 'wishlist' | 'lent' | 'read' | 'dnf'>('reading');

  const tabOrder: typeof tab[] = ['reading', 'wishlist', 'lent', 'read', 'dnf'];
  let books = $state<(UserBookData & { book: Book })[]>([]);
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

  function loadTab() {
    if (!user) return;
    loading = true;
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
  <div class="mb-6">
    <h1 class="font-display text-2xl font-bold text-ink tracking-tight">{t('mine.title')}</h1>
  </div>

  <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
    {#each [
      { key: 'reading', label: t('mine.reading') },
      { key: 'read', label: t('mine.finished') },
      { key: 'dnf', label: t('mine.dnf') },
      { key: 'wishlist', label: t('mine.wishlist') },
      { key: 'lent', label: t('mine.lent') }
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
    <div class="flex justify-center py-16">
      <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
    </div>
  {:else if books.length === 0}
    <div class="text-center py-16">
      <div class="mx-auto mb-4 flex items-center justify-center">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- Armchair reading scene -->
          <!-- Book being read -->
          <path d="M30 50 C30 38, 40 34, 40 40" style="stroke: var(--color-accent); stroke-width: 1.5; fill: var(--color-warm-100)"/>
          <path d="M50 50 C50 38, 40 34, 40 40" style="stroke: var(--color-accent); stroke-width: 1.5; fill: var(--color-warm-100)"/>
          <line x1="40" y1="40" x2="40" y2="50" style="stroke: var(--color-accent); stroke-width: 1"/>
          <!-- Page lines left -->
          <line x1="33" y1="42" x2="38" y2="43" style="stroke: var(--color-warm-300); stroke-width: 0.75"/>
          <line x1="33" y1="45" x2="38" y2="45.5" style="stroke: var(--color-warm-300); stroke-width: 0.75"/>
          <!-- Page lines right -->
          <line x1="42" y1="43" x2="47" y2="42" style="stroke: var(--color-warm-300); stroke-width: 0.75"/>
          <line x1="42" y1="45.5" x2="47" y2="45" style="stroke: var(--color-warm-300); stroke-width: 0.75"/>
          <!-- Steam/warmth lines (cozy reading) -->
          <path d="M22 30 Q24 26, 22 22" style="stroke: var(--color-warm-300); stroke-width: 1; fill: none; opacity: 0.6"/>
          <path d="M26 32 Q28 28, 26 24" style="stroke: var(--color-warm-300); stroke-width: 1; fill: none; opacity: 0.6"/>
          <!-- Cup -->
          <rect x="20" y="32" width="10" height="10" rx="2" style="fill: var(--color-warm-200); stroke: var(--color-warm-300); stroke-width: 1"/>
          <path d="M30 35 Q34 35, 34 38 Q34 41, 30 41" style="stroke: var(--color-warm-300); stroke-width: 1; fill: none"/>
          <!-- Heart -->
          <path d="M56 28 C56 24, 60 22, 62 26 C64 22, 68 24, 68 28 C68 33, 62 37, 62 37 C62 37, 56 33, 56 28Z" style="fill: var(--color-accent); opacity: 0.3"/>
        </svg>
      </div>
      <p class="text-sm text-ink-muted">{t('mine.empty')}</p>
    </div>
  {:else}
    {#if tab === 'lent'}
      <div class="flex flex-col gap-2">
        {#each books as item, i}
          <button
            class="card flex items-center gap-4 p-4 text-left hover:shadow-md transition-shadow w-full animate-fade-up"
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
