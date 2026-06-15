'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Beef, Wheat, Archive, Droplets, Landmark,
  CreditCard, Lightbulb, TrendingUp, ShieldCheck, ShoppingBag,
  Map, LogOut, Menu, X, Wifi, WifiOff,
} from 'lucide-react'
import api from '@/lib/api'
import { getMe, logout } from '@/lib/auth'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSync } from '@/hooks/useSync'
import type { Profile } from '@/types'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  module: string | null
  roles?: string[]
}

const ALL_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Beranda',       icon: LayoutDashboard, module: null },
  { href: '/ternak',        label: 'Ternak',         icon: Beef,            module: 'ternak' },
  { href: '/pakan',         label: 'Stok / Pakan',   icon: Wheat,           module: 'pakan' },
  { href: '/inventori',     label: 'Inventori',      icon: Archive,         module: 'inventori' },
  { href: '/air',           label: 'Utilitas Air',   icon: Droplets,        module: 'air' },
  { href: '/simpan-pinjam', label: 'Simpan Pinjam',  icon: Landmark,        module: 'simpan_pinjam' },
  { href: '/pass',          label: 'Pass',           icon: CreditCard,      module: 'pass',    roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/insight',       label: 'Insight AI',     icon: Lightbulb,       module: 'insight', roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/lens',          label: 'Lens',           icon: TrendingUp,      module: 'lens',    roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/guard',         label: 'Guard',          icon: ShieldCheck,     module: 'guard',   roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/pengadaan',     label: 'Pasar',          icon: ShoppingBag,     module: 'pasar' },
  { href: '/atlas',         label: 'Atlas',          icon: Map,             module: 'atlas' },
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
    getMe().then(async (me) => {
      if (!me) { router.push('/login'); return }
      // getMe mengembalikan UserProfile dari auth-svc; map ke bentuk Profile yang dipakai UI.
      const p = {
        id: me.id,
        nama: me.username,
        role: me.role,
        koperasi_id: me.koperasi_id,
      } as unknown as Profile
      setProfile(p)
      if (!me.koperasi_id) return
      try {
        const kop = await api.get<{ nama: string; modules?: string[] }>(`/api/koperasi/${me.koperasi_id}`)
        setKoperasiNama(kop.nama)
        if (me.role === 'pemkab') {
          setModules(['atlas', 'lens'])
        } else {
          setModules(kop.modules ?? [])
        }
      } catch {
        // Koperasi gagal dimuat — biarkan modul kosong, nav minimal tetap tampil.
        if (me.role === 'pemkab') setModules(['atlas', 'lens'])
      }
    })
  }, [router])

  const visibleNav = ALL_NAV.filter(n => {
    if (n.module === null) return true
    if (n.module === 'atlas') return profile?.role === 'pemkab' || profile?.role === 'pengawas'
    if (!modules.includes(n.module)) return false
    if (n.roles && profile?.role) return n.roles.includes(profile.role)
    return true
  })

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="p-5 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-700 flex items-center justify-center">
            <span className="text-white text-xs font-black">L</span>
          </div>
          <span className="text-amber-800 font-bold text-base tracking-tight">LUMBUNG</span>
        </div>
        {koperasiNama && (
          <p className="text-stone-500 text-xs mt-2 truncate">{koperasiNama}</p>
        )}
        {profile && (
          <p className="text-stone-400 text-xs truncate">{profile.nama} · {profile.role}</p>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleNav.map(n => {
          const Icon = n.icon
          const active = pathname === n.href
          return (
            <Link key={n.href} href={n.href} onClick={onClose}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${active
                  ? 'bg-amber-50 text-amber-800 font-medium border-l-2 border-amber-700 pl-[10px]'
                  : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
              <Icon size={16} className={active ? 'text-amber-700' : 'text-stone-400'} />
              {n.label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-stone-100 space-y-1">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
          ${isOnline && pending === 0
            ? 'text-green-700'
            : 'text-amber-700'}`}>
          {isOnline
            ? <Wifi size={13} className="text-green-600" />
            : <WifiOff size={13} className="text-amber-600" />}
          {!isOnline
            ? `Offline${pending > 0 ? ` (${pending} pending)` : ''}`
            : pending > 0 ? `Sinkronisasi... (${pending})` : 'Tersinkron'}
        </div>
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 text-stone-500 hover:text-stone-900 text-xs px-3 py-2 rounded-lg hover:bg-stone-100 transition-colors">
          <LogOut size={13} />
          Keluar
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-stone-50 flex">

      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-stone-200 shrink-0">
        <SidebarContent />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">

        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-700 flex items-center justify-center">
              <span className="text-white text-xs font-black">L</span>
            </div>
            <span className="text-amber-800 font-bold text-sm">LUMBUNG</span>
            {koperasiNama && <span className="text-stone-400 text-xs ml-1">{koperasiNama}</span>}
          </div>
          <button onClick={() => setOpen(!open)} className="text-stone-600 p-1">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {open && (
          <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)}>
            <aside className="w-56 h-full bg-white border-r border-stone-200 flex flex-col"
              onClick={e => e.stopPropagation()}>
              <SidebarContent onClose={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
