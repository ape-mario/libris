import { q, type UserBookData } from '$lib/db';

export function getUserBookData(userId: string, bookId: string): UserBookData | null {
	const key = `${userId}:${bookId}`;
	return q.getItem<UserBookData>('userBookData', key) ?? null;
}

export function setUserBookData(
	userId: string,
	bookId: string,
	updates: Partial<
		Pick<
			UserBookData,
			'status' | 'rating' | 'notes' | 'lentTo' | 'lentDate' | 'isWishlist' | 'currentPage' | 'totalPages'
		>
	>
): UserBookData {
	const key = `${userId}:${bookId}`;
	const existing = q.getItem<UserBookData>('userBookData', key);

	// Auto-manage dateRead when status changes
	const effectiveUpdates: Record<string, unknown> = { ...updates };
	if (updates.status === 'read' && existing?.status !== 'read') {
		effectiveUpdates.dateRead = new Date().toISOString();
	} else if (updates.status && updates.status !== 'read' && existing?.status === 'read') {
		effectiveUpdates.dateRead = undefined; // clears the field
	}

	if (existing) {
		q.updateItem('userBookData', key, effectiveUpdates);
		return { ...existing, ...effectiveUpdates } as UserBookData;
	}

	const data: UserBookData = {
		userId,
		bookId,
		status: 'unread',
		isWishlist: false,
		...effectiveUpdates
	} as UserBookData;
	q.setItem('userBookData', key, data);
	return data;
}

export function getUserBooks(
	userId: string,
	filter?: { status?: string; isWishlist?: boolean }
): UserBookData[] {
	let results = q.filter<UserBookData>('userBookData', (d) => d.userId === userId);

	if (filter?.status) {
		results = results.filter((d) => d.status === filter.status);
	}
	if (filter?.isWishlist !== undefined) {
		results = results.filter((d) => d.isWishlist === filter.isWishlist);
	}
	return results;
}

export function getLentBooks(userId: string): UserBookData[] {
	return q.filter<UserBookData>('userBookData', (d) => d.userId === userId && !!d.lentTo);
}
