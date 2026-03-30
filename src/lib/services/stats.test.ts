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
});
