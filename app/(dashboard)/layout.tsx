'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSync } from '@/hooks/useSync'
import type { Profile } from '@/types'

type NavItem = { href: string; label: string; icon: string; module: string | null }

const ALL_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Beranda',      icon: '⬡',  module: null },           // selalu tampil
  { href: '/ternak',        label: 'Ternak',        icon: '🐄', module: 'ternak' },
  { href: '/pakan',         label: 'Stok / Pakan',  icon: '🌾', module: 'pakan' },
  { href: '/simpan-pinjam', label: 'Simpan Pinjam', icon: '💰', module: 'simpan_pinjam' },
  { href: '/pass',          label: 'Pass',          icon: '🔑', module: 'pass' },
  { href: '/insight',       label: 'Insight AI',    icon: '📊', module: 'insight' },
  { href: '/lens',          label: 'Lens',          icon: '📈', module: 'lens' },
  { href: '/guard',         label: 'Guard',         icon: '🛡️', module: 'guard' },
  { href: '/pengadaan',     label: 'Pasar',         icon: '🛒', module: 'pasar' },
  { href: '/atlas',         label: 'Atlas',         icon: '🗺️', module: 'atlas' },        // pemkab saja
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modules, setModules] = useState<string[]>([])
  const [koperasiNama, setKoperasiNama] = useState('')
  const [open, setOpen] = useState(false)
  const { isOnline, pending, refreshPending } = useOnlineStatus()
  useSync(() => refreshPending())

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (!p) return
      setProfile(p)

      // Ambil modul dari koperasi
      const { data: kop } = await supabase
        .from('koperasi').select('nama, modules').eq('id', p.koperasi_id).single()
      if (kop) {
        setKoperasiNama(kop.nama)
        // pemkab: akses atlas + semua read-only
        if (p.role === 'pemkab') {
          setModules(['atlas', 'lens'])
        } else {
          setModules(kop.modules ?? [])
        }
      }
    })
  }, [router])

  const visibleNav = ALL_NAV.filter(n => {
    if (n.module === null) return true               // Beranda selalu
    if (n.module === 'atlas') return profile?.role === 'pemkab' || profile?.role === 'pengawas'
    return modules.includes(n.module)
  })

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const SidebarNav = ({ onClose }: { onClose?: () => void }) => (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {koperasiNama && (
        <p className="text-slate-600 text-xs px-3 py-1 uppercase tracking-wider">{koperasiNama}</p>
      )}
      {visibleNav.map((n) => (
        <Link key={n.href} href={n.href} onClick={onClose}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
            ${pathname === n.href
              ? 'bg-green-700/20 text-green-400 font-medium'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
          <span className="text-base">{n.icon}</span>
          {n.label}
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
          {profile && (
            <p className="text-slate-500 text-xs mt-0.5 truncate">{profile.nama} · {profile.role}</p>
          )}
        </div>
        <SidebarNav />
        <div className="p-3 border-t border-slate-800 space-y-2">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
            ${isOnline && pending === 0
              ? 'bg-green-900/30 text-green-400'
              : 'bg-yellow-900/30 text-yellow-400'}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {!isOnline
              ? `Offline${pending > 0 ? ` (${pending} pending)` : ''}`
              : pending > 0 ? `Sinkronisasi... (${pending})` : 'Tersinkron'}
          </div>
          <button onClick={handleLogout}
            className="w-full text-left text-slate-500 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            Keluar
          </button>
        </div>
      </aside>

      {/* Mobile */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
          <div>
            <span className="text-green-400 font-bold">LUMBUNG</span>
            {koperasiNama && <span className="text-slate-500 text-xs ml-2">{koperasiNama}</span>}
          </div>
          <button onClick={() => setOpen(!open)} className="text-slate-400 text-xl">☰</button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
            <aside className="w-56 h-full bg-slate-900 border-r border-slate-800 flex flex-col"
              onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-800">
                <span className="text-green-400 font-bold">LUMBUNG</span>
                {profile && <p className="text-slate-500 text-xs mt-0.5">{profile.nama}</p>}
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
