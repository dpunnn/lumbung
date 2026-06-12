'use client'

import { useEffect, useState } from 'react'
import { Lock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type AtasRow = {
  koperasi_id: string
  nama: string
  jumlah_anggota: number
  total_simpanan: number
  jumlah_ternak: number
  pct_sehat: number
  pinjaman_aktif: number
  skor: number
}

function Badge({ skor }: { skor: number }) {
  if (skor >= 75) return <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full font-medium">Sehat</span>
  if (skor >= 50) return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-medium">Cukup</span>
  return <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2 py-0.5 rounded-full font-medium">Perhatian</span>
}

export default function AtlasPage() {
  const [data, setData] = useState<AtasRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<keyof AtasRow>('skor')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    supabase.from('atlas_agregat').select('*')
      .then(({ data: rows, error }) => {
        if (error) { loadManual(); return }
        setData((rows as AtasRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  async function loadManual() {
    const { data: kops } = await supabase.from('koperasi').select('id, nama')
    if (!kops) { setLoading(false); return }

    const rows: AtasRow[] = await Promise.all(kops.map(async k => {
      const [{ count: anggota }, { data: simpanan }, { data: ternak }, { count: pinjaman }] = await Promise.all([
        supabase.from('anggota').select('*', { count: 'exact', head: true }).eq('koperasi_id', k.id),
        supabase.from('simpanan').select('jumlah').eq('koperasi_id', k.id),
        supabase.from('ternak').select('status').eq('koperasi_id', k.id),
        supabase.from('pinjaman').select('*', { count: 'exact', head: true }).eq('koperasi_id', k.id).eq('status', 'aktif'),
      ])
      const totalSimpanan = (simpanan ?? []).reduce((s, r) => s + (r.jumlah ?? 0), 0)
      const sehat = (ternak ?? []).filter(t => t.status === 'sehat').length
      const pctSehat = ternak?.length ? Math.round((sehat / ternak.length) * 100) : 0
      const skor = Math.min(100, Math.round(
        0.35 * Math.min(1, totalSimpanan / 10_000_000) * 100 +
        0.35 * pctSehat +
        0.3 * Math.min(1, (anggota ?? 0) / 20) * 100
      ))
      return { koperasi_id: k.id, nama: k.nama, jumlah_anggota: anggota ?? 0, total_simpanan: totalSimpanan, jumlah_ternak: ternak?.length ?? 0, pct_sehat: pctSehat, pinjaman_aktif: pinjaman ?? 0, skor }
    }))
    setData(rows)
    setLoading(false)
  }

  function handleSort(key: keyof AtasRow) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey]
    if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const totalSimpanan = data.reduce((s, r) => s + r.total_simpanan, 0)
  const avgSkor = data.length ? Math.round(data.reduce((s, r) => s + r.skor, 0) / data.length) : 0

  function SortIcon({ k }: { k: keyof AtasRow }) {
    if (sortKey !== k) return <ArrowUpDown size={12} className="inline ml-1 text-stone-400" />
    return sortAsc ? <ArrowUp size={12} className="inline ml-1 text-amber-700" /> : <ArrowDown size={12} className="inline ml-1 text-amber-700" />
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Lumbung Atlas</h1>
        <p className="text-stone-500 text-sm">Ringkasan agregat semua koperasi — Dinas Koperasi Kabupaten</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2 text-xs text-blue-700">
        <Lock size={13} className="shrink-0" />
        <span>Data agregat — identitas dan transaksi individual anggota terjaga. Hanya ringkasan per koperasi yang ditampilkan.</span>
      </div>

      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Koperasi Binaan', value: data.length, color: 'text-stone-900' },
            { label: 'Total Simpanan Platform', value: `Rp ${(totalSimpanan / 1_000_000).toFixed(1)}jt`, color: 'text-green-700' },
            { label: 'Rata-rata Skor', value: avgSkor, color: avgSkor >= 75 ? 'text-green-700' : avgSkor >= 50 ? 'text-amber-700' : 'text-red-600' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <p className="text-stone-500 text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs">
                {[
                  { key: 'nama', label: 'Koperasi' },
                  { key: 'jumlah_anggota', label: 'Anggota' },
                  { key: 'total_simpanan', label: 'Total Simpanan' },
                  { key: 'jumlah_ternak', label: 'Ternak' },
                  { key: 'pct_sehat', label: '% Sehat' },
                  { key: 'pinjaman_aktif', label: 'Pinjaman Aktif' },
                  { key: 'skor', label: 'Skor' },
                ].map(col => (
                  <th key={col.key}
                    className="px-4 py-3 text-left font-medium cursor-pointer hover:text-stone-900 select-none transition-colors"
                    onClick={() => handleSort(col.key as keyof AtasRow)}>
                    {col.label} <SortIcon k={col.key as keyof AtasRow} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map(row => (
                <tr key={row.koperasi_id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-900 font-medium">{row.nama}</td>
                  <td className="px-4 py-3 text-stone-700">{row.jumlah_anggota}</td>
                  <td className="px-4 py-3 text-stone-700">Rp {(row.total_simpanan / 1_000_000).toFixed(1)}jt</td>
                  <td className="px-4 py-3 text-stone-700">{row.jumlah_ternak}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${row.pct_sehat}%` }} />
                      </div>
                      <span className="text-stone-700 text-xs">{row.pct_sehat}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-700">{row.pinjaman_aktif}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${row.skor >= 75 ? 'text-green-700' : row.skor >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                        {row.skor}
                      </span>
                      <Badge skor={row.skor} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-stone-800 text-sm font-semibold mb-4">Perbandingan Total Simpanan</p>
          <div className="space-y-2">
            {[...data].sort((a, b) => b.total_simpanan - a.total_simpanan).map(row => {
              const max = Math.max(...data.map(r => r.total_simpanan))
              const pct = max > 0 ? (row.total_simpanan / max) * 100 : 0
              return (
                <div key={row.koperasi_id} className="flex items-center gap-3">
                  <span className="text-stone-500 text-xs w-32 truncate">{row.nama}</span>
                  <div className="flex-1 h-5 bg-stone-100 rounded overflow-hidden">
                    <div className="h-full bg-amber-600 rounded transition-all flex items-center px-2"
                      style={{ width: `${pct}%` }}>
                      {pct > 25 && (
                        <span className="text-white text-xs font-medium">
                          Rp {(row.total_simpanan / 1_000_000).toFixed(1)}jt
                        </span>
                      )}
                    </div>
                  </div>
                  {pct <= 25 && (
                    <span className="text-stone-500 text-xs">Rp {(row.total_simpanan / 1_000_000).toFixed(1)}jt</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
