import { q, type Book, type UserBookData, type User, type Series, type Shelf } from '$lib/db';
import { getCoverBase64, setCoverBase64 } from './coverCache';
import { getUserBookData } from './userbooks';
import { findSimilarBooks, hasBookWithISBN, addBook } from './books';

export async function exportData(): Promise<string> {
	const users = q.getAll<User>('users');
	const books = q.getAll<Book>('books');
	const userBookData = q.getAll<UserBookData>('userBookData');
	const series = q.getAll<Series>('series');
	const shelves = q.getAll<Shelf>('shelves');
	const goals = q.getAll('goals');

	// Attach cover base64 from coverCache
	const booksWithCovers = await Promise.all(
		books.map(async (book) => {
			const coverBase64 = await getCoverBase64(book.id);
			return {
				...book,
				coverBase64: coverBase64 || undefined
			};
		})
	);

	return JSON.stringify(
		{
			version: 5,
			exportedAt: new Date().toISOString(),
			users,
			books: booksWithCovers,
			userBookData,
			series,
			shelves,
			goals
		},
		null,
		2
	);
}

function csvEscape(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return '"' + value.replace(/"/g, '""') + '"';
	}
	return value;
}

export function exportCSV(userId: string): string {
	const books = q.getAll<Book>('books');
	const headers = ['Title', 'Authors', 'ISBN', 'Publisher', 'Publish Year', 'Edition', 'Categories', 'Tags', 'Date Added', 'Date Started', 'Date Read', 'Status', 'Rating', 'Notes'];
	const rows = books.map((book) => {
		const ubd = getUserBookData(userId, book.id);
		return [
			book.title,
			(book.authors || []).join('; '),
			book.isbn || '',
			book.publisher || '',
			book.publishYear?.toString() || '',
			book.edition || '',
			(book.categories || []).join('; '),
			(ubd?.tags || []).join('; '),
			book.dateAdded,
			ubd?.dateStarted || '',
			ubd?.dateRead || '',
			ubd?.status || 'unread',
			ubd?.rating?.toString() || '',
			ubd?.notes || ''
		].map(csvEscape).join(',');
	});
	return [headers.join(','), ...rows].join('\n');
}

export async function exportXLSX(userId: string): Promise<Blob> {
	const XLSX = await import('xlsx');
	const books = q.getAll<Book>('books');

	const rows = books.map((book) => {
		const ubd = getUserBookData(userId, book.id);
		return {
			Title: book.title,
			Authors: (book.authors || []).join('; '),
			ISBN: book.isbn || '',
			Publisher: book.publisher || '',
			'Publish Year': book.publishYear || '',
			Edition: book.edition || '',
			Categories: (book.categories || []).join('; '),
			Tags: (ubd?.tags || []).join('; '),
			'Date Added': book.dateAdded,
			'Date Started': ubd?.dateStarted || '',
			'Date Read': ubd?.dateRead || '',
			Status: ubd?.status || 'unread',
			Rating: ubd?.rating || '',
			Notes: ubd?.notes || ''
		};
	});

	const ws = XLSX.utils.json_to_sheet(rows);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Books');

	const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
	return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function importXLSX(file: ArrayBuffer, userId: string): Promise<number> {
	const XLSX = await import('xlsx');
	const wb = XLSX.read(file, { type: 'array' });
	const ws = wb.Sheets[wb.SheetNames[0]];
	if (!ws) throw new Error('Empty spreadsheet');

	const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
	if (rows.length === 0) throw new Error('No data rows');

	let imported = 0;

	for (const row of rows) {
		const title = (row['Title'] || '').trim();
		if (!title) continue;

		const isbn = (row['ISBN'] || '').replace(/[^0-9Xx]/g, '').trim() || undefined;

		// Skip duplicates (same logic as Goodreads import)
		if (isbn && hasBookWithISBN(isbn)) continue;
		if (findSimilarBooks(title).length > 0) continue;

		const authors = (row['Authors'] || '').split(';').map(a => a.trim()).filter(Boolean);
		const categories = (row['Categories'] || '').split(';').map(c => c.trim().toLowerCase()).filter(Boolean);
		const publishYear = parseInt(row['Publish Year'] || '0') || undefined;

		const book = addBook({
			title,
			authors,
			isbn,
			publisher: (row['Publisher'] || '').trim() || undefined,
			publishYear,
			edition: (row['Edition'] || '').trim() || undefined,
			categories,
			coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : undefined
		}, true);

		if (book) {
			// Set user book data if status/rating provided
			const status = (row['Status'] || '').trim().toLowerCase();
			const rating = parseFloat(row['Rating'] || '0') || undefined;
			const notes = (row['Notes'] || '').trim() || undefined;
			const dateRead = (row['Date Read'] || '').trim() || undefined;
			const dateStarted = (row['Date Started'] || '').trim() || undefined;
			const tags = (row['Tags'] || '').split(';').map(t => t.trim().toLowerCase()).filter(Boolean);

			if (status || rating || notes || dateStarted || tags.length > 0) {
				const validStatus = ['read', 'reading', 'unread', 'dnf'].includes(status) ? status as 'read' | 'reading' | 'unread' | 'dnf' : 'unread';
				const key = `${userId}:${book.id}`;
				q.setItem('userBookData', key, {
					userId,
					bookId: book.id,
					status: validStatus,
					rating,
					notes,
					tags: tags.length > 0 ? tags : undefined,
					dateStarted: validStatus === 'reading' ? (dateStarted || new Date().toISOString()) : dateStarted,
					dateRead: validStatus === 'read' ? (dateRead || new Date().toISOString()) : undefined,
					isWishlist: false
				});
			}

			imported++;
		}
	}

	return imported;
}

export async function importData(json: string): Promise<void> {
	const data = JSON.parse(json);

	if (!data.version || !data.books) {
		throw new Error('Invalid backup file');
	}

	if (data.users) {
		for (const user of data.users) {
			q.setItem('users', user.id, user);
		}
	}

	if (data.books) {
		for (const b of data.books) {
			const { coverBase64, coverBlob, ...bookData } = b;
			// Normalize dates to ISO strings (old backups may have Date objects serialized)
			if (bookData.dateAdded && typeof bookData.dateAdded !== 'string') {
				bookData.dateAdded = new Date(bookData.dateAdded).toISOString();
			}
			if (bookData.dateModified && typeof bookData.dateModified !== 'string') {
				bookData.dateModified = new Date(bookData.dateModified).toISOString();
			}
			q.setItem('books', bookData.id, bookData);

			// Store cover in coverCache if present
			if (coverBase64) {
				await setCoverBase64(bookData.id, coverBase64);
			}
		}
	}

	if (data.userBookData) {
		for (const ubd of data.userBookData) {
			// Support old format with standalone id, or new compound key
			const key = `${ubd.userId}:${ubd.bookId}`;
			const { id: _id, ...rest } = ubd;
			q.setItem('userBookData', key, { userId: ubd.userId, bookId: ubd.bookId, ...rest });
		}
	}

	if (data.series) {
		for (const s of data.series) {
			q.setItem('series', s.id, s);
		}
	}

	if (data.shelves) {
		for (const s of data.shelves) {
			const shelfData = {
				...s,
				dateCreated:
					typeof s.dateCreated === 'string' ? s.dateCreated : new Date(s.dateCreated).toISOString()
			};
			q.setItem('shelves', shelfData.id, shelfData);
		}
	}

	if (data.goals) {
		for (const g of data.goals) {
			const key = g.userId && g.year ? `${g.userId}:${g.year}` : null;
			if (key) {
				q.setItem('goals', key, g);
			}
		}
	}
}
