<script lang="ts">
  import { page } from '$app/state';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import { getYearInReview, getAvailableYears, type YearInReview } from '$lib/services/stats';
  import { t } from '$lib/i18n/index.svelte';

  let user = $derived(getCurrentUser());
  let review = $state<YearInReview | null>(null);
  let loading = $state(true);
  let availableYears = $state<number[]>([]);

  let year = $derived(parseInt((page.params as any).year));

  onMount(() => {
    if (user) {
      review = getYearInReview(user.id, year);
      availableYears = getAvailableYears(user.id);
    }
    loading = false;
  });

  function maxCount(arr: { count: number }[]): number {
    return Math.max(1, ...arr.map(a => a.count));
  }
</script>

<div class="max-w-lg mx-auto animate-fade-up">
  <button onclick={() => history.back()} class="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-4 transition-colors">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
    {t('common.back')}
  </button>

  {#if loading}
    <div class="flex justify-center py-16">
      <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
    </div>
  {:else if !review}
    <div class="text-center py-16">
      <p class="font-display text-lg text-ink-light mb-1">{t('review.no_data')}</p>
      <p class="text-sm text-ink-muted">{t('review.no_data_desc', { year: year.toString() })}</p>
    </div>
  {:else}
    <!-- Hero -->
    <div class="text-center mb-8">
      <p class="text-xs font-semibold text-accent uppercase tracking-widest mb-2">{t('review.title')}</p>
      <h1 class="font-display text-5xl font-bold text-ink tracking-tight">{year}</h1>
    </div>

    <!-- Big numbers -->
    <div class="grid grid-cols-3 gap-3 mb-8">
      <div class="card p-4 text-center">
        <div class="font-display text-3xl font-bold text-accent">{review.totalRead}</div>
        <div class="text-[10px] text-ink-muted uppercase tracking-wider mt-1">{t('review.books')}</div>
      </div>
      <div class="card p-4 text-center">
        <div class="font-display text-3xl font-bold text-sage">{review.totalPages > 0 ? review.totalPages.toLocaleString() : '—'}</div>
        <div class="text-[10px] text-ink-muted uppercase tracking-wider mt-1">{t('review.pages')}</div>
      </div>
      <div class="card p-4 text-center">
        <div class="font-display text-3xl font-bold text-gold">{review.averageRating > 0 ? review.averageRating.toFixed(1) : '—'}</div>
        <div class="text-[10px] text-ink-muted uppercase tracking-wider mt-1">{t('review.avg_rating')}</div>
      </div>
    </div>

    <!-- Highlights -->
    <div class="card p-5 mb-6">
      <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">{t('review.highlights')}</h2>
      <div class="flex flex-col gap-3">
        {#if review.favoriteBook}
          <div class="flex items-center gap-3">
            <span class="text-gold text-lg">★</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.favorite')}</div>
              <div class="text-sm font-medium text-ink">{review.favoriteBook.title}</div>
            </div>
          </div>
        {/if}
        {#if review.topGenre}
          <div class="flex items-center gap-3">
            <span class="text-accent text-lg">◆</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.top_genre')}</div>
              <div class="text-sm font-medium text-ink capitalize">{review.topGenre}</div>
            </div>
          </div>
        {/if}
        {#if review.topAuthor}
          <div class="flex items-center gap-3">
            <span class="text-sage text-lg">✦</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.top_author')}</div>
              <div class="text-sm font-medium text-ink">{review.topAuthor}</div>
            </div>
          </div>
        {/if}
        {#if review.longestBook}
          <div class="flex items-center gap-3">
            <span class="text-ink-muted text-lg">▮</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.longest')}</div>
              <div class="text-sm font-medium text-ink">{review.longestBook.title} <span class="text-ink-muted">({review.longestBook.pages} {t('review.pages_unit')})</span></div>
            </div>
          </div>
        {/if}
        {#if review.shortestBook && review.longestBook}
          <div class="flex items-center gap-3">
            <span class="text-ink-muted text-lg">▯</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.shortest')}</div>
              <div class="text-sm font-medium text-ink">{review.shortestBook.title} <span class="text-ink-muted">({review.shortestBook.pages} {t('review.pages_unit')})</span></div>
            </div>
          </div>
        {/if}
        {#if review.fastestRead}
          <div class="flex items-center gap-3">
            <span class="text-accent text-lg">⚡</span>
            <div>
              <div class="text-xs text-ink-muted">{t('review.fastest')}</div>
              <div class="text-sm font-medium text-ink">{review.fastestRead.title} <span class="text-ink-muted">({review.fastestRead.days} {t('review.days')})</span></div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Monthly chart -->
    <div class="mb-8">
      <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">{t('stats.books_per_month')}</h2>
      <div class="card p-4">
        <div class="flex items-end gap-1.5 h-28">
          {#each review.booksPerMonth as item}
            {@const height = item.count > 0 ? Math.max(8, (item.count / maxCount(review.booksPerMonth)) * 100) : 0}
            <div class="flex-1 flex flex-col items-center gap-1.5">
              <span class="text-xs text-ink-muted font-medium">{item.count || ''}</span>
              <div
                class="w-full rounded-t transition-all duration-500 {item.count > 0 ? 'bg-accent' : 'bg-warm-100'}"
                style="height: {item.count > 0 ? height : 4}%"
              ></div>
              <span class="text-[8px] text-warm-400 whitespace-nowrap">{item.month.split(' ')[0]}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Rating distribution -->
    {#if review.ratingDistribution.some(c => c > 0)}
      <div class="mb-8">
        <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-4">{t('stats.rating_distribution')}</h2>
        <div class="card p-4 flex flex-col gap-2.5">
          {#each [5, 4, 3, 2, 1] as star}
            {@const count = review.ratingDistribution[star - 1]}
            {@const max = Math.max(1, ...review.ratingDistribution)}
            <div class="flex items-center gap-3">
              <span class="text-xs text-gold w-5 text-right font-medium">{star}★</span>
              <div class="flex-1 h-3 rounded-full bg-warm-100 overflow-hidden">
                <div
                  class="h-full rounded-full bg-gold transition-all duration-500"
                  style="width: {count > 0 ? (count / max) * 100 : 0}%"
                ></div>
              </div>
              <span class="text-xs text-ink-muted w-6 text-right">{count}</span>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Nav to other years -->
    {#if availableYears.length > 1}
      <div class="flex justify-center gap-2 mb-8">
        {#each availableYears as y}
          <a
            href="{base}/review/{y}"
            class="tab-pill !py-1 !px-3 !text-xs {y === year ? 'tab-pill-active' : 'tab-pill-inactive'}"
          >{y}</a>
        {/each}
      </div>
    {/if}
  {/if}
</div>
