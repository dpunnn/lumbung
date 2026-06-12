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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Beranda</h1>
        <p className="text-slate-400 text-sm mt-1">Kondisi koperasi hari ini</p>
      </div>

      {/* Alert banners */}
      {mortalitasPct >= 10 && (
        <div className="bg-red-950/40 border border-red-900/60 border-l-4 border-l-red-500 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-400 text-lg leading-none mt-0.5">!</span>
          <div>
            <p className="text-red-300 text-sm font-medium">Mortalitas Tinggi</p>
            <p className="text-red-400/80 text-xs mt-0.5">{stats.ternak.matiBuilan} ternak mati bulan ini ({mortalitasPct}% dari populasi)</p>
          </div>
        </div>
      )}

      {stats.pakan.length > 0 && (
        <div className="bg-yellow-950/40 border border-yellow-900/60 border-l-4 border-l-yellow-500 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-yellow-400 text-lg leading-none mt-0.5">!</span>
          <div>
            <p className="text-yellow-300 text-sm font-medium">Stok Pakan Menipis</p>
            <p className="text-yellow-400/80 text-xs mt-0.5">{stats.pakan.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', ')}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Ternak */}
        <Link href="/ternak" className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-green-700/60 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🐄</span>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">→</span>
          </div>
          <p className="text-green-400 text-3xl font-bold tracking-tight">{stats.ternak.total}</p>
          <p className="text-slate-400 text-xs font-medium mt-1">Ternak Hidup</p>
          <p className="text-slate-500 text-xs mt-0.5">{stats.ternak.sehat} sehat · {stats.ternak.pantau} pantau · {stats.ternak.sakit} sakit</p>
        </Link>

        {/* Simpanan */}
        <Link href="/simpan-pinjam" className="group bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-green-700/60 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">💰</span>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">→</span>
          </div>
          <p className="text-blue-400 text-3xl font-bold tracking-tight">
            {stats.simpanan >= 1000000
              ? `${(stats.simpanan/1000000).toFixed(1)}jt`
              : `${(stats.simpanan/1000).toFixed(0)}rb`}
          </p>
          <p className="text-slate-400 text-xs font-medium mt-1">Total Simpanan</p>
          <p className="text-slate-500 text-xs mt-0.5">Rupiah · semua anggota</p>
        </Link>

        {/* Pinjaman */}
        <Link href="/simpan-pinjam" className={`group bg-slate-900 border rounded-xl p-5 transition-all ${stats.pinjaman.macet > 0 ? 'border-red-900/50 hover:border-red-700/60' : 'border-slate-800 hover:border-green-700/60'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">📋</span>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">→</span>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${stats.pinjaman.macet > 0 ? 'text-amber-400' : 'text-white'}`}>{stats.pinjaman.aktif}</p>
          <p className="text-slate-400 text-xs font-medium mt-1">Pinjaman Aktif</p>
          {stats.pinjaman.macet > 0
            ? <p className="text-red-400 text-xs font-medium mt-0.5">{stats.pinjaman.macet} macet</p>
            : <p className="text-slate-500 text-xs mt-0.5">Semua lancar</p>}
        </Link>

        {/* Stok Pakan */}
        <Link href="/pakan" className={`group bg-slate-900 border rounded-xl p-5 transition-all ${stats.pakan.length > 0 ? 'border-yellow-900/50 hover:border-yellow-700/60' : 'border-slate-800 hover:border-green-700/60'}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🌾</span>
            <span className="text-slate-600 group-hover:text-slate-400 transition-colors text-xs">→</span>
          </div>
          <p className={`text-3xl font-bold tracking-tight ${stats.pakan.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
            {stats.pakan.length > 0 ? stats.pakan.length : 'OK'}
          </p>
          <p className="text-slate-400 text-xs font-medium mt-1">Stok Pakan</p>
          <p className="text-slate-500 text-xs mt-0.5">
            {stats.pakan.length > 0 ? 'Item perlu restok' : 'Semua stok aman'}
          </p>
        </Link>
      </div>

      {/* Status Ternak - Progress Bars */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white text-sm font-semibold">Status Ternak</p>
            <p className="text-slate-500 text-xs mt-0.5">Distribusi kesehatan populasi</p>
          </div>
          <Link href="/ternak" className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Lihat detail →</Link>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Sehat', val: stats.ternak.sehat, color: 'bg-green-500', textColor: 'text-green-400' },
            { label: 'Pantau', val: stats.ternak.pantau, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
            { label: 'Sakit', val: stats.ternak.sakit, color: 'bg-red-500', textColor: 'text-red-400' },
          ].map(s => {
            const pct = stats.ternak.total > 0 ? Math.round((s.val / stats.ternak.total) * 100) : 0
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-slate-300 text-sm">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${s.textColor}`}>{s.val}</span>
                    <span className="text-slate-600 text-xs w-10 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full ${s.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Mortalitas bulan ini */}
        {stats.ternak.matiBuilan > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-slate-500 text-xs">Mortalitas bulan ini</span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${mortalitasPct >= 10 ? 'bg-red-900/40 text-red-400 border-red-800' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
              {stats.ternak.matiBuilan} ekor ({mortalitasPct}%)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
