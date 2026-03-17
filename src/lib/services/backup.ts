import { db } from '$lib/db';

export async function exportData(): Promise<string> {
  const [users, books, userBookData, series, categories] = await Promise.all([
    db.users.toArray(),
    db.books.toArray().then((books) =>
      books.map(({ coverBlob, ...rest }) => rest)
    ),
    db.userBookData.toArray(),
    db.series.toArray(),
    db.categories.toArray()
  ]);

  return JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), users, books, userBookData, series, categories }, null, 2);
}

export async function importData(json: string): Promise<void> {
  const data = JSON.parse(json);

  await db.transaction('rw', [db.users, db.books, db.userBookData, db.series, db.categories], async () => {
    if (data.users) await db.users.bulkPut(data.users);
    if (data.books) {
      const books = data.books.map((b: any) => ({
        ...b,
        dateAdded: new Date(b.dateAdded),
        dateModified: new Date(b.dateModified)
      }));
      await db.books.bulkPut(books);
    }
    if (data.userBookData) await db.userBookData.bulkPut(data.userBookData);
    if (data.series) await db.series.bulkPut(data.series);
    if (data.categories) await db.categories.bulkPut(data.categories);
  });
}
