'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSync } from '@/hooks/useSync'
import type { Profile } from '@/types'

const NAV = [
  { href: '/dashboard',      label: 'Beranda',      icon: '⬡' },
  { href: '/ternak',         label: 'Ternak',        icon: '🐄' },
  { href: '/pakan',          label: 'Pakan',         icon: '🌾' },
  { href: '/simpan-pinjam',  label: 'Simpan Pinjam', icon: '💰' },
  { href: '/pass',           label: 'Pass',          icon: '🔑' },
  { href: '/insight',        label: 'Insight',       icon: '📊' },
  { href: '/lens',           label: 'Lens',          icon: '📈' },
  { href: '/guard',          label: 'Guard',         icon: '🛡️' },
  { href: '/atlas',          label: 'Atlas',         icon: '🗺️' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [open, setOpen] = useState(false)
  const { isOnline, pending, refreshPending } = useOnlineStatus()
  useSync(() => refreshPending())

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0">
        <div className="p-4 border-b border-slate-800">
          <span className="text-green-400 font-bold text-lg tracking-tight">LUMBUNG</span>
          {profile && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{profile.nama} · {profile.role}</p>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${pathname === n.href
                  ? 'bg-green-700/20 text-green-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <span className="text-base">{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-2">
          {/* Badge online/offline */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
            ${isOnline && pending === 0
              ? 'bg-green-900/30 text-green-400'
              : !isOnline || pending > 0
              ? 'bg-yellow-900/30 text-yellow-400'
              : ''}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {!isOnline
              ? `Offline${pending > 0 ? ` (${pending} pending)` : ''}`
              : pending > 0
              ? `Sinkronisasi... (${pending})`
              : 'Tersinkron'}
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-slate-500 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile: top bar + drawer */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <span className="text-green-400 font-bold">LUMBUNG</span>
          <button onClick={() => setOpen(!open)} className="text-slate-400 text-xl">☰</button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
            <aside className="w-56 h-full bg-slate-900 border-r border-slate-800 p-2" onClick={e => e.stopPropagation()}>
              <nav className="space-y-0.5 mt-2">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                      ${pathname === n.href ? 'bg-green-700/20 text-green-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                  >
                    <span>{n.icon}</span>{n.label}
                  </Link>
                ))}
              </nav>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
