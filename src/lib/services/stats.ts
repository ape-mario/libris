import { q, type Book, type UserBookData } from '$lib/db';

export interface YearInReview {
	year: number;
	totalRead: number;
	totalPages: number;
	averageRating: number;
	topGenre: string | null;
	topAuthor: string | null;
	shortestBook: { title: string; pages: number } | null;
	longestBook: { title: string; pages: number } | null;
	fastestRead: { title: string; days: number } | null;
	booksPerMonth: { month: string; count: number }[];
	ratingDistribution: number[];
	favoriteBook: { title: string; rating: number } | null;
}

export function getYearInReview(userId: string, year: number): YearInReview | null {
	const stats = getReadingStats(userId, year);
	if (stats.totalRead === 0) return null;

	const allBooks = q.getAll<Book>('books');
	const userData = q.filter<UserBookData>('userBookData', (d) => d.userId === userId && d.status === 'read');
	const userBookMap = new Map(allBooks.map(b => [b.id, b]));

	// Filter to this year's reads
	const yearReads = userData.filter(ud => {
		if (!ud.dateRead) return false;
		const readYear = parseInt(ud.dateRead.slice(0, 4));
		return readYear === year;
	});

	// Shortest/longest by pages
	const withPages = yearReads
		.filter(ud => ud.totalPages && ud.totalPages > 0)
		.map(ud => ({ title: userBookMap.get(ud.bookId)?.title || '?', pages: ud.totalPages! }));
	withPages.sort((a, b) => a.pages - b.pages);

	// Fastest read (dateStarted → dateRead)
	let fastestRead: YearInReview['fastestRead'] = null;
	for (const ud of yearReads) {
		if (!ud.dateStarted || !ud.dateRead) continue;
		const start = new Date(ud.dateStarted).getTime();
		const end = new Date(ud.dateRead).getTime();
		const days = Math.max(1, Math.round((end - start) / 86400000));
		const title = userBookMap.get(ud.bookId)?.title || '?';
		if (!fastestRead || days < fastestRead.days) {
			fastestRead = { title, days };
		}
	}

	// Favorite book (highest rated)
	let favoriteBook: YearInReview['favoriteBook'] = null;
	for (const ud of yearReads) {
		if (!ud.rating) continue;
		const title = userBookMap.get(ud.bookId)?.title || '?';
		if (!favoriteBook || ud.rating > favoriteBook.rating) {
			favoriteBook = { title, rating: ud.rating };
		}
	}

	return {
		year,
		totalRead: stats.totalRead,
		totalPages: stats.totalPages,
		averageRating: stats.averageRating,
		topGenre: stats.genreBreakdown[0]?.name || null,
		topAuthor: stats.topAuthors[0]?.name || null,
		shortestBook: withPages[0] || null,
		longestBook: withPages[withPages.length - 1] || null,
		fastestRead,
		booksPerMonth: stats.booksPerMonth,
		ratingDistribution: stats.ratingDistribution,
		favoriteBook
	};
}

export interface ReadingStats {
	totalBooks: number;
	totalRead: number;
	totalReading: number;
	totalDnf: number;
	totalWishlist: number;
	averageRating: number;
	ratingDistribution: number[];
	booksPerMonth: { month: string; count: number }[];
	genreBreakdown: { name: string; count: number }[];
	topAuthors: { name: string; count: number }[];
	totalPages: number;
}

function getReadDate(ud: UserBookData, userBooks: Book[]): Date | null {
	if (ud.dateRead) return new Date(ud.dateRead);
	const book = userBooks.find((b) => b.id === ud.bookId);
	return book ? new Date(book.dateAdded) : null;
}

function matchesYear(ud: UserBookData, userBooks: Book[], year: number): boolean {
	const readDate = getReadDate(ud, userBooks);
	return readDate ? readDate.getFullYear() === year : false;
}

export function getAvailableYears(userId: string): number[] {
	const allBooks = q.getAll<Book>('books');
	const userData = q.filter<UserBookData>('userBookData', (d) => d.userId === userId);
	const userBookIds = new Set(userData.map((d) => d.bookId));
	const userBooks = allBooks.filter((b) => userBookIds.has(b.id));

	const years = new Set<number>();
	for (const ud of userData) {
		if (ud.status === 'read') {
			const readDate = getReadDate(ud, userBooks);
			if (readDate) years.add(readDate.getFullYear());
		}
	}
	return [...years].sort((a, b) => b - a);
}

export function getReadingStats(userId: string, year?: number): ReadingStats {
	const allBooks = q.getAll<Book>('books');
	const userData = q.filter<UserBookData>('userBookData', (d) => d.userId === userId);

	const userBookIds = new Set(userData.map((d) => d.bookId));
	const userBooks = allBooks.filter((b) => userBookIds.has(b.id));

	// For year filter: only include books read in that year
	const filteredData = year
		? userData.filter((d) => {
			if (d.status !== 'read') return false;
			return matchesYear(d, userBooks, year);
		})
		: userData;

	const filteredBookIds = new Set(filteredData.map((d) => d.bookId));
	const filteredBooks = userBooks.filter((b) => filteredBookIds.has(b.id));

	const totalRead = filteredData.filter((d) => d.status === 'read').length;
	const totalReading = year ? 0 : userData.filter((d) => d.status === 'reading').length;
	const totalDnf = year ? 0 : userData.filter((d) => d.status === 'dnf').length;
	const totalWishlist = year ? 0 : userData.filter((d) => d.isWishlist).length;

	const rated = filteredData.filter((d) => d.status === 'read' && d.rating && d.rating > 0);
	const averageRating =
		rated.length > 0 ? rated.reduce((sum, d) => sum + (d.rating || 0), 0) / rated.length : 0;

	const ratingDistribution = [0, 0, 0, 0, 0];
	for (const d of rated) {
		if (d.rating && d.rating >= 1 && d.rating <= 5) {
			ratingDistribution[d.rating - 1]++;
		}
	}

	// Books per month: if year specified, show Jan-Dec of that year; otherwise last 12 months
	const now = new Date();
	const booksPerMonth: { month: string; count: number }[] = [];
	for (let i = 11; i >= 0; i--) {
		const d = year
			? new Date(year, 11 - i, 1)
			: new Date(now.getFullYear(), now.getMonth() - i, 1);
		const label = d.toLocaleDateString('en', { month: 'short', year: '2-digit' });

		const count = filteredData.filter((ud) => {
			if (ud.status !== 'read') return false;
			const readDate = getReadDate(ud, userBooks);
			if (!readDate) return false;
			return readDate.getFullYear() === d.getFullYear() && readDate.getMonth() === d.getMonth();
		}).length;

		booksPerMonth.push({ month: label, count });
	}

	const genreMap = new Map<string, number>();
	for (const book of filteredBooks) {
		for (const cat of book.categories || []) {
			genreMap.set(cat, (genreMap.get(cat) || 0) + 1);
		}
	}
	const genreBreakdown = [...genreMap.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 8);

	const authorMap = new Map<string, number>();
	for (const book of filteredBooks) {
		for (const author of book.authors || []) {
			authorMap.set(author, (authorMap.get(author) || 0) + 1);
		}
	}
	const topAuthors = [...authorMap.entries()]
		.map(([name, count]) => ({ name, count }))
		.sort((a, b) => b.count - a.count)
		.slice(0, 6);

	const totalPages = filteredData
		.filter((d) => d.status === 'read' && d.totalPages)
		.reduce((sum, d) => sum + (d.totalPages || 0), 0);

	return {
		totalBooks: year ? totalRead : filteredBooks.length,
		totalRead,
		totalReading,
		totalDnf,
		totalWishlist,
		averageRating,
		ratingDistribution,
		booksPerMonth,
		genreBreakdown,
		topAuthors,
		totalPages
	};
}
