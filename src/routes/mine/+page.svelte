<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import { getUserBooks, getLentBooks } from '$lib/services/userbooks';
  import { getBookById } from '$lib/services/books';
  import type { Book, UserBookData } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  let user = $derived(getCurrentUser());
  let tab = $state<'reading' | 'wishlist' | 'lent' | 'read'>('reading');

  let books = $state<(UserBookData & { book: Book })[]>([]);
  let loading = $state(true);

  onMount(() => loadTab());

  async function loadTab() {
    if (!user) return;
    loading = true;
    let data: UserBookData[];

    if (tab === 'reading') {
      data = await getUserBooks(user.id, { status: 'reading' });
    } else if (tab === 'wishlist') {
      data = await getUserBooks(user.id, { isWishlist: true });
    } else if (tab === 'lent') {
      data = await getLentBooks(user.id);
    } else {
      data = await getUserBooks(user.id, { status: 'read' });
    }

    const enriched = await Promise.all(
      data.map(async (d) => {
        const book = await getBookById(d.bookId);
        return book ? { ...d, book } : null;
      })
    );
    books = enriched.filter(Boolean) as (UserBookData & { book: Book })[];
    loading = false;
  }
</script>

<h1 class="text-xl font-bold mb-4">My Books</h1>

<div class="flex gap-2 mb-6 overflow-x-auto">
  {#each [
    { key: 'reading', label: 'Reading' },
    { key: 'read', label: 'Read' },
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'lent', label: 'Lent Out' }
  ] as t}
    <button
      class="px-4 py-2 rounded-lg text-sm whitespace-nowrap {tab === t.key ? 'bg-blue-600' : 'bg-slate-800'}"
      onclick={() => { tab = t.key as typeof tab; loadTab(); }}
    >{t.label}</button>
  {/each}
</div>

{#if loading}
  <p class="text-slate-400">Loading...</p>
{:else if books.length === 0}
  <p class="text-slate-400">Nothing here yet.</p>
{:else}
  {#if tab === 'lent'}
    {#each books as item}
      <div class="flex items-center gap-3 p-3 mb-2 bg-slate-800 rounded-lg">
        <button class="flex-1 text-left" onclick={() => goto(`/book/${item.bookId}`)}>
          <div class="font-medium">{item.book.title}</div>
          <div class="text-sm text-slate-400">Lent to {item.lentTo}</div>
        </button>
      </div>
    {/each}
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {#each books as item}
        <BookCard book={item.book} onclick={() => goto(`/book/${item.bookId}`)} />
      {/each}
    </div>
  {/if}
{/if}
