import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <>
      <title>Not found · Shelved</title>
      <div className="text-center py-16">
        <h1 className="text-2xl font-semibold mb-2">Not found</h1>
        <p className="text-sm text-slate-500 mb-4">
          That page doesn't exist.
        </p>
        <Link to="/" className="text-sm underline">
          Back to bookcase
        </Link>
      </div>
    </>
  )
}
