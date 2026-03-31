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

import { getUserBookData, setUserBookData } from './userbooks';

beforeEach(() => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
});

describe('UserBookData service', () => {
	it('should create user book data if none exists', () => {
		const data = setUserBookData('u1', 'b1', { status: 'reading' });
		expect(data.status).toBe('reading');
		expect(data.isWishlist).toBe(false);
	});

	it('should update existing user book data', () => {
		setUserBookData('u1', 'b1', { status: 'reading' });
		setUserBookData('u1', 'b1', { status: 'read', rating: 5 });
		const data = getUserBookData('u1', 'b1');
		expect(data?.status).toBe('read');
		expect(data?.rating).toBe(5);
	});

	it('should return null for non-existent data', () => {
		const data = getUserBookData('u1', 'b1');
		expect(data).toBeNull();
	});

	it('should auto-set dateStarted when status changes to reading', () => {
		q.setItem('userBookData', 'u1:b1', { userId: 'u1', bookId: 'b1', status: 'unread', isWishlist: false });
		const result = setUserBookData('u1', 'b1', { status: 'reading' });
		expect(result.dateStarted).toBeDefined();
	});

	it('should auto-set dateRead when status changes to read', () => {
		q.setItem('userBookData', 'u1:b2', { userId: 'u1', bookId: 'b2', status: 'reading', isWishlist: false });
		const result = setUserBookData('u1', 'b2', { status: 'read' });
		expect(result.dateRead).toBeDefined();
	});

	it('should not override explicit dateRead', () => {
		q.setItem('userBookData', 'u1:b3', { userId: 'u1', bookId: 'b3', status: 'reading', isWishlist: false });
		const result = setUserBookData('u1', 'b3', { status: 'read', dateRead: '2024' });
		expect(result.dateRead).toBe('2024');
	});

	it('should store tags as array', () => {
		q.setItem('userBookData', 'u1:b4', { userId: 'u1', bookId: 'b4', status: 'unread', isWishlist: false });
		const result = setUserBookData('u1', 'b4', { tags: ['fiction', 'mystery'] });
		expect(result.tags).toEqual(['fiction', 'mystery']);
	});

	it('should store DNF reason and page', () => {
		q.setItem('userBookData', 'u1:b10', { userId: 'u1', bookId: 'b10', status: 'dnf', isWishlist: false });
		const result = setUserBookData('u1', 'b10', { dnfReason: 'Too boring', dnfPage: 42 });
		expect(result.dnfReason).toBe('Too boring');
		expect(result.dnfPage).toBe(42);
	});

	it('should store quotes array', () => {
		q.setItem('userBookData', 'u1:b11', { userId: 'u1', bookId: 'b11', status: 'read', isWishlist: false });
		const quotes = [{ text: 'To be or not to be', page: 42, note: 'Famous' }];
		const result = setUserBookData('u1', 'b11', { quotes });
		expect(result.quotes).toHaveLength(1);
		expect(result.quotes![0].text).toBe('To be or not to be');
	});

	it('should store readHistory array', () => {
		q.setItem('userBookData', 'u1:b12', { userId: 'u1', bookId: 'b12', status: 'read', isWishlist: false });
		const history = [{ dateStarted: '2024-01', dateFinished: '2024-02', rating: 4.5 }];
		const result = setUserBookData('u1', 'b12', { readHistory: history });
		expect(result.readHistory).toHaveLength(1);
		expect(result.readHistory![0].rating).toBe(4.5);
	});

	it('should store acquisition fields', () => {
		q.setItem('userBookData', 'u1:b13', { userId: 'u1', bookId: 'b13', status: 'unread', isWishlist: false });
		const result = setUserBookData('u1', 'b13', { acquiredFrom: 'Gramedia', acquiredPrice: '85000', acquiredDate: '2024-03-15' });
		expect(result.acquiredFrom).toBe('Gramedia');
		expect(result.acquiredPrice).toBe('85000');
	});
});
