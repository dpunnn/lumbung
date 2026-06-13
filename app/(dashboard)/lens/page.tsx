'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { AlertTriangle, ArrowDown, ArrowUp, BarChart2, TrendingUp, Minus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { narasiTemplate, type RingkasanLens } from '@/lib/narasi'

const WARNA_TERNAK: Record<string, string> = {
  sehat: '#22c55e', pantau: '#eab308', sakit: '#ef4444', mati: '#64748b',
}
const namaBulan = (d: Date) =>
  ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][d.getMonth()]
const ymKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID')
const fmtRb = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}jt` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}rb` : String(n)

type LensData = {
  koperasi: string; fokusUsaha: string; kopId: string
  simpananTrend: { bulan: string; total: number; key: string }[]
  simpananBulanLalu: number
  ternak: { name: string; value: number }[]
  pakan: { nama: string; stok: number; minimum: number }[]
  angsuran: { bulan: string; tepat: number; terlambat: number }[]
  modul: { simpanPinjam: boolean; ternak: boolean; pakan: boolean }
  ringkasan: RingkasanLens
}
type RinciSimpanan = { id: string; jumlah: number; tanggal: string; anggota: { nama: string } | null }
type RinciAngsuran = {
  id: string; status: string; tanggal_jatuh_tempo: string; jumlah_bayar: number | null
  pinjaman: { jumlah_pokok: number; anggota: { nama: string } | null } | null
}
type RinciTernak = { id: string; kode: string; jenis: string; status: string; umur_bulan: number | null }
type RinciPakan = { id: string; nama: string; stok: number; batas_minimum: number; satuan: string }
type RinciData = {
  simpananBulanIni: RinciSimpanan[]
  simpananBulanLalu: number
  angsuranAll: RinciAngsuran[]
  ternakAll: RinciTernak[]
  pakanAll: RinciPakan[]
}
const STATUS_ANGSURAN: Record<string, string> = {
  lunas:       'bg-green-50 text-green-700 border-green-200',
  terlambat:   'bg-red-50 text-red-600 border-red-200',
  belum_lunas: 'bg-amber-50 text-amber-700 border-amber-200',
}
const STATUS_TERNAK: Record<string, string> = {
  sehat:  'bg-green-50 text-green-700 border-green-200',
  pantau: 'bg-amber-50 text-amber-700 border-amber-200',
  sakit:  'bg-red-50 text-red-600 border-red-200',
  mati:   'bg-stone-100 text-stone-500 border-stone-200',
}

function SimpananTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cur = payload[0].value as number
  const idx = payload[0].payload._idx as number
  const prev = payload[0].payload._prev as number
  const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[160px]">
      <p className="text-stone-500 mb-1 font-medium">{label}</p>
      <p className="text-stone-900 font-bold text-base">{rp(cur)}</p>
      {pct !== null && idx > 0 && (
        <p className={`flex items-center gap-0.5 mt-1 font-medium ${pct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {pct > 0 ? <ArrowUp size={10} /> : pct < 0 ? <ArrowDown size={10} /> : <Minus size={10} />}
          {Math.abs(pct)}% vs bulan lalu
        </p>
      )}
    </div>
  )
}

function AngsuranTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const tepat = (payload.find((p: any) => p.dataKey === 'tepat')?.value ?? 0) as number
  const terlambat = (payload.find((p: any) => p.dataKey === 'terlambat')?.value ?? 0) as number
  const total = tepat + terlambat
  const pct = total > 0 ? Math.round((tepat / total) * 100) : null
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[180px]">
      <p className="text-stone-500 mb-2 font-medium">{label}</p>
      <div className="space-y-1.5">
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Tepat waktu</span>
          <span className="font-semibold text-green-700">{tepat}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Terlambat</span>
          <span className="font-semibold text-red-600">{terlambat}</span>
        </div>
        {pct !== null && (
          <div className="border-t border-stone-100 pt-1.5 flex justify-between gap-4">
            <span className="text-stone-500">Tingkat keberhasilan</span>
            <span className={`font-bold ${pct >= 80 ? 'text-green-700' : pct >= 60 ? 'text-amber-700' : 'text-red-600'}`}>{pct}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PakanTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const stok = (payload.find((p: any) => p.dataKey === 'stok')?.value ?? 0) as number
  const minimum = (payload.find((p: any) => p.dataKey === 'minimum')?.value ?? 0) as number
  const isCritical = minimum > 0 && stok <= minimum
  const isWarning = !isCritical && minimum > 0 && stok <= minimum * 1.5
  return (
    <div className="bg-white border border-stone-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[170px]">
      <p className="text-stone-900 font-semibold mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-stone-500">Stok sekarang</span>
          <span className={`font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-700' : 'text-stone-900'}`}>{stok}</span>
        </div>
        {minimum > 0 && (
          <div className="flex justify-between gap-4">
            <span className="text-stone-500">Batas minimum</span>
            <span className="font-medium text-stone-600">{minimum}</span>
          </div>
        )}
        {isCritical && (
          <p className="text-red-500 font-medium mt-1 flex items-center gap-1">
            <AlertTriangle size={10} /> Stok di bawah minimum!
          </p>
        )}
        {isWarning && (
          <p className="text-amber-600 font-medium mt-1">Mendekati batas minimum</p>
        )}
      </div>
    </div>
  )
}

function ActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 8}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={outerRadius + 12} outerRadius={outerRadius + 15}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#1c1917" fontSize={24} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#78716c" fontSize={12} fontWeight={600}>{payload.name}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#a8a29e" fontSize={11}>{(percent * 100).toFixed(1)}%</text>
    </g>
  )
}

export default function LensPage() {
  const [data, setData] = useState<LensData | null>(null)
  const [narasi, setNarasi] = useState('')
  const [sumber, setSumber] = useState<'haiku' | 'template' | ''>('')
  const [mode, setMode] = useState<'ringkas' | 'rinci'>('ringkas')
  const [loading, setLoading] = useState(true)

  const [periode, setPeriode] = useState<3 | 6 | 12>(6)
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar')
  const [activeTernakIdx, setActiveTernakIdx] = useState(0)

  const [rinciData, setRinciData] = useState<RinciData | null>(null)
  const [rinciLoading, setRinciLoading] = useState(false)
  const [angsuranFilter, setAngsuranFilter] = useState('semua')
  const [ternakFilter, setTernakFilter] = useState('semua')
  const [simpananSort, setSimpananSort] = useState<'tanggal' | 'jumlah'>('tanggal')

  useEffect(() => {
    async function load() {
      const { data: auth } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('profiles').select('koperasi_id').eq('id', auth.user!.id).single()
      const kopId = profile!.koperasi_id
      const { data: kop } = await supabase
        .from('koperasi').select('nama, fokus_usaha').eq('id', kopId).single()

      const [{ data: simpanan }, { data: ternak }, { data: pakan }, { data: pinjaman }, { data: angsuran }] =
        await Promise.all([
          supabase.from('simpanan').select('jumlah, tanggal').eq('status', 'confirmed').eq('koperasi_id', kopId),
          supabase.from('ternak').select('status').eq('koperasi_id', kopId),
          supabase.from('pakan').select('nama, stok, batas_minimum').eq('koperasi_id', kopId),
          supabase.from('pinjaman').select('id').eq('koperasi_id', kopId),
          supabase.from('angsuran').select('status, tanggal_jatuh_tempo'),
        ])

      const modul = {
        simpanPinjam: (simpanan?.length ?? 0) > 0 || (pinjaman?.length ?? 0) > 0,
        ternak: (ternak?.length ?? 0) > 0,
        pakan: (pakan?.length ?? 0) > 0,
      }

      const now = new Date()

      const bulanList: { key: string; bulan: string }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        bulanList.push({ key: ymKey(d), bulan: namaBulan(d) })
      }

      const totals = bulanList.map((b) => ({
        key: b.key,
        bulan: b.bulan,
        total: (simpanan ?? []).filter((s) => s.tanggal?.startsWith(b.key)).reduce((sum, s) => sum + (s.jumlah ?? 0), 0),
      }))

      const simpananTrend = totals.map((t, i) => ({
        ...t, _idx: i, _prev: i > 0 ? totals[i - 1].total : 0,
      }))

      const bulanIniKey = ymKey(now)
      const bulanLaluKey = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const simpananBulanIni = (simpanan ?? []).filter(s => s.tanggal?.startsWith(bulanIniKey)).reduce((s, x) => s + (x.jumlah ?? 0), 0)
      const simpananBulanLalu = (simpanan ?? []).filter(s => s.tanggal?.startsWith(bulanLaluKey)).reduce((s, x) => s + (x.jumlah ?? 0), 0)

      const hitung = (st: string) => (ternak ?? []).filter((t) => t.status === st).length
      const ternakChart = (['sehat', 'pantau', 'sakit', 'mati'] as const)
        .map((st) => ({ name: st, value: hitung(st) })).filter((x) => x.value > 0)
      const pakanChart = (pakan ?? []).map((p) => ({ nama: p.nama, stok: p.stok, minimum: p.batas_minimum }))
      const pakanMenipis = (pakan ?? []).filter((p) => p.batas_minimum > 0 && p.stok <= p.batas_minimum).map((p) => p.nama)

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
        koperasi: kop?.nama ?? 'Koperasi', fokusUsaha: kop?.fokus_usaha ?? '-',
        simpananBulanIni, pakanMenipis,
        ternak: modul.ternak ? {
          sehat: hitung('sehat'), pantau: hitung('pantau'),
          sakit: hitung('sakit'), mati: hitung('mati'),
          total: (ternak ?? []).filter((t) => t.status !== 'mati').length,
        } : undefined,
        angsuran: { tepatWaktu: totTepat, terlambat: totTerlambat, total: totTepat + totTerlambat },
        modul,
      }

      setData({
        koperasi: kop?.nama ?? 'Koperasi', fokusUsaha: kop?.fokus_usaha ?? '-', kopId,
        simpananTrend, simpananBulanLalu,
        ternak: ternakChart, pakan: pakanChart, angsuran: angsuranChart, modul, ringkasan,
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

  const loadRinci = useCallback(async (kopId: string) => {
    if (rinciData) return
    setRinciLoading(true)
    const now = new Date()
    const bulanIniKey = ymKey(now)
    const bulanLaluKey = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
    const [simpananIni, simpananLalu, angsuranRes, ternakRes, pakanRes] = await Promise.all([
      supabase.from('simpanan').select('id, jumlah, tanggal, anggota:anggota_id(nama)')
        .eq('koperasi_id', kopId).eq('status', 'confirmed')
        .gte('tanggal', bulanIniKey + '-01').order('tanggal', { ascending: false }),
      supabase.from('simpanan').select('jumlah').eq('koperasi_id', kopId).eq('status', 'confirmed')
        .gte('tanggal', bulanLaluKey + '-01').lte('tanggal', bulanLaluKey + '-31'),
      supabase.from('angsuran')
        .select('id, status, tanggal_jatuh_tempo, jumlah_bayar, pinjaman:pinjaman_id(jumlah_pokok, anggota:anggota_id(nama))')
        .order('tanggal_jatuh_tempo', { ascending: false }).limit(100),
      supabase.from('ternak').select('id, kode, jenis, status, umur_bulan').eq('koperasi_id', kopId).order('status'),
      supabase.from('pakan').select('id, nama, stok, batas_minimum, satuan').eq('koperasi_id', kopId).order('nama'),
    ])
    setRinciData({
      simpananBulanIni: (simpananIni.data ?? []) as unknown as RinciSimpanan[],
      simpananBulanLalu: (simpananLalu.data ?? []).reduce((s, x) => s + (x.jumlah ?? 0), 0),
      angsuranAll: (angsuranRes.data ?? []) as unknown as RinciAngsuran[],
      ternakAll: (ternakRes.data ?? []) as RinciTernak[],
      pakanAll: (pakanRes.data ?? []) as RinciPakan[],
    })
    setRinciLoading(false)
  }, [rinciData])

  useEffect(() => {
    if (mode === 'rinci' && data?.kopId && !rinciData && !rinciLoading) loadRinci(data.kopId)
  }, [mode, data, rinciData, rinciLoading, loadRinci])

  const simpananVisible = useMemo(() =>
    data ? data.simpananTrend.slice(-periode) : [], [data, periode])

  const avgSimpanan = useMemo(() =>
    simpananVisible.length ? Math.round(simpananVisible.reduce((s, x) => s + x.total, 0) / simpananVisible.length) : 0,
  [simpananVisible])

  const angsuranVisible = useMemo(() =>
    data ? data.angsuran.slice(-periode) : [], [data, periode])

  const filteredAngsuran = useMemo(() => {
    if (!rinciData) return []
    return angsuranFilter === 'semua' ? rinciData.angsuranAll : rinciData.angsuranAll.filter(a => a.status === angsuranFilter)
  }, [rinciData, angsuranFilter])

  const filteredTernak = useMemo(() => {
    if (!rinciData) return []
    return ternakFilter === 'semua' ? rinciData.ternakAll : rinciData.ternakAll.filter(t => t.status === ternakFilter)
  }, [rinciData, ternakFilter])

  const sortedSimpanan = useMemo(() => {
    if (!rinciData) return []
    return [...rinciData.simpananBulanIni].sort((a, b) =>
      simpananSort === 'jumlah' ? b.jumlah - a.jumlah : new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    )
  }, [rinciData, simpananSort])

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!data) return null

  const { modul, ringkasan } = data
  const adaModul = modul.simpanPinjam || modul.ternak || modul.pakan
  const simpananBulanIni = ringkasan.simpananBulanIni
  const trendSimpanan = data.simpananBulanLalu > 0
    ? Math.round(((simpananBulanIni - data.simpananBulanLalu) / data.simpananBulanLalu) * 100) : null
  const totTepat = ringkasan.angsuran.tepatWaktu
  const totAngsuran = ringkasan.angsuran.total
  const pctTepat = totAngsuran > 0 ? Math.round((totTepat / totAngsuran) * 100) : null
  const totalTernakHidup = ringkasan.ternak?.total ?? 0
  const pctSehat = totalTernakHidup > 0 ? Math.round(((ringkasan.ternak?.sehat ?? 0) / totalTernakHidup) * 100) : null
  const pakanKritis = data.pakan.filter(p => p.minimum > 0 && p.stok <= p.minimum).length

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Lumbung Lens</h1>
          <p className="text-stone-500 text-sm">{data.koperasi} · {data.fokusUsaha}</p>
        </div>
        <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1">
          {(['ringkas', 'rinci'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-lg text-sm capitalize transition-colors
                ${mode === m ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-stone-500 text-xs font-medium">Ringkasan Bulan Ini</p>
          <span className="text-[10px] text-stone-400">{sumber === 'haiku' ? 'AI (Haiku)' : 'template'}</span>
        </div>
        <p className="text-stone-700 text-sm leading-relaxed">{narasi || 'Menyusun ringkasan...'}</p>
      </div>

      {!adaModul && (
        <div className="bg-white border border-dashed border-stone-300 rounded-xl p-8 text-center">
          <p className="text-stone-900 font-medium">Belum ada data operasional</p>
          <p className="text-stone-400 text-sm mt-1">Modul untuk <strong>{data.fokusUsaha}</strong> belum tersedia.</p>
        </div>
      )}

      {mode === 'ringkas' && adaModul && (
        <div className="space-y-5">

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {modul.simpanPinjam && (
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-stone-400 text-xs mb-1">Simpanan Bulan Ini</p>
                <p className="text-stone-900 font-bold text-lg leading-tight">{fmtRb(simpananBulanIni)}</p>
                {trendSimpanan !== null && (
                  <p className={`text-xs flex items-center gap-0.5 mt-1 font-medium ${trendSimpanan >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {trendSimpanan > 0 ? <ArrowUp size={11} /> : trendSimpanan < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                    {Math.abs(trendSimpanan)}% vs bln lalu
                  </p>
                )}
              </div>
            )}
            {modul.simpanPinjam && (
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-stone-400 text-xs mb-1">Angsuran Tepat Waktu</p>
                <p className="text-stone-900 font-bold text-lg leading-tight">
                  {pctTepat !== null ? `${pctTepat}%` : '—'}
                </p>
                <p className="text-stone-400 text-xs mt-1">{totTepat}/{totAngsuran} tagihan</p>
              </div>
            )}
            {modul.ternak && (
              <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-stone-400 text-xs mb-1">Ternak Sehat</p>
                <p className={`font-bold text-lg leading-tight ${(pctSehat ?? 0) >= 80 ? 'text-green-700' : (pctSehat ?? 0) >= 60 ? 'text-amber-700' : 'text-red-600'}`}>
                  {pctSehat !== null ? `${pctSehat}%` : '—'}
                </p>
                <p className="text-stone-400 text-xs mt-1">{ringkasan.ternak?.sehat}/{totalTernakHidup} ekor</p>
              </div>
            )}
            {modul.pakan && (
              <div className={`border rounded-xl p-4 shadow-sm ${pakanKritis > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
                <p className={`text-xs mb-1 ${pakanKritis > 0 ? 'text-red-400' : 'text-stone-400'}`}>Pakan Kritis</p>
                <p className={`font-bold text-lg leading-tight ${pakanKritis > 0 ? 'text-red-600' : 'text-stone-900'}`}>
                  {pakanKritis} item
                </p>
                {pakanKritis > 0 && (
                  <p className="text-red-400 text-xs mt-1 flex items-center gap-0.5">
                    <AlertTriangle size={10} /> Perlu restok segera
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
              {([3, 6, 12] as const).map(p => (
                <button key={p} onClick={() => setPeriode(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${periode === p ? 'bg-amber-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                  {p} bln
                </button>
              ))}
            </div>
            {modul.simpanPinjam && (
              <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
                <button onClick={() => setChartType('bar')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${chartType === 'bar' ? 'bg-amber-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                  <BarChart2 size={12} /> Bar
                </button>
                <button onClick={() => setChartType('line')}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${chartType === 'line' ? 'bg-amber-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
                  <TrendingUp size={12} /> Line
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">

            {modul.simpanPinjam && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-stone-700 text-sm font-medium">Tren Simpanan</p>
                  {avgSimpanan > 0 && (
                    <span className="text-[10px] text-stone-400">Avg: {fmtRb(avgSimpanan)}</span>
                  )}
                </div>
                <p className="text-stone-400 text-xs mb-3">{periode} bulan terakhir</p>
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === 'bar' ? (
                    <BarChart data={simpananVisible} barSize={simpananVisible.length <= 4 ? 32 : 20}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f5f5f4" />
                      <XAxis dataKey="bulan" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a8a29e" fontSize={11} tickFormatter={fmtRb} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<SimpananTooltip />} cursor={{ fill: '#f5f5f4' }} />
                      {avgSimpanan > 0 && (
                        <ReferenceLine y={avgSimpanan} stroke="#b45309" strokeDasharray="4 2" strokeOpacity={0.5}
                          label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#b45309' }} />
                      )}
                      <Bar dataKey="total" radius={[5, 5, 0, 0]} isAnimationActive>
                        {simpananVisible.map((entry, i) => (
                          <Cell key={i}
                            fill={entry.total >= avgSimpanan ? '#b45309' : '#d6a87a'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={simpananVisible}>
                      <defs>
                        <linearGradient id="simpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#b45309" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#b45309" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f5f5f4" />
                      <XAxis dataKey="bulan" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#a8a29e" fontSize={11} tickFormatter={fmtRb} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<SimpananTooltip />} />
                      {avgSimpanan > 0 && (
                        <ReferenceLine y={avgSimpanan} stroke="#b45309" strokeDasharray="4 2" strokeOpacity={0.5}
                          label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#b45309' }} />
                      )}
                      <Area dataKey="total" stroke="#b45309" strokeWidth={2.5} fill="url(#simpGrad)"
                        dot={{ r: 4, fill: '#b45309', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#b45309', stroke: '#fff', strokeWidth: 2 }}
                        isAnimationActive />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {modul.simpanPinjam && angsuranVisible.some(a => a.tepat + a.terlambat > 0) && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
                <p className="text-stone-700 text-sm font-medium mb-1">Ketepatan Angsuran</p>
                <p className="text-stone-400 text-xs mb-3">{periode} bulan terakhir</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={angsuranVisible} barSize={angsuranVisible.length <= 4 ? 32 : 20}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis dataKey="bulan" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#a8a29e" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                    <Tooltip content={<AngsuranTooltip />} cursor={{ fill: '#f5f5f4' }} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-stone-600 text-xs">{v === 'tepat' ? 'Tepat Waktu' : 'Terlambat'}</span>} />
                    <Bar dataKey="tepat" name="tepat" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} isAnimationActive />
                    <Bar dataKey="terlambat" name="terlambat" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} isAnimationActive />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {modul.ternak && data.ternak.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
                <p className="text-stone-700 text-sm font-medium mb-1">Komposisi Ternak</p>
                <p className="text-stone-400 text-xs mb-1">Hover atau klik untuk detail</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>

                    <Pie {...{
                      data: data.ternak,
                      dataKey: 'value',
                      nameKey: 'name',
                      innerRadius: 52,
                      outerRadius: 80,
                      paddingAngle: 3,
                      activeIndex: activeTernakIdx,
                      activeShape: (props: any) => <ActivePieShape {...props} />,
                      onMouseEnter: (_: any, i: number) => setActiveTernakIdx(i),
                      onClick: (_: any, i: number) => setActiveTernakIdx(i),
                      isAnimationActive: true,
                    } as any}>
                      {data.ternak.map((e) => (
                        <Cell key={e.name} fill={WARNA_TERNAK[e.name] ?? '#a8a29e'}
                          stroke="white" strokeWidth={2} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <Legend iconType="circle" iconSize={9}
                      formatter={(v) => <span className="text-stone-600 text-xs capitalize">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {modul.pakan && data.pakan.length > 0 && (
              <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
                <p className="text-stone-700 text-sm font-medium mb-1">Stok Pakan</p>
                <p className="text-stone-400 text-xs mb-3">Stok vs batas minimum</p>
                <ResponsiveContainer width="100%" height={Math.max(160, data.pakan.length * 48)}>
                  <BarChart data={data.pakan} layout="vertical" barSize={12}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f5f5f4" />
                    <XAxis type="number" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => String(v)} />
                    <YAxis type="category" dataKey="nama" width={72} stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<PakanTooltip />} cursor={{ fill: '#f5f5f4' }} />
                    <Legend iconType="circle" iconSize={8}
                      formatter={(v) => <span className="text-stone-600 text-xs">{v === 'stok' ? 'Stok' : 'Minimum'}</span>} />
                    <Bar dataKey="minimum" name="minimum" fill="#d6d3d1" radius={[0, 4, 4, 0]} isAnimationActive />
                    <Bar dataKey="stok" name="stok" radius={[0, 4, 4, 0]} isAnimationActive>
                      {data.pakan.map((entry, i) => {
                        const isCrit = entry.minimum > 0 && entry.stok <= entry.minimum
                        const isWarn = !isCrit && entry.minimum > 0 && entry.stok <= entry.minimum * 1.5
                        return <Cell key={i} fill={isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#38bdf8'} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

          </div>
        </div>
      )}

      {mode === 'rinci' && adaModul && (
        <div className="space-y-4">
          {rinciLoading ? (
            <div className="flex items-center justify-center gap-3 py-12 bg-white border border-stone-200 rounded-xl">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Memuat data rinci...</p>
            </div>
          ) : rinciData ? (
            <>
              {modul.simpanPinjam && (
                <>

                  <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-stone-900 text-sm font-semibold">Setoran Bulan Ini</p>
                        <p className="text-stone-400 text-xs mt-0.5">{rinciData.simpananBulanIni.length} transaksi terkonfirmasi</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-amber-700 font-bold text-sm">
                          {rp(rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0))}
                        </p>
                        {rinciData.simpananBulanLalu > 0 && (() => {
                          const selisih = rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0) - rinciData.simpananBulanLalu
                          const pct = Math.round(Math.abs(selisih) / rinciData.simpananBulanLalu * 100)
                          return (
                            <p className={`text-xs flex items-center justify-end gap-0.5 mt-0.5 ${selisih >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                              {selisih > 0 ? <ArrowUp size={11} /> : selisih < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                              {pct}% vs bulan lalu
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-stone-100 bg-stone-50">
                      <span className="text-stone-400 text-xs">Urut:</span>
                      {(['tanggal', 'jumlah'] as const).map(s => (
                        <button key={s} onClick={() => setSimpananSort(s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                            ${simpananSort === s ? 'bg-amber-700 text-white border-amber-700' : 'text-stone-600 border-stone-300 hover:border-stone-400 bg-white'}`}>
                          {s === 'tanggal' ? 'Terbaru' : 'Terbesar'}
                        </button>
                      ))}
                    </div>
                    {rinciData.simpananBulanIni.length === 0 ? (
                      <p className="text-stone-400 text-sm text-center py-8">Belum ada setoran bulan ini</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-50 text-stone-500 text-xs border-b border-stone-100">
                            <th className="px-4 py-2.5 text-left font-medium">Anggota</th>
                            <th className="px-4 py-2.5 text-left font-medium">Tanggal</th>
                            <th className="px-4 py-2.5 text-right font-medium">Jumlah</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {sortedSimpanan.map(s => (
                            <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                              <td className="px-4 py-2.5 text-stone-900 font-medium">{s.anggota?.nama ?? '—'}</td>
                              <td className="px-4 py-2.5 text-stone-500 text-xs">
                                {new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-2.5 text-right text-stone-900 font-semibold">{rp(s.jumlah)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-amber-200 bg-amber-50">
                            <td colSpan={2} className="px-4 py-2.5 text-amber-800 font-semibold text-sm">Total</td>
                            <td className="px-4 py-2.5 text-right text-amber-800 font-bold">
                              {rp(rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>

                  <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-stone-900 text-sm font-semibold">Status Angsuran</p>
                        <p className="text-stone-400 text-xs mt-0.5">{filteredAngsuran.length} dari {rinciData.angsuranAll.length} entri</p>
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {[
                          { key: 'semua', label: 'Semua' },
                          { key: 'lunas', label: 'Lunas' },
                          { key: 'terlambat', label: 'Terlambat' },
                          { key: 'belum_lunas', label: 'Belum Lunas' },
                        ].map(f => (
                          <button key={f.key} onClick={() => setAngsuranFilter(f.key)}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors
                              ${angsuranFilter === f.key ? 'bg-amber-700 text-white border-amber-700' : 'text-stone-600 border-stone-300 hover:border-stone-400 bg-white'}`}>
                            {f.label}
                            {f.key !== 'semua' && (
                              <span className="ml-1 opacity-70">({rinciData.angsuranAll.filter(a => a.status === f.key).length})</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filteredAngsuran.length === 0 ? (
                      <p className="text-stone-400 text-sm text-center py-8">Tidak ada data angsuran</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-stone-50 text-stone-500 text-xs border-b border-stone-100">
                            <th className="px-4 py-2.5 text-left font-medium">Anggota</th>
                            <th className="px-4 py-2.5 text-left font-medium">Jatuh Tempo</th>
                            <th className="px-4 py-2.5 text-center font-medium">Status</th>
                            <th className="px-4 py-2.5 text-right font-medium">Dibayar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {filteredAngsuran.map(a => (
                            <tr key={a.id} className="hover:bg-stone-50 transition-colors">
                              <td className="px-4 py-2.5 text-stone-900 font-medium">
                                {(a.pinjaman?.anggota as any)?.nama ?? '—'}
                              </td>
                              <td className="px-4 py-2.5 text-stone-500 text-xs">
                                {a.tanggal_jatuh_tempo ? new Date(a.tanggal_jatuh_tempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${STATUS_ANGSURAN[a.status] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                  {a.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right text-stone-700">
                                {a.jumlah_bayar ? rp(a.jumlah_bayar) : <span className="text-stone-300">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              )}

              {modul.ternak && (
                <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-stone-900 text-sm font-semibold">Daftar Ternak</p>
                      <p className="text-stone-400 text-xs mt-0.5">{filteredTernak.length} dari {rinciData.ternakAll.length} ekor</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {['semua', 'sehat', 'pantau', 'sakit', 'mati'].map(f => (
                        <button key={f} onClick={() => setTernakFilter(f)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors capitalize
                            ${ternakFilter === f ? 'bg-amber-700 text-white border-amber-700' : 'text-stone-600 border-stone-300 hover:border-stone-400 bg-white'}`}>
                          {f}
                          {f !== 'semua' && (
                            <span className="ml-1 opacity-70">({rinciData.ternakAll.filter(t => t.status === f).length})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredTernak.length === 0 ? (
                    <p className="text-stone-400 text-sm text-center py-8">Tidak ada ternak dengan filter ini</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50 text-stone-500 text-xs border-b border-stone-100">
                          <th className="px-4 py-2.5 text-left font-medium">Kode</th>
                          <th className="px-4 py-2.5 text-left font-medium">Jenis</th>
                          <th className="px-4 py-2.5 text-center font-medium">Status</th>
                          <th className="px-4 py-2.5 text-right font-medium">Umur</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {filteredTernak.map(t => (
                          <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                            <td className="px-4 py-2.5 text-stone-900 font-mono font-medium text-xs">{t.kode}</td>
                            <td className="px-4 py-2.5 text-stone-700 capitalize">{t.jenis}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs border px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_TERNAK[t.status] ?? 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-stone-500 text-xs">
                              {t.umur_bulan != null ? `${t.umur_bulan} bln` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {modul.pakan && (
                <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100">
                    <p className="text-stone-900 text-sm font-semibold">Stok Pakan</p>
                    <p className="text-stone-400 text-xs mt-0.5">{rinciData.pakanAll.length} jenis</p>
                  </div>
                  <div className="divide-y divide-stone-100">
                    {rinciData.pakanAll.map(p => {
                      const isCritical = p.batas_minimum > 0 && p.stok <= p.batas_minimum
                      const isWarning = !isCritical && p.batas_minimum > 0 && p.stok <= p.batas_minimum * 1.5
                      const maxRef = Math.max(p.batas_minimum * 3, p.stok, 1)
                      const pct = Math.min(100, (p.stok / maxRef) * 100)
                      const minPct = Math.min(100, (p.batas_minimum / maxRef) * 100)
                      return (
                        <div key={p.id} className={`px-4 py-3.5 ${isCritical ? 'bg-red-50' : isWarning ? 'bg-amber-50' : ''}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {isCritical && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
                              <span className="text-stone-900 text-sm font-medium">{p.nama}</span>
                            </div>
                            <div className="text-right">
                              <span className={`text-sm font-bold ${isCritical ? 'text-red-600' : isWarning ? 'text-amber-700' : 'text-stone-900'}`}>
                                {p.stok} {p.satuan}
                              </span>
                              {isCritical && <span className="ml-2 text-xs bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full font-medium">Kritis</span>}
                              {isWarning && <span className="ml-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-medium">Menipis</span>}
                            </div>
                          </div>
                          <div className="relative h-2.5 bg-stone-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-green-500'}`}
                              style={{ width: `${pct}%` }} />
                            {p.batas_minimum > 0 && (
                              <div className="absolute top-0 bottom-0 w-0.5 bg-stone-500 opacity-40"
                                style={{ left: `${minPct}%` }} />
                            )}
                          </div>
                          {p.batas_minimum > 0 && (
                            <p className="text-stone-400 text-xs mt-1.5">
                              Minimum: {p.batas_minimum} {p.satuan} ·{' '}
                              <span className={isCritical ? 'text-red-500 font-medium' : isWarning ? 'text-amber-600' : 'text-stone-400'}>
                                {isCritical ? `defisit ${p.batas_minimum - p.stok} ${p.satuan}` : `sisa buffer ${p.stok - p.batas_minimum} ${p.satuan}`}
                              </span>
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
