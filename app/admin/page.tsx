'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type KopStat = {
  id: string; nama: string; fokus_usaha: string; modules: string[]
  anggota_count: number; user_count: number
}

export default function AdminPage() {
  const [stats, setStats] = useState({ koperasi: 0, users: 0, anggota: 0 })
  const [koperasiList, setKoperasiList] = useState<KopStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    const [{ data: kop }, { count: userCount }, { count: anggotaCount }] = await Promise.all([
      supabase.from('koperasi').select('id, nama, fokus_usaha, modules').order('nama'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'anggota'),
    ])

    if (!kop) { setLoading(false); return }

    // Hitung user per koperasi
    const { data: profiles } = await supabase.from('profiles').select('koperasi_id')
    const userPerKop = new Map<string, number>()
    for (const p of profiles ?? []) {
      if (p.koperasi_id) userPerKop.set(p.koperasi_id, (userPerKop.get(p.koperasi_id) ?? 0) + 1)
    }

    // Hitung anggota per koperasi (dari junction)
    const { data: junctions } = await supabase.from('anggota_koperasi').select('koperasi_id')
    const anggotaPerKop = new Map<string, number>()
    for (const j of junctions ?? []) {
      anggotaPerKop.set(j.koperasi_id, (anggotaPerKop.get(j.koperasi_id) ?? 0) + 1)
    }

    setKoperasiList(kop.map(k => ({
      ...k,
      modules: k.modules ?? [],
      user_count: userPerKop.get(k.id) ?? 0,
      anggota_count: anggotaPerKop.get(k.id) ?? 0,
    })))

    setStats({
      koperasi: kop.length,
      users: userCount ?? 0,
      anggota: anggotaCount ?? 0,
    })

    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Platform Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Admin LUMBUNG -- ringkasan semua koperasi aktif</p>
      </div>

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Koperasi', value: stats.koperasi, color: 'text-green-400', subtitle: 'Terdaftar di platform', icon: 'K' },
          { label: 'Pengurus & Kasir', value: stats.users, color: 'text-blue-400', subtitle: 'User dengan akses dashboard', icon: 'P' },
          { label: 'Anggota Terdaftar', value: stats.anggota, color: 'text-amber-400', subtitle: 'Total anggota aktif', icon: 'A' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center">
                <span className={`text-sm font-bold ${s.color}`}>{s.icon}</span>
              </div>
            </div>
            <p className={`text-4xl font-bold tracking-tight ${s.color}`}>{loading ? '--' : s.value}</p>
            <p className="text-slate-400 text-xs font-medium mt-2">{s.label}</p>
            <p className="text-slate-600 text-xs mt-0.5">{s.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Koperasi List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white text-sm font-semibold">Koperasi Terdaftar</h2>
            <p className="text-slate-500 text-xs mt-0.5">{koperasiList.length} koperasi aktif</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Memuat data...</p>
          </div>
        ) : koperasiList.length === 0 ? (
          <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
            <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-slate-500 text-2xl">--</span>
            </div>
            <p className="text-slate-300 font-semibold">Belum Ada Koperasi</p>
            <p className="text-slate-500 text-sm mt-1">Koperasi akan muncul setelah didaftarkan</p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-5 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Koperasi</th>
                  <th className="px-5 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Modul</th>
                  <th className="px-5 py-3 text-center text-slate-500 text-xs uppercase tracking-wide font-medium">Pengurus</th>
                  <th className="px-5 py-3 text-center text-slate-500 text-xs uppercase tracking-wide font-medium">Anggota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {koperasiList.map(k => (
                  <tr key={k.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="text-white font-medium text-sm">{k.nama}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{k.fokus_usaha}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {k.modules.length === 0
                          ? <span className="text-slate-600 text-xs">--</span>
                          : k.modules.map(m => (
                              <span key={m} className="bg-green-900/30 text-green-400 border border-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                                {m}
                              </span>
                            ))
                        }
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-blue-400 text-lg font-bold">{k.user_count}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-amber-400 text-lg font-bold">{k.anggota_count}</span>
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
