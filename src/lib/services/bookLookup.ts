export interface OpenLibraryResult {
  title: string;
  authors: string[];
  isbn: string | undefined;
  coverUrl: string | undefined;
  publishYear: number | undefined;
  publisher: string | undefined;
}

export async function searchOpenLibrary(query: string): Promise<OpenLibraryResult[]> {
  // Try Open Library first, fallback to Google Books
  const olResults = await searchOpenLibrary_OL(query);
  if (olResults.length > 0) return olResults;
  return searchGoogleBooks(query);
}

async function searchOpenLibrary_OL(query: string): Promise<OpenLibraryResult[]> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=10&fields=title,author_name,isbn,cover_i,first_publish_year,publisher`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();

    return (data.docs || []).map((doc: any) => ({
      title: doc.title || 'Unknown',
      authors: doc.author_name || [],
      isbn: doc.isbn?.[0],
      coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : undefined,
      publishYear: doc.first_publish_year,
      publisher: doc.publisher?.[0]
    }));
  } catch {
    return [];
  }
}

async function searchGoogleBooks(query: string): Promise<OpenLibraryResult[]> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = await res.json();

    return (data.items || []).map((item: any) => {
      const info = item.volumeInfo || {};
      const identifiers = info.industryIdentifiers || [];
      const isbn = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier
        || identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;

      return {
        title: info.title || 'Unknown',
        authors: info.authors || [],
        isbn,
        coverUrl: info.imageLinks?.thumbnail?.replace('http://', 'https://') || undefined,
        publishYear: info.publishedDate ? parseInt(info.publishedDate) : undefined,
        publisher: info.publisher || undefined
      };
    });
  } catch {
    return [];
  }
}

export async function lookupByISBN(isbn: string): Promise<OpenLibraryResult | null> {
  // Try Open Library first
  const olResult = await lookupByISBN_OpenLibrary(isbn);
  if (olResult) return olResult;

  // Fallback to Google Books API (better coverage for non-English books)
  return lookupByISBN_GoogleBooks(isbn);
}

async function lookupByISBN_OpenLibrary(isbn: string): Promise<OpenLibraryResult | null> {
  const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const entry = data[`ISBN:${isbn}`];
    if (!entry) return null;

    return {
      title: entry.title || 'Unknown',
      authors: (entry.authors || []).map((a: any) => a.name),
      isbn,
      coverUrl: entry.cover?.medium,
      publishYear: entry.publish_date ? parseInt(entry.publish_date) : undefined,
      publisher: (entry.publishers || [])[0]?.name
    };
  } catch {
    return null;
  }
}

async function lookupByISBN_GoogleBooks(isbn: string): Promise<OpenLibraryResult | null> {
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&maxResults=1`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const item = data.items?.[0]?.volumeInfo;
    if (!item) return null;

    return {
      title: item.title || 'Unknown',
      authors: item.authors || [],
      isbn,
      coverUrl: item.imageLinks?.thumbnail?.replace('http://', 'https://') || undefined,
      publishYear: item.publishedDate ? parseInt(item.publishedDate) : undefined,
      publisher: item.publisher || undefined
    };
  } catch {
    return null;
  }
}
