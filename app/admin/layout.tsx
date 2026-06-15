'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Building2, Users, LogOut } from 'lucide-react'
import { getMe, logout } from '@/lib/auth'

const NAV = [
  { href: '/admin',           label: 'Overview',  icon: LayoutDashboard },
  { href: '/admin/koperasi',  label: 'Koperasi',  icon: Building2 },
  { href: '/admin/users',     label: 'Users',     icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nama, setNama] = useState('')

  useEffect(() => {
    getMe().then((me) => {
      if (!me) { router.push('/login'); return }
      if (me.role !== 'superadmin') { router.push('/login'); return }
      setNama(me.username)
    })
  }, [router])

  async function handleLogout() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-stone-50 flex">
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-stone-200 shrink-0">
        <div className="p-5 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-700 flex items-center justify-center">
              <span className="text-white text-xs font-black">L</span>
            </div>
            <div>
              <span className="text-amber-800 font-bold text-sm tracking-tight">LUMBUNG</span>
              <p className="text-amber-600 text-xs">Admin Platform</p>
            </div>
          </div>
          {nama && <p className="text-stone-400 text-xs mt-2 truncate">{nama}</p>}
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(n => {
            const Icon = n.icon
            const active = pathname === n.href
            return (
              <Link key={n.href} href={n.href}
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
      </aside>

      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
