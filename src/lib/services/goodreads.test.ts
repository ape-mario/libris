import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createQueryHelpers } from '$lib/db/query';

let doc: Y.Doc;
let q: ReturnType<typeof createQueryHelpers>;

import { vi } from 'vitest';
vi.mock('$lib/db', () => {
	return {
		get q() {
			return q;
		},
		get doc() {
			return doc;
		}
	};
});

import { importGoodreadsCSV } from './goodreads';

beforeEach(() => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
});

describe('Goodreads import', () => {
	it('should parse Goodreads CSV and import books', () => {
		const csv = [
			'Title,Author,ISBN13,Publisher,Year Published,Original Publication Year,Number of Pages,My Rating,Exclusive Shelf,Date Read,Date Added',
			'Dune,Frank Herbert,="9780441013593",Ace Books,,1965,688,5,read,2024-03-15,2024-01-10',
			'Neuromancer,William Gibson,="9780441569595",Ace,1984,1984,271,4,read,2024-05-20,2024-04-01'
		].join('\n');

		const count = importGoodreadsCSV(csv, 'u1');
		expect(count).toBe(2);

		// Verify books were created
		const books = q.getAll('books');
		expect(books).toHaveLength(2);

		const dune = books.find((b: any) => b.title === 'Dune') as any;
		expect(dune).toBeDefined();
		expect(dune.authors).toContain('Frank Herbert');
		expect(dune.isbn).toBe('9780441013593');
		expect(dune.publisher).toBe('Ace Books');
		expect(dune.publishYear).toBe(1965);

		// Verify user book data
		const ubd = q.getItem('userBookData', `u1:${dune.id}`) as any;
		expect(ubd).toBeDefined();
		expect(ubd.status).toBe('read');
		expect(ubd.rating).toBe(5);
	});

	it('should skip duplicate books by ISBN', () => {
		// Pre-add a book with the same ISBN
		q.setItem('books', 'existing', {
			id: 'existing',
			title: 'Dune',
			authors: ['Frank Herbert'],
			isbn: '9780441013593',
			categories: [],
			dateAdded: '2024-01-01T00:00:00.000Z',
			dateModified: '2024-01-01T00:00:00.000Z'
		});

		const csv = [
			'Title,Author,ISBN13,Exclusive Shelf,My Rating,Date Read,Date Added',
			'Dune,Frank Herbert,="9780441013593",read,5,2024-03-15,2024-01-10'
		].join('\n');

		const count = importGoodreadsCSV(csv, 'u1');
		// Book already exists by ISBN, so it should not create a new one (count = 0)
		expect(count).toBe(0);
		// Only the original book should exist
		expect(q.getAll('books')).toHaveLength(1);
	});

	it('should map Goodreads shelves to status correctly', () => {
		const csv = [
			'Title,Author,ISBN13,Exclusive Shelf,Bookshelves,My Rating,Date Read,Date Added,Number of Pages',
			'Read Book,Author A,,read,read,4,2024-03-15,2024-01-10,200',
			'Reading Book,Author B,,currently-reading,currently-reading,0,,2024-02-01,300',
			'Wishlist Book,Author C,,to-read,to-read,0,,2024-03-01,150'
		].join('\n');

		const count = importGoodreadsCSV(csv, 'u1');
		expect(count).toBe(3);

		const books = q.getAll('books') as any[];
		const readBook = books.find((b: any) => b.title === 'Read Book');
		const readingBook = books.find((b: any) => b.title === 'Reading Book');
		const wishlistBook = books.find((b: any) => b.title === 'Wishlist Book');

		// read shelf → status 'read'
		const readUbd = q.getItem('userBookData', `u1:${readBook!.id}`) as any;
		expect(readUbd.status).toBe('read');

		// currently-reading shelf → status 'reading' with dateStarted
		const readingUbd = q.getItem('userBookData', `u1:${readingBook!.id}`) as any;
		expect(readingUbd.status).toBe('reading');
		expect(readingUbd.dateStarted).toBeDefined();

		// to-read shelf → isWishlist true
		const wishlistUbd = q.getItem('userBookData', `u1:${wishlistBook!.id}`) as any;
		expect(wishlistUbd.isWishlist).toBe(true);
	});
});
