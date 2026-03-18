import { q, type ReadingGoal, type UserBookData } from '$lib/db';

export function getGoal(userId: string, year: number = new Date().getFullYear()): ReadingGoal | null {
	return q.getItem<ReadingGoal>('goals', `${userId}:${year}`) ?? null;
}

export function setGoal(userId: string, target: number, year: number = new Date().getFullYear()): void {
	q.setItem('goals', `${userId}:${year}`, { userId, year, target });
}

export function removeGoal(userId: string, year: number = new Date().getFullYear()): void {
	q.deleteItem('goals', `${userId}:${year}`);
}

export function getBooksReadThisYear(userId: string): number {
	const year = new Date().getFullYear();
	const userData = q.filter<UserBookData>('userBookData', (d) => d.userId === userId && d.status === 'read');

	return userData.filter((d) => {
		// Use dateRead if available, fall back to looking up book.dateAdded for legacy data
		if (d.dateRead) {
			return new Date(d.dateRead).getFullYear() === year;
		}
		// Fallback for records without dateRead (pre-migration)
		const book = q.getItem<{ dateAdded: string }>('books', d.bookId);
		return book ? new Date(book.dateAdded).getFullYear() === year : false;
	}).length;
}
