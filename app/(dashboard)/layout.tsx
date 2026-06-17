'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Beef, Wheat, Archive, Droplets, Landmark,
  CreditCard, Lightbulb, TrendingUp, ShieldCheck, ShoppingBag,
  Map, LogOut, Menu, X, Wifi, WifiOff, ChevronRight,
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
  group?: string
}

const ALL_NAV: NavItem[] = [
  { href: '/dashboard',     label: 'Beranda',       icon: LayoutDashboard, module: null,           group: 'utama' },
  { href: '/ternak',        label: 'Ternak',         icon: Beef,            module: 'ternak',       group: 'komoditas' },
  { href: '/pakan',         label: 'Stok / Pakan',   icon: Wheat,           module: 'pakan',        group: 'komoditas' },
  { href: '/inventori',     label: 'Inventori',      icon: Archive,         module: 'inventori',    group: 'komoditas' },
  { href: '/air',           label: 'Utilitas Air',   icon: Droplets,        module: 'air',          group: 'komoditas' },
  { href: '/simpan-pinjam', label: 'Simpan Pinjam',  icon: Landmark,        module: 'simpan_pinjam',group: 'keuangan' },
  { href: '/pass',          label: 'Pass',           icon: CreditCard,      module: 'pass',         group: 'keuangan', roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/insight',       label: 'Insight AI',     icon: Lightbulb,       module: 'insight',      group: 'analitik', roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/lens',          label: 'Lens',           icon: TrendingUp,      module: 'lens',         group: 'analitik', roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/guard',         label: 'Guard',          icon: ShieldCheck,     module: 'guard',        group: 'analitik', roles: ['pengurus', 'pemkab', 'pengawas'] },
  { href: '/pengadaan',     label: 'Pasar',          icon: ShoppingBag,     module: 'pasar',        group: 'jaringan' },
  { href: '/atlas',         label: 'Atlas',          icon: Map,             module: 'atlas',        group: 'jaringan' },
]

const GROUP_LABELS: Record<string, string> = {
  utama:     'Utama',
  komoditas: 'Komoditas',
  keuangan:  'Keuangan',
  analitik:  'Analitik & AI',
  jaringan:  'Jaringan',
}

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
          const raw = kop.modules ?? []
          // 'core' adalah modul dasar — aktifkan semua fitur operasional utama
          const expanded = raw.includes('core')
            ? [...raw, 'ternak', 'pakan', 'inventori', 'air', 'simpan_pinjam']
            : raw
          // 'marketplace' → alias 'pasar' di nav
          const normalized = expanded.map(m => m === 'marketplace' ? 'pasar' : m)
          setModules([...new Set(normalized)])
        }
      } catch {
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

  // Group nav items
  const groupedNav = visibleNav.reduce<Record<string, NavItem[]>>((acc, item) => {
    const g = item.group ?? 'utama'
    if (!acc[g]) acc[g] = []
    acc[g].push(item)
    return acc
  }, {})

  const groupOrder = ['utama', 'komoditas', 'keuangan', 'analitik', 'jaringan']

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  const roleLabel: Record<string, string> = {
    pengurus: 'Pengurus',
    anggota:  'Anggota',
    pemkab:   'Dinas Kab.',
    pengawas: 'Pengawas',
  }

  const synced = isOnline && pending === 0

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <div
      className="lmb-scroll"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '18px 14px',
        background: 'linear-gradient(165deg,#1a4731,#0c2218)',
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <Link href="/" onClick={onClose} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 16px', textDecoration: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke="#c9963a" strokeWidth="2" strokeLinejoin="round" /></svg>
        </div>
        <span style={{ fontWeight: 800, fontSize: 17, color: '#fff', letterSpacing: '-.02em' }}>LUMBUNG</span>
      </Link>

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {groupOrder.map(gKey => {
          const items = groupedNav[gKey]
          if (!items || items.length === 0) return null
          return (
            <div key={gKey}>
              {gKey !== 'utama' && (
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.13em', textTransform: 'uppercase', color: '#5d8770', padding: '14px 12px 6px' }}>
                  {GROUP_LABELS[gKey]}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map(n => {
                  const Icon = n.icon
                  const active = pathname === n.href
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      onClick={onClose}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 11,
                        padding: '10px 12px',
                        borderRadius: 11,
                        cursor: 'pointer',
                        fontSize: 13.5,
                        fontWeight: active ? 700 : 600,
                        color: active ? '#ffffff' : '#9fc1ad',
                        background: active ? 'rgba(201,150,58,.18)' : 'transparent',
                        border: '1px solid ' + (active ? 'rgba(201,150,58,.42)' : 'transparent'),
                        borderLeft: active ? '2px solid #c9963a' : '1px solid transparent',
                        textDecoration: 'none',
                        transition: 'background .16s,color .16s',
                      }}
                      onMouseEnter={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.06)'
                          ;(e.currentTarget as HTMLElement).style.color = '#fff'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent'
                          ;(e.currentTarget as HTMLElement).style.color = '#9fc1ad'
                        }
                      }}
                    >
                      <span style={{ display: 'flex', color: active ? '#e0b864' : '#7fa68f' }}>
                        <Icon size={18} />
                      </span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.label}</span>
                      {active && <ChevronRight size={12} style={{ color: '#c9963a' }} />}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User profile card */}
      {profile && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ position: 'relative', width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg,#c9963a,#8a6420)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 15, flexShrink: 0 }}>
            {profile.nama?.charAt(0)?.toUpperCase() ?? 'U'}
            <span style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', background: synced ? '#3bb673' : '#c9963a', border: '2px solid #143726' }} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.nama}</div>
            <div style={{ fontSize: 11, color: '#9fc1ad', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {synced ? 'Online' : (!isOnline ? 'Offline' : 'Sinkron...')} · {roleLabel[profile.role] ?? profile.role}
              {koperasiNama && ` · ${koperasiNama}`}
            </div>
          </div>
        </div>
      )}

      {/* Status + Logout */}
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, fontSize: 11.5, fontWeight: 600, color: synced ? '#7fe0a7' : '#e0b864' }}>
          {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
          <span>
            {!isOnline
              ? `Offline${pending > 0 ? ` (${pending} pending)` : ''}`
              : pending > 0 ? `Sinkronisasi... (${pending})` : 'Tersinkron'}
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 600, color: '#7fa68f', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all .15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(214,87,69,.15)'; (e.currentTarget as HTMLElement).style.color = '#ff9a8a' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#7fa68f' }}
        >
          <LogOut size={13} />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        background: 'radial-gradient(120% 90% at 85% -10%, #e6efe4 0%, #f7f4ec 45%, #f3efe4 100%)',
      }}
    >
      {/* Desktop sidebar */}
      <aside className="hidden md:flex" style={{ flexDirection: 'column', width: 232, flexShrink: 0, boxShadow: '6px 0 30px rgba(15,42,29,.18)' }}>
        <SidebarContent />
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* Mobile header */}
        <header className="md:hidden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'rgba(247,244,236,.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke="#c9963a" strokeWidth="2" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15, color: '#0f2a1d' }}>LUMBUNG</span>
            {koperasiNama && (
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 999, background: 'rgba(26,71,49,.08)', color: '#1a4731', fontWeight: 600 }}>{koperasiNama}</span>
            )}
          </div>
          <button onClick={() => setOpen(!open)} style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', color: '#1a4731', cursor: 'pointer' }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        {/* Mobile drawer */}
        {open && (
          <div className="md:hidden" style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(10,26,18,.42)', backdropFilter: 'blur(4px)' }} onClick={() => setOpen(false)}>
            <aside style={{ width: 256, height: '100%', display: 'flex', flexDirection: 'column', boxShadow: '6px 0 30px rgba(15,42,29,.3)' }} onClick={e => e.stopPropagation()}>
              <SidebarContent onClose={() => setOpen(false)} />
            </aside>
          </div>
        )}

        <main className="lmb-scroll" style={{ flex: 1, overflow: 'auto', padding: '24px 24px 40px' }}>{children}</main>
      </div>
    </div>
  )
}
