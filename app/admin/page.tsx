'use client'

import { useEffect, useState } from 'react'
import { Building2, Users, UserCheck } from 'lucide-react'
import api from '@/lib/api'

type KopStat = {
  id: string; nama: string; fokus_usaha: string; modules: string[]
  anggota_count: number; user_count: number
}

const MODULE_LABEL: Record<string, string> = {
  simpan_pinjam: 'Simpan Pinjam',
  inventori: 'Inventori',
  ternak: 'Ternak',
  air: 'Utilitas Air',
  pakan: 'Stok Pakan',
  pass: 'Pass',
  insight: 'Insight AI',
  guard: 'Guard',
  lens: 'Lens',
  pasar: 'Pasar',
  atlas: 'Atlas',
}

export default function AdminPage() {
  const [stats, setStats] = useState({ koperasi: 0, users: 0, anggota: 0 })
  const [koperasiList, setKoperasiList] = useState<KopStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // /api/koperasi list — tenant-svc
    const kop = await api.get<{ id: string; nama: string; fokus_usaha: string; modules: string[] }[]>('/api/koperasi').catch(() => [])

    // TODO: /api/auth/users count dan /api/anggota count belum ada endpoint aggregate — gunakan panjang array sebagai fallback
    const [users, anggota] = await Promise.all([
      api.get<{ id: string; role: string; koperasi_id: string | null }[]>('/api/auth/users').catch(() => []),
      api.get<{ koperasi_id: string }[]>('/api/anggota').catch(() => []),
    ])

    const userPerKop = new Map<string, number>()
    for (const u of users) {
      if (u.koperasi_id) userPerKop.set(u.koperasi_id, (userPerKop.get(u.koperasi_id) ?? 0) + 1)
    }

    const anggotaPerKop = new Map<string, number>()
    for (const a of anggota) {
      if (a.koperasi_id) anggotaPerKop.set(a.koperasi_id, (anggotaPerKop.get(a.koperasi_id) ?? 0) + 1)
    }

    setKoperasiList(kop.map(k => ({
      ...k, modules: k.modules ?? [],
      user_count: userPerKop.get(k.id) ?? 0,
      anggota_count: anggotaPerKop.get(k.id) ?? 0,
    })))

    const anggotaCount = anggota.filter(a => a.koperasi_id).length
    setStats({ koperasi: kop.length, users: users.length, anggota: anggotaCount })
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Platform Overview</h1>
        <p className="text-stone-500 text-sm mt-0.5">Admin LUMBUNG — ringkasan semua koperasi aktif</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Koperasi', value: stats.koperasi, subtitle: 'Terdaftar di platform', icon: Building2, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Pengurus & Kasir', value: stats.users, subtitle: 'User dengan akses dashboard', icon: Users, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Anggota Terdaftar', value: stats.anggota, subtitle: 'Total anggota aktif', icon: UserCheck, color: 'text-green-700', bg: 'bg-green-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
              <div className={`w-9 h-9 ${s.bg} rounded-lg flex items-center justify-center mb-3`}>
                <Icon size={18} className={s.color} />
              </div>
              <p className="text-stone-900 text-3xl font-bold tracking-tight">{loading ? '—' : s.value}</p>
              <p className="text-stone-700 text-xs font-medium mt-2">{s.label}</p>
              <p className="text-stone-400 text-xs mt-0.5">{s.subtitle}</p>
            </div>
          )
        })}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-stone-900 text-sm font-semibold">Koperasi Terdaftar</h2>
            <p className="text-stone-500 text-xs mt-0.5">{koperasiList.length} koperasi aktif</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : koperasiList.length === 0 ? (
          <div className="text-center py-20 bg-white border border-stone-200 rounded-xl">
            <Building2 size={28} className="mx-auto text-stone-300 mb-3" />
            <p className="text-stone-700 font-medium">Belum Ada Koperasi</p>
            <p className="text-stone-400 text-sm mt-1">Koperasi akan muncul setelah didaftarkan</p>
          </div>
        ) : (
          <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-5 py-3 text-left text-stone-500 text-xs font-medium uppercase tracking-wide">Koperasi</th>
                  <th className="px-5 py-3 text-left text-stone-500 text-xs font-medium uppercase tracking-wide">Modul</th>
                  <th className="px-5 py-3 text-center text-stone-500 text-xs font-medium uppercase tracking-wide">Pengurus</th>
                  <th className="px-5 py-3 text-center text-stone-500 text-xs font-medium uppercase tracking-wide">Anggota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {koperasiList.map(k => (
                  <tr key={k.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-stone-900 font-medium text-sm">{k.nama}</p>
                      <p className="text-stone-500 text-xs mt-0.5">{k.fokus_usaha}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {k.modules.length === 0
                          ? <span className="text-stone-400 text-xs">—</span>
                          : k.modules.map(m => (
                              <span key={m} className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">
                                {MODULE_LABEL[m] ?? m}
                              </span>
                            ))
                        }
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-blue-700 text-lg font-bold">{k.user_count}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-amber-700 text-lg font-bold">{k.anggota_count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
