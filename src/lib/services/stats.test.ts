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

import { getAvailableYears, getReadingStats, getYearInReview } from './stats';

beforeEach(() => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
});

describe('Stats service', () => {
	it('getAvailableYears returns years with read books', () => {
		// Add books
		q.setItem('books', 'b1', {
			id: 'b1', title: 'Book 2024', authors: [], categories: [],
			dateAdded: '2024-06-15T00:00:00.000Z', dateModified: '2024-06-15T00:00:00.000Z'
		});
		q.setItem('books', 'b2', {
			id: 'b2', title: 'Book 2023', authors: [], categories: [],
			dateAdded: '2023-03-10T00:00:00.000Z', dateModified: '2023-03-10T00:00:00.000Z'
		});
		// Add user book data with dateRead
		q.setItem('userBookData', 'u1:b1', {
			userId: 'u1', bookId: 'b1', status: 'read', isWishlist: false,
			dateRead: '2024-06-15T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b2', {
			userId: 'u1', bookId: 'b2', status: 'read', isWishlist: false,
			dateRead: '2023-03-10T00:00:00.000Z'
		});

		const years = getAvailableYears('u1');
		expect(years).toEqual([2024, 2023]);
	});

	it('getReadingStats filters by year', () => {
		// Add 3 books: 2 read in 2024, 1 read in 2023
		q.setItem('books', 'b1', {
			id: 'b1', title: 'A', authors: [], categories: [],
			dateAdded: '2024-01-01T00:00:00.000Z', dateModified: '2024-01-01T00:00:00.000Z'
		});
		q.setItem('books', 'b2', {
			id: 'b2', title: 'B', authors: [], categories: [],
			dateAdded: '2024-06-01T00:00:00.000Z', dateModified: '2024-06-01T00:00:00.000Z'
		});
		q.setItem('books', 'b3', {
			id: 'b3', title: 'C', authors: [], categories: [],
			dateAdded: '2023-05-01T00:00:00.000Z', dateModified: '2023-05-01T00:00:00.000Z'
		});

		q.setItem('userBookData', 'u1:b1', {
			userId: 'u1', bookId: 'b1', status: 'read', isWishlist: false,
			dateRead: '2024-02-15T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b2', {
			userId: 'u1', bookId: 'b2', status: 'read', isWishlist: false,
			dateRead: '2024-07-20T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b3', {
			userId: 'u1', bookId: 'b3', status: 'read', isWishlist: false,
			dateRead: '2023-06-01T00:00:00.000Z'
		});

		const stats2024 = getReadingStats('u1', 2024);
		expect(stats2024.totalRead).toBe(2);

		const stats2023 = getReadingStats('u1', 2023);
		expect(stats2023.totalRead).toBe(1);
	});

	it('getYearInReview returns null for year with no reads', () => {
		const result = getYearInReview('u1', 2099);
		expect(result).toBeNull();
	});

	it('getYearInReview returns correct highlights', () => {
		// Add 3 books read in 2024 with different ratings, pages, dates
		q.setItem('books', 'b1', {
			id: 'b1', title: 'Short Book', authors: ['Author A'], categories: ['fiction'],
			dateAdded: '2024-01-01T00:00:00.000Z', dateModified: '2024-01-01T00:00:00.000Z'
		});
		q.setItem('books', 'b2', {
			id: 'b2', title: 'Medium Book', authors: ['Author A'], categories: ['fiction', 'mystery'],
			dateAdded: '2024-03-01T00:00:00.000Z', dateModified: '2024-03-01T00:00:00.000Z'
		});
		q.setItem('books', 'b3', {
			id: 'b3', title: 'Long Book', authors: ['Author B'], categories: ['mystery'],
			dateAdded: '2024-06-01T00:00:00.000Z', dateModified: '2024-06-01T00:00:00.000Z'
		});

		q.setItem('userBookData', 'u1:b1', {
			userId: 'u1', bookId: 'b1', status: 'read', isWishlist: false,
			rating: 3, totalPages: 150,
			dateStarted: '2024-01-01T00:00:00.000Z', dateRead: '2024-01-15T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b2', {
			userId: 'u1', bookId: 'b2', status: 'read', isWishlist: false,
			rating: 5, totalPages: 300,
			dateStarted: '2024-03-01T00:00:00.000Z', dateRead: '2024-04-01T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b3', {
			userId: 'u1', bookId: 'b3', status: 'read', isWishlist: false,
			rating: 4, totalPages: 500,
			dateStarted: '2024-06-01T00:00:00.000Z', dateRead: '2024-07-15T00:00:00.000Z'
		});

		const review = getYearInReview('u1', 2024);
		expect(review).not.toBeNull();
		expect(review!.totalRead).toBe(3);
		expect(review!.totalPages).toBe(950);
		expect(review!.averageRating).toBe(4);
		// Favorite book is highest rated
		expect(review!.favoriteBook).toEqual({ title: 'Medium Book', rating: 5 });
		// Top genre: fiction and mystery both appear 2 times, but fiction is on b1 and b2
		expect(review!.topGenre).toBeDefined();
		// Top author: Author A has 2 books
		expect(review!.topAuthor).toBe('Author A');
	});

	it('getReadingStats all-time returns all books', () => {
		// Add books from different years
		q.setItem('books', 'b1', {
			id: 'b1', title: 'Book 2023', authors: [], categories: [],
			dateAdded: '2023-06-01T00:00:00.000Z', dateModified: '2023-06-01T00:00:00.000Z'
		});
		q.setItem('books', 'b2', {
			id: 'b2', title: 'Book 2024', authors: [], categories: [],
			dateAdded: '2024-03-01T00:00:00.000Z', dateModified: '2024-03-01T00:00:00.000Z'
		});
		q.setItem('books', 'b3', {
			id: 'b3', title: 'Book 2025', authors: [], categories: [],
			dateAdded: '2025-01-01T00:00:00.000Z', dateModified: '2025-01-01T00:00:00.000Z'
		});

		q.setItem('userBookData', 'u1:b1', {
			userId: 'u1', bookId: 'b1', status: 'read', isWishlist: false,
			dateRead: '2023-07-01T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b2', {
			userId: 'u1', bookId: 'b2', status: 'read', isWishlist: false,
			dateRead: '2024-04-01T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b3', {
			userId: 'u1', bookId: 'b3', status: 'reading', isWishlist: false,
			dateStarted: '2025-01-01T00:00:00.000Z'
		});

		// Without year filter, totalRead should include all years
		const stats = getReadingStats('u1');
		expect(stats.totalRead).toBe(2);
		expect(stats.totalReading).toBe(1);
		expect(stats.totalBooks).toBe(3);
	});
});
