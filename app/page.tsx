'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Landmark, Package, Leaf, Droplets, ShieldCheck, CreditCard,
  TrendingUp, ShoppingBag, Map, Sparkles, ArrowRight, ChevronDown,
  Wifi, WifiOff, BarChart3, Users, CheckCircle, Zap, Globe,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── auth-aware CTA ──────────────────────────────────────────
function useAuthState() {
  const [state, setState] = useState<'loading' | 'guest' | 'authed'>('loading')
  const [role, setRole] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setState('guest'); return }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      setRole(p?.role ?? '')
      setState('authed')
    })
  }, [])
  return { state, role }
}

function dashboardHref(role: string) {
  if (['pemkab', 'pengawas'].includes(role)) return '/admin'
  return '/dashboard'
}

// ─── data ────────────────────────────────────────────────────
const MODULES = [
  { icon: Landmark,    color: 'bg-blue-50 text-blue-600',    label: 'Simpan Pinjam',  desc: 'Setoran, pinjaman, dan cicilan anggota' },
  { icon: ShieldCheck, color: 'bg-red-50 text-red-600',      label: 'Guard',          desc: 'Deteksi fraud & audit trail real-time' },
  { icon: TrendingUp,  color: 'bg-rose-50 text-rose-600',    label: 'Lens',           desc: 'Analitik mendalam & tren koperasi' },
  { icon: CreditCard,  color: 'bg-amber-50 text-amber-700',  label: 'Lumbung Pass',   desc: 'Paspor data terverifikasi untuk pemodal' },
  { icon: Package,     color: 'bg-purple-50 text-purple-600',label: 'Inventori',      desc: 'Stok barang & cold storage' },
  { icon: Leaf,        color: 'bg-emerald-50 text-emerald-600', label: 'Pakan',       desc: 'Stok pakan ternak dengan alert kritis' },
  { icon: Package,     color: 'bg-green-50 text-green-600',  label: 'Ternak',         desc: 'Registri & monitoring kesehatan ternak' },
  { icon: Droplets,    color: 'bg-sky-50 text-sky-600',      label: 'Utilitas Air',   desc: 'Tagihan & meteran air bersih' },
  { icon: ShoppingBag, color: 'bg-orange-50 text-orange-600',label: 'Pasar',          desc: 'Pengadaan bersama antar koperasi' },
  { icon: Map,         color: 'bg-teal-50 text-teal-600',    label: 'Atlas',          desc: 'Data agregat lintas koperasi' },
  { icon: Sparkles,    color: 'bg-violet-50 text-violet-600',label: 'Insight AI',     desc: 'Verifikasi aset & sinyal risiko' },
  { icon: BarChart3,   color: 'bg-cyan-50 text-cyan-600',    label: 'Dashboard',      desc: 'Ringkasan operasional harian' },
]

const LAYERS = [
  { name: 'Lumbung Core',   color: 'bg-orange-500', desc: 'Multi-tenant terisolasi + commodity adapter. Satu platform untuk semua jenis koperasi — beras, ternak, sayur, air.' },
  { name: 'Lumbung Sync',   color: 'bg-blue-500',   desc: 'Offline-first. Kasir koperasi di pegunungan tanpa sinyal tetap bisa input data. Sync otomatis saat koneksi kembali.' },
  { name: 'Lumbung Pass',   color: 'bg-amber-500',  desc: 'Paspor data terverifikasi. Koperasi berbagi data ke pemodal dengan consent terbatas — tanpa membocorkan data sensitif anggota.' },
  { name: 'Lumbung Lens',   color: 'bg-green-500',  desc: 'Laporan adaptif sesuai literasi. Pengurus yang tidak paham grafik sekalipun bisa memahami kondisi koperasinya.' },
]

const PROBLEMS = [
  { n: '01', title: 'Data Bercampur', body: 'Saat koperasi kedua bergabung ke sistem yang sama, data anggota, simpanan, dan stok saling bercampur. LUMBUNG mengisolasi tiap koperasi di level database.' },
  { n: '02', title: 'Laporan Tak Terbaca', body: 'Format laporan generik tidak cocok untuk pengurus koperasi ternak yang tidak terbiasa dengan spreadsheet. Lens menyesuaikan laporan ke konteks komoditas.' },
  { n: '03', title: 'Data Sharing Buta', body: 'Pemodal minta portofolio — pengurus tidak tahu harus kirim apa. Lumbung Pass memberi token data terbatas yang bisa diaudit kapan saja.' },
  { n: '04', title: 'Tidak Ada Sinyal', body: 'Koperasi Harapan Baru di pegunungan tidak bisa lapor real-time. Dengan offline-first Sync, mereka tetap mencatat dan otomatis sync saat online.' },
]

// ─── component ───────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const { state, role } = useAuthState()

  return (
    <div className="min-h-screen bg-stone-50 font-sans">

      {/* ── Navbar ─────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200/60">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-700 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-black">L</span>
            </div>
            <span className="font-bold text-amber-800 text-lg tracking-tight">LUMBUNG</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-stone-500">
            <a href="#produk" className="hover:text-stone-900 transition-colors">Produk</a>
            <a href="#fitur" className="hover:text-stone-900 transition-colors">Fitur</a>
            <a href="#masalah" className="hover:text-stone-900 transition-colors">Solusi</a>
          </div>
          <Link href="/login" className="text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors">
            Masuk
          </Link>
          <Link href="/daftar" className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
            Daftar
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-900 via-stone-800 to-amber-900" />
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-amber-600/10 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold px-4 py-2 rounded-full">
              <Zap size={12} />
              Program Koperasi Desa Merah Putih · Inpres No. 9 / 2025
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-center text-white font-black leading-[1.05] tracking-tight max-w-4xl mx-auto" style={{ fontSize: 'clamp(44px, 7vw, 88px)' }}>
            Satu Lumbung,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400">
              Banyak Koperasi
            </span>
          </h1>

          <p className="text-center text-stone-400 text-lg md:text-xl mt-6 max-w-2xl mx-auto leading-relaxed">
            Platform digitalisasi koperasi desa Indonesia. Multi-tenant, offline-first, dan terhubung ke sistem pembiayaan formal — untuk 80.000 koperasi yang belum pernah tersentuh teknologi.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 mt-10 flex-wrap">
            {state === 'authed' ? (
              <Link href={dashboardHref(role)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-900/30 flex items-center gap-2 text-base">
                Buka Dashboard <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/daftar"
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 py-3.5 rounded-xl transition-all shadow-lg shadow-amber-900/30 flex items-center gap-2 text-base">
                  Daftar Sekarang <ArrowRight size={16} />
                </Link>
                <Link href="/login"
                  className="text-stone-400 hover:text-white font-medium px-6 py-3.5 rounded-xl border border-stone-700 hover:border-stone-500 transition-all flex items-center gap-2 text-base">
                  Sudah punya akun? Masuk
                </Link>
              </>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mt-16 max-w-2xl mx-auto">
            {[
              { n: '80.000+', l: 'Koperasi Target' },
              { n: 'Rp1,76T', l: 'Aset Koperasi Desa' },
              { n: '12', l: 'Modul Tersedia' },
            ].map(s => (
              <div key={s.l} className="text-center bg-white/5 border border-white/10 rounded-2xl p-4">
                <p className="text-white font-black text-2xl md:text-3xl">{s.n}</p>
                <p className="text-stone-500 text-xs mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem → Solution ─────────────────────────────── */}
      <section id="masalah" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-amber-700 text-sm font-bold uppercase tracking-widest mb-3">Mengapa LUMBUNG</p>
            <h2 className="text-stone-900 font-black text-4xl md:text-5xl tracking-tight">Masalah nyata di lapangan</h2>
            <p className="text-stone-500 text-lg mt-4 max-w-xl mx-auto">Tidak semua data diberikan. Tapi masalahnya sudah jelas sejak hari pertama.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PROBLEMS.map(p => (
              <div key={p.n} className="group flex gap-5 p-6 rounded-2xl border border-stone-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all">
                <span className="text-3xl font-black text-stone-200 group-hover:text-amber-200 transition-colors shrink-0 leading-none mt-1">{p.n}</span>
                <div>
                  <h3 className="text-stone-900 font-bold text-lg mb-2">{p.title}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Layers ─────────────────────────────────── */}
      <section id="produk" className="py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-amber-700 text-sm font-bold uppercase tracking-widest mb-3">Arsitektur Produk</p>
            <h2 className="text-stone-900 font-black text-4xl md:text-5xl tracking-tight">Empat lapisan,<br />satu ekosistem</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {LAYERS.map((l, i) => (
              <div key={l.name}
                className="group relative bg-white border border-stone-200 rounded-2xl p-7 hover:shadow-lg transition-all overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${l.color}`} />
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg ${l.color} flex items-center justify-center text-white text-xs font-black shrink-0 mt-0.5`}>
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-stone-900 font-bold text-lg">{l.name}</h3>
                      {l.name === 'Lumbung Pass' && (
                        <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide">Hero</span>
                      )}
                    </div>
                    <p className="text-stone-500 text-sm leading-relaxed">{l.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Modules Grid ───────────────────────────────────── */}
      <section id="fitur" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <p className="text-amber-700 text-sm font-bold uppercase tracking-widest mb-3">Modul</p>
            <h2 className="text-stone-900 font-black text-4xl md:text-5xl tracking-tight">Semua yang dibutuhkan<br />koperasi desa</h2>
            <p className="text-stone-500 text-lg mt-4 max-w-xl mx-auto">Aktifkan hanya modul yang relevan dengan komoditas dan kebutuhan koperasi Anda.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MODULES.map(m => {
              const Icon = m.icon
              return (
                <div key={m.label}
                  className="group p-5 rounded-2xl border border-stone-200 hover:border-amber-300 hover:shadow-md transition-all bg-white hover:-translate-y-0.5">
                  <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <Icon size={18} />
                  </div>
                  <p className="text-stone-900 font-semibold text-sm">{m.label}</p>
                  <p className="text-stone-400 text-xs mt-1 leading-relaxed">{m.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Highlight: Guard + Pass ─────────────────────────── */}
      <section className="py-24 bg-stone-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Guard */}
            <div className="bg-stone-800 border border-stone-700 rounded-2xl p-8">
              <div className="w-10 h-10 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center mb-5">
                <ShieldCheck size={18} className="text-red-400" />
              </div>
              <h3 className="text-white font-bold text-2xl mb-3">Guard — Deteksi Fraud Real-Time</h3>
              <p className="text-stone-400 text-sm leading-relaxed mb-6">
                Sistem mendeteksi pola anomali kasir secara otomatis — dari pembatalan transaksi di luar jam kerja hingga perubahan nominal setelah konfirmasi. AI menganalisis dan memberi rekomendasi investigasi.
              </p>
              <div className="space-y-2">
                {['Deteksi pembatalan luar jam kerja', 'Sengketa & klaim setoran anggota', 'Penghapusan data finansial', 'Perubahan nominal mencurigakan'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-stone-400">
                    <CheckCircle size={13} className="text-red-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Pass */}
            <div className="bg-gradient-to-br from-amber-900/50 to-stone-800 border border-amber-700/30 rounded-2xl p-8">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-5">
                <CreditCard size={18} className="text-amber-400" />
              </div>
              <h3 className="text-white font-bold text-2xl mb-3">Lumbung Pass — Paspor Data</h3>
              <p className="text-stone-400 text-sm leading-relaxed mb-6">
                Koperasi bisa berbagi data portofolio ke pemodal dengan token akses terbatas. Hanya data yang diizinkan pengurus yang bisa dilihat, dan setiap akses tercatat di audit log.
              </p>
              <div className="space-y-2">
                {['Consent-scoped: pemodal hanya lihat yang diizinkan', 'Setiap akses tercatat otomatis', 'Credit history lintas koperasi', 'Verifikasi agunan ternak visual (AI)'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm text-stone-400">
                    <CheckCircle size={13} className="text-amber-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Offline badge */}
          <div className="mt-6 bg-stone-800 border border-stone-700 rounded-2xl p-6 flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <WifiOff size={18} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-bold">Offline-First</p>
                <p className="text-stone-400 text-sm">Bekerja tanpa sinyal</p>
              </div>
            </div>
            <div className="text-stone-600 hidden md:block">→</div>
            <p className="text-stone-400 text-sm flex-1 min-w-0">
              Koperasi di pelosok yang tidak memiliki sinyal internet tetap bisa mencatat transaksi. Data tersimpan lokal dan otomatis sync ke server saat koneksi tersedia kembali.
            </p>
            <div className="flex items-center gap-2">
              <Wifi size={14} className="text-green-400" />
              <span className="text-green-400 text-xs font-semibold">Auto-sync saat online</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Program Context ─────────────────────────────────── */}
      <section className="py-20 bg-white border-y border-stone-100">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1">
            <p className="text-amber-700 text-sm font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              <Globe size={14} /> Konteks Kebijakan
            </p>
            <h2 className="text-stone-900 font-black text-3xl md:text-4xl tracking-tight leading-tight mb-4">
              Didukung oleh<br />Inpres No. 9 Tahun 2025
            </h2>
            <p className="text-stone-500 leading-relaxed">
              Program Koperasi Desa Merah Putih menargetkan pembentukan 80.000 koperasi desa baru di seluruh Indonesia. LUMBUNG dibangun untuk menjadi infrastruktur digital yang siap melayani skala nasional tersebut.
            </p>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            {[
              { icon: Users,    v: '80.000+', l: 'Koperasi Target Nasional' },
              { icon: Globe,    v: '514',     l: 'Kabupaten/Kota di Indonesia' },
              { icon: BarChart3,v: 'Rp1,76T', l: 'Potensi Aset Koperasi Desa' },
              { icon: Zap,      v: '2025',    l: 'Tahun Implementasi Inpres' },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.l} className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <Icon size={18} className="text-amber-700 mb-3" />
                  <p className="text-stone-900 font-black text-2xl">{s.v}</p>
                  <p className="text-stone-400 text-xs mt-1">{s.l}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="py-24 bg-gradient-to-br from-amber-900 via-amber-800 to-stone-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-white font-black text-4xl md:text-5xl tracking-tight mb-5">
            Mulai digitalisasi<br />koperasi Anda hari ini
          </h2>
          <p className="text-amber-200/70 text-lg mb-10">
            Data sudah bisa masuk. Sistem sudah siap. Tidak perlu keahlian teknis untuk memulai.
          </p>
          {state === 'authed' ? (
            <Link href={dashboardHref(role)}
              className="inline-flex items-center gap-2 bg-white text-amber-900 font-bold px-10 py-4 rounded-xl text-base hover:bg-amber-50 transition-colors shadow-xl">
              Buka Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <div className="flex items-center gap-4 justify-center flex-wrap">
              <Link href="/daftar"
                className="inline-flex items-center gap-2 bg-white text-amber-900 font-bold px-10 py-4 rounded-xl text-base hover:bg-amber-50 transition-colors shadow-xl">
                Daftar Sekarang <ArrowRight size={16} />
              </Link>
              <Link href="/login"
                className="inline-flex items-center gap-2 text-amber-200 hover:text-white font-medium px-6 py-4 rounded-xl border border-amber-700/40 hover:border-amber-500 transition-colors text-base">
                Sudah punya akun? Masuk
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="bg-stone-900 py-10 border-t border-stone-800">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-amber-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-black">L</span>
            </div>
            <span className="text-white font-bold">LUMBUNG</span>
            <span className="text-stone-600 text-sm">Platform Koperasi Digital Indonesia</span>
          </div>
          <div className="flex items-center gap-6 text-stone-500 text-sm">
            <Link href="/login" className="hover:text-stone-300 transition-colors">Masuk</Link>
            <a href="https://github.com/dpunnn/lumbung" className="hover:text-stone-300 transition-colors">GitHub</a>
            <span>TechnoScape Hackathon 9.0 · 2026</span>
          </div>
        </div>
      </footer>

    </div>
  )
}
