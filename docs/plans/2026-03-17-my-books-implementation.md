# My Books PWA — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first PWA for managing a personal book collection with multi-user support, barcode scanning, and Open Library integration.

**Architecture:** SvelteKit 2 static build with Dexie.js (IndexedDB) for local storage, Tailwind CSS 4 for styling, and @vite-pwa/sveltekit for installability. No backend — everything runs client-side.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Tailwind CSS 4, Dexie.js 4, QuaggaJS 2, @vite-pwa/sveltekit, @sveltejs/adapter-static

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `src/app.html`, `src/app.css`, `static/manifest.json`, `static/favicon.png`

**Step 1: Create SvelteKit project**

```bash
cd D:/dev/my-books
npx sv create . --template minimal --types ts --no-add-ons --no-install
```

If prompted, select SvelteKit minimal, TypeScript, no extras.

**Step 2: Install dependencies**

```bash
npm install
npm install dexie@4
npm install -D tailwindcss@4 @tailwindcss/vite @sveltejs/adapter-static @vite-pwa/sveltekit
```

**Step 3: Configure adapter-static**

Edit `svelte.config.js`:

```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: 'index.html'
    })
  }
};

export default config;
```

**Step 4: Configure Vite with Tailwind and PWA**

Edit `vite.config.ts`:

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'My Books',
        short_name: 'MyBooks',
        description: 'Personal book collection manager',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}']
      }
    })
  ]
});
```

**Step 5: Set up Tailwind CSS**

Edit `src/app.css`:

```css
@import 'tailwindcss';
```

Ensure `src/app.html` includes `<link rel="stylesheet" href="%sveltekit.assets%/app.css">` or that the layout imports it.

**Step 6: Create placeholder PWA icons**

Create simple placeholder `static/icon-192.png` and `static/icon-512.png` (can be replaced later with proper icons).

**Step 7: Add layout with CSS import**

Create `src/routes/+layout.svelte`:

```svelte
<script>
  import '../app.css';
  let { children } = $props();
</script>

{@render children()}
```

**Step 8: Verify it runs**

```bash
npm run dev
```

Expected: App loads at `http://localhost:5173` with no errors.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with Tailwind, PWA, and static adapter"
```

---

## Task 2: Database Layer (Dexie.js)

**Files:**
- Create: `src/lib/db/index.ts`, `src/lib/db/types.ts`
- Test: `src/lib/db/db.test.ts`

**Step 1: Define TypeScript types**

Create `src/lib/db/types.ts`:

```ts
export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Book {
  id: string;
  title: string;
  authors: string[];
  isbn?: string;
  coverUrl?: string;
  coverBlob?: Blob;
  categories: string[];
  seriesId?: string;
  seriesOrder?: number;
  dateAdded: Date;
  dateModified: Date;
}

export interface UserBookData {
  id: string;
  userId: string;
  bookId: string;
  status: 'unread' | 'reading' | 'read';
  rating?: number;
  notes?: string;
  lentTo?: string;
  lentDate?: Date;
  isWishlist: boolean;
}

export interface Series {
  id: string;
  name: string;
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  color?: string;
}
```

**Step 2: Create Dexie database**

Create `src/lib/db/index.ts`:

```ts
import Dexie, { type EntityTable } from 'dexie';
import type { User, Book, UserBookData, Series, Category } from './types';

const db = new Dexie('MyBooksDB') as Dexie & {
  users: EntityTable<User, 'id'>;
  books: EntityTable<Book, 'id'>;
  userBookData: EntityTable<UserBookData, 'id'>;
  series: EntityTable<Series, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  users: 'id, name',
  books: 'id, title, isbn, *categories, seriesId, dateAdded',
  userBookData: 'id, [userId+bookId], userId, bookId, status, isWishlist',
  series: 'id, name',
  categories: 'id, name'
});

export { db };
export type { User, Book, UserBookData, Series, Category };
```

**Step 3: Install test dependencies and write tests**

```bash
npm install -D vitest fake-indexeddb
```

Create `src/lib/db/db.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

beforeEach(async () => {
  await db.users.clear();
  await db.books.clear();
  await db.userBookData.clear();
  await db.series.clear();
  await db.categories.clear();
});

describe('Database', () => {
  it('should add and retrieve a user', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    const user = await db.users.get('u1');
    expect(user?.name).toBe('Alice');
  });

  it('should add and retrieve a book', async () => {
    const book = {
      id: 'b1',
      title: 'Dune',
      authors: ['Frank Herbert'],
      categories: ['sci-fi'],
      dateAdded: new Date(),
      dateModified: new Date()
    };
    await db.books.add(book);
    const result = await db.books.get('b1');
    expect(result?.title).toBe('Dune');
    expect(result?.authors).toEqual(['Frank Herbert']);
  });

  it('should add user book data linked to user and book', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.books.add({
      id: 'b1', title: 'Dune', authors: ['Frank Herbert'],
      categories: [], dateAdded: new Date(), dateModified: new Date()
    });
    await db.userBookData.add({
      id: 'ubd1', userId: 'u1', bookId: 'b1',
      status: 'reading', isWishlist: false
    });

    const data = await db.userBookData.where({ userId: 'u1', bookId: 'b1' }).first();
    expect(data?.status).toBe('reading');
  });

  it('should query books by category using multi-entry index', async () => {
    await db.books.add({
      id: 'b1', title: 'Watchmen', authors: ['Alan Moore'],
      categories: ['comics', 'sci-fi'], dateAdded: new Date(), dateModified: new Date()
    });
    await db.books.add({
      id: 'b2', title: 'Dune', authors: ['Frank Herbert'],
      categories: ['sci-fi', 'novel'], dateAdded: new Date(), dateModified: new Date()
    });

    const sciFiBooks = await db.books.where('categories').equals('sci-fi').toArray();
    expect(sciFiBooks).toHaveLength(2);

    const comics = await db.books.where('categories').equals('comics').toArray();
    expect(comics).toHaveLength(1);
    expect(comics[0].title).toBe('Watchmen');
  });

  it('should add and retrieve a series with books', async () => {
    await db.series.add({ id: 's1', name: 'Lord of the Rings' });
    await db.books.add({
      id: 'b1', title: 'Fellowship of the Ring', authors: ['J.R.R. Tolkien'],
      categories: ['fantasy'], seriesId: 's1', seriesOrder: 1,
      dateAdded: new Date(), dateModified: new Date()
    });

    const seriesBooks = await db.books.where('seriesId').equals('s1').toArray();
    expect(seriesBooks).toHaveLength(1);
    expect(seriesBooks[0].seriesOrder).toBe(1);
  });
});
```

**Step 4: Configure Vitest**

Add to `vite.config.ts` (inside defineConfig):

```ts
test: {
  include: ['src/**/*.test.ts'],
  environment: 'jsdom'
}
```

Or create `vitest.config.ts` if preferred. Also add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 5: Run tests**

```bash
npx vitest run
```

Expected: All 5 tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Dexie.js database layer with types and tests"
```

---

## Task 3: User Profile System

**Files:**
- Create: `src/lib/stores/user.svelte.ts`, `src/lib/components/ProfilePicker.svelte`
- Test: `src/lib/stores/user.test.ts`

**Step 1: Write tests for user store**

Create `src/lib/stores/user.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';

beforeEach(async () => {
  await db.users.clear();
});

describe('User management', () => {
  it('should create a new user', async () => {
    const id = crypto.randomUUID();
    await db.users.add({ id, name: 'Alice', avatar: '👩' });
    const user = await db.users.get(id);
    expect(user?.name).toBe('Alice');
  });

  it('should list all users', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.users.add({ id: 'u2', name: 'Bob' });
    const users = await db.users.toArray();
    expect(users).toHaveLength(2);
  });

  it('should delete user and their book data', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.userBookData.add({
      id: 'ubd1', userId: 'u1', bookId: 'b1',
      status: 'unread', isWishlist: false
    });

    await db.userBookData.where('userId').equals('u1').delete();
    await db.users.delete('u1');

    expect(await db.users.get('u1')).toBeUndefined();
    expect(await db.userBookData.where('userId').equals('u1').count()).toBe(0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/stores/user.test.ts
```

Expected: PASS (these test the DB layer directly, which already exists).

**Step 3: Create user store**

Create `src/lib/stores/user.svelte.ts`:

```ts
import { db, type User } from '$lib/db';

let currentUser = $state<User | null>(null);

export function getCurrentUser(): User | null {
  return currentUser;
}

export function setCurrentUser(user: User | null) {
  currentUser = user;
  if (user) {
    localStorage.setItem('currentUserId', user.id);
  } else {
    localStorage.removeItem('currentUserId');
  }
}

export async function restoreUser(): Promise<User | null> {
  const id = localStorage.getItem('currentUserId');
  if (id) {
    const user = await db.users.get(id);
    if (user) {
      currentUser = user;
      return user;
    }
  }
  return null;
}

export async function createUser(name: string, avatar?: string): Promise<User> {
  const user: User = { id: crypto.randomUUID(), name, avatar };
  await db.users.add(user);
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  await db.userBookData.where('userId').equals(id).delete();
  await db.users.delete(id);
  if (currentUser?.id === id) {
    setCurrentUser(null);
  }
}

export async function getAllUsers(): Promise<User[]> {
  return db.users.toArray();
}
```

**Step 4: Create ProfilePicker component**

Create `src/lib/components/ProfilePicker.svelte`:

```svelte
<script lang="ts">
  import { getAllUsers, createUser, setCurrentUser, type User } from '$lib/stores/user.svelte';
  import { onMount } from 'svelte';

  let users = $state<User[]>([]);
  let newName = $state('');
  let showCreate = $state(false);

  onMount(async () => {
    users = await getAllUsers();
  });

  async function handleSelect(user: User) {
    setCurrentUser(user);
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    const user = await createUser(newName.trim());
    users = await getAllUsers();
    setCurrentUser(user);
    newName = '';
    showCreate = false;
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
  <h1 class="text-2xl font-bold mb-8">Who's reading?</h1>

  <div class="flex gap-6 flex-wrap justify-center mb-8">
    {#each users as user}
      <button
        class="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-800 transition"
        onclick={() => handleSelect(user)}
      >
        <div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl">
          {user.avatar || user.name[0].toUpperCase()}
        </div>
        <span class="text-sm">{user.name}</span>
      </button>
    {/each}

    <button
      class="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-800 transition"
      onclick={() => showCreate = true}
    >
      <div class="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center text-3xl border-2 border-dashed border-slate-500">
        +
      </div>
      <span class="text-sm">Add Profile</span>
    </button>
  </div>

  {#if showCreate}
    <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); handleCreate(); }}>
      <input
        type="text"
        bind:value={newName}
        placeholder="Enter name"
        class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
      />
      <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-500">
        Create
      </button>
    </form>
  {/if}
</div>
```

**Step 5: Verify app still runs**

```bash
npm run dev
```

Expected: No errors. Profile picker not wired up to routes yet (that's Task 5).

**Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add user profile store and profile picker component"
```

---

## Task 4: Book CRUD Service

**Files:**
- Create: `src/lib/services/books.ts`, `src/lib/services/covers.ts`
- Test: `src/lib/services/books.test.ts`, `src/lib/services/covers.test.ts`

**Step 1: Write failing tests for book service**

Create `src/lib/services/books.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { addBook, updateBook, deleteBook, getBooks, getBookById, searchBooks } from './books';

beforeEach(async () => {
  await db.books.clear();
  await db.userBookData.clear();
  await db.categories.clear();
  await db.series.clear();
});

describe('Book service', () => {
  it('should add a book with auto-generated fields', async () => {
    const book = await addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: ['sci-fi'] });
    expect(book.id).toBeDefined();
    expect(book.dateAdded).toBeInstanceOf(Date);
    expect(book.dateModified).toBeInstanceOf(Date);
  });

  it('should detect duplicate by ISBN', async () => {
    await addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: [], isbn: '9780441013593' });
    const duplicate = await addBook({ title: 'Dune 2', authors: ['Frank Herbert'], categories: [], isbn: '9780441013593' });
    expect(duplicate).toBeNull();
  });

  it('should update a book', async () => {
    const book = await addBook({ title: 'Duen', authors: ['Frank Herbert'], categories: [] });
    await updateBook(book!.id, { title: 'Dune' });
    const updated = await getBookById(book!.id);
    expect(updated?.title).toBe('Dune');
  });

  it('should delete a book and its user data', async () => {
    const book = await addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: [] });
    await db.userBookData.add({
      id: 'ubd1', userId: 'u1', bookId: book!.id, status: 'reading', isWishlist: false
    });
    await deleteBook(book!.id);
    expect(await getBookById(book!.id)).toBeUndefined();
    expect(await db.userBookData.where('bookId').equals(book!.id).count()).toBe(0);
  });

  it('should search books by title', async () => {
    await addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: [] });
    await addBook({ title: 'Neuromancer', authors: ['William Gibson'], categories: [] });
    const results = await searchBooks('dune');
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Dune');
  });

  it('should get all books sorted by dateAdded desc', async () => {
    await addBook({ title: 'A', authors: [], categories: [] });
    await addBook({ title: 'B', authors: [], categories: [] });
    const books = await getBooks();
    expect(books[0].title).toBe('B');
    expect(books[1].title).toBe('A');
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/services/books.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement book service**

Create `src/lib/services/books.ts`:

```ts
import { db, type Book } from '$lib/db';

type NewBook = Pick<Book, 'title' | 'authors' | 'categories'> &
  Partial<Pick<Book, 'isbn' | 'coverUrl' | 'coverBlob' | 'seriesId' | 'seriesOrder'>>;

export async function addBook(data: NewBook): Promise<Book | null> {
  if (data.isbn) {
    const existing = await db.books.where('isbn').equals(data.isbn).first();
    if (existing) return null;
  }

  const book: Book = {
    id: crypto.randomUUID(),
    title: data.title,
    authors: data.authors,
    isbn: data.isbn,
    coverUrl: data.coverUrl,
    coverBlob: data.coverBlob,
    categories: data.categories,
    seriesId: data.seriesId,
    seriesOrder: data.seriesOrder,
    dateAdded: new Date(),
    dateModified: new Date()
  };

  await db.books.add(book);
  return book;
}

export async function updateBook(id: string, data: Partial<Omit<Book, 'id'>>): Promise<void> {
  await db.books.update(id, { ...data, dateModified: new Date() });
}

export async function deleteBook(id: string): Promise<void> {
  await db.userBookData.where('bookId').equals(id).delete();
  await db.books.delete(id);
}

export async function getBookById(id: string): Promise<Book | undefined> {
  return db.books.get(id);
}

export async function getBooks(): Promise<Book[]> {
  return db.books.orderBy('dateAdded').reverse().toArray();
}

export async function searchBooks(query: string): Promise<Book[]> {
  const lower = query.toLowerCase();
  return db.books.filter(
    (book) =>
      book.title.toLowerCase().includes(lower) ||
      book.authors.some((a) => a.toLowerCase().includes(lower))
  ).toArray();
}

export async function getBooksByCategory(category: string): Promise<Book[]> {
  return db.books.where('categories').equals(category).toArray();
}

export async function getBooksBySeries(seriesId: string): Promise<Book[]> {
  return db.books.where('seriesId').equals(seriesId).sortBy('seriesOrder');
}
```

**Step 4: Write cover service**

Create `src/lib/services/covers.ts`:

```ts
const MAX_WIDTH = 400;
const JPEG_QUALITY = 0.8;

export async function resizeImage(file: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
}

export async function fetchCoverFromOpenLibrary(isbn: string): Promise<string | null> {
  const url = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
  try {
    const res = await fetch(url);
    if (res.ok) return url;
    return null;
  } catch {
    return null;
  }
}
```

**Step 5: Run all tests**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add book CRUD service with search and cover utilities"
```

---

## Task 5: App Shell & Navigation

**Files:**
- Create: `src/routes/+layout.svelte` (update), `src/lib/components/BottomNav.svelte`, `src/lib/components/TopBar.svelte`
- Create: `src/routes/+page.svelte`, `src/routes/browse/+page.svelte`, `src/routes/mine/+page.svelte`

**Step 1: Create BottomNav component**

Create `src/lib/components/BottomNav.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';

  const tabs = [
    { href: '/', label: 'Library', icon: '📚' },
    { href: '/browse', label: 'Browse', icon: '📂' },
    { href: '/mine', label: 'Mine', icon: '⭐' }
  ];
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 flex justify-around py-2 z-50">
  {#each tabs as tab}
    <a
      href={tab.href}
      class="flex flex-col items-center gap-1 px-4 py-1 text-xs transition {page.url.pathname === tab.href ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'}"
    >
      <span class="text-lg">{tab.icon}</span>
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>
```

**Step 2: Create TopBar component**

Create `src/lib/components/TopBar.svelte`:

```svelte
<script lang="ts">
  import { getCurrentUser, setCurrentUser } from '$lib/stores/user.svelte';

  let user = $derived(getCurrentUser());
</script>

<header class="fixed top-0 left-0 right-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 py-3 z-50">
  <button
    class="flex items-center gap-2 text-sm text-slate-300 hover:text-white"
    onclick={() => setCurrentUser(null)}
  >
    <span class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-base">
      {user?.avatar || user?.name?.[0]?.toUpperCase() || '?'}
    </span>
    <span>{user?.name || 'Select Profile'}</span>
  </button>

  <a href="/add" class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500">
    + Add
  </a>
</header>
```

**Step 3: Update root layout**

Update `src/routes/+layout.svelte`:

```svelte
<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { getCurrentUser, restoreUser } from '$lib/stores/user.svelte';
  import ProfilePicker from '$lib/components/ProfilePicker.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let { children } = $props();
  let loaded = $state(false);
  let user = $derived(getCurrentUser());

  onMount(async () => {
    await restoreUser();
    loaded = true;
  });
</script>

{#if !loaded}
  <div class="min-h-screen bg-slate-900 flex items-center justify-center text-white">
    Loading...
  </div>
{:else if !user}
  <ProfilePicker />
{:else}
  <TopBar />
  <main class="pt-16 pb-20 px-4 min-h-screen bg-slate-950 text-white">
    {@render children()}
  </main>
  <BottomNav />
{/if}
```

**Step 4: Create placeholder route pages**

Create `src/routes/+page.svelte`:

```svelte
<h1 class="text-xl font-bold">Library</h1>
<p class="text-slate-400 mt-2">Your book collection will appear here.</p>
```

Create `src/routes/browse/+page.svelte`:

```svelte
<h1 class="text-xl font-bold">Browse</h1>
<p class="text-slate-400 mt-2">Browse by category, series, and author.</p>
```

Create `src/routes/mine/+page.svelte`:

```svelte
<h1 class="text-xl font-bold">Mine</h1>
<p class="text-slate-400 mt-2">Your reading list, wishlist, and ratings.</p>
```

**Step 5: Verify navigation works**

```bash
npm run dev
```

Expected: Profile picker on first load. After creating a profile, see top bar + bottom nav + page content. Tabs switch between pages.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add app shell with top bar, bottom nav, and profile gating"
```

---

## Task 6: Add Book Page (Manual + Open Library Search)

**Files:**
- Create: `src/routes/add/+page.svelte`, `src/lib/services/openlibrary.ts`
- Test: `src/lib/services/openlibrary.test.ts`

**Step 1: Write Open Library service**

Create `src/lib/services/openlibrary.ts`:

```ts
export interface OpenLibraryResult {
  title: string;
  authors: string[];
  isbn: string | undefined;
  coverUrl: string | undefined;
  publishYear: number | undefined;
}

export async function searchOpenLibrary(query: string): Promise<OpenLibraryResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=title,author_name,isbn,cover_i,first_publish_year`;

  const res = await fetch(url);
  if (!res.ok) return [];

  const data = await res.json();

  return (data.docs || []).map((doc: any) => ({
    title: doc.title || 'Unknown',
    authors: doc.author_name || [],
    isbn: doc.isbn?.[0],
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
    publishYear: doc.first_publish_year
  }));
}

export async function lookupByISBN(isbn: string): Promise<OpenLibraryResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  const entry = data[`ISBN:${isbn}`];
  if (!entry) return null;

  return {
    title: entry.title || 'Unknown',
    authors: (entry.authors || []).map((a: any) => a.name),
    isbn,
    coverUrl: entry.cover?.medium,
    publishYear: entry.publish_date ? parseInt(entry.publish_date) : undefined
  };
}
```

**Step 2: Create Add Book page**

Create `src/routes/add/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { addBook } from '$lib/services/books';
  import { resizeImage } from '$lib/services/covers';
  import { searchOpenLibrary, lookupByISBN, type OpenLibraryResult } from '$lib/services/openlibrary';

  let mode = $state<'search' | 'manual' | 'scan'>('search');
  let searchQuery = $state('');
  let searchResults = $state<OpenLibraryResult[]>([]);
  let searching = $state(false);

  // Manual form fields
  let title = $state('');
  let authors = $state('');
  let isbn = $state('');
  let categories = $state('');
  let coverFile = $state<File | null>(null);
  let coverPreview = $state<string | null>(null);
  let saving = $state(false);
  let error = $state('');

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    searching = true;
    searchResults = await searchOpenLibrary(searchQuery);
    searching = false;
  }

  async function selectResult(result: OpenLibraryResult) {
    title = result.title;
    authors = result.authors.join(', ');
    isbn = result.isbn || '';
    coverPreview = result.coverUrl || null;
    mode = 'manual';
  }

  async function handleCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    coverFile = file;
    coverPreview = URL.createObjectURL(file);
  }

  async function handleSave() {
    if (!title.trim()) {
      error = 'Title is required';
      return;
    }
    saving = true;
    error = '';

    let coverBlob: Blob | undefined;
    if (coverFile) {
      coverBlob = await resizeImage(coverFile);
    }

    const result = await addBook({
      title: title.trim(),
      authors: authors.split(',').map((a) => a.trim()).filter(Boolean),
      isbn: isbn.trim() || undefined,
      coverUrl: !coverFile && coverPreview ? coverPreview : undefined,
      coverBlob,
      categories: categories.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
    });

    if (result === null) {
      error = 'A book with this ISBN already exists';
      saving = false;
      return;
    }

    goto('/');
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-xl font-bold mb-4">Add Book</h1>

  <!-- Mode tabs -->
  <div class="flex gap-2 mb-6">
    <button
      class="px-4 py-2 rounded-lg text-sm {mode === 'search' ? 'bg-blue-600' : 'bg-slate-800'}"
      onclick={() => mode = 'search'}
    >Search</button>
    <button
      class="px-4 py-2 rounded-lg text-sm {mode === 'manual' ? 'bg-blue-600' : 'bg-slate-800'}"
      onclick={() => mode = 'manual'}
    >Manual</button>
    <button
      class="px-4 py-2 rounded-lg text-sm {mode === 'scan' ? 'bg-blue-600' : 'bg-slate-800'}"
      onclick={() => mode = 'scan'}
    >Scan</button>
  </div>

  <!-- Search mode -->
  {#if mode === 'search'}
    <form class="flex gap-2 mb-4" onsubmit={(e) => { e.preventDefault(); handleSearch(); }}>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search by title or author..."
        class="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
      />
      <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg" disabled={searching}>
        {searching ? '...' : 'Search'}
      </button>
    </form>

    {#each searchResults as result}
      <button
        class="w-full flex gap-3 p-3 mb-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-left"
        onclick={() => selectResult(result)}
      >
        {#if result.coverUrl}
          <img src={result.coverUrl} alt="" class="w-12 h-16 object-cover rounded" />
        {:else}
          <div class="w-12 h-16 bg-slate-700 rounded flex items-center justify-center text-xs text-slate-500">No cover</div>
        {/if}
        <div>
          <div class="font-medium">{result.title}</div>
          <div class="text-sm text-slate-400">{result.authors.join(', ')}</div>
          {#if result.publishYear}<div class="text-xs text-slate-500">{result.publishYear}</div>{/if}
        </div>
      </button>
    {/each}
  {/if}

  <!-- Scan mode placeholder -->
  {#if mode === 'scan'}
    <p class="text-slate-400">Barcode scanning will be implemented in a later task.</p>
  {/if}

  <!-- Manual mode -->
  {#if mode === 'manual'}
    <form class="flex flex-col gap-4" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
      {#if coverPreview}
        <img src={coverPreview} alt="Cover" class="w-32 h-44 object-cover rounded mx-auto" />
      {/if}

      <label class="flex flex-col gap-1">
        <span class="text-sm text-slate-400">Cover Image</span>
        <input type="file" accept="image/*" onchange={handleCoverUpload}
          class="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm text-slate-400">Title *</span>
        <input type="text" bind:value={title}
          class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm text-slate-400">Authors (comma-separated)</span>
        <input type="text" bind:value={authors}
          class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm text-slate-400">ISBN</span>
        <input type="text" bind:value={isbn}
          class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
      </label>

      <label class="flex flex-col gap-1">
        <span class="text-sm text-slate-400">Categories (comma-separated)</span>
        <input type="text" bind:value={categories} placeholder="e.g. sci-fi, novel"
          class="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white" />
      </label>

      {#if error}
        <p class="text-red-400 text-sm">{error}</p>
      {/if}

      <button type="submit" class="px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 font-medium" disabled={saving}>
        {saving ? 'Saving...' : 'Add Book'}
      </button>
    </form>
  {/if}
</div>
```

**Step 3: Verify the page works**

```bash
npm run dev
```

Visit `/add`. Test searching Open Library and manual entry.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add book page with Open Library search and manual entry"
```

---

## Task 7: Library Page (Book Grid/List)

**Files:**
- Create: `src/lib/components/BookCard.svelte`, `src/lib/components/BookGrid.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Create BookCard component**

Create `src/lib/components/BookCard.svelte`:

```svelte
<script lang="ts">
  import type { Book } from '$lib/db';

  let { book, onclick }: { book: Book; onclick?: () => void } = $props();

  function getCoverSrc(book: Book): string | null {
    if (book.coverBlob) return URL.createObjectURL(book.coverBlob);
    if (book.coverUrl) return book.coverUrl;
    return null;
  }
</script>

<button
  class="flex flex-col rounded-xl bg-slate-800 overflow-hidden hover:ring-2 hover:ring-blue-500 transition w-full text-left"
  {onclick}
>
  {#if getCoverSrc(book)}
    <img src={getCoverSrc(book)} alt={book.title} class="w-full h-48 object-cover" />
  {:else}
    <div class="w-full h-48 bg-slate-700 flex items-center justify-center text-slate-500 text-sm px-2 text-center">
      {book.title}
    </div>
  {/if}
  <div class="p-3">
    <h3 class="font-medium text-sm truncate">{book.title}</h3>
    <p class="text-xs text-slate-400 truncate">{book.authors.join(', ')}</p>
    {#if book.categories.length}
      <div class="flex gap-1 mt-2 flex-wrap">
        {#each book.categories.slice(0, 3) as cat}
          <span class="text-xs px-2 py-0.5 bg-slate-700 rounded-full">{cat}</span>
        {/each}
      </div>
    {/if}
  </div>
</button>
```

**Step 2: Update Library page**

Update `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { getBooks, searchBooks } from '$lib/services/books';
  import type { Book } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  let books = $state<Book[]>([]);
  let query = $state('');
  let loading = $state(true);

  onMount(async () => {
    books = await getBooks();
    loading = false;
  });

  async function handleSearch() {
    if (query.trim()) {
      books = await searchBooks(query);
    } else {
      books = await getBooks();
    }
  }
</script>

<div>
  <div class="mb-4">
    <input
      type="search"
      bind:value={query}
      oninput={handleSearch}
      placeholder="Search books..."
      class="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white"
    />
  </div>

  {#if loading}
    <p class="text-slate-400">Loading...</p>
  {:else if books.length === 0}
    <div class="text-center py-12">
      <p class="text-slate-400 mb-4">No books yet.</p>
      <a href="/add" class="px-4 py-2 bg-blue-600 rounded-lg text-white">Add your first book</a>
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {#each books as book}
        <BookCard {book} onclick={() => goto(`/book/${book.id}`)} />
      {/each}
    </div>
  {/if}
</div>
```

**Step 3: Verify grid works**

```bash
npm run dev
```

Add a few books via `/add`, return to library, verify they display in a grid with search working.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add library page with book grid and search"
```

---

## Task 8: Book Detail Page

**Files:**
- Create: `src/routes/book/[id]/+page.svelte`
- Create: `src/lib/services/userbooks.ts`
- Test: `src/lib/services/userbooks.test.ts`

**Step 1: Write tests for user book data service**

Create `src/lib/services/userbooks.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { getUserBookData, setUserBookData } from './userbooks';

beforeEach(async () => {
  await db.userBookData.clear();
});

describe('UserBookData service', () => {
  it('should create user book data if none exists', async () => {
    const data = await setUserBookData('u1', 'b1', { status: 'reading' });
    expect(data.status).toBe('reading');
    expect(data.isWishlist).toBe(false);
  });

  it('should update existing user book data', async () => {
    await setUserBookData('u1', 'b1', { status: 'reading' });
    await setUserBookData('u1', 'b1', { status: 'read', rating: 5 });
    const data = await getUserBookData('u1', 'b1');
    expect(data?.status).toBe('read');
    expect(data?.rating).toBe(5);
  });

  it('should return null for non-existent data', async () => {
    const data = await getUserBookData('u1', 'b1');
    expect(data).toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/services/userbooks.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement user book data service**

Create `src/lib/services/userbooks.ts`:

```ts
import { db, type UserBookData } from '$lib/db';

export async function getUserBookData(userId: string, bookId: string): Promise<UserBookData | null> {
  const data = await db.userBookData.where({ userId, bookId }).first();
  return data || null;
}

export async function setUserBookData(
  userId: string,
  bookId: string,
  updates: Partial<Pick<UserBookData, 'status' | 'rating' | 'notes' | 'lentTo' | 'lentDate' | 'isWishlist'>>
): Promise<UserBookData> {
  const existing = await db.userBookData.where({ userId, bookId }).first();

  if (existing) {
    await db.userBookData.update(existing.id, updates);
    return { ...existing, ...updates };
  }

  const data: UserBookData = {
    id: crypto.randomUUID(),
    userId,
    bookId,
    status: 'unread',
    isWishlist: false,
    ...updates
  };
  await db.userBookData.add(data);
  return data;
}

export async function getUserBooks(userId: string, filter?: { status?: string; isWishlist?: boolean }): Promise<UserBookData[]> {
  let collection = db.userBookData.where('userId').equals(userId);
  let results = await collection.toArray();

  if (filter?.status) {
    results = results.filter((d) => d.status === filter.status);
  }
  if (filter?.isWishlist !== undefined) {
    results = results.filter((d) => d.isWishlist === filter.isWishlist);
  }
  return results;
}

export async function getLentBooks(userId: string): Promise<UserBookData[]> {
  const all = await db.userBookData.where('userId').equals(userId).toArray();
  return all.filter((d) => d.lentTo);
}
```

**Step 4: Run tests**

```bash
npx vitest run src/lib/services/userbooks.test.ts
```

Expected: All pass.

**Step 5: Create Book Detail page**

Create `src/routes/book/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getBookById, updateBook, deleteBook } from '$lib/services/books';
  import { getUserBookData, setUserBookData } from '$lib/services/userbooks';
  import { resizeImage } from '$lib/services/covers';
  import { getCurrentUser } from '$lib/stores/user.svelte';
  import type { Book, UserBookData } from '$lib/db';

  let book = $state<Book | null>(null);
  let userData = $state<UserBookData | null>(null);
  let editing = $state(false);
  let user = $derived(getCurrentUser());

  onMount(async () => {
    book = (await getBookById(page.params.id)) || null;
    if (book && user) {
      userData = await getUserBookData(user.id, book.id);
    }
  });

  function getCoverSrc(): string | null {
    if (!book) return null;
    if (book.coverBlob) return URL.createObjectURL(book.coverBlob);
    if (book.coverUrl) return book.coverUrl;
    return null;
  }

  async function updateStatus(status: 'unread' | 'reading' | 'read') {
    if (!user || !book) return;
    userData = await setUserBookData(user.id, book.id, { status });
  }

  async function updateRating(rating: number) {
    if (!user || !book) return;
    userData = await setUserBookData(user.id, book.id, { rating });
  }

  async function updateNotes(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    if (!user || !book) return;
    userData = await setUserBookData(user.id, book.id, { notes: textarea.value });
  }

  async function toggleWishlist() {
    if (!user || !book) return;
    userData = await setUserBookData(user.id, book.id, { isWishlist: !userData?.isWishlist });
  }

  async function handleLend() {
    const name = prompt('Lent to:');
    if (!name || !user || !book) return;
    userData = await setUserBookData(user.id, book.id, { lentTo: name, lentDate: new Date() });
  }

  async function handleReturn() {
    if (!user || !book) return;
    userData = await setUserBookData(user.id, book.id, { lentTo: undefined, lentDate: undefined });
  }

  async function handleCoverUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !book) return;
    const blob = await resizeImage(file);
    await updateBook(book.id, { coverBlob: blob });
    book = await getBookById(book.id) || null;
  }

  async function handleDelete() {
    if (!book || !confirm(`Delete "${book.title}"?`)) return;
    await deleteBook(book.id);
    goto('/');
  }
</script>

{#if !book}
  <p class="text-slate-400">Book not found.</p>
{:else}
  <div class="max-w-lg mx-auto">
    <!-- Cover -->
    <div class="flex flex-col items-center mb-6">
      {#if getCoverSrc()}
        <img src={getCoverSrc()} alt={book.title} class="w-40 h-56 object-cover rounded-lg shadow-lg" />
      {:else}
        <div class="w-40 h-56 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">No cover</div>
      {/if}
      <label class="mt-2 text-xs text-blue-400 cursor-pointer">
        Change cover
        <input type="file" accept="image/*" class="hidden" onchange={handleCoverUpload} />
      </label>
    </div>

    <!-- Metadata -->
    <h1 class="text-2xl font-bold">{book.title}</h1>
    <p class="text-slate-400">{book.authors.join(', ')}</p>
    {#if book.isbn}<p class="text-xs text-slate-500 mt-1">ISBN: {book.isbn}</p>{/if}

    {#if book.categories.length}
      <div class="flex gap-2 mt-3 flex-wrap">
        {#each book.categories as cat}
          <span class="text-xs px-3 py-1 bg-slate-800 rounded-full">{cat}</span>
        {/each}
      </div>
    {/if}

    <!-- Reading Status -->
    <div class="mt-6">
      <h2 class="text-sm font-medium text-slate-400 mb-2">Reading Status</h2>
      <div class="flex gap-2">
        {#each ['unread', 'reading', 'read'] as status}
          <button
            class="px-4 py-2 rounded-lg text-sm capitalize {userData?.status === status ? 'bg-blue-600' : 'bg-slate-800'}"
            onclick={() => updateStatus(status as 'unread' | 'reading' | 'read')}
          >{status}</button>
        {/each}
      </div>
    </div>

    <!-- Rating -->
    <div class="mt-6">
      <h2 class="text-sm font-medium text-slate-400 mb-2">Rating</h2>
      <div class="flex gap-1">
        {#each [1, 2, 3, 4, 5] as star}
          <button
            class="text-2xl {(userData?.rating || 0) >= star ? 'text-yellow-400' : 'text-slate-600'}"
            onclick={() => updateRating(star)}
          >★</button>
        {/each}
      </div>
    </div>

    <!-- Notes -->
    <div class="mt-6">
      <h2 class="text-sm font-medium text-slate-400 mb-2">Notes</h2>
      <textarea
        class="w-full h-24 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm resize-none"
        placeholder="Your thoughts..."
        value={userData?.notes || ''}
        onblur={updateNotes}
      ></textarea>
    </div>

    <!-- Lending -->
    <div class="mt-6">
      <h2 class="text-sm font-medium text-slate-400 mb-2">Lending</h2>
      {#if userData?.lentTo}
        <div class="flex items-center justify-between bg-slate-800 p-3 rounded-lg">
          <span>Lent to <strong>{userData.lentTo}</strong></span>
          <button class="text-sm text-blue-400" onclick={handleReturn}>Mark returned</button>
        </div>
      {:else}
        <button class="px-4 py-2 bg-slate-800 rounded-lg text-sm" onclick={handleLend}>Lend this book</button>
      {/if}
    </div>

    <!-- Actions -->
    <div class="mt-6 flex gap-3">
      <button
        class="flex-1 px-4 py-2 rounded-lg text-sm {userData?.isWishlist ? 'bg-yellow-600' : 'bg-slate-800'}"
        onclick={toggleWishlist}
      >{userData?.isWishlist ? 'In Wishlist' : 'Add to Wishlist'}</button>
      <button class="px-4 py-2 bg-red-900 rounded-lg text-sm" onclick={handleDelete}>Delete</button>
    </div>
  </div>
{/if}
```

**Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add book detail page with status, rating, notes, and lending"
```

---

## Task 9: Browse Page (Categories, Series, Authors)

**Files:**
- Modify: `src/routes/browse/+page.svelte`
- Create: `src/routes/browse/category/[name]/+page.svelte`, `src/routes/browse/series/[id]/+page.svelte`, `src/routes/browse/author/[name]/+page.svelte`

**Step 1: Build Browse page with grouped sections**

Update `src/routes/browse/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import type { Category, Series } from '$lib/db';

  let categories = $state<{ name: string; count: number }[]>([]);
  let seriesList = $state<(Series & { count: number })[]>([]);
  let authors = $state<{ name: string; count: number }[]>([]);
  let tab = $state<'categories' | 'series' | 'authors'>('categories');

  onMount(async () => {
    // Build category counts from books
    const books = await db.books.toArray();
    const catMap = new Map<string, number>();
    const authorMap = new Map<string, number>();

    for (const book of books) {
      for (const cat of book.categories) {
        catMap.set(cat, (catMap.get(cat) || 0) + 1);
      }
      for (const author of book.authors) {
        authorMap.set(author, (authorMap.get(author) || 0) + 1);
      }
    }

    categories = [...catMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    authors = [...authorMap.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const allSeries = await db.series.toArray();
    seriesList = await Promise.all(
      allSeries.map(async (s) => ({
        ...s,
        count: await db.books.where('seriesId').equals(s.id).count()
      }))
    );
  });
</script>

<h1 class="text-xl font-bold mb-4">Browse</h1>

<div class="flex gap-2 mb-6">
  {#each ['categories', 'series', 'authors'] as t}
    <button
      class="px-4 py-2 rounded-lg text-sm capitalize {tab === t ? 'bg-blue-600' : 'bg-slate-800'}"
      onclick={() => tab = t as typeof tab}
    >{t}</button>
  {/each}
</div>

{#if tab === 'categories'}
  {#each categories as cat}
    <a href="/browse/category/{encodeURIComponent(cat.name)}"
      class="flex items-center justify-between p-3 mb-2 bg-slate-800 rounded-lg hover:bg-slate-700">
      <span class="capitalize">{cat.name}</span>
      <span class="text-sm text-slate-400">{cat.count} books</span>
    </a>
  {:else}
    <p class="text-slate-400">No categories yet. Add categories when adding books.</p>
  {/each}
{/if}

{#if tab === 'series'}
  {#each seriesList as s}
    <a href="/browse/series/{s.id}"
      class="flex items-center justify-between p-3 mb-2 bg-slate-800 rounded-lg hover:bg-slate-700">
      <span>{s.name}</span>
      <span class="text-sm text-slate-400">{s.count} books</span>
    </a>
  {:else}
    <p class="text-slate-400">No series yet.</p>
  {/each}
{/if}

{#if tab === 'authors'}
  {#each authors as author}
    <a href="/browse/author/{encodeURIComponent(author.name)}"
      class="flex items-center justify-between p-3 mb-2 bg-slate-800 rounded-lg hover:bg-slate-700">
      <span>{author.name}</span>
      <span class="text-sm text-slate-400">{author.count} books</span>
    </a>
  {:else}
    <p class="text-slate-400">No authors yet.</p>
  {/each}
{/if}
```

**Step 2: Create category drill-down page**

Create `src/routes/browse/category/[name]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getBooksByCategory } from '$lib/services/books';
  import type { Book } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  let books = $state<Book[]>([]);
  let name = $derived(decodeURIComponent(page.params.name));

  onMount(async () => {
    books = await getBooksByCategory(name);
  });
</script>

<h1 class="text-xl font-bold mb-4 capitalize">{name}</h1>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {#each books as book}
    <BookCard {book} onclick={() => goto(`/book/${book.id}`)} />
  {/each}
</div>
```

**Step 3: Create series and author drill-down pages**

Create `src/routes/browse/series/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getBooksBySeries } from '$lib/services/books';
  import { db } from '$lib/db';
  import type { Book, Series } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  let books = $state<Book[]>([]);
  let series = $state<Series | null>(null);

  onMount(async () => {
    series = (await db.series.get(page.params.id)) || null;
    books = await getBooksBySeries(page.params.id);
  });
</script>

<h1 class="text-xl font-bold mb-4">{series?.name || 'Series'}</h1>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {#each books as book}
    <BookCard {book} onclick={() => goto(`/book/${book.id}`)} />
  {/each}
</div>
```

Create `src/routes/browse/author/[name]/+page.svelte`:

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { getBooks } from '$lib/services/books';
  import type { Book } from '$lib/db';
  import BookCard from '$lib/components/BookCard.svelte';

  let books = $state<Book[]>([]);
  let name = $derived(decodeURIComponent(page.params.name));

  onMount(async () => {
    const allBooks = await getBooks();
    books = allBooks.filter((b) => b.authors.some((a) => a === name));
  });
</script>

<h1 class="text-xl font-bold mb-4">{name}</h1>

<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {#each books as book}
    <BookCard {book} onclick={() => goto(`/book/${book.id}`)} />
  {/each}
</div>
```

**Step 4: Verify navigation works**

```bash
npm run dev
```

Expected: Browse page shows categories/series/authors with counts. Tapping drills into filtered book grids.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add browse page with category, series, and author drill-down"
```

---

## Task 10: Mine Page (Personal Dashboard)

**Files:**
- Modify: `src/routes/mine/+page.svelte`

**Step 1: Build Mine page**

Update `src/routes/mine/+page.svelte`:

```svelte
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
```

**Step 2: Verify it works**

```bash
npm run dev
```

Expected: Mine page shows tabs for Reading/Read/Wishlist/Lent, each showing relevant books.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Mine page with reading, wishlist, and lending tabs"
```

---

## Task 11: Barcode Scanner

**Files:**
- Create: `src/lib/components/BarcodeScanner.svelte`
- Modify: `src/routes/add/+page.svelte`

**Step 1: Install QuaggaJS**

```bash
npm install @ericblade/quagga2
```

**Step 2: Create BarcodeScanner component**

Create `src/lib/components/BarcodeScanner.svelte`:

```svelte
<script lang="ts">
  import Quagga from '@ericblade/quagga2';
  import { onMount, onDestroy } from 'svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();
  let scannerRef: HTMLDivElement;
  let active = $state(false);
  let error = $state('');

  onMount(() => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef,
          constraints: { facingMode: 'environment', width: 640, height: 480 }
        },
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader']
        }
      },
      (err: any) => {
        if (err) {
          error = 'Camera access denied or not available';
          return;
        }
        Quagga.start();
        active = true;
      }
    );

    Quagga.onDetected((result: any) => {
      const code = result.codeResult?.code;
      if (code) {
        Quagga.stop();
        active = false;
        onDetected(code);
      }
    });
  });

  onDestroy(() => {
    if (active) Quagga.stop();
  });
</script>

<div class="relative">
  {#if error}
    <p class="text-red-400 text-sm">{error}</p>
  {/if}
  <div bind:this={scannerRef} class="w-full rounded-lg overflow-hidden bg-black aspect-video"></div>
  <p class="text-center text-sm text-slate-400 mt-2">Point camera at book barcode</p>
</div>
```

**Step 3: Wire scanner into Add Book page**

In `src/routes/add/+page.svelte`, add to the scan mode section, replacing the placeholder:

```svelte
<!-- Scan mode -->
{#if mode === 'scan'}
  <BarcodeScanner onDetected={handleBarcode} />
{/if}
```

Add the import and handler:

```ts
import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
import { lookupByISBN } from '$lib/services/openlibrary';

async function handleBarcode(code: string) {
  isbn = code;
  const result = await lookupByISBN(code);
  if (result) {
    title = result.title;
    authors = result.authors.join(', ');
    coverPreview = result.coverUrl || null;
  }
  mode = 'manual';
}
```

**Step 4: Test on phone**

```bash
npm run dev -- --host
```

Open on phone (same network), navigate to `/add`, tap Scan, point at a barcode.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add barcode scanner with QuaggaJS for ISBN lookup"
```

---

## Task 12: Export/Import & Settings

**Files:**
- Create: `src/routes/settings/+page.svelte`, `src/lib/services/backup.ts`
- Test: `src/lib/services/backup.test.ts`

**Step 1: Write backup service tests**

Create `src/lib/services/backup.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { exportData, importData } from './backup';

beforeEach(async () => {
  await db.books.clear();
  await db.users.clear();
  await db.userBookData.clear();
  await db.series.clear();
  await db.categories.clear();
});

describe('Backup service', () => {
  it('should export and import data', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.books.add({
      id: 'b1', title: 'Dune', authors: ['Frank Herbert'],
      categories: ['sci-fi'], dateAdded: new Date(), dateModified: new Date()
    });

    const json = await exportData();
    const parsed = JSON.parse(json);
    expect(parsed.books).toHaveLength(1);
    expect(parsed.users).toHaveLength(1);

    // Clear and reimport
    await db.books.clear();
    await db.users.clear();
    await importData(json);

    expect(await db.books.count()).toBe(1);
    expect(await db.users.count()).toBe(1);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/services/backup.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement backup service**

Create `src/lib/services/backup.ts`:

```ts
import { db } from '$lib/db';

export async function exportData(): Promise<string> {
  const [users, books, userBookData, series, categories] = await Promise.all([
    db.users.toArray(),
    db.books.toArray().then((books) =>
      books.map(({ coverBlob, ...rest }) => rest)
    ),
    db.userBookData.toArray(),
    db.series.toArray(),
    db.categories.toArray()
  ]);

  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), users, books, userBookData, series, categories }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);

  await db.transaction('rw', [db.users, db.books, db.userBookData, db.series, db.categories], async () => {
    if (data.users) await db.users.bulkPut(data.users);
    if (data.books) {
      const books = data.books.map((b: any) => ({
        ...b,
        dateAdded: new Date(b.dateAdded),
        dateModified: new Date(b.dateModified)
      }));
      await db.books.bulkPut(books);
    }
    if (data.userBookData) await db.userBookData.bulkPut(data.userBookData);
    if (data.series) await db.series.bulkPut(data.series);
    if (data.categories) await db.categories.bulkPut(data.categories);
  });
}
```

**Step 4: Create Settings page**

Create `src/routes/settings/+page.svelte`:

```svelte
<script lang="ts">
  import { exportData, importData } from '$lib/services/backup';

  let importing = $state(false);
  let message = $state('');

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-books-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message = 'Export complete!';
  }

  async function handleImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importing = true;
    try {
      const json = await file.text();
      await importData(json);
      message = 'Import complete! Refresh to see changes.';
    } catch {
      message = 'Import failed. Invalid file.';
    }
    importing = false;
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-xl font-bold mb-6">Settings</h1>

  <div class="space-y-4">
    <div class="bg-slate-800 p-4 rounded-lg">
      <h2 class="font-medium mb-2">Export Library</h2>
      <p class="text-sm text-slate-400 mb-3">Download your entire library as a JSON file.</p>
      <button class="px-4 py-2 bg-blue-600 rounded-lg text-sm" onclick={handleExport}>Export</button>
    </div>

    <div class="bg-slate-800 p-4 rounded-lg">
      <h2 class="font-medium mb-2">Import Library</h2>
      <p class="text-sm text-slate-400 mb-3">Restore from a backup file. Existing data will be merged.</p>
      <input type="file" accept=".json" onchange={handleImport} disabled={importing}
        class="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white" />
    </div>
  </div>

  {#if message}
    <p class="mt-4 text-sm text-green-400">{message}</p>
  {/if}
</div>
```

**Step 5: Add settings link to TopBar**

Add a gear icon/link to the TopBar component that navigates to `/settings`.

**Step 6: Run all tests**

```bash
npx vitest run
```

Expected: All pass.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add export/import backup and settings page"
```

---

## Task 13: Series Management

**Files:**
- Create: `src/lib/services/series.ts`, `src/lib/components/SeriesManager.svelte`
- Modify: `src/routes/add/+page.svelte` (add series picker)

**Step 1: Create series service**

Create `src/lib/services/series.ts`:

```ts
import { db, type Series } from '$lib/db';

export async function createSeries(name: string, description?: string): Promise<Series> {
  const series: Series = { id: crypto.randomUUID(), name, description };
  await db.series.add(series);
  return series;
}

export async function getAllSeries(): Promise<Series[]> {
  return db.series.orderBy('name').toArray();
}

export async function deleteSeries(id: string): Promise<void> {
  await db.books.where('seriesId').equals(id).modify({ seriesId: undefined, seriesOrder: undefined });
  await db.series.delete(id);
}
```

**Step 2: Add series picker to Add Book page**

Add a dropdown/create-new UI for selecting or creating a series when adding a book. Include a `seriesOrder` number input.

**Step 3: Verify series flow works**

```bash
npm run dev
```

Create a series, add books to it, verify they appear grouped in Browse > Series.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add series management and series picker on add book"
```

---

## Task 14: Final Polish & PWA Verification

**Files:**
- Create: `static/icon-192.png`, `static/icon-512.png` (proper icons)
- Modify: various files for polish

**Step 1: Generate PWA icons**

Create proper 192x192 and 512x512 PNG icons for the app. Can use a simple book emoji rendered to canvas, or a placeholder.

**Step 2: Verify PWA installability**

```bash
npm run build && npm run preview
```

Open in Chrome, check Application tab in DevTools:
- Manifest detected
- Service worker registered
- Install prompt available

**Step 3: Test on mobile**

```bash
npm run dev -- --host
```

Open on phone, verify:
- Profile picker works
- Add book (all 3 methods)
- Library grid displays
- Book detail with all features
- Browse navigation
- Mine page tabs
- Export/import
- "Add to Home Screen" prompt appears

**Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: finalize PWA icons and polish for release"
```
