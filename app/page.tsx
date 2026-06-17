'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMe } from '@/lib/auth'

/* ---------- shared bits ---------- */

function useAuthState() {
  const [state, setState] = useState<'loading' | 'guest' | 'authed'>('loading')
  const [role, setRole] = useState('')
  useEffect(() => {
    getMe().then((me) => {
      if (!me) { setState('guest'); return }
      setRole(me.role ?? '')
      setState('authed')
    })
  }, [])
  return { state, role }
}

function dashboardHref(role: string) {
  if (['pemkab', 'pengawas'].includes(role)) return '/admin'
  return '/dashboard'
}

/* Pak Tani mascot — SVG inline persis dari design file */
function PakTani() {
  return (
    <svg width="220" height="240" viewBox="0 0 220 240" fill="none">
      {/* shadow */}
      <ellipse cx="110" cy="226" rx="62" ry="10" fill="#1a4731" opacity="0.14" />
      {/* body / shirt */}
      <path d="M62 232 C58 188 70 162 110 162 C150 162 162 188 158 232 Z" fill="#1a4731" />
      <path d="M110 162 C92 162 80 170 74 184 L110 196 L146 184 C140 170 128 162 110 162 Z" fill="#21603f" />
      {/* collar */}
      <path d="M94 165 L110 182 L126 165" stroke="#0f2a1d" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* arms */}
      <g style={{ transformOrigin: '70px 188px', animation: 'lmbSway 3.8s ease-in-out infinite' }}>
        <rect x="44" y="184" width="26" height="15" rx="7.5" fill="#21603f" />
        <circle cx="46" cy="191" r="9" fill="#e8c39a" />
      </g>
      <rect x="150" y="186" width="24" height="14" rx="7" fill="#21603f" />
      <circle cx="172" cy="193" r="8.5" fill="#e8c39a" />
      {/* neck */}
      <rect x="100" y="150" width="20" height="20" rx="8" fill="#dcb389" />
      {/* head */}
      <circle cx="110" cy="120" r="42" fill="#e8c39a" />
      {/* ears */}
      <circle cx="69" cy="122" r="8" fill="#dcae84" />
      <circle cx="151" cy="122" r="8" fill="#dcae84" />
      {/* cheeks */}
      <circle cx="88" cy="132" r="9" fill="#e8a06a" opacity="0.5" />
      <circle cx="132" cy="132" r="9" fill="#e8a06a" opacity="0.5" />
      {/* eyes (blink) */}
      <g style={{ transformOrigin: '110px 116px', animation: 'lmbBlink 5s ease-in-out infinite' }}>
        <ellipse cx="96" cy="116" rx="5" ry="6.5" fill="#2a201a" />
        <ellipse cx="124" cy="116" rx="5" ry="6.5" fill="#2a201a" />
        <circle cx="97.6" cy="113.5" r="1.7" fill="#fff" />
        <circle cx="125.6" cy="113.5" r="1.7" fill="#fff" />
      </g>
      {/* brows */}
      <path d="M88 104 q8 -4 16 0" stroke="#7a5a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M116 104 q8 -4 16 0" stroke="#7a5a3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* smile */}
      <path d="M98 138 q12 12 24 0" stroke="#9a6b42" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      {/* caping (straw hat) */}
      <path d="M52 96 C70 70 150 70 168 96 C150 102 70 102 52 96 Z" fill="#d9a441" />
      <path d="M82 96 C84 64 136 64 138 96 Z" fill="#e8bd63" />
      <path d="M82 96 C84 64 136 64 138 96 Z" fill="url(#strawg)" opacity="0.5" />
      <ellipse cx="110" cy="96" rx="58" ry="7" fill="#c98e34" opacity="0.55" />
      <path d="M68 90 L152 90" stroke="#c98e34" strokeWidth="1.5" opacity="0.6" />
      <circle cx="110" cy="69" r="4" fill="#1a4731" />
      <defs>
        <linearGradient id="strawg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
}

const LogoMark = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke="#c9963a" strokeWidth="2" strokeLinejoin="round" />
    <path d="M8 20 V14 H16 V20" stroke="#e0b864" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

/* Modul icons (sederhana, port dari design) */
function Ic({ name, color }: { name: string; color: string }) {
  const p: Record<string, string> = {
    home: 'M4 11 L12 4 L20 11 V20 H4 Z|M9 20 V14 H15 V20',
    wallet: 'M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 7l2-3h11l1 3M16 13h2',
    cow: 'M5 8c-2 0-3 2-2 4M19 8c2 0 3 2 2 4M6 9c0 5 3 8 6 8s6-3 6-8c0-2-1-3-2-3H8c-1 0-2 1-2 3zM10 13h.01M14 13h.01M10 16h4',
    wheat: 'M12 3v18M12 7c-3-2-5 0-5 0 2 2 5 1 5 1M12 7c3-2 5 0 5 0-2 2-5 1-5 1M12 12c-3-2-5 0-5 0 2 2 5 1 5 1M12 12c3-2 5 0 5 0-2 2-5 1-5 1',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
    shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  }
  const d = (p[name] || '').split('|')
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      {d.map((dd, i) => (
        <path key={i} d={dd} stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

const TINT = {
  g: 'rgba(47,158,99,.14)', gold: 'rgba(201,150,58,.16)',
  blue: 'rgba(90,169,214,.16)', red: 'rgba(214,87,69,.14)',
}
const ACC = { g: '#2f9e63', gold: '#c9963a', blue: '#5aa9d6', red: '#d65745' }

const MODULES = [
  { id: 'home', icon: 'home', title: 'Beranda', desc: 'Ringkasan ternak, kas, simpanan & alert dalam satu layar.', col: 'g' },
  { id: 'wallet', icon: 'wallet', title: 'Simpan Pinjam', desc: 'Kelola simpanan, pengajuan, setoran & angsuran anggota.', col: 'gold' },
  { id: 'cow', icon: 'cow', title: 'Ternak', desc: 'Kartu ternak sapi & kambing lengkap dengan status kesehatan.', col: 'g' },
  { id: 'wheat', icon: 'wheat', title: 'Stok / Pakan', desc: 'Inventori pakan dengan alert otomatis saat stok menipis.', col: 'gold' },
  { id: 'qr', icon: 'qr', title: 'Pass', desc: 'Kartu anggota digital berbasis QR untuk verifikasi cepat.', col: 'blue' },
  { id: 'shield', icon: 'shield', title: 'Guard', desc: 'Deteksi anomali & fraud bertenaga AI plus log audit.', col: 'red' },
  { id: 'chart', icon: 'chart', title: 'Lens', desc: 'Laporan & analitik adaptif siap kirim ke dinas.', col: 'blue' },
  { id: 'map', icon: 'map', title: 'Atlas', desc: 'Peta sebaran koperasi untuk pengawasan tingkat kabupaten.', col: 'g' },
] as const

const PROOF = [
  { value: '38', label: 'Koperasi desa aktif' },
  { value: '1.240+', label: 'Anggota terdaftar' },
  { value: 'Rp 8,4 M', label: 'Total simpanan dikelola' },
  { value: '99,2%', label: 'Angsuran lancar' },
]

/* ---------- page ---------- */

export default function LandingPage() {
  const router = useRouter()
  const { state, role } = useAuthState()

  const goLogin = () => router.push('/login')
  const goApp = () => router.push(state === 'authed' ? dashboardHref(role) : '/login')

  const glass = (blur = 18, alpha = 0.55): React.CSSProperties => ({
    background: `rgba(255,255,255,${alpha})`,
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    border: '1px solid rgba(255,255,255,.7)',
  })

  return (
    <div
      className="lmb-scroll"
      style={{
        minHeight: '100vh',
        fontFamily: "var(--font-sans), system-ui, sans-serif",
        color: '#16241c',
        position: 'relative',
        overflowX: 'hidden',
        background: 'radial-gradient(120% 90% at 85% -10%, #e6efe4 0%, #f7f4ec 45%, #f3efe4 100%)',
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      {/* ambient blobs */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-12%', right: '-6%', width: '46vw', height: '46vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(26,71,49,.22),transparent 65%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', bottom: '-18%', left: '-8%', width: '42vw', height: '42vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.20),transparent 65%)', filter: 'blur(18px)' }} />
        <div style={{ position: 'absolute', top: '38%', left: '42%', width: '30vw', height: '30vw', borderRadius: '50%', background: 'radial-gradient(circle,rgba(47,158,99,.12),transparent 65%)', filter: 'blur(20px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 2 }}>

        {/* ===== NAV ===== */}
        <nav style={{ position: 'sticky', top: 0, zIndex: 30, padding: '14px 0' }}>
          <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '12px 16px 12px 22px', borderRadius: 18, boxShadow: '0 10px 34px rgba(26,71,49,.10)', ...glass(18, 0.55) }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(26,71,49,.35)' }}>
                  <LogoMark />
                </div>
                <span style={{ fontWeight: 800, fontSize: 19, letterSpacing: '-.02em', color: '#10241a' }}>LUMBUNG</span>
              </div>
              <div className="hidden md:flex" style={{ alignItems: 'center', gap: 30, fontSize: 14.5, fontWeight: 600, color: '#3d4b43' }}>
                <a href="#fitur" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>Modul</a>
                <a href="#stats" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>Harga</a>
                <a href="#cerita" style={{ cursor: 'pointer', color: 'inherit', textDecoration: 'none' }}>Cerita Desa</a>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={goLogin} style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 14.5, color: '#1a4731', padding: '11px 16px', borderRadius: 12, cursor: 'pointer' }}>Masuk</button>
                <button onClick={goApp} style={{ border: 'none', fontWeight: 700, fontSize: 14.5, color: '#fff', padding: '11px 20px', borderRadius: 12, cursor: 'pointer', background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', boxShadow: '0 8px 20px rgba(26,71,49,.32)' }}>
                  {state === 'authed' ? 'Buka Dashboard' : 'Coba Demo'}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* ===== HERO ===== */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '46px 28px 30px' }}>
          <div className="lmb-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1.05fr .95fr', gap: 46, alignItems: 'center' }}>
            <div className="lmb-fade">
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 999, background: 'rgba(201,150,58,.14)', border: '1px solid rgba(201,150,58,.35)', fontSize: 12.5, fontWeight: 700, color: '#8a6420', marginBottom: 22 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2f9e63', boxShadow: '0 0 0 3px rgba(47,158,99,.25)' }} />
                Platform koperasi desa multi-tenant
              </div>
              <h1 style={{ fontSize: 50, lineHeight: 1.13, letterSpacing: '-.03em', fontWeight: 800, color: '#0f2a1d', marginBottom: 22 }}>
                Koperasi desa Anda,<br />kini <span style={{ fontFamily: 'var(--font-serif), serif', fontStyle: 'italic', fontWeight: 400, color: '#c9963a', letterSpacing: 0 }}>berdaya digital</span>.
              </h1>
              <p style={{ fontSize: 17.5, lineHeight: 1.6, color: '#46544b', maxWidth: 480, marginBottom: 30 }}>
                Satu lumbung untuk simpan pinjam, ternak, stok pakan, hingga laporan dinas. Dirancang untuk pengurus desa — bukan ahli komputer.
              </p>
              <div style={{ display: 'flex', gap: 13, flexWrap: 'wrap', marginBottom: 34 }}>
                <button onClick={goApp} style={{ border: 'none', fontWeight: 700, fontSize: 15.5, color: '#fff', padding: '15px 26px', borderRadius: 14, cursor: 'pointer', background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', boxShadow: '0 12px 28px rgba(26,71,49,.34)', display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                  {state === 'authed' ? 'Buka dashboard' : 'Mulai gratis'}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#c9963a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button onClick={goLogin} style={{ fontWeight: 700, fontSize: 15.5, color: '#1a4731', padding: '15px 24px', borderRadius: 14, cursor: 'pointer', background: 'rgba(255,255,255,.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(26,71,49,.16)' }}>Lihat demo langsung</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#2f9e63,#1a4731)', border: '2px solid #f7f4ec', display: 'inline-block' }} />
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#c9963a,#8a6420)', border: '2px solid #f7f4ec', display: 'inline-block', marginLeft: -11 }} />
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#5aa9d6,#2c6f95)', border: '2px solid #f7f4ec', display: 'inline-block', marginLeft: -11 }} />
                  <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#0f2a1d', border: '2px solid #f7f4ec', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: -11, fontSize: 11, fontWeight: 700, color: '#c9963a' }}>+35</span>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.4, color: '#46544b' }}><strong style={{ color: '#0f2a1d' }}>1.240+ anggota</strong> di 38 koperasi desa<br />mempercayakan datanya pada Lumbung</div>
              </div>
            </div>

            {/* mascot scene */}
            <div className="lmb-fade" style={{ position: 'relative' }}>
              <div style={{ position: 'relative', borderRadius: 30, padding: 34, boxShadow: '0 26px 60px rgba(26,71,49,.18)', overflow: 'hidden', ...glass(22, 0.5) }}>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 70% at 50% 90%, rgba(47,158,99,.18), transparent 70%)' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 90, background: 'linear-gradient(180deg,rgba(201,150,58,.14),transparent)' }} />

                <div style={{ position: 'relative', height: 330, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ position: 'absolute', width: 210, height: 210, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.25),transparent 65%)' }} />
                  <div style={{ position: 'absolute', width: 170, height: 170, borderRadius: '50%', border: '2px solid rgba(201,150,58,.5)', animation: 'lmbRing 3.4s ease-out infinite' }} />

                  {/* MASCOT */}
                  <div style={{ position: 'relative', animation: 'lmbBob 4.6s ease-in-out infinite', transformOrigin: '50% 90%' }}>
                    <PakTani />
                    <div style={{ position: 'absolute', right: 18, top: 150, animation: 'lmbSway 3.8s ease-in-out infinite', transformOrigin: 'bottom center' }}>
                      <svg width="34" height="54" viewBox="0 0 34 54" fill="none"><path d="M17 54 V20" stroke="#2f9e63" strokeWidth="3" strokeLinecap="round" /><path d="M17 30 C6 28 4 18 4 18 C16 16 17 26 17 30Z" fill="#3bb673" /><path d="M17 24 C28 22 30 12 30 12 C18 10 17 20 17 24Z" fill="#2f9e63" /></svg>
                    </div>
                  </div>

                  {/* floating chips */}
                  <div style={{ position: 'absolute', top: 14, left: -6, animation: 'lmbFloat 5.2s ease-in-out infinite' }}>
                    <div style={{ padding: '10px 13px', borderRadius: 14, background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 10px 24px rgba(26,71,49,.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(47,158,99,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 18l5-5 4 4 7-8" stroke="#2f9e63" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <div><div style={{ fontSize: 11, color: '#6a766e', fontWeight: 600 }}>Simpanan bulan ini</div><div style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d' }}>+12,4%</div></div>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', bottom: 18, right: -10, animation: 'lmbFloat2 4.4s ease-in-out infinite' }}>
                    <div style={{ padding: '10px 13px', borderRadius: 14, background: 'rgba(255,255,255,.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 10px 24px rgba(26,71,49,.16)', display: 'flex', alignItems: 'center', gap: 9 }}>
                      <span style={{ width: 30, height: 30, borderRadius: 9, background: 'rgba(201,150,58,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2 6 4-14 2 8h6" stroke="#c9963a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <div><div style={{ fontSize: 11, color: '#6a766e', fontWeight: 600 }}>Ternak sehat</div><div style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d' }}>248 ekor</div></div>
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', textAlign: 'center', marginTop: 6 }}>
                  <div style={{ fontFamily: 'var(--font-serif), serif', fontStyle: 'italic', fontSize: 20, color: '#1a4731' }}>&ldquo;Halo, saya Pak Tani —</div>
                  <div style={{ fontSize: 13.5, color: '#46544b', marginTop: 2 }}>pemandu digital koperasi desa Anda.&rdquo;</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== TRUST STRIP ===== */}
        <section id="cerita" style={{ maxWidth: 1180, margin: '0 auto', padding: '14px 28px 8px' }}>
          <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8a958c', marginBottom: 18 }}>Mendukung program penguatan ekonomi desa</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 42, flexWrap: 'wrap', opacity: .62, fontWeight: 800, fontSize: 16, color: '#46544b', letterSpacing: '-.01em' }}>
            <span>Dinas Koperasi</span><span>BUMDes Bersama</span><span>Gapoktan</span><span>Kementerian Desa</span><span>Bank Wakaf Mikro</span>
          </div>
        </section>

        {/* ===== FEATURES ===== */}
        <section id="fitur" style={{ maxWidth: 1180, margin: '0 auto', padding: '56px 28px 30px' }}>
          <div style={{ textAlign: 'center', maxWidth: 620, margin: '0 auto 38px' }}>
            <h2 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-.025em', color: '#0f2a1d', lineHeight: 1.1 }}>Sepuluh modul, <span style={{ fontFamily: 'var(--font-serif), serif', fontStyle: 'italic', fontWeight: 400, color: '#c9963a' }}>satu lumbung</span></h2>
            <p style={{ fontSize: 16.5, color: '#46544b', marginTop: 12, lineHeight: 1.55 }}>Dari kas simpan pinjam sampai peta sebaran untuk dinas — semua terhubung dalam satu platform.</p>
          </div>
          <div className="lmb-features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
            {MODULES.map((m) => (
              <div
                key={m.title}
                onClick={goApp}
                style={{ position: 'relative', padding: 24, borderRadius: 20, boxShadow: '0 10px 30px rgba(26,71,49,.08)', cursor: 'pointer', transition: 'transform .25s,box-shadow .25s', overflow: 'hidden', ...glass(16, 0.55) }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 40px rgba(26,71,49,.16)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 10px 30px rgba(26,71,49,.08)' }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ACC[m.col] }} />
                <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 15, background: TINT[m.col] }}>
                  <Ic name={m.icon} color={ACC[m.col]} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f2a1d', marginBottom: 6, letterSpacing: '-.01em' }}>{m.title}</h3>
                <p style={{ fontSize: 13.8, color: '#525f57', lineHeight: 1.5 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== STATS BAND ===== */}
        <section id="stats" style={{ maxWidth: 1180, margin: '0 auto', padding: '34px 28px' }}>
          <div style={{ borderRadius: 28, padding: '42px 40px', background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', boxShadow: '0 26px 60px rgba(15,42,29,.32)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-40%', right: '-6%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.3),transparent 65%)' }} />
            <div className="lmb-stats-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 24 }}>
              {PROOF.map((p) => (
                <div key={p.label}>
                  <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-.03em', color: '#fff', lineHeight: 1 }}>{p.value}</div>
                  <div style={{ fontSize: 13.5, color: '#9fc1ad', marginTop: 8, fontWeight: 600 }}>{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section style={{ maxWidth: 1180, margin: '0 auto', padding: '42px 28px 20px' }}>
          <div style={{ textAlign: 'center', borderRadius: 28, padding: '54px 30px', boxShadow: '0 16px 44px rgba(26,71,49,.1)', ...glass(18, 0.55) }}>
            <h2 style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-.025em', color: '#0f2a1d', marginBottom: 12 }}>Siap memajukan koperasi desa Anda?</h2>
            <p style={{ fontSize: 16.5, color: '#46544b', maxWidth: 480, margin: '0 auto 26px' }}>Pak Tani sudah menunggu. Coba demo lengkap tanpa perlu daftar.</p>
            <button onClick={goApp} style={{ border: 'none', fontWeight: 700, fontSize: 16, color: '#fff', padding: '16px 30px', borderRadius: 14, cursor: 'pointer', background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', boxShadow: '0 14px 30px rgba(26,71,49,.36)' }}>
              {state === 'authed' ? 'Buka dashboard' : 'Masuk ke dashboard demo'}
            </button>
          </div>
        </section>

        {/* ===== FOOTER ===== */}
        <footer style={{ maxWidth: 1180, margin: '20px auto 0', padding: '34px 28px 46px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', borderTop: '1px solid rgba(26,71,49,.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogoMark size={16} /></div>
            <span style={{ fontWeight: 800, color: '#10241a' }}>LUMBUNG</span>
            <span style={{ fontSize: 13, color: '#8a958c' }}>© 2026 — Dari desa, untuk desa.</span>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 13.5, fontWeight: 600, color: '#525f57' }}>
            <span style={{ cursor: 'pointer' }}>Privasi</span><span style={{ cursor: 'pointer' }}>Syarat</span><span style={{ cursor: 'pointer' }}>Bantuan</span>
          </div>
        </footer>
      </div>

      {/* responsive helpers */}
      <style jsx>{`
        @media (max-width: 860px) {
          :global(.lmb-hero-grid) { grid-template-columns: 1fr !important; }
          :global(.lmb-features-grid) { grid-template-columns: 1fr 1fr !important; }
          :global(.lmb-stats-grid) { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          :global(.lmb-features-grid) { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
