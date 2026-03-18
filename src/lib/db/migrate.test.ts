import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Dexie from 'dexie';
import * as Y from 'yjs';
import { createQueryHelpers } from './query';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (key: string) => store[key] ?? null,
		setItem: (key: string, value: string) => { store[key] = value; },
		removeItem: (key: string) => { delete store[key]; },
		clear: () => { store = {}; },
		get length() { return Object.keys(store).length; },
		key: (i: number) => Object.keys(store)[i] ?? null
	};
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Mock coverCache (uses IndexedDB internally)
vi.mock('../services/coverCache', () => ({
	setCoverBase64: vi.fn().mockResolvedValue(undefined)
}));

let doc: Y.Doc;
let q: ReturnType<typeof createQueryHelpers>;

async function seedDexie() {
	const oldDb = new Dexie('MyBooksDB');
	oldDb.version(3).stores({
		users: 'id, name',
		books: 'id, title, isbn, *categories, seriesId, dateAdded',
		userBookData: 'id, [userId+bookId], userId, bookId, status, isWishlist',
		series: 'id, name',
		categories: 'id, name',
		shelves: 'id, userId, name',
		syncConfig: 'id'
	});

	await oldDb.table('users').add({ id: 'u1', name: 'Alice', avatar: '👩' });
	await oldDb.table('books').add({
		id: 'b1',
		title: 'Dune',
		authors: ['Frank Herbert'],
		isbn: '9780441013593',
		coverUrl: 'https://example.com/dune.jpg',
		categories: ['sci-fi'],
		dateAdded: new Date('2024-06-15'),
		dateModified: new Date('2024-06-15')
	});
	await oldDb.table('userBookData').add({
		id: 'ubd1',
		userId: 'u1',
		bookId: 'b1',
		status: 'read',
		rating: 5,
		isWishlist: false,
		totalPages: 412
	});
	await oldDb.table('series').add({ id: 's1', name: 'Dune Chronicles', description: 'Frank Herbert saga' });
	await oldDb.table('shelves').add({
		id: 'sh1',
		userId: 'u1',
		name: 'Favorites',
		bookIds: ['b1'],
		dateCreated: new Date('2024-07-01')
	});
	await oldDb.table('categories').add({ id: 'c1', name: 'sci-fi', color: '#ff0000' });

	return oldDb;
}

beforeEach(async () => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
	localStorageMock.clear();

	// Clean up any existing Dexie DB
	await Dexie.delete('MyBooksDB');
});

describe('Dexie → Yjs migration', () => {
	it('migrates all data from Dexie to Y.Doc', async () => {
		const oldDb = await seedDexie();

		// Set a localStorage goal
		localStorageMock.setItem('reading_goal_u1_2024', '12');

		const { migrateFromDexie } = await import('./migrate');
		const result = await migrateFromDexie(doc);

		expect(result.migrated).toBe(true);
		expect(result.stats?.users).toBe(1);
		expect(result.stats?.books).toBe(1);
		expect(result.stats?.userBookData).toBe(1);
		expect(result.stats?.series).toBe(1);
		expect(result.stats?.shelves).toBe(1);
		expect(result.stats?.goals).toBe(1);

		// Verify users
		const user = q.getItem('users', 'u1') as any;
		expect(user.name).toBe('Alice');
		expect(user.avatar).toBe('👩');

		// Verify books (dates converted to ISO string)
		const book = q.getItem('books', 'b1') as any;
		expect(book.title).toBe('Dune');
		expect(book.isbn).toBe('9780441013593');
		expect(typeof book.dateAdded).toBe('string');
		expect(book.dateAdded).toContain('2024-06-15');

		// Verify userBookData (compound key)
		const ubd = q.getItem('userBookData', 'u1:b1') as any;
		expect(ubd.status).toBe('read');
		expect(ubd.rating).toBe(5);
		expect(ubd.totalPages).toBe(412);

		// Verify series
		const series = q.getItem('series', 's1') as any;
		expect(series.name).toBe('Dune Chronicles');

		// Verify shelves (bookIds as Y.Map set → converted to array)
		const shelf = q.getItem('shelves', 'sh1') as any;
		expect(shelf.name).toBe('Favorites');
		expect(shelf.bookIds).toContain('b1');

		// Verify goals migrated from localStorage
		const goal = q.getItem('goals', 'u1:2024') as any;
		expect(goal.target).toBe(12);

		// Verify migration flag set
		expect(localStorageMock.getItem('libris_migrated_at')).toBeTruthy();

		await oldDb.close();
	});

	it('skips migration if Y.Doc already has data', async () => {
		await seedDexie();
		localStorageMock.setItem('libris_migrated_at', new Date().toISOString());

		// Put some data in Y.Doc
		q.setItem('books', 'b99', { id: 'b99', title: 'Existing' });

		const { migrateFromDexie } = await import('./migrate');
		const result = await migrateFromDexie(doc);

		expect(result.migrated).toBe(false);
		// Should not have migrated Dexie data
		expect(q.getItem('books', 'b1')).toBeUndefined();
	});

	it('skips migration if Dexie DB does not exist', async () => {
		const { migrateFromDexie } = await import('./migrate');
		const result = await migrateFromDexie(doc);
		expect(result.migrated).toBe(false);
	});

	it('logs warning for categories with color data', async () => {
		await seedDexie();
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		const { migrateFromDexie } = await import('./migrate');
		await migrateFromDexie(doc);

		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining('1 categories with color data')
		);
		warnSpy.mockRestore();
	});
});
