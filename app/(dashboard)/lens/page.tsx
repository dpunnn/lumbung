'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { supabase } from '@/lib/supabase'
import { narasiTemplate, type RingkasanLens } from '@/lib/narasi'

const WARNA_TERNAK: Record<string, string> = {
  sehat: '#22c55e', pantau: '#eab308', sakit: '#ef4444', mati: '#64748b',
}
const namaBulan = (d: Date) =>
  ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

type LensData = {
  koperasi: string
  fokusUsaha: string
  simpanan6bln: { bulan: string; total: number }[]
  ternak: { name: string; value: number }[]
  pakan: { nama: string; stok: number; minimum: number }[]
  angsuran: { bulan: string; tepat: number; terlambat: number }[]
  modul: { simpanPinjam: boolean; ternak: boolean; pakan: boolean }
  ringkasan: RingkasanLens
}

export default function LensPage() {
  const [data, setData] = useState<LensData | null>(null)
  const [narasi, setNarasi] = useState('')
  const [sumber, setSumber] = useState<'haiku' | 'template' | ''>('')
  const [mode, setMode] = useState<'ringkas' | 'rinci'>('ringkas')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Identitas koperasi aktif (data sudah tersaring RLS ke koperasi ini)
      const { data: auth } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles').select('koperasi_id').eq('id', auth.user!.id).single()
      const { data: kop } = await supabase
        .from('koperasi').select('nama, fokus_usaha').eq('id', profile!.koperasi_id).single()

      const [{ data: simpanan }, { data: ternak }, { data: pakan }, { data: pinjaman }, { data: angsuran }] =
        await Promise.all([
          supabase.from('simpanan').select('jumlah, tanggal'),
          supabase.from('ternak').select('status'),
          supabase.from('pakan').select('nama, stok, batas_minimum'),
          supabase.from('pinjaman').select('id'),
          supabase.from('angsuran').select('status, tanggal_jatuh_tempo'),
        ])

      // Deteksi modul yang BENAR-BENAR dimiliki koperasi ini
      const modul = {
        simpanPinjam: (simpanan?.length ?? 0) > 0 || (pinjaman?.length ?? 0) > 0,
        ternak: (ternak?.length ?? 0) > 0,
        pakan: (pakan?.length ?? 0) > 0,
      }

      // --- Simpanan 6 bulan ---
      const bulanList: { key: string; bulan: string }[] = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        bulanList.push({ key: ymKey(d), bulan: namaBulan(d) })
      }
      const simpanan6bln = bulanList.map((b) => ({
        bulan: b.bulan,
        total: (simpanan ?? []).filter((s) => s.tanggal?.startsWith(b.key))
          .reduce((sum, s) => sum + (s.jumlah ?? 0), 0),
      }))
      const simpananBulanIni = (simpanan ?? [])
        .filter((s) => s.tanggal?.startsWith(ymKey(now)))
        .reduce((sum, s) => sum + (s.jumlah ?? 0), 0)

      // --- Ternak ---
      const hitung = (st: string) => (ternak ?? []).filter((t) => t.status === st).length
      const ternakChart = (['sehat', 'pantau', 'sakit', 'mati'] as const)
        .map((st) => ({ name: st, value: hitung(st) })).filter((x) => x.value > 0)

      // --- Pakan ---
      const pakanChart = (pakan ?? []).map((p) => ({
        nama: p.nama, stok: p.stok, minimum: p.batas_minimum,
      }))
      const pakanMenipis = (pakan ?? [])
        .filter((p) => p.batas_minimum > 0 && p.stok <= p.batas_minimum).map((p) => p.nama)

      // --- Angsuran tepat vs terlambat ---
      const angsuranChart = bulanList.map((b) => {
        const baris = (angsuran ?? []).filter((a) => a.tanggal_jatuh_tempo?.startsWith(b.key))
        return {
          bulan: b.bulan,
          tepat: baris.filter((a) => a.status === 'lunas').length,
          terlambat: baris.filter((a) => a.status === 'terlambat').length,
        }
      })
      const totTepat = angsuranChart.reduce((s, a) => s + a.tepat, 0)
      const totTerlambat = angsuranChart.reduce((s, a) => s + a.terlambat, 0)

      const ringkasan: RingkasanLens = {
        koperasi: kop?.nama ?? 'Koperasi',
        fokusUsaha: kop?.fokus_usaha ?? '-',
        simpananBulanIni,
        ternak: modul.ternak ? {
          sehat: hitung('sehat'), pantau: hitung('pantau'),
          sakit: hitung('sakit'), mati: hitung('mati'),
          total: (ternak ?? []).filter((t) => t.status !== 'mati').length,
        } : undefined,
        pakanMenipis,
        angsuran: { tepatWaktu: totTepat, terlambat: totTerlambat, total: totTepat + totTerlambat },
        modul,
      }

      setData({
        koperasi: kop?.nama ?? 'Koperasi', fokusUsaha: kop?.fokus_usaha ?? '-',
        simpanan6bln, ternak: ternakChart, pakan: pakanChart, angsuran: angsuranChart, modul, ringkasan,
      })
      setLoading(false)

      try {
        const res = await fetch('/api/narasi', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(ringkasan),
        })
        const j = await res.json()
        setNarasi(j.narasi); setSumber(j.sumber)
      } catch {
        setNarasi(narasiTemplate(ringkasan)); setSumber('template')
      }
    }
    load()
  }, [])

  const fmtRb = useMemo(() => (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : `${(n / 1_000).toFixed(0)}rb`, [])

  if (loading) return <p className="text-slate-500 text-sm">Memuat laporan...</p>
  if (!data) return null

  const { modul } = data
  const adaModul = modul.simpanPinjam || modul.ternak || modul.pakan

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Lens — {data.koperasi}</h1>
          <p className="text-slate-400 text-sm">{data.fokusUsaha} · laporan koperasi ini</p>
        </div>
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
          {(['ringkas', 'rinci'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors
                ${mode === m ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Narasi */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-slate-400 text-xs">Ringkasan Bulan Ini</p>
          <span className="text-[10px] text-slate-500">{sumber === 'haiku' ? '✨ AI (Haiku)' : 'template'}</span>
        </div>
        <p className="text-slate-200 text-sm leading-relaxed">{narasi || 'Menyusun ringkasan...'}</p>
      </div>

      {/* Empty-state untuk koperasi yang modulnya belum tersedia (mis. sayuran/air) */}
      {!adaModul && (
        <div className="bg-slate-900 border border-dashed border-slate-700 rounded-xl p-8 text-center">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-slate-300">Belum ada data operasional untuk koperasi ini.</p>
          <p className="text-slate-500 text-sm mt-1">
            Modul untuk <strong>{data.fokusUsaha}</strong> belum tersedia (roadmap).
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Simpan-pinjam */}
        {modul.simpanPinjam && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-3">Simpanan 6 Bulan Terakhir</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.simpanan6bln}>
                <XAxis dataKey="bulan" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={fmtRb} />
                <Tooltip formatter={(v: number) => `Rp${v.toLocaleString('id-ID')}`}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                <Bar dataKey="total" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {modul.simpanPinjam && data.angsuran.some((a) => a.tepat + a.terlambat > 0) && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-3">Angsuran: Tepat Waktu vs Terlambat</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.angsuran}>
                <XAxis dataKey="bulan" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                <Legend formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
                <Bar dataKey="tepat" name="Tepat waktu" stackId="a" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="terlambat" name="Terlambat" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Ternak */}
        {modul.ternak && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-3">Komposisi Status Ternak</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={data.ternak} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {data.ternak.map((e) => <Cell key={e.name} fill={WARNA_TERNAK[e.name]} />)}
                </Pie>
                <Legend formatter={(v) => <span className="text-slate-300 text-xs capitalize">{v}</span>} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pakan */}
        {modul.pakan && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-3">Stok Pakan vs Batas Minimum</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.pakan}>
                <XAxis dataKey="nama" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} />
                <Legend formatter={(v) => <span className="text-slate-300 text-xs">{v}</span>} />
                <Bar dataKey="stok" name="Stok" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="minimum" name="Minimum" fill="#475569" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Rinci */}
      {mode === 'rinci' && adaModul && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-3">Rincian Angka</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {modul.simpanPinjam && (<>
              <span className="text-slate-400">Simpanan bulan ini</span>
              <span className="text-white text-right">Rp{data.ringkasan.simpananBulanIni.toLocaleString('id-ID')}</span>
              <span className="text-slate-400">Angsuran tepat waktu</span>
              <span className="text-white text-right">{data.ringkasan.angsuran.tepatWaktu}</span>
              <span className="text-slate-400">Angsuran terlambat</span>
              <span className="text-white text-right">{data.ringkasan.angsuran.terlambat}</span>
            </>)}
            {modul.ternak && data.ringkasan.ternak && (<>
              <span className="text-slate-400">Ternak hidup</span>
              <span className="text-white text-right">{data.ringkasan.ternak.total} ekor</span>
              <span className="text-slate-400">Perlu perhatian (sakit/pantau)</span>
              <span className="text-white text-right">
                {data.ringkasan.ternak.sakit + data.ringkasan.ternak.pantau} ekor
              </span>
            </>)}
            {modul.pakan && (<>
              <span className="text-slate-400">Pakan menipis</span>
              <span className="text-white text-right">{data.ringkasan.pakanMenipis.join(', ') || '—'}</span>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}
