import { describe, it, expect, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { createQueryHelpers } from '$lib/db/query';

// We need to mock $lib/db to use a fresh Y.Doc per test
let doc: Y.Doc;
let q: ReturnType<typeof createQueryHelpers>;

// Mock the $lib/db module
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

import { addBook, updateBook, deleteBook, getBooks, getBookById, searchBooks, findSimilarBooks, resetSearchIndex } from './books';
import { setUserBookData } from './userbooks';

beforeEach(() => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
	resetSearchIndex();
});

describe('Book service', () => {
	it('should add a book with auto-generated fields', () => {
		const book = addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: ['sci-fi'] });
		expect(book!.id).toBeDefined();
		expect(book!.dateAdded).toBeDefined();
		expect(book!.dateModified).toBeDefined();
	});

	it('should detect duplicate by ISBN', () => {
		addBook({
			title: 'Dune',
			authors: ['Frank Herbert'],
			categories: [],
			isbn: '9780441013593'
		});
		const duplicate = addBook({
			title: 'Dune 2',
			authors: ['Frank Herbert'],
			categories: [],
			isbn: '9780441013593'
		});
		expect(duplicate).toBeNull();
	});

	it('should update a book', () => {
		const book = addBook({ title: 'Duen', authors: ['Frank Herbert'], categories: [] });
		updateBook(book!.id, { title: 'Dune' });
		const updated = getBookById(book!.id);
		expect(updated?.title).toBe('Dune');
	});

	it('should delete a book and its user data', () => {
		const book = addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: [] });
		// Add user book data
		q.setItem('userBookData', `u1:${book!.id}`, {
			userId: 'u1',
			bookId: book!.id,
			status: 'reading',
			isWishlist: false
		});
		deleteBook(book!.id);
		expect(getBookById(book!.id)).toBeUndefined();
		expect(q.filter('userBookData', (d) => d.bookId === book!.id)).toHaveLength(0);
	});

	it('should search books by title', () => {
		addBook({ title: 'Dune', authors: ['Frank Herbert'], categories: [] });
		addBook({ title: 'Neuromancer', authors: ['William Gibson'], categories: [] });
		const results = searchBooks('dune');
		expect(results).toHaveLength(1);
		expect(results[0].title).toBe('Dune');
	});

	it('should get all books sorted by dateAdded desc', () => {
		const bookA = addBook({ title: 'A', authors: [], categories: [] });
		// Force earlier dateAdded on book A
		q.updateItem('books', bookA!.id, { dateAdded: '2024-01-01T00:00:00.000Z' });
		addBook({ title: 'B', authors: [], categories: [] });
		const books = getBooks();
		expect(books[0].title).toBe('B');
		expect(books[1].title).toBe('A');
	});

	it('should find similar books by fuzzy title matching', () => {
		addBook({ title: 'The Lord of the Rings', authors: ['Tolkien'], categories: [] }, true);
		expect(findSimilarBooks('the lord of the rings')).toHaveLength(1);
		expect(findSimilarBooks('LORD OF THE RINGS')).toHaveLength(0); // missing "The"
		expect(findSimilarBooks('The Lord of the Rings')).toHaveLength(1);
		expect(findSimilarBooks('Something Else')).toHaveLength(0);
	});

	it('should search with prefix index', () => {
		addBook({ title: 'Harry Potter', authors: ['J.K. Rowling'], categories: ['fantasy'] }, true);
		addBook({ title: 'Hamlet', authors: ['Shakespeare'], categories: ['drama'] }, true);
		const results = searchBooks('har');
		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results.some(b => b.title === 'Harry Potter')).toBe(true);
	});

	it('should support half-star ratings via setUserBookData', () => {
		const book = addBook({ title: 'Test Rating', authors: [], categories: [] }, true);
		const ubd = setUserBookData('user1', book!.id, { rating: 3.5 });
		expect(ubd.rating).toBe(3.5);
	});
});
