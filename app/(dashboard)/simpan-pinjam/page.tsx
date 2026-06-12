'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pinjaman, Angsuran, Anggota } from '@/types'
import { AlertTriangle, CheckCircle, Plus } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  diajukan: 'bg-amber-50 text-amber-700 border border-amber-200',
  aktif:    'bg-blue-50 text-blue-700 border border-blue-200',
  lunas:    'bg-green-50 text-green-700 border border-green-200',
  macet:    'bg-red-50 text-red-600 border border-red-200',
  ditolak:  'bg-stone-100 text-stone-600 border border-stone-200',
}

type PinjamanWithMeta = Pinjaman & {
  angsuran: Angsuran[]
  anggota: { nama: string } | null
}

type RiskProfile = {
  user_linked: boolean
  macet: number
  aktif: number
  total: number
  cross_koperasi: boolean
}

function RiskBadge({ r }: { r: RiskProfile | null }) {
  if (!r) return null
  if (r.macet > 0) return (
    <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-xl p-4 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-red-600 font-bold text-sm">Peringatan Risiko Tinggi</span>
        {r.cross_koperasi && (
          <span className="bg-red-50 text-red-600 text-xs px-2 py-0.5 rounded-full border border-red-200">Lintas Koperasi</span>
        )}
      </div>
      <p className="text-red-600 text-sm">
        Anggota ini memiliki <strong>{r.macet} pinjaman macet</strong> dari {r.total} total pinjaman
        {r.cross_koperasi ? ' di semua koperasi platform.' : ' di koperasi ini.'}
      </p>
      <p className="text-red-600 text-xs">Pertimbangkan untuk menolak atau meminta jaminan tambahan.</p>
    </div>
  )
  if (r.aktif > 0) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-amber-700 text-sm">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>Memiliki {r.aktif} pinjaman aktif{r.cross_koperasi ? ' di platform' : ''}. Pastikan kapasitas cicilan mencukupi.</span>
    </div>
  )
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
      <CheckCircle className="w-4 h-4 shrink-0" />
      <span>
        Rekam jejak bersih{r.cross_koperasi ? ' (dicek lintas koperasi)' : ''}.
        {r.total > 0 ? ` ${r.total} pinjaman, semua lunas.` : ' Peminjam pertama kali.'}
      </span>
    </div>
  )
}

function PengajuanCard({
  p, onApprove, onReject, saving,
}: {
  p: PinjamanWithMeta
  onApprove: (p: PinjamanWithMeta) => void
  onReject: (p: PinjamanWithMeta) => void
  saving: boolean
}) {
  const [localRisk, setLocalRisk] = useState<RiskProfile | null>(null)
  const [checking, setChecking] = useState(false)
  const [checked, setChecked] = useState(false)

  async function doCheck() {
    setChecking(true)
    const { data } = await supabase.rpc('fn_anggota_risk_cross', { p_anggota_id: p.anggota_id })
    setLocalRisk(data as RiskProfile)
    setChecked(true)
    setChecking(false)
  }

  return (
    <div className="bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl shadow-sm overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-stone-900 font-semibold text-lg">{p.anggota?.nama ?? '--'}</p>
            <p className="text-stone-600 text-sm">
              Rp {p.jumlah_pokok.toLocaleString('id-ID')} &middot; {p.tenor_bulan} bulan &middot; Rp {p.angsuran_per_bulan.toLocaleString('id-ID')}/bln
            </p>
            <p className="text-stone-400 text-xs mt-1">
              Diajukan: {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-1 rounded-full shrink-0">
            Menunggu Review
          </span>
        </div>

        {!checked ? (
          <button onClick={doCheck} disabled={checking}
            className="w-full border border-stone-300 hover:border-stone-400 text-stone-600 hover:text-stone-900 text-sm py-2 rounded-lg transition-colors mb-3">
            {checking ? 'Mengecek riwayat lintas koperasi...' : 'Cek Riwayat Pinjaman (Lintas Koperasi)'}
          </button>
        ) : (
          <div className="mb-3">
            <RiskBadge r={localRisk} />
          </div>
        )}

        <div className="flex gap-2 mt-3">
          <button onClick={() => onApprove(p)} disabled={saving}
            className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors">
            Setujui & Aktifkan
          </button>
          <button onClick={() => onReject(p)} disabled={saving}
            className="flex-1 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold py-2.5 rounded-lg transition-colors">
            Tolak
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SimpanPinjamPage() {
  const [tab, setTab] = useState<'pinjaman' | 'pengajuan' | 'baru' | 'anggota'>('pinjaman')
  const [data, setData] = useState<PinjamanWithMeta[]>([])
  const [pengajuan, setPengajuan] = useState<PinjamanWithMeta[]>([])
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([])
  const [selected, setSelected] = useState<PinjamanWithMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [risk, setRisk] = useState<RiskProfile | null>(null)
  const [riskLoading, setRiskLoading] = useState(false)
  const [formP, setFormP] = useState({
    anggota_id: '', jumlah_pokok: '', tenor_bulan: '12',
    tanggal_mulai: new Date().toISOString().split('T')[0],
  })
  const [formA, setFormA] = useState({ nama: '', no_hp: '', nama_penjamin: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: semua }, { data: ag }] = await Promise.all([
      supabase.from('pinjaman').select('*, anggota(nama), angsuran(*)').order('created_at', { ascending: false }),
      supabase.from('anggota').select('*').order('nama'),
    ])
    const rows = (semua as PinjamanWithMeta[]) ?? []
    setData(rows.filter(r => r.status !== 'diajukan'))
    setPengajuan(rows.filter(r => r.status === 'diajukan'))
    setAnggotaList(ag ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function checkRisk(anggotaId: string) {
    if (!anggotaId) { setRisk(null); return }
    setRiskLoading(true)
    const { data } = await supabase.rpc('fn_anggota_risk_cross', { p_anggota_id: anggotaId })
    setRisk(data as RiskProfile)
    setRiskLoading(false)
  }

  function setP(k: string, v: string) {
    setFormP(f => ({ ...f, [k]: v }))
    if (k === 'anggota_id') checkRisk(v)
  }

  async function handleBuatPinjaman(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()
    const pokok = parseInt(formP.jumlah_pokok)
    const tenor = parseInt(formP.tenor_bulan)

    const { data: pinjaman } = await supabase.from('pinjaman').insert({
      koperasi_id: profile!.koperasi_id,
      anggota_id: formP.anggota_id,
      jumlah_pokok: pokok,
      tenor_bulan: tenor,
      tanggal_mulai: formP.tanggal_mulai,
      angsuran_per_bulan: Math.ceil(pokok / tenor),
      status: 'aktif',
    }).select().single()

    if (pinjaman) {
      await supabase.rpc('fn_generate_angsuran', { p_pinjaman_id: pinjaman.id })
    }
    setSaving(false)
    setRisk(null)
    setFormP({ anggota_id: '', jumlah_pokok: '', tenor_bulan: '12', tanggal_mulai: new Date().toISOString().split('T')[0] })
    setTab('pinjaman')
    load()
  }

  async function handleApprove(p: PinjamanWithMeta) {
    setSaving(true)
    await supabase.from('pinjaman').update({ status: 'aktif' }).eq('id', p.id)
    await supabase.rpc('fn_generate_angsuran', { p_pinjaman_id: p.id })
    setSaving(false)
    load()
  }

  async function handleReject(p: PinjamanWithMeta) {
    if (!confirm(`Tolak pengajuan dari ${p.anggota?.nama}?`)) return
    setSaving(true)
    await supabase.from('pinjaman').update({ status: 'ditolak' }).eq('id', p.id)
    setSaving(false)
    load()
  }

  async function handleBuatAnggota(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()
    await supabase.from('anggota').insert({
      koperasi_id: profile!.koperasi_id,
      nama: formA.nama,
      no_hp: formA.no_hp || null,
      nama_penjamin: formA.nama_penjamin || null,
    })
    setSaving(false)
    setFormA({ nama: '', no_hp: '', nama_penjamin: '' })
    setTab('pinjaman')
    load()
  }

  async function bayarAngsuran(angsuran: Angsuran) {
    await supabase.from('angsuran').update({
      tanggal_bayar: new Date().toISOString().split('T')[0],
      jumlah_bayar: selected!.angsuran_per_bulan,
      status: 'lunas',
    }).eq('id', angsuran.id)
    const terbayar = selected!.angsuran.filter(a => a.status === 'lunas').length + 1
    if (terbayar >= selected!.tenor_bulan) {
      await supabase.from('pinjaman').update({ status: 'lunas' }).eq('id', selected!.id)
    }
    load()
    const { data } = await supabase.from('pinjaman').select('*, anggota(nama), angsuran(*)').eq('id', selected!.id).single()
    setSelected(data as PinjamanWithMeta)
  }

  const lunasCount = (p: PinjamanWithMeta) => p.angsuran.filter(a => a.status === 'lunas').length

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Simpan Pinjam</h1>
          <p className="text-stone-600 text-sm mt-1">Kelola pinjaman dan anggota koperasi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('anggota')}
            className="bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Anggota
          </button>
          <button onClick={() => { setTab('baru'); setRisk(null); setFormP(f => ({ ...f, anggota_id: '' })) }}
            className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Pinjaman
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['pinjaman', 'pengajuan', 'baru', 'anggota'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'baru' ? 'Pinjaman Baru' : t === 'anggota' ? 'Tambah Anggota' : t === 'pengajuan' ? 'Pengajuan' : 'Daftar Pinjaman'}
            {t === 'pengajuan' && pengajuan.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {pengajuan.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB: Pengajuan Masuk */}
      {tab === 'pengajuan' && (
        <div className="space-y-4">
          {pengajuan.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm">
              <CheckCircle className="w-10 h-10 text-green-700 mx-auto mb-3" />
              <p className="text-green-700 font-semibold text-lg">Tidak Ada Pengajuan</p>
              <p className="text-stone-400 text-sm mt-1">Semua pengajuan sudah diproses</p>
            </div>
          ) : pengajuan.map(p => (
            <PengajuanCard
              key={p.id} p={p}
              onApprove={handleApprove}
              onReject={handleReject}
              saving={saving}
            />
          ))}
        </div>
      )}

      {/* TAB: Buat pinjaman baru (pengurus langsung approve) */}
      {tab === 'baru' && (
        <form onSubmit={handleBuatPinjaman} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-stone-900 font-semibold">Buat Pinjaman Baru</h2>
            <p className="text-stone-400 text-xs mt-0.5">Dibuat langsung oleh pengurus — langsung aktif</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Anggota *</label>
              <select required value={formP.anggota_id} onChange={e => setP('anggota_id', e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                <option value="">Pilih anggota...</option>
                {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </select>
            </div>

            {formP.anggota_id && (
              riskLoading
                ? <p className="text-stone-400 text-xs animate-pulse">Mengecek riwayat lintas koperasi...</p>
                : <RiskBadge r={risk} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Jumlah Pokok (Rp) *</label>
                <input required type="number" min="0" value={formP.jumlah_pokok}
                  onChange={e => setP('jumlah_pokok', e.target.value)} placeholder="5000000"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Tenor (bulan) *</label>
                <select value={formP.tenor_bulan} onChange={e => setP('tenor_bulan', e.target.value)}
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                  {[3,6,9,12,18,24,36].map(t => <option key={t} value={t}>{t} bulan</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Tanggal Mulai</label>
              <input type="date" value={formP.tanggal_mulai} onChange={e => setP('tanggal_mulai', e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            {formP.jumlah_pokok && (
              <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-stone-600 text-sm">Angsuran per bulan</span>
                <span className="text-amber-700 text-lg font-bold">
                  Rp {Math.ceil(parseInt(formP.jumlah_pokok) / parseInt(formP.tenor_bulan)).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
            <button type="submit" disabled={saving}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              {saving ? 'Membuat...' : 'Buat Pinjaman'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Tambah anggota */}
      {tab === 'anggota' && (
        <form onSubmit={handleBuatAnggota} className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-200">
            <h2 className="text-stone-900 font-semibold">Tambah Anggota</h2>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Nama *</label>
              <input required value={formA.nama} onChange={e => setFormA(f => ({ ...f, nama: e.target.value }))}
                placeholder="Pak Hendra"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">No. HP</label>
                <input value={formA.no_hp} onChange={e => setFormA(f => ({ ...f, no_hp: e.target.value }))}
                  placeholder="081234567890"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-2">Nama Penjamin</label>
                <input value={formA.nama_penjamin} onChange={e => setFormA(f => ({ ...f, nama_penjamin: e.target.value }))}
                  placeholder="Pak Budi"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-stone-200 bg-stone-50">
            <button type="submit" disabled={saving}
              className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              {saving ? 'Menyimpan...' : 'Simpan Anggota'}
            </button>
          </div>
        </form>
      )}

      {/* TAB: Daftar pinjaman */}
      {tab === 'pinjaman' && (
        <>
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Memuat data pinjaman...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm">
              <p className="text-stone-900 font-semibold">Belum Ada Pinjaman</p>
              <p className="text-stone-400 text-sm mt-1">Klik "+ Pinjaman" untuk membuat pinjaman baru</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['No','Anggota','Pokok','Angsuran/bln','Status','Mulai','Progress'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-stone-500 text-xs font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {data.map((p, idx) => {
                    const terbayar = lunasCount(p)
                    const pct = Math.round((terbayar / p.tenor_bulan) * 100)
                    const isSelected = selected?.id === p.id
                    return (
                      <tr key={p.id}
                        onClick={() => setSelected(isSelected ? null : p)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-amber-50 border-l-4 border-l-amber-500' : 'hover:bg-stone-50'}`}>
                        <td className="px-4 py-3 text-stone-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-stone-900 font-medium text-sm">{p.anggota?.nama ?? '--'}</p>
                        </td>
                        <td className="px-4 py-3 text-stone-600 text-sm">Rp{p.jumlah_pokok.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-stone-600 text-sm">Rp{p.angsuran_per_bulan.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status] ?? 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-stone-400 text-xs whitespace-nowrap">
                          {new Date(p.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-amber-600'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-stone-400 text-xs">{terbayar}/{p.tenor_bulan}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {selected && (
            <div className="bg-white border border-amber-200 border-l-4 border-l-amber-500 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <p className="text-stone-900 font-semibold">{selected.anggota?.nama}</p>
                  <p className="text-stone-400 text-xs mt-0.5">
                    Angsuran Rp{selected.angsuran_per_bulan.toLocaleString('id-ID')}/bulan &middot; {selected.tenor_bulan} bulan
                  </p>
                </div>
                <button onClick={() => setSelected(null)} className="text-stone-400 hover:text-stone-600 text-xs transition-colors">Tutup</button>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {selected.angsuran.sort((a, b) => a.bulan_ke - b.bulan_ke).map(a => {
                    const isOverdue = a.status !== 'lunas' && new Date(a.tanggal_jatuh_tempo) < new Date()
                    return (
                      <div key={a.id} className={`rounded-lg p-3 text-center border ${
                        a.status === 'lunas' ? 'bg-green-50 border-green-200'
                          : isOverdue ? 'bg-red-50 border-red-200'
                          : 'bg-stone-50 border-stone-200'}`}>
                        <p className="text-stone-400 text-xs mb-1">Bln {a.bulan_ke}</p>
                        {a.status === 'lunas' ? (
                          <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full">Lunas</span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); bayarAngsuran(a) }}
                            className={`${isOverdue ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-700 hover:bg-amber-800'} text-white text-xs px-2 py-0.5 rounded-full font-medium transition-colors`}>
                            {isOverdue ? 'Terlambat' : 'Bayar'}
                          </button>
                        )}
                        <p className="text-stone-400 text-[10px] mt-1">{a.tanggal_jatuh_tempo}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
