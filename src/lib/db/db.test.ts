import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './index';

beforeEach(async () => {
  await db.users.clear();
  await db.books.clear();
  await db.userBookData.clear();
  await db.series.clear();
  await db.categories.clear();
});

describe('Database', () => {
  it('should add and retrieve a user', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    const user = await db.users.get('u1');
    expect(user?.name).toBe('Alice');
  });

  it('should add and retrieve a book', async () => {
    const book = {
      id: 'b1',
      title: 'Dune',
      authors: ['Frank Herbert'],
      categories: ['sci-fi'],
      dateAdded: new Date(),
      dateModified: new Date()
    };
    await db.books.add(book);
    const result = await db.books.get('b1');
    expect(result?.title).toBe('Dune');
    expect(result?.authors).toEqual(['Frank Herbert']);
  });

  it('should add user book data linked to user and book', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.books.add({
      id: 'b1', title: 'Dune', authors: ['Frank Herbert'],
      categories: [], dateAdded: new Date(), dateModified: new Date()
    });
    await db.userBookData.add({
      id: 'ubd1', userId: 'u1', bookId: 'b1',
      status: 'reading', isWishlist: false
    });

    const data = await db.userBookData.where({ userId: 'u1', bookId: 'b1' }).first();
    expect(data?.status).toBe('reading');
  });

  it('should query books by category using multi-entry index', async () => {
    await db.books.add({
      id: 'b1', title: 'Watchmen', authors: ['Alan Moore'],
      categories: ['comics', 'sci-fi'], dateAdded: new Date(), dateModified: new Date()
    });
    await db.books.add({
      id: 'b2', title: 'Dune', authors: ['Frank Herbert'],
      categories: ['sci-fi', 'novel'], dateAdded: new Date(), dateModified: new Date()
    });

    const sciFiBooks = await db.books.where('categories').equals('sci-fi').toArray();
    expect(sciFiBooks).toHaveLength(2);

    const comics = await db.books.where('categories').equals('comics').toArray();
    expect(comics).toHaveLength(1);
    expect(comics[0].title).toBe('Watchmen');
  });

  it('should add and retrieve a series with books', async () => {
    await db.series.add({ id: 's1', name: 'Lord of the Rings' });
    await db.books.add({
      id: 'b1', title: 'Fellowship of the Ring', authors: ['J.R.R. Tolkien'],
      categories: ['fantasy'], seriesId: 's1', seriesOrder: 1,
      dateAdded: new Date(), dateModified: new Date()
    });

    const seriesBooks = await db.books.where('seriesId').equals('s1').toArray();
    expect(seriesBooks).toHaveLength(1);
    expect(seriesBooks[0].seriesOrder).toBe(1);
  });
});
