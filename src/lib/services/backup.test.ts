import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '$lib/db';
import { exportData, importData } from './backup';

beforeEach(async () => {
  await db.books.clear();
  await db.users.clear();
  await db.userBookData.clear();
  await db.series.clear();
  await db.categories.clear();
});

describe('Backup service', () => {
  it('should export and import data', async () => {
    await db.users.add({ id: 'u1', name: 'Alice' });
    await db.books.add({
      id: 'b1', title: 'Dune', authors: ['Frank Herbert'],
      categories: ['sci-fi'], dateAdded: new Date(), dateModified: new Date()
    });

    const json = await exportData();
    const parsed = JSON.parse(json);
    expect(parsed.books).toHaveLength(1);
    expect(parsed.users).toHaveLength(1);

    // Clear and reimport
    await db.books.clear();
    await db.users.clear();
    await importData(json);

    expect(await db.books.count()).toBe(1);
    expect(await db.users.count()).toBe(1);
  });
});
