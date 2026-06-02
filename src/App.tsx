import { Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider.tsx'
import { Login } from './auth/Login.tsx'
import { Layout } from './routes/Layout.tsx'
import { Bookcase } from './routes/Bookcase.tsx'
import { TBR } from './routes/TBR.tsx'
import { Wishlist } from './routes/Wishlist.tsx'
import { AddBook } from './routes/AddBook.tsx'
import { BookDetail } from './routes/BookDetail.tsx'
import { AuthorPage } from './routes/AuthorPage.tsx'
import { SeriesPage } from './routes/SeriesPage.tsx'
import { NotFound } from './routes/NotFound.tsx'

function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (!session) return <Login />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Bookcase />} />
        <Route path="tbr" element={<TBR />} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="add" element={<AddBook />} />
        <Route path="book/:id" element={<BookDetail />} />
        <Route path="author/:name" element={<AuthorPage />} />
        <Route path="series/:name" element={<SeriesPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

export default App
