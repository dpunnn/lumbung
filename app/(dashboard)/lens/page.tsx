'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Sector,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, CartesianGrid,
} from 'recharts'
import { AlertTriangle, ArrowDown, ArrowUp, BarChart2, TrendingUp, Minus } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
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

const STATUS_ANGSURAN: Record<string, React.CSSProperties> = {
  lunas:       { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' },
  terlambat:   { background: 'rgba(214,87,69,.12)', color: '#c0392b', border: '1px solid rgba(214,87,69,.28)' },
  belum_lunas: { background: 'rgba(201,150,58,.12)', color: '#8a6420', border: '1px solid rgba(201,150,58,.3)' },
}
const STATUS_TERNAK: Record<string, React.CSSProperties> = {
  sehat:  { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' },
  pantau: { background: 'rgba(201,150,58,.12)', color: '#8a6420', border: '1px solid rgba(201,150,58,.3)' },
  sakit:  { background: 'rgba(214,87,69,.12)', color: '#c0392b', border: '1px solid rgba(214,87,69,.28)' },
  mati:   { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' },
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}
const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '11px 16px', textAlign: 'left', whiteSpace: 'nowrap',
}

const tooltipBase: React.CSSProperties = {
  background: '#fff', border: '1px solid rgba(26,71,49,.12)', borderRadius: 14,
  boxShadow: '0 8px 24px rgba(26,71,49,.12)', padding: '12px 16px', minWidth: 160, fontSize: 12,
}

function SimpananTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const cur = payload[0].value as number
  const idx = payload[0].payload._idx as number
  const prev = payload[0].payload._prev as number
  const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null
  return (
    <div style={tooltipBase}>
      <p style={{ color: '#9aa39c', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      <p style={{ color: '#0f2a1d', fontWeight: 800, fontSize: 15 }}>{rp(cur)}</p>
      {pct !== null && idx > 0 && (
        <p style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 5, fontWeight: 600, color: pct >= 0 ? '#1d7a4d' : '#c0392b' }}>
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
    <div style={{ ...tooltipBase, minWidth: 180 }}>
      <p style={{ color: '#9aa39c', marginBottom: 8, fontWeight: 600 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />Tepat waktu
          </span>
          <span style={{ fontWeight: 700, color: '#1d7a4d' }}>{tepat}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />Terlambat
          </span>
          <span style={{ fontWeight: 700, color: '#c0392b' }}>{terlambat}</span>
        </div>
        {pct !== null && (
          <div style={{ borderTop: '1px solid rgba(26,71,49,.08)', paddingTop: 6, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#9aa39c' }}>Tingkat keberhasilan</span>
            <span style={{ fontWeight: 800, color: pct >= 80 ? '#1d7a4d' : pct >= 60 ? '#8a6420' : '#c0392b' }}>{pct}%</span>
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
    <div style={{ ...tooltipBase, minWidth: 170 }}>
      <p style={{ color: '#0f2a1d', fontWeight: 700, marginBottom: 8 }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: '#9aa39c' }}>Stok sekarang</span>
          <span style={{ fontWeight: 800, color: isCritical ? '#c0392b' : isWarning ? '#8a6420' : '#0f2a1d' }}>{stok}</span>
        </div>
        {minimum > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ color: '#9aa39c' }}>Batas minimum</span>
            <span style={{ color: '#46544b' }}>{minimum}</span>
          </div>
        )}
        {isCritical && (
          <p style={{ color: '#c0392b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
            <AlertTriangle size={11} /> Stok di bawah minimum!
          </p>
        )}
        {isWarning && <p style={{ color: '#8a6420', fontWeight: 600, marginTop: 4 }}>Mendekati batas minimum</p>}
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
      <text x={cx} y={cy - 12} textAnchor="middle" fill="#0f2a1d" fontSize={24} fontWeight={700}>{value}</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="#7a857d" fontSize={12} fontWeight={600}>{payload.name}</text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="#9aa39c" fontSize={11}>{(percent * 100).toFixed(1)}%</text>
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
      const me = await getMe()
      if (!me?.koperasi_id) return
      const kopId = me.koperasi_id
      const kop = await api.get<{ nama: string; fokus_usaha: string }>(`/api/koperasi/${kopId}`).catch(() => null)
      const [simpanan, ternak, pakan, pinjaman, angsuran] = await Promise.all([
        api.get<{ jumlah: number; tanggal: string }[]>(`/api/simpanan?koperasi_id=${kopId}&status=confirmed`).catch(() => []),
        api.get<{ status: string }[]>(`/api/stok/ternak?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ nama: string; stok: number; batas_minimum: number }[]>(`/api/stok?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string }[]>(`/api/pinjaman?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ status: string; tanggal_jatuh_tempo: string }[]>(`/api/angsuran?koperasi_id=${kopId}`).catch(() => []),
      ])
      const modul = { simpanPinjam: simpanan.length > 0 || pinjaman.length > 0, ternak: ternak.length > 0, pakan: pakan.length > 0 }
      const now = new Date()
      const bulanList: { key: string; bulan: string }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        bulanList.push({ key: ymKey(d), bulan: namaBulan(d) })
      }
      const totals = bulanList.map(b => ({
        key: b.key, bulan: b.bulan,
        total: simpanan.filter(s => s.tanggal?.startsWith(b.key)).reduce((sum, s) => sum + (s.jumlah ?? 0), 0),
      }))
      const simpananTrend = totals.map((t, i) => ({ ...t, _idx: i, _prev: i > 0 ? totals[i - 1].total : 0 }))
      const bulanIniKey = ymKey(now)
      const bulanLaluKey = ymKey(new Date(now.getFullYear(), now.getMonth() - 1, 1))
      const simpananBulanIni = simpanan.filter(s => s.tanggal?.startsWith(bulanIniKey)).reduce((s, x) => s + (x.jumlah ?? 0), 0)
      const simpananBulanLalu = simpanan.filter(s => s.tanggal?.startsWith(bulanLaluKey)).reduce((s, x) => s + (x.jumlah ?? 0), 0)
      const hitung = (st: string) => ternak.filter(t => t.status === st).length
      const ternakChart = (['sehat', 'pantau', 'sakit', 'mati'] as const).map(st => ({ name: st, value: hitung(st) })).filter(x => x.value > 0)
      const pakanChart = pakan.map(p => ({ nama: p.nama, stok: p.stok, minimum: p.batas_minimum }))
      const pakanMenipis = pakan.filter(p => p.batas_minimum > 0 && p.stok <= p.batas_minimum).map(p => p.nama)
      const angsuranChart = bulanList.map(b => {
        const baris = angsuran.filter(a => a.tanggal_jatuh_tempo?.startsWith(b.key))
        return { bulan: b.bulan, tepat: baris.filter(a => a.status === 'lunas').length, terlambat: baris.filter(a => a.status === 'terlambat').length }
      })
      const totTepat = angsuranChart.reduce((s, a) => s + a.tepat, 0)
      const totTerlambat = angsuranChart.reduce((s, a) => s + a.terlambat, 0)
      const ringkasan: RingkasanLens = {
        koperasi: kop?.nama ?? 'Koperasi', fokusUsaha: kop?.fokus_usaha ?? '-', simpananBulanIni, pakanMenipis,
        ternak: modul.ternak ? { sehat: hitung('sehat'), pantau: hitung('pantau'), sakit: hitung('sakit'), mati: hitung('mati'), total: ternak.filter(t => t.status !== 'mati').length } : undefined,
        angsuran: { tepatWaktu: totTepat, terlambat: totTerlambat, total: totTepat + totTerlambat },
        modul,
      }
      setData({ koperasi: kop?.nama ?? 'Koperasi', fokusUsaha: kop?.fokus_usaha ?? '-', kopId, simpananTrend, simpananBulanLalu, ternak: ternakChart, pakan: pakanChart, angsuran: angsuranChart, modul, ringkasan })
      setLoading(false)
      try {
        const res = await fetch('/api/narasi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ringkasan) })
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
    const [simpananIni, simpananLaluArr, angsuranRes, ternakRes, pakanRes] = await Promise.all([
      api.get<RinciSimpanan[]>(`/api/simpanan?koperasi_id=${kopId}&status=confirmed&tanggal_gte=${bulanIniKey}-01`).catch(() => [] as RinciSimpanan[]),
      api.get<{ jumlah: number }[]>(`/api/simpanan?koperasi_id=${kopId}&status=confirmed&tanggal_gte=${bulanLaluKey}-01&tanggal_lte=${bulanLaluKey}-31`).catch(() => []),
      api.get<RinciAngsuran[]>(`/api/angsuran?koperasi_id=${kopId}&limit=100`).catch(() => [] as RinciAngsuran[]),
      api.get<RinciTernak[]>(`/api/stok/ternak?koperasi_id=${kopId}`).catch(() => [] as RinciTernak[]),
      api.get<RinciPakan[]>(`/api/stok?koperasi_id=${kopId}`).catch(() => [] as RinciPakan[]),
    ])
    setRinciData({
      simpananBulanIni: simpananIni,
      simpananBulanLalu: simpananLaluArr.reduce((s, x) => s + (x.jumlah ?? 0), 0),
      angsuranAll: angsuranRes, ternakAll: ternakRes, pakanAll: pakanRes,
    })
    setRinciLoading(false)
  }, [rinciData])

  useEffect(() => {
    if (mode === 'rinci' && data?.kopId && !rinciData && !rinciLoading) loadRinci(data.kopId)
  }, [mode, data, rinciData, rinciLoading, loadRinci])

  const simpananVisible = useMemo(() => data ? data.simpananTrend.slice(-periode) : [], [data, periode])
  const avgSimpanan = useMemo(() => simpananVisible.length ? Math.round(simpananVisible.reduce((s, x) => s + x.total, 0) / simpananVisible.length) : 0, [simpananVisible])
  const angsuranVisible = useMemo(() => data ? data.angsuran.slice(-periode) : [], [data, periode])
  const filteredAngsuran = useMemo(() => !rinciData ? [] : angsuranFilter === 'semua' ? rinciData.angsuranAll : rinciData.angsuranAll.filter(a => a.status === angsuranFilter), [rinciData, angsuranFilter])
  const filteredTernak = useMemo(() => !rinciData ? [] : ternakFilter === 'semua' ? rinciData.ternakAll : rinciData.ternakAll.filter(t => t.status === ternakFilter), [rinciData, ternakFilter])
  const sortedSimpanan = useMemo(() => {
    if (!rinciData) return []
    return [...rinciData.simpananBulanIni].sort((a, b) =>
      simpananSort === 'jumlah' ? b.jumlah - a.jumlah : new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
    )
  }, [rinciData, simpananSort])

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  const filterPill = (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999, cursor: 'pointer', border: 'none',
    background: active ? '#1a4731' : 'rgba(255,255,255,.7)', color: active ? '#fff' : '#46544b',
    borderWidth: 1, borderStyle: 'solid', borderColor: active ? '#1a4731' : 'rgba(26,71,49,.14)',
  })

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
    </div>
  )
  if (!data) return null

  const { modul, ringkasan } = data
  const adaModul = modul.simpanPinjam || modul.ternak || modul.pakan
  const simpananBulanIni = ringkasan.simpananBulanIni
  const trendSimpanan = data.simpananBulanLalu > 0 ? Math.round(((simpananBulanIni - data.simpananBulanLalu) / data.simpananBulanLalu) * 100) : null
  const totTepat = ringkasan.angsuran.tepatWaktu
  const totAngsuran = ringkasan.angsuran.total
  const pctTepat = totAngsuran > 0 ? Math.round((totTepat / totAngsuran) * 100) : null
  const totalTernakHidup = ringkasan.ternak?.total ?? 0
  const pctSehat = totalTernakHidup > 0 ? Math.round(((ringkasan.ternak?.sehat ?? 0) / totalTernakHidup) * 100) : null
  const pakanKritis = data.pakan.filter(p => p.minimum > 0 && p.stok <= p.minimum).length

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both', display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Lens</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>{data.koperasi} · {data.fokusUsaha}</p>
        </div>
        <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5 }}>
          {(['ringkas', 'rinci'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={tabBtn(mode === m)}>{m}</button>
          ))}
        </div>
      </div>

      {/* Narasi */}
      <div style={{ ...glass, borderRadius: 18, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#9aa39c', textTransform: 'uppercase', letterSpacing: '.04em' }}>Ringkasan Bulan Ini</p>
          <span style={{ fontSize: 11, color: '#c4ccc6' }}>{sumber === 'haiku' ? 'AI (Haiku)' : 'template'}</span>
        </div>
        <p style={{ fontSize: 13.5, color: '#46544b', lineHeight: 1.7 }}>{narasi || 'Menyusun ringkasan...'}</p>
      </div>

      {!adaModul && (
        <div style={{ ...glass, borderRadius: 18, padding: '40px 0', textAlign: 'center' }}>
          <p style={{ fontWeight: 700, color: '#0f2a1d', fontSize: 15 }}>Belum ada data operasional</p>
          <p style={{ fontSize: 13, color: '#9aa39c', marginTop: 4 }}>Modul untuk <strong>{data.fokusUsaha}</strong> belum tersedia.</p>
        </div>
      )}

      {mode === 'ringkas' && adaModul && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* KPI grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {modul.simpanPinjam && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Simpanan Bulan Ini</p>
                <p style={{ fontSize: 21, fontWeight: 800, color: '#0f2a1d', lineHeight: 1.1 }}>{fmtRb(simpananBulanIni)}</p>
                {trendSimpanan !== null && (
                  <p style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, fontWeight: 600, color: trendSimpanan >= 0 ? '#1d7a4d' : '#c0392b' }}>
                    {trendSimpanan > 0 ? <ArrowUp size={11} /> : trendSimpanan < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                    {Math.abs(trendSimpanan)}% vs bln lalu
                  </p>
                )}
              </div>
            )}
            {modul.simpanPinjam && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Angsuran Tepat Waktu</p>
                <p style={{ fontSize: 21, fontWeight: 800, color: '#0f2a1d', lineHeight: 1.1 }}>
                  {pctTepat !== null ? `${pctTepat}%` : '—'}
                </p>
                <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 6 }}>{totTepat}/{totAngsuran} tagihan</p>
              </div>
            )}
            {modul.ternak && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Ternak Sehat</p>
                <p style={{ fontSize: 21, fontWeight: 800, color: (pctSehat ?? 0) >= 80 ? '#1d7a4d' : (pctSehat ?? 0) >= 60 ? '#8a6420' : '#c0392b', lineHeight: 1.1 }}>
                  {pctSehat !== null ? `${pctSehat}%` : '—'}
                </p>
                <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 6 }}>{ringkasan.ternak?.sehat}/{totalTernakHidup} ekor</p>
              </div>
            )}
            {modul.pakan && (
              <div style={{ background: pakanKritis > 0 ? 'rgba(214,87,69,.1)' : 'rgba(255,255,255,.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: pakanKritis > 0 ? '1px solid rgba(214,87,69,.25)' : '1px solid rgba(255,255,255,.7)', boxShadow: '0 10px 26px rgba(26,71,49,.08)', borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Pakan Kritis</p>
                <p style={{ fontSize: 21, fontWeight: 800, color: pakanKritis > 0 ? '#c0392b' : '#9aa39c', lineHeight: 1.1 }}>{pakanKritis} item</p>
                {pakanKritis > 0 && (
                  <p style={{ fontSize: 12, color: '#c0392b', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> Perlu restok segera
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5 }}>
              {([3, 6, 12] as const).map(p => (
                <button key={p} onClick={() => setPeriode(p)} style={filterPill(periode === p)}>{p} bln</button>
              ))}
            </div>
            {modul.simpanPinjam && (
              <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5 }}>
                <button onClick={() => setChartType('bar')}
                  style={{ ...filterPill(chartType === 'bar'), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <BarChart2 size={12} /> Bar
                </button>
                <button onClick={() => setChartType('line')}
                  style={{ ...filterPill(chartType === 'line'), display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <TrendingUp size={12} /> Line
                </button>
              </div>
            )}
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
            {modul.simpanPinjam && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d' }}>Tren Simpanan</p>
                  {avgSimpanan > 0 && <span style={{ fontSize: 11, color: '#9aa39c' }}>Avg: {fmtRb(avgSimpanan)}</span>}
                </div>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 12 }}>{periode} bulan terakhir</p>
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === 'bar' ? (
                    <BarChart data={simpananVisible} barSize={simpananVisible.length <= 4 ? 32 : 20}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,71,49,.06)" />
                      <XAxis dataKey="bulan" stroke="#9aa39c" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9aa39c" fontSize={11} tickFormatter={fmtRb} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<SimpananTooltip />} cursor={{ fill: 'rgba(26,71,49,.04)' }} />
                      {avgSimpanan > 0 && <ReferenceLine y={avgSimpanan} stroke="#c9963a" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#c9963a' }} />}
                      <Bar dataKey="total" radius={[5, 5, 0, 0]} isAnimationActive>
                        {simpananVisible.map((entry, i) => <Cell key={i} fill={entry.total >= avgSimpanan ? '#1a4731' : '#7aad8a'} />)}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart data={simpananVisible}>
                      <defs>
                        <linearGradient id="simpGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1a4731" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#1a4731" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,71,49,.06)" />
                      <XAxis dataKey="bulan" stroke="#9aa39c" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#9aa39c" fontSize={11} tickFormatter={fmtRb} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<SimpananTooltip />} />
                      {avgSimpanan > 0 && <ReferenceLine y={avgSimpanan} stroke="#c9963a" strokeDasharray="4 2" strokeOpacity={0.5} label={{ value: 'avg', position: 'right', fontSize: 9, fill: '#c9963a' }} />}
                      <Area dataKey="total" stroke="#1a4731" strokeWidth={2.5} fill="url(#simpGrad)" dot={{ r: 4, fill: '#1a4731', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#1a4731', stroke: '#fff', strokeWidth: 2 }} isAnimationActive />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {modul.simpanPinjam && angsuranVisible.some(a => a.tepat + a.terlambat > 0) && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d', marginBottom: 4 }}>Ketepatan Angsuran</p>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 12 }}>{periode} bulan terakhir</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={angsuranVisible} barSize={angsuranVisible.length <= 4 ? 32 : 20}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,71,49,.06)" />
                    <XAxis dataKey="bulan" stroke="#9aa39c" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#9aa39c" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} width={24} />
                    <Tooltip content={<AngsuranTooltip />} cursor={{ fill: 'rgba(26,71,49,.04)' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 12, color: '#46544b' }}>{v === 'tepat' ? 'Tepat Waktu' : 'Terlambat'}</span>} />
                    <Bar dataKey="tepat" name="tepat" stackId="a" fill="#22c55e" radius={[0,0,0,0]} isAnimationActive />
                    <Bar dataKey="terlambat" name="terlambat" stackId="a" fill="#ef4444" radius={[4,4,0,0]} isAnimationActive />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {modul.ternak && data.ternak.length > 0 && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d', marginBottom: 4 }}>Komposisi Ternak</p>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 4 }}>Hover atau klik untuk detail</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie {...{
                      data: data.ternak, dataKey: 'value', nameKey: 'name',
                      innerRadius: 52, outerRadius: 80, paddingAngle: 3,
                      activeIndex: activeTernakIdx, activeShape: (props: any) => <ActivePieShape {...props} />,
                      onMouseEnter: (_: any, i: number) => setActiveTernakIdx(i),
                      onClick: (_: any, i: number) => setActiveTernakIdx(i),
                      isAnimationActive: true,
                    } as any}>
                      {data.ternak.map(e => <Cell key={e.name} fill={WARNA_TERNAK[e.name] ?? '#9aa39c'} stroke="white" strokeWidth={2} style={{ cursor: 'pointer' }} />)}
                    </Pie>
                    <Legend iconType="circle" iconSize={9} formatter={(v) => <span style={{ fontSize: 12, color: '#46544b', textTransform: 'capitalize' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {modul.pakan && data.pakan.length > 0 && (
              <div style={{ ...glass, borderRadius: 18, padding: '16px 18px' }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d', marginBottom: 4 }}>Stok Pakan</p>
                <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 12 }}>Stok vs batas minimum</p>
                <ResponsiveContainer width="100%" height={Math.max(160, data.pakan.length * 48)}>
                  <BarChart data={data.pakan} layout="vertical" barSize={12}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(26,71,49,.06)" />
                    <XAxis type="number" stroke="#9aa39c" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => String(v)} />
                    <YAxis type="category" dataKey="nama" width={72} stroke="#46544b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<PakanTooltip />} cursor={{ fill: 'rgba(26,71,49,.04)' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 12, color: '#46544b' }}>{v === 'stok' ? 'Stok' : 'Minimum'}</span>} />
                    <Bar dataKey="minimum" name="minimum" fill="#d6d3d1" radius={[0,4,4,0]} isAnimationActive />
                    <Bar dataKey="stok" name="stok" radius={[0,4,4,0]} isAnimationActive>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rinciLoading ? (
            <div style={{ ...glass, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 0' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13.5, color: '#9aa39c' }}>Memuat data rinci...</p>
            </div>
          ) : rinciData ? (
            <>
              {modul.simpanPinjam && (
                <>
                  <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div>
                        <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Setoran Bulan Ini</p>
                        <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>{rinciData.simpananBulanIni.length} transaksi terkonfirmasi</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 800, color: '#1a4731' }}>
                          {rp(rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0))}
                        </p>
                        {rinciData.simpananBulanLalu > 0 && (() => {
                          const selisih = rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0) - rinciData.simpananBulanLalu
                          const pct = Math.round(Math.abs(selisih) / rinciData.simpananBulanLalu * 100)
                          return (
                            <p style={{ fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 3, color: selisih >= 0 ? '#1d7a4d' : '#c0392b' }}>
                              {selisih > 0 ? <ArrowUp size={11} /> : selisih < 0 ? <ArrowDown size={11} /> : <Minus size={11} />}
                              {pct}% vs bulan lalu
                            </p>
                          )
                        })()}
                      </div>
                    </div>
                    <div style={{ padding: '8px 20px', borderBottom: '1px solid rgba(26,71,49,.05)', background: 'rgba(247,244,236,.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, color: '#9aa39c' }}>Urut:</span>
                      {(['tanggal', 'jumlah'] as const).map(s => (
                        <button key={s} onClick={() => setSimpananSort(s)} style={filterPill(simpananSort === s)}>
                          {s === 'tanggal' ? 'Terbaru' : 'Terbesar'}
                        </button>
                      ))}
                    </div>
                    {rinciData.simpananBulanIni.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: '#9aa39c', textAlign: 'center', padding: '32px 0' }}>Belum ada setoran bulan ini</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                              <th style={thStyle}>Anggota</th>
                              <th style={thStyle}>Tanggal</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Jumlah</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sortedSimpanan.map(s => (
                              <tr key={s.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                <td style={{ padding: '11px 20px', fontWeight: 700, color: '#0f2a1d' }}>{s.anggota?.nama ?? '—'}</td>
                                <td style={{ padding: '11px 20px', color: '#9aa39c', fontSize: 12 }}>
                                  {new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </td>
                                <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 700, color: '#0f2a1d' }}>{rp(s.jumlah)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr style={{ borderTop: '2px solid rgba(201,150,58,.3)', background: 'rgba(201,150,58,.07)' }}>
                              <td colSpan={2} style={{ padding: '11px 20px', fontWeight: 800, color: '#8a6420', fontSize: 14 }}>Total</td>
                              <td style={{ padding: '11px 20px', textAlign: 'right', fontWeight: 800, color: '#8a6420', fontSize: 14 }}>
                                {rp(rinciData.simpananBulanIni.reduce((s, x) => s + x.jumlah, 0))}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>

                  <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Status Angsuran</p>
                        <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>{filteredAngsuran.length} dari {rinciData.angsuranAll.length} entri</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {[
                          { key: 'semua', label: 'Semua' },
                          { key: 'lunas', label: 'Lunas' },
                          { key: 'terlambat', label: 'Terlambat' },
                          { key: 'belum_lunas', label: 'Belum Lunas' },
                        ].map(f => (
                          <button key={f.key} onClick={() => setAngsuranFilter(f.key)} style={filterPill(angsuranFilter === f.key)}>
                            {f.label}
                            {f.key !== 'semua' && <span style={{ marginLeft: 4, opacity: 0.7 }}>({rinciData.angsuranAll.filter(a => a.status === f.key).length})</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filteredAngsuran.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: '#9aa39c', textAlign: 'center', padding: '32px 0' }}>Tidak ada data angsuran</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                              <th style={thStyle}>Anggota</th>
                              <th style={thStyle}>Jatuh Tempo</th>
                              <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                              <th style={{ ...thStyle, textAlign: 'right' }}>Dibayar</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAngsuran.map(a => (
                              <tr key={a.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                                <td style={{ padding: '11px 20px', fontWeight: 700, color: '#0f2a1d' }}>
                                  {(a.pinjaman?.anggota as any)?.nama ?? '—'}
                                </td>
                                <td style={{ padding: '11px 20px', color: '#9aa39c', fontSize: 12 }}>
                                  {a.tanggal_jatuh_tempo ? new Date(a.tanggal_jatuh_tempo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                </td>
                                <td style={{ padding: '11px 20px', textAlign: 'center' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-block', ...(STATUS_ANGSURAN[a.status] ?? { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' }) }}>
                                    {a.status}
                                  </span>
                                </td>
                                <td style={{ padding: '11px 20px', textAlign: 'right', color: '#46544b' }}>
                                  {a.jumlah_bayar ? rp(a.jumlah_bayar) : <span style={{ color: '#c4ccc6' }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

              {modul.ternak && (
                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Daftar Ternak</p>
                      <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>{filteredTernak.length} dari {rinciData.ternakAll.length} ekor</p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['semua', 'sehat', 'pantau', 'sakit', 'mati'].map(f => (
                        <button key={f} onClick={() => setTernakFilter(f)} style={filterPill(ternakFilter === f)}>
                          {f} {f !== 'semua' && <span style={{ marginLeft: 3, opacity: 0.7 }}>({rinciData.ternakAll.filter(t => t.status === f).length})</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  {filteredTernak.length === 0 ? (
                    <p style={{ fontSize: 13.5, color: '#9aa39c', textAlign: 'center', padding: '32px 0' }}>Tidak ada ternak dengan filter ini</p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                            <th style={thStyle}>Kode</th>
                            <th style={thStyle}>Jenis</th>
                            <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                            <th style={{ ...thStyle, textAlign: 'right' }}>Umur</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTernak.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                              <td style={{ padding: '11px 20px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#0f2a1d' }}>{t.kode}</td>
                              <td style={{ padding: '11px 20px', color: '#46544b', textTransform: 'capitalize' }}>{t.jenis}</td>
                              <td style={{ padding: '11px 20px', textAlign: 'center' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-block', textTransform: 'capitalize', ...(STATUS_TERNAK[t.status] ?? { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' }) }}>
                                  {t.status}
                                </span>
                              </td>
                              <td style={{ padding: '11px 20px', textAlign: 'right', color: '#9aa39c', fontSize: 12 }}>
                                {t.umur_bulan != null ? `${t.umur_bulan} bln` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {modul.pakan && (
                <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                    <p style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Stok Pakan</p>
                    <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>{rinciData.pakanAll.length} jenis</p>
                  </div>
                  {rinciData.pakanAll.map(p => {
                    const isCritical = p.batas_minimum > 0 && p.stok <= p.batas_minimum
                    const isWarning = !isCritical && p.batas_minimum > 0 && p.stok <= p.batas_minimum * 1.5
                    const maxRef = Math.max(p.batas_minimum * 3, p.stok, 1)
                    const pct = Math.min(100, (p.stok / maxRef) * 100)
                    const minPct = Math.min(100, (p.batas_minimum / maxRef) * 100)
                    return (
                      <div key={p.id} style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.05)', background: isCritical ? 'rgba(214,87,69,.05)' : isWarning ? 'rgba(201,150,58,.05)' : 'transparent' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {isCritical && <AlertTriangle size={13} style={{ color: '#d65745', flexShrink: 0 }} />}
                            <span style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d' }}>{p.nama}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: isCritical ? '#c0392b' : isWarning ? '#8a6420' : '#0f2a1d' }}>{p.stok} {p.satuan}</span>
                            {isCritical && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#c0392b', background: 'rgba(214,87,69,.12)', border: '1px solid rgba(214,87,69,.25)', padding: '2px 8px', borderRadius: 999 }}>Kritis</span>}
                            {isWarning && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#8a6420', background: 'rgba(201,150,58,.12)', border: '1px solid rgba(201,150,58,.3)', padding: '2px 8px', borderRadius: 999 }}>Menipis</span>}
                          </div>
                        </div>
                        <div style={{ position: 'relative', height: 9, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, transition: 'width .4s', background: isCritical ? '#d65745' : isWarning ? '#c9963a' : '#2f9e63', width: `${pct}%` }} />
                          {p.batas_minimum > 0 && (
                            <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: 'rgba(26,71,49,.4)', left: `${minPct}%` }} />
                          )}
                        </div>
                        {p.batas_minimum > 0 && (
                          <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 6 }}>
                            Minimum: {p.batas_minimum} {p.satuan} ·{' '}
                            <span style={{ color: isCritical ? '#c0392b' : isWarning ? '#8a6420' : '#9aa39c', fontWeight: isCritical || isWarning ? 600 : 400 }}>
                              {isCritical ? `defisit ${p.batas_minimum - p.stok} ${p.satuan}` : `sisa buffer ${p.stok - p.batas_minimum} ${p.satuan}`}
                            </span>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
