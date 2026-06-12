'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type UserRow = {
  id: string; nama: string; role: string
  koperasi_id: string | null
  koperasi: { nama: string } | null
}

const ROLE_COLOR: Record<string, string> = {
  superadmin: 'bg-amber-50 text-amber-700 border-amber-200',
  pengurus:   'bg-blue-50 text-blue-700 border-blue-200',
  kasir:      'bg-purple-50 text-purple-700 border-purple-200',
  anggota:    'bg-green-50 text-green-700 border-green-200',
  pemkab:     'bg-cyan-50 text-cyan-700 border-cyan-200',
  pengawas:   'bg-stone-100 text-stone-600 border-stone-200',
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

  const filtered = filter ? users.filter(u => u.role === filter) : users
  const roles = [...new Set(users.map(u => u.role))]

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Semua Users</h1>
        <p className="text-stone-500 text-sm">{users.length} akun terdaftar di platform</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium
            ${!filter ? 'bg-amber-700 text-white border-amber-700' : 'text-stone-600 border-stone-300 hover:border-stone-400 bg-white'}`}>
          Semua
        </button>
        {roles.map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium
              ${filter === r ? 'bg-amber-700 text-white border-amber-700' : 'text-stone-600 border-stone-300 hover:border-stone-400 bg-white'}`}>
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">Nama</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Koperasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-900 font-medium">{u.nama || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${ROLE_COLOR[u.role] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-stone-500">
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
