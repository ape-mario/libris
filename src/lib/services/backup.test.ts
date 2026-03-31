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

// Mock coverCache since it uses IndexedDB
vi.mock('./coverCache', () => ({
	getCoverBase64: vi.fn().mockResolvedValue(null),
	setCoverBase64: vi.fn().mockResolvedValue(undefined)
}));

import { exportData, importData } from './backup';

beforeEach(() => {
	doc = new Y.Doc();
	q = createQueryHelpers(doc);
});

describe('Backup service', () => {
	it('should export CSV with correct columns', async () => {
		q.setItem('users', 'u1', { id: 'u1', name: 'Alice' });
		q.setItem('books', 'b1', {
			id: 'b1',
			title: 'Dune',
			authors: ['Frank Herbert'],
			isbn: '9780441013593',
			publisher: 'Ace Books',
			publishYear: 1965,
			edition: '1st',
			categories: ['sci-fi', 'classic'],
			dateAdded: '2024-01-15T00:00:00.000Z',
			dateModified: '2024-01-15T00:00:00.000Z'
		});
		q.setItem('userBookData', 'u1:b1', {
			userId: 'u1',
			bookId: 'b1',
			status: 'dnf',
			isWishlist: false,
			rating: 4,
			notes: 'Great world-building',
			tags: ['favorites', 'sci-fi'],
			dateStarted: '2024-01-20T00:00:00.000Z',
			dateRead: '2024-02-10T00:00:00.000Z',
			dnfReason: 'Too slow',
			dnfPage: 150
		});

		const { exportCSV } = await import('./backup');
		const csv = exportCSV('u1');
		const lines = csv.split('\n');

		// Verify headers
		const headers = lines[0].split(',');
		expect(headers).toEqual([
			'Title', 'Authors', 'ISBN', 'Publisher', 'Publish Year', 'Edition',
			'Categories', 'Tags', 'Date Added', 'Date Started', 'Date Read',
			'Status', 'Rating', 'Notes', 'DNF Reason', 'DNF Page'
		]);

		// Verify data row
		expect(lines).toHaveLength(2);
		const dataRow = lines[1];
		expect(dataRow).toContain('Dune');
		expect(dataRow).toContain('Frank Herbert');
		expect(dataRow).toContain('9780441013593');
		expect(dataRow).toContain('Ace Books');
		expect(dataRow).toContain('1965');
		expect(dataRow).toContain('1st');
		expect(dataRow).toContain('sci-fi; classic');
		expect(dataRow).toContain('favorites; sci-fi');
		expect(dataRow).toContain('dnf');
		expect(dataRow).toContain('4');
		expect(dataRow).toContain('Great world-building');
		expect(dataRow).toContain('Too slow');
		expect(dataRow).toContain('150');
	});

	it('should export and import data', async () => {
		q.setItem('users', 'u1', { id: 'u1', name: 'Alice' });
		q.setItem('books', 'b1', {
			id: 'b1',
			title: 'Dune',
			authors: ['Frank Herbert'],
			categories: ['sci-fi'],
			dateAdded: new Date().toISOString(),
			dateModified: new Date().toISOString()
		});

		const json = await exportData();
		const parsed = JSON.parse(json);
		expect(parsed.books).toHaveLength(1);
		expect(parsed.users).toHaveLength(1);
		expect(parsed.version).toBe(5);

		// Clear and reimport
		doc = new Y.Doc();
		q = createQueryHelpers(doc);
		await importData(json);

		expect(q.getAll('books')).toHaveLength(1);
		expect(q.getAll('users')).toHaveLength(1);
	});
});
