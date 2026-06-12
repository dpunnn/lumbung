'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/member', label: 'Koperasiku', icon: '🏦' },
  { href: '/member/pinjaman', label: 'Pinjaman', icon: '💰' },
  { href: '/member/simpanan', label: 'Simpanan', icon: '🪙' },
  { href: '/member/pass', label: 'Pass Saya', icon: '🔑' },
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nama, setNama] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('nama, role').eq('id', user.id).single()
      if (!p || p.role !== 'anggota') { router.push('/login'); return }
      setNama(p.nama)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarNav = ({ onClose }: { onClose?: () => void }) => (
    <nav className="flex-1 p-2 space-y-0.5">
      {NAV.map(n => (
        <Link key={n.href} href={n.href} onClick={onClose}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
            ${pathname === n.href
              ? 'bg-green-700/20 text-green-400 font-medium'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <span>{n.icon}</span>{n.label}
        </Link>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0">
        <div className="p-4 border-b border-slate-800">
          <span className="text-green-400 font-bold text-lg tracking-tight">LUMBUNG</span>
          <p className="text-xs text-green-600 mt-0.5">Portal Anggota</p>
          {nama && <p className="text-slate-500 text-xs mt-0.5 truncate">{nama}</p>}
        </div>
        <SidebarNav />
        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout}
            className="w-full text-left text-slate-500 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <span className="text-green-400 font-bold">LUMBUNG</span>
          <button onClick={() => setOpen(!open)} className="text-slate-400 text-xl">☰</button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
            <aside className="w-56 h-full bg-slate-900 border-r border-slate-800 flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-800">
                <span className="text-green-400 font-bold">LUMBUNG</span>
                {nama && <p className="text-slate-500 text-xs mt-0.5">{nama}</p>}
              </div>
              <SidebarNav onClose={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
