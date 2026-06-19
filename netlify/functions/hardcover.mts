// Proxy to Hardcover's GraphQL API so the API token stays server-side and
// never ships in the browser bundle.
//
// Setup: add HARDCOVER_TOKEN in Netlify (Site settings → Environment
// variables), and to a local `.env` if you run `netlify dev`. Get the token
// from your Hardcover account's API settings.
//
// Endpoint (from the app): /.netlify/functions/hardcover?isbn=<isbn>
// Returns: { match: boolean, editionFormat, pages, seriesName, seriesIndex }
// On any problem it returns 200 with { match:false } / { error } so the app
// quietly falls back to Open Library.

const ENDPOINT = 'https://api.hardcover.app/v1/graphql'

const QUERY = `
  query LookupByIsbn($isbn: String!) {
    editions(
      where: { _or: [{ isbn_13: { _eq: $isbn } }, { isbn_10: { _eq: $isbn } }] }
      limit: 1
    ) {
      edition_format
      pages
      book {
        book_series(limit: 5) {
          featured
          position
          series { name }
        }
      }
    }
  }
`

type BookSeries = {
  featured?: boolean
  position?: number | null
  series?: { name?: string | null } | null
}

export default async (req: Request): Promise<Response> => {
  const token = process.env.HARDCOVER_TOKEN
  if (!token) return Response.json({ match: false, error: 'not_configured' })

  const isbn = new URL(req.url).searchParams
    .get('isbn')
    ?.replace(/[\s-]/g, '')
  if (!isbn) return Response.json({ error: 'missing_isbn' }, { status: 400 })

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY, variables: { isbn } }),
    })
    if (!res.ok) return Response.json({ match: false, error: `hardcover_${res.status}` })

    const json = await res.json()
    const edition = json?.data?.editions?.[0]
    if (!edition) return Response.json({ match: false })

    const list: BookSeries[] = edition.book?.book_series ?? []
    const bs = list.find((s) => s.featured) ?? list[0]

    return Response.json({
      match: true,
      editionFormat: edition.edition_format ?? null,
      pages: edition.pages ?? null,
      seriesName: bs?.series?.name ?? null,
      seriesIndex: bs?.position ?? null,
    })
  } catch (err) {
    return Response.json({
      match: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
    })
  }
}
