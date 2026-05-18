import { NavLink, Outlet } from 'react-router-dom'
import { BookOpen, BookMarked, Plus, Heart, LogOut } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { supabase } from '../lib/supabase.ts'

const navItems = [
  { to: '/', label: 'Home', icon: BookOpen, end: true },
  { to: '/tbr', label: 'TBR', icon: BookMarked, end: false },
  { to: '/add', label: 'Add', icon: Plus, end: false },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, end: false },
]

export function Layout() {
  const { session } = useAuth()

  return (
    <div className="min-h-svh bg-stone-50 text-stone-800 flex flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <span className="font-semibold">Shelved</span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="p-1 text-stone-500 hover:text-stone-800"
            aria-label="Sign out"
            title={session?.user.email ?? 'Sign out'}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 pb-24 pt-4 px-4 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 border-t border-stone-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80"
        aria-label="Primary"
      >
        <div className="max-w-4xl mx-auto flex justify-around px-2 py-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md text-xs ${
                  isActive
                    ? 'text-stone-900 font-medium'
                    : 'text-stone-500 hover:text-stone-700'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
