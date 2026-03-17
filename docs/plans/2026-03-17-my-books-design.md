# My Books — Design Document

## Overview

A local-first PWA for managing a personal/household book collection. Installable on phone, works offline, supports multiple users sharing a single library.

## Architecture

SvelteKit 2 (Svelte 5) static build with client-side IndexedDB storage via Dexie.js. No backend required. Optional cloud sync (CouchDB/PouchDB) can be added later without restructuring.

```
┌─────────────────────────────────────┐
│           SvelteKit App             │
│  (SSG/static build, PWA manifest)   │
├─────────────────────────────────────┤
│  UI Layer: Svelte 5 components      │
│  ├── Book List (grid/list view)     │
│  ├── Book Detail / Editor           │
│  ├── Category & Series Manager      │
│  ├── Barcode Scanner (QuaggaJS)     │
│  ├── Book Search (Open Library API) │
│  └── Wishlist                       │
├─────────────────────────────────────┤
│  Data Layer: Dexie.js (IndexedDB)   │
│  ├── Books, Categories, Series      │
│  ├── Full-text search               │
│  └── Export/Import (JSON backup)    │
├─────────────────────────────────────┤
│  Optional Future: CouchDB + PouchDB │
│  (sync across devices)              │
└─────────────────────────────────────┘
```

## Data Model

### Book (shared — household library)

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| title | string | Required |
| authors | string[] | One or more |
| isbn | string? | For lookup/dedup |
| coverUrl | string? | From Open Library |
| coverBlob | Blob? | Cached locally for offline / custom upload |
| categories | string[] | e.g. ["comics", "sci-fi"] |
| seriesId | string? | FK to Series |
| seriesOrder | number? | Position in series |
| dateAdded | date | Auto-set |
| dateModified | date | Auto-updated |

### UserBookData (per-user)

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| userId | string | FK to User |
| bookId | string | FK to Book |
| status | "unread" \| "reading" \| "read" | Reading tracker |
| rating | number? | 1-5 stars |
| notes | string? | Personal notes |
| lentTo | string? | Person's name |
| lentDate | date? | When lent |
| isWishlist | boolean | true = wishlist item |

### User

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| name | string | Display name |
| avatar | string? | Emoji or image |

### Series

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| name | string | e.g. "Lord of the Rings" |
| description | string? | Optional |

### Category

| Field | Type | Notes |
|-------|------|-------|
| id | string (UUID) | Primary key |
| name | string | e.g. "Comics", "Novel" |
| color | string? | For UI tags |

## Shared vs. Per-User Data

| Shared (household) | Per-user (personal) |
|---------------------|---------------------|
| Book catalog (title, author, ISBN, cover) | Reading status |
| Categories & Series | Rating & notes |
| Physical ownership | Wishlist |
| | Lending tracker |

## Pages & Navigation

Bottom tab navigation (mobile-first):

```
┌─────────────────────────────────────┐
│  [Profile Switcher]        [+ Add]  │  ← Top bar
├─────────────────────────────────────┤
│         Page Content                │
├─────────────────────────────────────┤
│  📚 Library  │ 📂 Browse │ ⭐ Mine  │  ← Bottom tabs
└─────────────────────────────────────┘
```

| Page | Purpose |
|------|---------|
| Library (home) | All owned books. Search, filter by category/series/author, sort by title/date/rating |
| Browse | Browse by category, series, author. Tap a group to see its books |
| Mine | Current user's reading list, wishlist, lent books, ratings |
| Book Detail | Cover, metadata, status, rating, notes, lending. Edit/delete |
| Add Book | Barcode scan, Open Library search, or manual entry. Upload/change cover |
| Profile Picker | Switch between users (Netflix-style, no passwords) |

### Key Interactions

- Swipe on book card → quick actions (mark read, lend, wishlist)
- Long press → multi-select for batch categorize/delete
- Search → full-text across title, author, notes

## Adding Books

Three input methods:
1. **Barcode scan** — QuaggaJS reads ISBN, auto-fills from Open Library
2. **Search** — query Open Library by title/author, pick from results
3. **Manual entry** — type all fields by hand

Cover images:
- Auto-fetched from Open Library when available
- User can upload custom cover (camera or file picker)
- Resized client-side (max 400px wide, compressed JPEG) via Canvas API
- Stored as Blob in IndexedDB, takes priority over URL

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | SvelteKit 2 + Svelte 5 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Local DB | Dexie.js 4 |
| PWA | @vite-pwa/sveltekit |
| Barcode | QuaggaJS 2 |
| Book API | Open Library API |
| Image resize | Browser Canvas API |
| Deploy | @sveltejs/adapter-static |

## Error Handling & Edge Cases

| Scenario | Handling |
|----------|----------|
| Offline | Fully functional — IndexedDB + cached covers + service worker |
| Barcode scan fails | Fall back to manual ISBN or title search |
| No Open Library result | Manual entry for all fields |
| No cover found | Placeholder + prompt for custom upload |
| IndexedDB full | Warn user, suggest JSON export + clear old cover blobs |
| Duplicate book | Detect by ISBN, warn before adding |
| Delete profile | Confirm dialog, remove UserBookData, shared books stay |
| Large collection (500-1k) | Virtual scrolling, paginated Dexie queries |

## Data Safety

- Export/Import: JSON backup of entire library (books + user data + categories + series)
- Covers exported separately as zip
- Available from settings page, manual trigger

## Future Considerations

- Cloud sync via CouchDB + PouchDB (userId FK pattern supports this without restructuring)
- Profile picker upgradeable to real auth (email/password, OAuth)
- Reading stats/analytics
