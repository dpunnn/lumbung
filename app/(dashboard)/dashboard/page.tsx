'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Beef, Landmark, FileText, Wheat, AlertTriangle, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Stats = {
  ternak: { sehat: number; pantau: number; sakit: number; total: number; matiBuilan: number }
  simpanan: number
  pinjaman: { aktif: number; macet: number }
  pakan: { nama: string; stok: number; satuan: string }[]
}

const rupiah = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : `${(n / 1_000).toFixed(0)}rb`

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: ternak } = await supabase.from('ternak').select('status, tanggal_mati')
    const { data: simpanan } = await supabase.from('simpanan').select('jumlah').eq('status', 'confirmed')
    const { data: pinjaman } = await supabase.from('pinjaman').select('status')
    const { data: pakan } = await supabase.from('pakan').select('nama, stok, satuan, batas_minimum')

    const now = new Date()
    const bulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    setStats({
      ternak: {
        sehat:      ternak?.filter(t => t.status === 'sehat').length ?? 0,
        pantau:     ternak?.filter(t => t.status === 'pantau').length ?? 0,
        sakit:      ternak?.filter(t => t.status === 'sakit').length ?? 0,
        total:      ternak?.filter(t => t.status !== 'mati').length ?? 0,
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
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ternak' },   () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'simpanan' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pinjaman' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pakan' },    () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!stats) return null

  const mortalitasPct = stats.ternak.total > 0
    ? Math.round((stats.ternak.matiBuilan / stats.ternak.total) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-stone-900 text-xl font-bold tracking-tight">Beranda</h1>
        <p className="text-stone-500 text-sm mt-0.5">Kondisi koperasi hari ini</p>
      </div>

      {/* Alert banners */}
      {mortalitasPct >= 10 && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-red-700 text-sm font-medium">Mortalitas Tinggi</p>
            <p className="text-red-600 text-xs mt-0.5">{stats.ternak.matiBuilan} ternak mati bulan ini ({mortalitasPct}% dari populasi)</p>
          </div>
        </div>
      )}

      {stats.pakan.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-amber-800 text-sm font-medium">Stok Pakan Menipis</p>
            <p className="text-amber-700 text-xs mt-0.5">{stats.pakan.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', ')}</p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Link href="/ternak"
          className="group bg-white border border-stone-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Beef size={16} className="text-amber-700" />
            </div>
            <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
          </div>
          <p className="text-stone-900 text-2xl font-bold tracking-tight">{stats.ternak.total}</p>
          <p className="text-stone-600 text-xs font-medium mt-1">Ternak Hidup</p>
          <p className="text-stone-400 text-xs mt-0.5">{stats.ternak.sehat} sehat · {stats.ternak.pantau} pantau · {stats.ternak.sakit} sakit</p>
        </Link>

        <Link href="/simpan-pinjam"
          className="group bg-white border border-stone-200 rounded-xl p-5 hover:border-amber-300 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Landmark size={16} className="text-blue-600" />
            </div>
            <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
          </div>
          <p className="text-stone-900 text-2xl font-bold tracking-tight">Rp {rupiah(stats.simpanan)}</p>
          <p className="text-stone-600 text-xs font-medium mt-1">Total Simpanan</p>
          <p className="text-stone-400 text-xs mt-0.5">Semua anggota</p>
        </Link>

        <Link href="/simpan-pinjam"
          className={`group bg-white border rounded-xl p-5 hover:shadow-sm transition-all
            ${stats.pinjaman.macet > 0 ? 'border-red-200 hover:border-red-300' : 'border-stone-200 hover:border-amber-300'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
              ${stats.pinjaman.macet > 0 ? 'bg-red-50' : 'bg-stone-50'}`}>
              <FileText size={16} className={stats.pinjaman.macet > 0 ? 'text-red-500' : 'text-stone-500'} />
            </div>
            <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
          </div>
          <p className="text-stone-900 text-2xl font-bold tracking-tight">{stats.pinjaman.aktif}</p>
          <p className="text-stone-600 text-xs font-medium mt-1">Pinjaman Aktif</p>
          {stats.pinjaman.macet > 0
            ? <p className="text-red-500 text-xs font-medium mt-0.5">{stats.pinjaman.macet} macet</p>
            : <p className="text-stone-400 text-xs mt-0.5">Semua lancar</p>}
        </Link>

        <Link href="/pakan"
          className={`group bg-white border rounded-xl p-5 hover:shadow-sm transition-all
            ${stats.pakan.length > 0 ? 'border-amber-200 hover:border-amber-300' : 'border-stone-200 hover:border-amber-300'}`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center
              ${stats.pakan.length > 0 ? 'bg-amber-50' : 'bg-green-50'}`}>
              <Wheat size={16} className={stats.pakan.length > 0 ? 'text-amber-600' : 'text-green-600'} />
            </div>
            <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors" />
          </div>
          <p className="text-stone-900 text-2xl font-bold tracking-tight">
            {stats.pakan.length > 0 ? stats.pakan.length : 'OK'}
          </p>
          <p className="text-stone-600 text-xs font-medium mt-1">Stok Pakan</p>
          <p className="text-stone-400 text-xs mt-0.5">
            {stats.pakan.length > 0 ? 'Item perlu restok' : 'Semua stok aman'}
          </p>
        </Link>
      </div>

      {/* Status Ternak */}
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-stone-900 text-sm font-semibold">Status Ternak</p>
            <p className="text-stone-500 text-xs mt-0.5">Distribusi kesehatan populasi</p>
          </div>
          <Link href="/ternak" className="text-amber-700 hover:text-amber-800 text-xs font-medium flex items-center gap-1">
            Lihat detail <ChevronRight size={12} />
          </Link>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Sehat',  val: stats.ternak.sehat,  color: 'bg-green-500',  textColor: 'text-green-600',  track: 'bg-green-100' },
            { label: 'Pantau', val: stats.ternak.pantau, color: 'bg-amber-500',  textColor: 'text-amber-600',  track: 'bg-amber-100' },
            { label: 'Sakit',  val: stats.ternak.sakit,  color: 'bg-red-500',    textColor: 'text-red-600',    track: 'bg-red-100' },
          ].map(s => {
            const pct = stats.ternak.total > 0 ? Math.round((s.val / stats.ternak.total) * 100) : 0
            return (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.color}`} />
                    <span className="text-stone-700 text-sm">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${s.textColor}`}>{s.val}</span>
                    <span className="text-stone-400 text-xs w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className={`h-2 ${s.track} rounded-full overflow-hidden`}>
                  <div className={`h-full ${s.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        {stats.ternak.matiBuilan > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
            <span className="text-stone-500 text-xs">Mortalitas bulan ini</span>
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border
              ${mortalitasPct >= 10
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
              {stats.ternak.matiBuilan} ekor ({mortalitasPct}%)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
