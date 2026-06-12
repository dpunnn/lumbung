'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Simpanan = { tanggal: string; jumlah: number }
type Pinjaman = { created_at: string; jumlah: number; status: string }

export default function LensPage() {
  const [simpanan, setSimpanan] = useState<Simpanan[]>([])
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('koperasi_id').eq('id', user.id).single()
      if (!p?.koperasi_id) { setLoading(false); return }

      const [{ data: smp }, { data: pin }] = await Promise.all([
        supabase.from('simpanan').select('tanggal, jumlah').eq('koperasi_id', p.koperasi_id).order('tanggal'),
        supabase.from('pinjaman').select('created_at, jumlah_pokok, status').eq('koperasi_id', p.koperasi_id).order('created_at'),
      ])
      setSimpanan((smp ?? []) as Simpanan[])
      setPinjaman((pin ?? []).map((r: any) => ({ ...r, jumlah: r.jumlah_pokok })) as Pinjaman[])
      setLoading(false)
    }
    load()
  }, [])

  // Aggregate simpanan per bulan
  const bySimpananBulan = simpanan.reduce<Record<string, number>>((acc, s) => {
    const bulan = (s.tanggal ?? '').slice(0, 7)
    acc[bulan] = (acc[bulan] ?? 0) + s.jumlah
    return acc
  }, {})
  const simpananBulanan = Object.entries(bySimpananBulan)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)

  const maxSimpanan = Math.max(...simpananBulanan.map(([, v]) => v), 1)

  const totalSimpanan = simpanan.reduce((s, r) => s + r.jumlah, 0)
  const totalPinjaman = pinjaman.reduce((s, r) => s + r.jumlah, 0)
  const pinjamanMacet = pinjaman.filter(p => p.status === 'macet').length

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-white text-xl font-semibold">Lumbung Lens</h1>
        <p className="text-slate-400 text-sm">Visualisasi tren keuangan koperasi</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Simpanan', value: `Rp ${(totalSimpanan / 1_000_000).toFixed(1)}jt`, color: 'text-green-400' },
          { label: 'Total Pinjaman', value: `Rp ${(totalPinjaman / 1_000_000).toFixed(1)}jt`, color: 'text-blue-400' },
          { label: 'Pinjaman Macet', value: pinjamanMacet, color: pinjamanMacet > 0 ? 'text-red-400' : 'text-slate-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart simpanan 6 bulan terakhir */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <p className="text-slate-300 text-sm font-medium mb-4">Simpanan Masuk — 6 Bulan Terakhir</p>
        {loading ? (
          <p className="text-slate-500 text-sm">Memuat...</p>
        ) : simpananBulanan.length === 0 ? (
          <p className="text-slate-500 text-sm">Belum ada data simpanan.</p>
        ) : (
          <div className="flex items-end gap-2 h-32">
            {simpananBulanan.map(([bulan, val]) => {
              const pct = (val / maxSimpanan) * 100
              return (
                <div key={bulan} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-slate-500 text-xs">
                    {val >= 1_000_000 ? `${(val / 1_000_000).toFixed(1)}jt` : `${Math.round(val / 1000)}rb`}
                  </span>
                  <div className="w-full bg-slate-800 rounded-t overflow-hidden" style={{ height: '80px' }}>
                    <div
                      className="w-full bg-green-600/80 rounded-t transition-all"
                      style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                    />
                  </div>
                  <span className="text-slate-600 text-xs">{bulan.slice(5)}/{bulan.slice(2, 4)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tabel pinjaman ringkasan */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <p className="text-slate-300 text-sm font-medium mb-3">Riwayat Pinjaman</p>
        {pinjaman.length === 0 ? (
          <p className="text-slate-500 text-sm">Belum ada pinjaman.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 text-xs border-b border-slate-800">
                <th className="text-left pb-2">Tanggal</th>
                <th className="text-right pb-2">Jumlah</th>
                <th className="text-right pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pinjaman.slice(0, 10).map((p, i) => (
                <tr key={i}>
                  <td className="py-2 text-slate-400 text-xs">
                    {new Date(p.created_at).toLocaleDateString('id-ID')}
                  </td>
                  <td className="py-2 text-right text-white">
                    Rp {p.jumlah.toLocaleString('id-ID')}
                  </td>
                  <td className="py-2 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full border
                      ${p.status === 'aktif' ? 'bg-green-900/50 text-green-400 border-green-800'
                      : p.status === 'macet' ? 'bg-red-900/50 text-red-400 border-red-800'
                      : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
