'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Stats = {
  ternak: { sehat: number; pantau: number; sakit: number; total: number; matiBuilan: number }
  simpanan: number
  pinjaman: { aktif: number; macet: number }
  pakan: { nama: string; stok: number; satuan: string }[]
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: ternak } = await supabase.from('ternak').select('status, tanggal_mati')
      const { data: simpanan } = await supabase.from('simpanan').select('jumlah')
      const { data: pinjaman } = await supabase.from('pinjaman').select('status')
      const { data: pakan } = await supabase.from('pakan').select('nama, stok, satuan, batas_minimum')

      const now = new Date()
      const bulanIni = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`

      setStats({
        ternak: {
          sehat:  ternak?.filter(t => t.status === 'sehat').length ?? 0,
          pantau: ternak?.filter(t => t.status === 'pantau').length ?? 0,
          sakit:  ternak?.filter(t => t.status === 'sakit').length ?? 0,
          total:  ternak?.filter(t => t.status !== 'mati').length ?? 0,
          matiBuilan: ternak?.filter(t => t.status === 'mati' && t.tanggal_mati?.startsWith(bulanIni)).length ?? 0,
        },
        simpanan: simpanan?.reduce((s, r) => s + (r.jumlah ?? 0), 0) ?? 0,
        pinjaman: {
          aktif: pinjaman?.filter(p => p.status === 'aktif').length ?? 0,
          macet: pinjaman?.filter(p => p.status === 'macet').length ?? 0,
        },
        pakan: (pakan ?? []).filter(p => p.batas_minimum > 0 && p.stok <= p.batas_minimum),
      })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p className="text-slate-500 text-sm">Memuat...</p>
  if (!stats) return null

  const mortalitasPct = stats.ternak.total > 0
    ? Math.round((stats.ternak.matiBuilan / stats.ternak.total) * 100)
    : 0

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-white text-xl font-semibold">Beranda</h1>
        <p className="text-slate-400 text-sm">Kondisi koperasi hari ini</p>
      </div>

      {/* Alert mortalitas */}
      {mortalitasPct >= 10 && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-3 flex items-center gap-2 text-red-300 text-sm">
          <span>⚠</span>
          <span><strong>Mortalitas tinggi:</strong> {stats.ternak.matiBuilan} ternak mati bulan ini ({mortalitasPct}%)</span>
        </div>
      )}

      {/* Alert stok pakan */}
      {stats.pakan.length > 0 && (
        <div className="bg-yellow-950/50 border border-yellow-900 rounded-xl p-3 flex items-center gap-2 text-yellow-300 text-sm">
          <span>⚠</span>
          <span><strong>Stok menipis:</strong> {stats.pakan.map(p => p.nama).join(', ')}</span>
        </div>
      )}

      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link href="/ternak" className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-green-700 transition-colors">
          <p className="text-slate-400 text-xs mb-1">Ternak Hidup</p>
          <p className="text-white text-2xl font-bold">{stats.ternak.total}</p>
          <p className="text-slate-500 text-xs mt-1">{stats.ternak.sakit} sakit · {stats.ternak.pantau} pantau</p>
        </Link>
        <Link href="/simpan-pinjam" className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-green-700 transition-colors">
          <p className="text-slate-400 text-xs mb-1">Total Simpanan</p>
          <p className="text-white text-2xl font-bold">
            {stats.simpanan >= 1000000
              ? `Rp${(stats.simpanan/1000000).toFixed(1)}jt`
              : `Rp${(stats.simpanan/1000).toFixed(0)}rb`}
          </p>
          <p className="text-slate-500 text-xs mt-1">semua anggota</p>
        </Link>
        <Link href="/simpan-pinjam" className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-green-700 transition-colors">
          <p className="text-slate-400 text-xs mb-1">Pinjaman Aktif</p>
          <p className="text-white text-2xl font-bold">{stats.pinjaman.aktif}</p>
          {stats.pinjaman.macet > 0
            ? <p className="text-red-400 text-xs mt-1">{stats.pinjaman.macet} macet</p>
            : <p className="text-slate-500 text-xs mt-1">semua lancar</p>}
        </Link>
        <Link href="/pakan" className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-green-700 transition-colors">
          <p className="text-slate-400 text-xs mb-1">Stok Pakan</p>
          <p className={`text-2xl font-bold ${stats.pakan.length > 0 ? 'text-yellow-400' : 'text-white'}`}>
            {stats.pakan.length > 0 ? `${stats.pakan.length} ⚠` : 'Aman'}
          </p>
          <p className="text-slate-500 text-xs mt-1">
            {stats.pakan.length > 0 ? 'perlu restok' : 'stok cukup'}
          </p>
        </Link>
      </div>

      {/* Status ternak detail */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-slate-400 text-xs mb-3">Status Ternak</p>
        <div className="flex gap-3">
          {[
            { label: 'Sehat', val: stats.ternak.sehat, color: 'bg-green-600' },
            { label: 'Pantau', val: stats.ternak.pantau, color: 'bg-yellow-500' },
            { label: 'Sakit', val: stats.ternak.sakit, color: 'bg-red-500' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${s.color}`} />
              <span className="text-slate-300 text-sm">{s.label} <strong className="text-white">{s.val}</strong></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
