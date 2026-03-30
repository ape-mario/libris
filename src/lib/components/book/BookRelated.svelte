<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { t } from '$lib/i18n/index.svelte';
  import type { Book } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  interface Props {
    books: Book[];
  }

  let { books }: Props = $props();
</script>

{#if books.length > 0}
  <div class="mb-6">
    <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.related')}</h2>
    <div class="flex gap-4 overflow-x-auto pb-2">
      {#each books as related}
        <div class="flex-shrink-0">
          <BookCard book={related} onclick={() => goto(`${base}/book/${related.id}`)} />
        </div>
      {/each}
    </div>
  </div>
{/if}
