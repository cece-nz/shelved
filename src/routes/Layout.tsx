import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Drawer } from '../components/Drawer.tsx'

export function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-svh bg-[#f5f6fb] text-slate-900 flex flex-col">
      <header className="bg-white">
        <div className="max-w-4xl mx-auto flex items-center px-2 py-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="p-2 rounded-md text-slate-700 hover:bg-slate-100"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <main className="flex-1 pt-4 px-4 pb-8 max-w-4xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
