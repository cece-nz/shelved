// Production proxy to Hardcover's GraphQL API. Keeps the token server-side
// (HARDCOVER_TOKEN env var). The actual query lives in the shared module so
// local dev (Vite middleware in vite.config.ts) behaves identically.
//
// Endpoint: /.netlify/functions/hardcover?isbn=<isbn>

import { hardcoverLookup } from '../../src/lib/hardcoverServer.ts'

export default async (req: Request): Promise<Response> => {
  const isbn = new URL(req.url).searchParams.get('isbn')
  const result = await hardcoverLookup(isbn, process.env.HARDCOVER_TOKEN)
  return Response.json(result, {
    status: result.error === 'missing_isbn' ? 400 : 200,
  })
}
