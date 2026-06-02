import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  BookMarked,
  Plus,
  Heart,
  LogOut,
  X,
} from 'lucide-react'
import { useAuth } from '../auth/AuthProvider.tsx'
import { supabase } from '../lib/supabase.ts'

const navItems = [
  { to: '/', label: 'Home', icon: BookOpen, end: true },
  { to: '/tbr', label: 'TBR', icon: BookMarked, end: false },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, end: false },
  { to: '/add', label: 'Add a book', icon: Plus, end: false },
]

export function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useAuth()
  const email = session?.user.email ?? ''
  const initial = (email || '?').charAt(0).toUpperCase()

  // Close on Esc
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 z-40"
            aria-hidden="true"
          />
          <motion.aside
            key="drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.2 }}
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl z-50 flex flex-col"
            aria-label="Main menu"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden="true">📚</span>
                <div className="leading-tight">
                  <p className="font-bold text-base text-slate-900">Shelved</p>
                  <p className="text-xs text-slate-500">Your library</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 p-2 space-y-1 overflow-y-auto" aria-label="Primary">
              {navItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-100 text-teal-700'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="p-3 border-t border-slate-100 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
              <div className="flex items-center gap-2.5 px-2 py-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white text-sm font-semibold shrink-0">
                  {initial}
                </span>
                <p className="text-xs text-slate-700 truncate flex-1 min-w-0">
                  {email || 'Signed in'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  supabase.auth.signOut()
                  onClose()
                }}
                className="mt-1 w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
