import Dexie, { type EntityTable } from 'dexie';
import type { User, Book, UserBookData, Series, Category } from './types';

const db = new Dexie('MyBooksDB') as Dexie & {
  users: EntityTable<User, 'id'>;
  books: EntityTable<Book, 'id'>;
  userBookData: EntityTable<UserBookData, 'id'>;
  series: EntityTable<Series, 'id'>;
  categories: EntityTable<Category, 'id'>;
};

db.version(1).stores({
  users: 'id, name',
  books: 'id, title, isbn, *categories, seriesId, dateAdded',
  userBookData: 'id, [userId+bookId], userId, bookId, status, isWishlist',
  series: 'id, name',
  categories: 'id, name'
});

export { db };
export type { User, Book, UserBookData, Series, Category };
