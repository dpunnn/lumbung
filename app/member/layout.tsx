'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { Building2, Landmark, Coins, CreditCard, LogOut, Menu, X } from 'lucide-react'
import { getMe, logout } from '@/lib/auth'

const NAV = [
  { href: '/member',           label: 'Koperasiku', icon: Building2 },
  { href: '/member/pinjaman',  label: 'Pinjaman',   icon: Landmark  },
  { href: '/member/simpanan',  label: 'Simpanan',   icon: Coins     },
  { href: '/member/pass',      label: 'Pass Saya',  icon: CreditCard},
]

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nama, setNama] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    getMe().then((me) => {
      if (!me) { router.push('/login'); return }
      if (me.role !== 'anggota') { router.push('/login'); return }
      setNama(me.username)
    })
  }, [router])

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
          <div>
            <span className="text-amber-800 font-bold text-sm tracking-tight">LUMBUNG</span>
            <p className="text-stone-500 text-xs">Portal Anggota</p>
          </div>
        </div>
        {nama && <p className="text-stone-400 text-xs mt-2 truncate">{nama}</p>}
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map(n => {
          const Icon = n.icon
          const active = pathname === n.href || pathname.startsWith(n.href + '?')
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

      <div className="p-3 border-t border-stone-100">
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
