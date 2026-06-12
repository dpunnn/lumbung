'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const NAV = [
  { href: '/admin', label: 'Overview', icon: '⬡' },
  { href: '/admin/koperasi', label: 'Koperasi', icon: '🏦' },
  { href: '/admin/users', label: 'Users', icon: '👥' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [nama, setNama] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('profiles').select('nama, role').eq('id', user.id).single()
      if (!p || p.role !== 'superadmin') { router.push('/login'); return }
      setNama(p.nama)
    })
  }, [router])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-800 shrink-0">
        <div className="p-4 border-b border-slate-800">
          <span className="text-green-400 font-bold text-lg tracking-tight">LUMBUNG</span>
          <p className="text-xs text-amber-400 mt-0.5">Admin Platform</p>
          {nama && <p className="text-slate-500 text-xs mt-0.5 truncate">{nama}</p>}
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors
                ${pathname === n.href
                  ? 'bg-amber-700/20 text-amber-400 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <span>{n.icon}</span>{n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout}
            className="w-full text-left text-slate-500 hover:text-white text-xs px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            Keluar
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
    </div>
  )
}
