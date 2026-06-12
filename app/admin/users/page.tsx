'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRow = {
  id: string; nama: string; role: string
  koperasi_id: string | null
  koperasi: { nama: string } | null
}

const ROLE_COLOR: Record<string, string> = {
  superadmin: 'bg-amber-900/50 text-amber-400 border-amber-800',
  pengurus:   'bg-blue-900/50 text-blue-400 border-blue-800',
  kasir:      'bg-purple-900/50 text-purple-400 border-purple-800',
  anggota:    'bg-green-900/50 text-green-400 border-green-800',
  pemkab:     'bg-cyan-900/50 text-cyan-400 border-cyan-800',
  pengawas:   'bg-slate-800 text-slate-400 border-slate-700',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    supabase.from('profiles')
      .select('id, nama, role, koperasi_id, koperasi(nama)')
      .order('role')
      .then(({ data }) => {
        setUsers((data as UserRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = filter
    ? users.filter(u => u.role === filter)
    : users

  const roles = [...new Set(users.map(u => u.role))]

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-white text-xl font-semibold">Semua Users</h1>
        <p className="text-slate-400 text-sm">{users.length} akun terdaftar di platform</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors
            ${!filter ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
          Semua
        </button>
        {roles.map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors
              ${filter === r ? 'bg-slate-700 text-white border-slate-600' : 'text-slate-400 border-slate-700 hover:border-slate-500'}`}>
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-500 text-sm">Memuat...</p>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-xs">
                <th className="px-4 py-3 text-left">Nama</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Koperasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-white">{u.nama || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${ROLE_COLOR[u.role] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {u.koperasi?.nama ?? (u.role === 'anggota' ? 'Lintas koperasi' : '—')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
