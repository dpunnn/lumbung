'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { login } from '@/lib/auth'

const LogoMark = ({ size = 19 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 11 L12 4 L20 11 V20 H4 Z" stroke="#c9963a" strokeWidth="2" strokeLinejoin="round" />
  </svg>
)

/* Mini Pak Tani — port dari design file login panel */
function MiniPakTani() {
  return (
    <svg width="118" height="120" viewBox="0 0 220 240">
      <ellipse cx="110" cy="226" rx="50" ry="8" fill="#000" opacity="0.18" />
      <path d="M62 232 C58 188 70 162 110 162 C150 162 162 188 158 232 Z" fill="#e8bd63" />
      <circle cx="110" cy="120" r="42" fill="#e8c39a" />
      <circle cx="88" cy="132" r="9" fill="#e8a06a" opacity="0.5" />
      <circle cx="132" cy="132" r="9" fill="#e8a06a" opacity="0.5" />
      <ellipse cx="96" cy="116" rx="5" ry="6.5" fill="#2a201a" />
      <ellipse cx="124" cy="116" rx="5" ry="6.5" fill="#2a201a" />
      <path d="M98 138 q12 12 24 0" stroke="#9a6b42" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M52 96 C70 70 150 70 168 96 C150 102 70 102 52 96 Z" fill="#d9a441" />
      <path d="M82 96 C84 64 136 64 138 96 Z" fill="#e8bd63" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      router.push('/dashboard')
    } catch {
      setError('Email atau password salah.')
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 15px',
    borderRadius: 12,
    border: '1px solid rgba(26,71,49,.18)',
    background: 'rgba(255,255,255,.7)',
    fontSize: 14.5,
    color: '#0f2a1d',
    outline: 'none',
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        background: 'radial-gradient(120% 90% at 85% -10%, #e6efe4 0%, #f7f4ec 45%, #f3efe4 100%)',
        display: 'grid',
        gridTemplateColumns: '1.05fr 1fr',
      }}
      className="lmb-login-grid"
    >
      {/* ===== brand panel ===== */}
      <div
        className="lmb-login-brand"
        style={{ position: 'relative', padding: 46, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'linear-gradient(160deg,#1a4731,#0c2218)', overflow: 'hidden' }}
      >
        <div style={{ position: 'absolute', top: '-10%', right: '-12%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.34),transparent 65%)' }} />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LogoMark /></div>
          <span style={{ fontWeight: 800, fontSize: 19, color: '#fff', letterSpacing: '-.02em' }}>LUMBUNG</span>
        </div>

        <div style={{ position: 'relative' }}>
          <div style={{ width: 128, height: 128, marginBottom: 26, borderRadius: '50%', background: 'radial-gradient(circle,rgba(201,150,58,.22),transparent 70%)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'lmbBob 5s ease-in-out infinite' }}>
            <MiniPakTani />
          </div>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1.18, letterSpacing: '-.02em', maxWidth: 380 }}>Selamat datang kembali di lumbung Anda.</h2>
          <p style={{ fontSize: 15.5, color: '#9fc1ad', marginTop: 14, maxWidth: 360, lineHeight: 1.6 }}>Pak Tani sudah menyiapkan ringkasan koperasi hari ini. Masuk untuk melanjutkan.</p>
        </div>

        <div style={{ position: 'relative', display: 'flex', gap: 26 }}>
          <div><div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>38</div><div style={{ fontSize: 12.5, color: '#9fc1ad' }}>koperasi</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>1.240+</div><div style={{ fontSize: 12.5, color: '#9fc1ad' }}>anggota</div></div>
          <div><div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>99,2%</div><div style={{ fontSize: 12.5, color: '#9fc1ad' }}>lancar</div></div>
        </div>
      </div>

      {/* ===== form panel ===== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 380 }}>
          <h3 style={{ fontSize: 26, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em' }}>Masuk ke akun</h3>
          <p style={{ fontSize: 14.5, color: '#6a766e', marginTop: 7, marginBottom: 26 }}>Gunakan akun pengurus koperasi Anda.</p>

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d4b43', marginBottom: 7 }}>Email pengurus</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pengurus@melatijaya.id"
            style={{ ...inputStyle, marginBottom: 16 }}
            onFocus={(e) => { e.target.style.borderColor = '#1a4731'; e.target.style.boxShadow = '0 0 0 3px rgba(26,71,49,.12)' }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(26,71,49,.18)'; e.target.style.boxShadow = 'none' }}
          />

          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#3d4b43', marginBottom: 7 }}>Kata sandi</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{ ...inputStyle, marginBottom: 10 }}
            onFocus={(e) => { e.target.style.borderColor = '#1a4731'; e.target.style.boxShadow = '0 0 0 3px rgba(26,71,49,.12)' }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(26,71,49,.18)'; e.target.style.boxShadow = 'none' }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#46544b', cursor: 'pointer' }}><input type="checkbox" defaultChecked style={{ accentColor: '#1a4731', width: 15, height: 15 }} />Ingat saya</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#1a4731', cursor: 'pointer' }}>Lupa sandi?</span>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '11px 14px', fontSize: 13.5, marginBottom: 16, background: 'rgba(214,87,69,.08)', border: '1px solid rgba(214,87,69,.25)', color: '#b23b2c' }}>
              <span style={{ fontWeight: 800 }}>!</span>{error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', border: 'none', fontWeight: 700, fontSize: 15, color: '#fff', padding: 14, borderRadius: 13, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', boxShadow: '0 12px 26px rgba(26,71,49,.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lmbSpin .7s linear infinite' }} />
                Masuk...
              </>
            ) : 'Masuk ke dashboard'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13.5, color: '#6a766e' }}>
            Belum punya koperasi terdaftar?{' '}
            <Link href="/daftar" style={{ fontWeight: 700, color: '#1a4731', textDecoration: 'none' }}>Daftarkan koperasi</Link>
          </div>
          <Link href="/" style={{ display: 'block', textAlign: 'center', marginTop: 22, fontSize: 13, color: '#8a958c', textDecoration: 'none' }}>← Kembali ke beranda</Link>
        </form>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.lmb-login-grid) { grid-template-columns: 1fr !important; }
          :global(.lmb-login-brand) { display: none !important; }
        }
      `}</style>
    </div>
  )
}
