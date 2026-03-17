import { db, type Series } from '$lib/db';

export async function createSeries(name: string, description?: string): Promise<Series> {
  const series: Series = { id: crypto.randomUUID(), name, description };
  await db.series.add(series);
  return series;
}

export async function getAllSeries(): Promise<Series[]> {
  return db.series.orderBy('name').toArray();
}

export async function deleteSeries(id: string): Promise<void> {
  await db.books.where('seriesId').equals(id).modify({ seriesId: undefined, seriesOrder: undefined });
  await db.series.delete(id);
}
