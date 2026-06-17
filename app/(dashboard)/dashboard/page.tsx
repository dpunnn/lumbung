'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Beef, Landmark, FileText, Wheat, AlertTriangle, Activity } from 'lucide-react'
import api from '@/lib/api'

type Stats = {
  ternak: { sehat: number; pantau: number; sakit: number; total: number; matiBuilan: number }
  simpanan: number
  pinjaman: { aktif: number; macet: number }
  pakan: { nama: string; stok: number; satuan: string }[]
}

const rupiahShort = (n: number) => {
  if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`
  if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`
  return `Rp ${n}`
}

/* Count-up hook: animasikan dari 0 ke target sekali ketika target berubah dari 0 */
function useCountUp(target: number, run: boolean, duration = 1300) {
  const [value, setValue] = useState(0)
  const startedRef = useRef(false)
  useEffect(() => {
    if (!run || startedRef.current) return
    startedRef.current = true
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const e = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * e))
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [run, target, duration])
  return value
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

function StatCard({
  href, accent, tint, icon: Icon, iconColor, value, label, sub, trend,
}: {
  href: string; accent: string; tint: string; icon: React.ElementType; iconColor: string
  value: React.ReactNode; label: string; sub: string; trend: string
}) {
  return (
    <Link
      href={href}
      style={{ position: 'relative', padding: 20, borderRadius: 18, overflow: 'hidden', display: 'block', textDecoration: 'none', transition: 'transform .2s', ...glass }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint }}>
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#46544b', background: 'rgba(26,71,49,.06)', padding: '4px 9px', borderRadius: 999 }}>{trend}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2c382f', marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#7a857d', marginTop: 3 }}>{sub}</div>
    </Link>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    type TernakRow = { status: string; tanggal_mati?: string | null }
    type SimpananRow = { jumlah: number }
    type PinjamanRow = { status: string }
    type PakanRow = { nama: string; stok: number; satuan: string; batas_minimum: number }

    const [ternak, simpanan, pinjaman, pakan] = await Promise.all([
      api.get<TernakRow[]>('/api/stok/ternak').catch(() => [] as TernakRow[]),
      api.get<SimpananRow[]>('/api/simpanan?status=confirmed').catch(() => [] as SimpananRow[]),
      api.get<PinjamanRow[]>('/api/pinjaman').catch(() => [] as PinjamanRow[]),
      api.get<PakanRow[]>('/api/stok/pakan').catch(() => [] as PakanRow[]),
    ])

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
    const id = setInterval(() => load(), 30_000)
    return () => clearInterval(id)
  }, [load])

  // count-up — dijalankan sekali setelah data pertama masuk
  const ready = !!stats
  const cTernak   = useCountUp(stats?.ternak.total ?? 0, ready)
  const cSimpanan = useCountUp(stats?.simpanan ?? 0, ready)
  const cPinjaman = useCountUp(stats?.pinjaman.aktif ?? 0, ready)

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1a4731', borderTopColor: 'transparent', animation: 'lmbSpin .7s linear infinite' }} />
        <p style={{ fontSize: 12, fontWeight: 500, color: '#46544b' }}>Memuat data...</p>
      </div>
    </div>
  )
  if (!stats) return null

  const mortalitasPct = stats.ternak.total > 0
    ? Math.round((stats.ternak.matiBuilan / stats.ternak.total) * 100) : 0

  const pakanLow = stats.pakan.length

  // Bar chart — distribusi kesehatan ternak nyata (sehat/pantau/sakit) dari data API.
  const chartData = [
    { m: 'Sehat', a: stats.ternak.sehat },
    { m: 'Pantau', a: stats.ternak.pantau },
    { m: 'Sakit', a: stats.ternak.sakit },
  ]
  const maxHealth = Math.max(1, ...chartData.map(d => d.a))

  // Alert panel cards
  const alerts: { icon: React.ElementType; clr: string; bg: string; title: string; sub: string; href: string }[] = []
  if (mortalitasPct >= 10) alerts.push({ icon: AlertTriangle, clr: '#c0392b', bg: 'rgba(214,87,69,.12)', title: 'Mortalitas tinggi terdeteksi', sub: `${stats.ternak.matiBuilan} ternak mati bulan ini (${mortalitasPct}%)`, href: '/ternak' })
  if (stats.pinjaman.macet > 0) alerts.push({ icon: Landmark, clr: '#b5791f', bg: 'rgba(201,150,58,.16)', title: `${stats.pinjaman.macet} pinjaman macet`, sub: 'Tindak lanjuti segera', href: '/simpan-pinjam' })
  if (pakanLow > 0) alerts.push({ icon: Wheat, clr: '#c0392b', bg: 'rgba(214,87,69,.12)', title: `${pakanLow} jenis pakan di bawah minimum`, sub: stats.pakan.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', '), href: '/pakan' })
  if (stats.ternak.sakit > 0) alerts.push({ icon: Beef, clr: '#c0392b', bg: 'rgba(214,87,69,.12)', title: `${stats.ternak.sakit} ternak sakit perlu tindakan`, sub: 'Periksa kartu ternak', href: '/ternak' })

  return (
    <div className="lmb-fade" style={{ maxWidth: 1100, margin: '0 auto', fontFamily: 'var(--font-sans), system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', lineHeight: 1.1 }}>Beranda</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e', marginTop: 4 }}>Ringkasan kondisi koperasi hari ini</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 999, background: 'rgba(47,158,99,.14)', color: '#1d7a4d' }}>
          <Activity size={11} /> Live
        </div>
      </div>

      {/* Stat cards */}
      <div className="lmb-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
        <StatCard href="/ternak" accent="#2f9e63" tint="rgba(47,158,99,.14)" icon={Beef} iconColor="#2f9e63"
          value={cTernak} label="Ternak hidup" sub={`${stats.ternak.pantau} pantau · ${stats.ternak.sakit} sakit`} trend={`${stats.ternak.sehat} sehat`} />
        <StatCard href="/simpan-pinjam" accent="#c9963a" tint="rgba(201,150,58,.16)" icon={Landmark} iconColor="#c9963a"
          value={rupiahShort(cSimpanan)} label="Total simpanan" sub="Semua anggota aktif" trend="Confirmed" />
        <StatCard href="/simpan-pinjam" accent="#5aa9d6" tint="rgba(90,169,214,.16)" icon={FileText} iconColor="#5aa9d6"
          value={cPinjaman} label="Pinjaman aktif" sub={stats.pinjaman.macet > 0 ? `${stats.pinjaman.macet} pinjaman macet` : 'Semua lancar'} trend={stats.pinjaman.macet > 0 ? `${stats.pinjaman.macet} macet` : 'Lancar'} />
        <StatCard href="/pakan" accent={pakanLow > 0 ? '#d65745' : '#2f9e63'} tint={pakanLow > 0 ? 'rgba(214,87,69,.14)' : 'rgba(47,158,99,.14)'} icon={Wheat} iconColor={pakanLow > 0 ? '#d65745' : '#2f9e63'}
          value={pakanLow > 0 ? pakanLow : 'OK'} label="Stok pakan menipis" sub={pakanLow > 0 ? 'item di bawah minimum' : 'Semua stok aman'} trend={pakanLow > 0 ? 'Perlu restok' : 'Aman'} />
      </div>

      <div className="lmb-dash-cols" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Bar chart */}
          <div style={{ padding: 22, borderRadius: 20, ...glass }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f2a1d' }}>Distribusi kesehatan ternak</h3>
                <p style={{ fontSize: 12.5, color: '#7a857d', marginTop: 2 }}>Populasi hidup: {stats.ternak.total} ekor</p>
              </div>
              <Link href="/ternak" style={{ fontSize: 13, fontWeight: 700, color: '#1a4731', textDecoration: 'none' }}>Lihat detail →</Link>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: 168, paddingTop: 8 }}>
              {chartData.map((d, i) => {
                const h = Math.round((d.a / maxHealth) * 100)
                const colors = ['linear-gradient(180deg,#3bb673,#2f9e63)', 'linear-gradient(180deg,#e0b864,#c9963a)', 'linear-gradient(180deg,#e0805f,#d65745)']
                return (
                  <div key={d.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%' }}>
                    <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', borderRadius: '7px 7px 3px 3px', height: `${h}%`, minHeight: 4, background: colors[i], transition: 'height .7s ease', position: 'relative' }}>
                        <span style={{ position: 'absolute', top: -22, left: 0, right: 0, textAlign: 'center', fontSize: 13, fontWeight: 800, color: '#0f2a1d' }}>{d.a}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 11.5, color: '#7a857d', fontWeight: 600 }}>{d.m}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Health bars panel */}
          <div style={{ padding: 22, borderRadius: 20, ...glass }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f2a1d', marginBottom: 16 }}>Rincian populasi</h3>
            {[
              { label: 'Sehat', val: stats.ternak.sehat, bar: 'linear-gradient(90deg,#3bb673,#2f9e63)', clr: '#1d7a4d' },
              { label: 'Perlu pantau', val: stats.ternak.pantau, bar: 'linear-gradient(90deg,#e0b864,#c9963a)', clr: '#b5791f' },
              { label: 'Sakit', val: stats.ternak.sakit, bar: 'linear-gradient(90deg,#e0805f,#d65745)', clr: '#c0392b' },
            ].map(s => {
              const pct = stats.ternak.total > 0 ? Math.round((s.val / stats.ternak.total) * 100) : 0
              return (
                <div key={s.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#46544b', fontWeight: 600 }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: s.clr }}>{s.val} · {pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: 'rgba(26,71,49,.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: s.bar, transition: 'width .7s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Alert panel */}
          <div style={{ padding: 20, borderRadius: 20, ...glass }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f2a1d', marginBottom: 14 }}>Perlu perhatian</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alerts.length === 0 && (
                <div style={{ fontSize: 13, color: '#6a766e', padding: '8px 0' }}>Tidak ada yang perlu ditindaklanjuti. Semua kondisi aman.</div>
              )}
              {alerts.map((a, i) => {
                const Icon = a.icon
                return (
                  <Link key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 13, background: a.bg, textDecoration: 'none', transition: 'transform .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateX(3px)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                  >
                    <span style={{ display: 'flex', color: a.clr }}><Icon size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#2c382f' }}>{a.title}</div>
                      <div style={{ fontSize: 12, color: '#6a766e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sub}</div>
                    </div>
                    <span style={{ color: a.clr, fontWeight: 800 }}>›</span>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Pak Tani tip */}
          <div style={{ position: 'relative', padding: 20, borderRadius: 20, background: 'linear-gradient(160deg,#1a4731,#0c2218)', boxShadow: '0 14px 30px rgba(15,42,29,.28)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-30%', right: '-15%', width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.3),transparent 65%)' }} />
            <div style={{ position: 'relative', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 54, height: 54, borderRadius: '50%', background: 'rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'lmbBob 4s ease-in-out infinite' }}>
                <svg width="46" height="48" viewBox="0 0 220 240"><path d="M62 232 C58 188 70 162 110 162 C150 162 162 188 158 232 Z" fill="#e8bd63" /><circle cx="110" cy="120" r="42" fill="#e8c39a" /><ellipse cx="96" cy="116" rx="5" ry="6.5" fill="#2a201a" /><ellipse cx="124" cy="116" rx="5" ry="6.5" fill="#2a201a" /><path d="M98 138 q12 12 24 0" stroke="#9a6b42" strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M52 96 C70 70 150 70 168 96 C150 102 70 102 52 96 Z" fill="#d9a441" /><path d="M82 96 C84 64 136 64 138 96 Z" fill="#e8bd63" /></svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#e0b864', letterSpacing: '.04em', marginBottom: 5 }}>SAPAAN PAK TANI</div>
                <p style={{ fontSize: 13.5, color: '#dce9e2', lineHeight: 1.55 }}>
                  {pakanLow > 0 || stats.pinjaman.macet > 0
                    ? `Hari ini ada ${pakanLow} stok pakan menipis dan ${stats.pinjaman.macet} pinjaman macet. Mari kita tinjau bersama, Bu!`
                    : 'Kondisi koperasi sehat hari ini. Tetap pantau ternak dan setoran anggota, ya, Bu!'}
                </p>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Link href="/simpan-pinjam" style={{ padding: 16, borderRadius: 15, border: '1px solid rgba(26,71,49,.12)', background: 'rgba(255,255,255,.62)', textDecoration: 'none', transition: 'transform .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f2a1d' }}>Pinjaman baru</div>
              <div style={{ fontSize: 12, color: '#7a857d', marginTop: 2 }}>Ajukan pinjaman</div>
            </Link>
            <Link href="/ternak" style={{ padding: 16, borderRadius: 15, border: '1px solid rgba(26,71,49,.12)', background: 'rgba(255,255,255,.62)', textDecoration: 'none', transition: 'transform .15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f2a1d' }}>Tambah ternak</div>
              <div style={{ fontSize: 12, color: '#7a857d', marginTop: 2 }}>Registrasi ternak</div>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.lmb-stat-grid) { grid-template-columns: 1fr 1fr !important; }
          :global(.lmb-dash-cols) { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          :global(.lmb-stat-grid) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
