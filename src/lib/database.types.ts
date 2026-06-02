// Hand-written to mirror supabase/migrations/20260517000001_initial_schema.sql.
// When the schema gets bigger, swap this for output of:
//   npx supabase gen types typescript --project-id <ref> --schema public

export type Format =
  | 'paperback'
  | 'hardcover'
  | 'ebook'
  | 'audiobook'
  | 'special_edition'
  | 'other'

export type Condition = 'new' | 'second_hand' | 'unknown'

export type ListKind = 'tbr_top' | 'tbr_pool' | 'wishlist'

type Timestamps = {
  created_at: string
  updated_at: string
}

export type BookRow = Timestamps & {
  id: string
  user_id: string
  title: string
  authors: string[]
  publisher: string | null
  published_year: number | null
  description: string | null
  genres: string[]
  tags: string[]
  cover_path: string | null
  rating: number | null
  openlibrary_work_id: string | null
  series_name: string | null
  series_index: number | null
}

export type EditionRow = Timestamps & {
  id: string
  user_id: string
  book_id: string
  format: Format
  isbn: string | null
  publisher: string | null
  publication_date: string | null
  page_count: number | null
  duration_seconds: number | null
  purchase_date: string | null
  purchase_location: string | null
  purchase_price: number | null
  currency: string | null
  condition: Condition | null
  notes: string | null
  cover_path: string | null
  started_at: string | null
  finished_at: string | null
  is_trophy: boolean
}

export type ReadingSessionRow = {
  id: string
  user_id: string
  edition_id: string
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export type NoteRow = Timestamps & {
  id: string
  user_id: string
  book_id: string
  body: string
}

export type QuoteRow = {
  id: string
  user_id: string
  book_id: string
  body: string
  character: string | null
  location: string | null
  created_at: string
}

export type BookmarkRow = {
  id: string
  user_id: string
  book_id: string
  note: string | null
  location: string | null
  created_at: string
}

export type ListItemRow = {
  id: string
  user_id: string
  book_id: string
  list_kind: ListKind
  position: number | null
  created_at: string
}

// Database shape expected by `createClient<Database>(...)`.
// `Row` = what you get back from .select()
// `Insert` = what you can pass to .insert() (server fills id/timestamps)
// `Update` = what you can pass to .update() (everything optional)
//
// Each table also declares `Relationships: []`, and the schema declares
// empty `Views` / `Functions`. These are required by supabase-js v2's
// GenericSchema constraint — without them, type inference on .insert()
// / .select() collapses and you lose autocomplete.
type TableShape<Row> = {
  Row: Row
  Insert: Partial<Row>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      books: TableShape<BookRow>
      editions: TableShape<EditionRow>
      reading_sessions: TableShape<ReadingSessionRow>
      notes: TableShape<NoteRow>
      quotes: TableShape<QuoteRow>
      bookmarks: TableShape<BookmarkRow>
      list_items: TableShape<ListItemRow>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
