'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import type { Pinjaman, Angsuran, Anggota } from '@/types'
import { AlertTriangle, CheckCircle, Plus, Clock, X } from 'lucide-react'

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

type SimpananItem = {
  id: string; jumlah: number; keterangan: string | null
  tanggal: string; status: string; disputed_note: string | null
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
  const score = r.total === 0 ? 100 : Math.max(0, Math.round((1 - r.macet / r.total) * 100))
  const level = r.macet > 0 ? 'merah' : r.aktif >= 2 ? 'kuning' : 'hijau'
  const barColor = level === 'merah' ? 'bg-red-500' : level === 'kuning' ? 'bg-amber-400' : 'bg-green-500'
  const borderLeft = level === 'merah' ? 'border-l-red-500' : level === 'kuning' ? 'border-l-amber-400' : 'border-l-green-500'
  const bg = level === 'merah' ? 'bg-red-50 border-red-200' : level === 'kuning' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
  const txt = level === 'merah' ? 'text-red-600' : level === 'kuning' ? 'text-amber-700' : 'text-green-700'
  const labelText = level === 'merah' ? 'BERISIKO TINGGI' : level === 'kuning' ? 'PERLU PERHATIAN' : 'BAIK'
  const rec = level === 'merah'
    ? 'Pertimbangkan untuk menolak atau meminta jaminan tambahan sebelum menyetujui.'
    : level === 'kuning'
    ? 'Verifikasi kapasitas cicilan — anggota sudah memiliki pinjaman aktif.'
    : r.total > 0 ? `${r.total} pinjaman tercatat, semua lunas. Rekam jejak bersih.` : 'Peminjam pertama kali di platform — tidak ada riwayat negatif.'

  return (
    <div className={`${bg} border border-l-4 ${borderLeft} rounded-xl p-4 space-y-2.5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`${txt} font-bold text-sm`}>Skor Kredit: {labelText}</span>
          {r.cross_koperasi && (
            <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full border border-blue-200 font-medium">
              Lintas Koperasi
            </span>
          )}
        </div>
        <span className={`${txt} text-2xl font-black tabular-nums`}>{score}</span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-2">
        <div className={`${barColor} h-2 rounded-full transition-all duration-500`} style={{ width: `${score}%` }} />
      </div>
      <div className="flex items-center gap-4 text-xs text-stone-500 flex-wrap">
        <span>{r.total} total pinjaman</span>
        {r.macet > 0 && <span className="text-red-600 font-semibold">{r.macet} macet</span>}
        {r.aktif > 0 && <span className="text-amber-600">{r.aktif} aktif berjalan</span>}
        <span className="ml-auto text-stone-400 italic">
          {r.cross_koperasi ? 'data dari seluruh platform Lumbung' : 'koperasi ini saja'}
        </span>
      </div>
      <p className={`${txt} text-xs border-t border-current border-opacity-20 pt-2`}>{rec}</p>
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
    // TODO: implement via API — fn_anggota_risk_cross belum ada route di gateway
    const risk = await api.get<RiskProfile>(`/api/anggota/${p.anggota_id}/risk`).catch(() => null)
    setLocalRisk(risk)
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
  const [tab, setTab] = useState<'pinjaman' | 'pengajuan' | 'setoran' | 'baru' | 'anggota'>('pinjaman')
  const [data, setData] = useState<PinjamanWithMeta[]>([])
  const [pengajuan, setPengajuan] = useState<PinjamanWithMeta[]>([])
  const [simpananAksi, setSimpananAksi] = useState<SimpananItem[]>([])
  const [formSetoran, setFormSetoran] = useState({ anggota_id: '', jumlah: '', keterangan: '' })
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
    const [semua, ag, sp] = await Promise.all([
      api.get<PinjamanWithMeta[]>('/api/pinjaman').catch(() => [] as PinjamanWithMeta[]),
      api.get<Anggota[]>('/api/anggota').catch(() => [] as Anggota[]),
      api.get<SimpananItem[]>('/api/simpanan?status=pending_admin_confirm,pending_member_confirm,disputed,claimed').catch(() => [] as SimpananItem[]),
    ])
    const rows = semua ?? []
    setData(rows.filter(r => r.status !== 'diajukan'))
    setPengajuan(rows.filter(r => r.status === 'diajukan'))
    setAnggotaList(ag ?? [])
    setSimpananAksi(sp ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    // Polling pengganti realtime Supabase channel (simpan-pinjam-rt)
    const interval = setInterval(() => load(), 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function checkRisk(anggotaId: string) {
    if (!anggotaId) { setRisk(null); return }
    setRiskLoading(true)
    // TODO: implement via API — fn_anggota_risk_cross belum ada route di gateway
    const risk = await api.get<RiskProfile>(`/api/anggota/${anggotaId}/risk`).catch(() => null)
    setRisk(risk)
    setRiskLoading(false)
  }

  function setP(k: string, v: string) {
    setFormP(f => ({ ...f, [k]: v }))
    if (k === 'anggota_id') checkRisk(v)
  }

  async function handleBuatPinjaman(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const me = await getMe()
    const pokok = parseInt(formP.jumlah_pokok)
    const tenor = parseInt(formP.tenor_bulan)

    const pinjaman = await api.post<PinjamanWithMeta>('/api/pinjaman', {
      koperasi_id: me?.koperasi_id,
      anggota_id: formP.anggota_id,
      jumlah_pokok: pokok,
      tenor_bulan: tenor,
      tanggal_mulai: formP.tanggal_mulai,
      angsuran_per_bulan: Math.ceil(pokok / tenor),
      status: 'aktif',
    }).catch(() => null)

    if (pinjaman) {
      // TODO: fn_generate_angsuran belum ada route di gateway — angsuran di-generate server-side saat insert
    }
    setSaving(false)
    setRisk(null)
    setFormP({ anggota_id: '', jumlah_pokok: '', tenor_bulan: '12', tanggal_mulai: new Date().toISOString().split('T')[0] })
    setTab('pinjaman')
    load()
  }

  async function handleApprove(p: PinjamanWithMeta) {
    setSaving(true)
    await api.put<void>(`/api/pinjaman/${p.id}`, { status: 'aktif' }).catch(() => null)
    // TODO: fn_generate_angsuran belum ada route di gateway — angsuran di-generate server-side saat approve
    setSaving(false)
    load()
  }

  async function handleReject(p: PinjamanWithMeta) {
    if (!confirm(`Tolak pengajuan dari ${p.anggota?.nama}?`)) return
    setSaving(true)
    await api.put<void>(`/api/pinjaman/${p.id}`, { status: 'ditolak' }).catch(() => null)
    setSaving(false)
    load()
  }

  async function handleBuatAnggota(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const me = await getMe()
    await api.post<void>('/api/anggota', {
      koperasi_id: me?.koperasi_id,
      nama: formA.nama,
      no_hp: formA.no_hp || null,
      nama_penjamin: formA.nama_penjamin || null,
    }).catch(() => null)
    setSaving(false)
    setFormA({ nama: '', no_hp: '', nama_penjamin: '' })
    setTab('pinjaman')
    load()
  }

  async function handleCatatSetoran(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const me = await getMe()
    await api.post<void>('/api/simpanan', {
      koperasi_id: me?.koperasi_id,
      anggota_id: formSetoran.anggota_id,
      jumlah: parseFloat(formSetoran.jumlah),
      keterangan: formSetoran.keterangan || null,
      status: 'pending_member_confirm',
    }).catch(() => null)
    setSaving(false)
    setFormSetoran({ anggota_id: '', jumlah: '', keterangan: '' })
    load()
  }

  async function confirmClaimed(id: string) {
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }).catch(() => null)
    setSaving(false)
    load()
  }

  async function rejectClaimed(id: string, nama: string) {
    if (!confirm(`Tolak klaim dari ${nama}?`)) return
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, { status: 'rejected' }).catch(() => null)
    setSaving(false)
    load()
  }

  async function resolveDisputed(id: string) {
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, {
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      disputed_note: null,
    }).catch(() => null)
    setSaving(false)
    load()
  }

  async function bayarAngsuran(angsuran: Angsuran) {
    await api.put<void>(`/api/pinjaman/angsuran/${angsuran.id}`, {
      tanggal_bayar: new Date().toISOString().split('T')[0],
      jumlah_bayar: selected!.angsuran_per_bulan,
      status: 'lunas',
    }).catch(() => null)
    const terbayar = selected!.angsuran.filter(a => a.status === 'lunas').length + 1
    if (terbayar >= selected!.tenor_bulan) {
      await api.put<void>(`/api/pinjaman/${selected!.id}`, { status: 'lunas' }).catch(() => null)
    }
    load()
    const updated = await api.get<PinjamanWithMeta>(`/api/pinjaman/${selected!.id}`).catch(() => null)
    if (updated) setSelected(updated)
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

      <div className="flex flex-wrap gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['pinjaman', 'pengajuan', 'setoran', 'baru', 'anggota'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'baru' ? 'Pinjaman Baru'
              : t === 'anggota' ? 'Tambah Anggota'
              : t === 'pengajuan' ? 'Pengajuan Pinjaman'
              : t === 'setoran' ? 'Setoran Masuk'
              : 'Daftar Pinjaman'}
            {t === 'pengajuan' && pengajuan.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {pengajuan.length}
              </span>
            )}
            {t === 'setoran' && simpananAksi.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {simpananAksi.length}
              </span>
            )}
          </button>
        ))}
      </div>

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

      {tab === 'setoran' && (
        <div className="space-y-5">

          <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200">
              <h2 className="text-stone-900 font-semibold text-sm">Catat Setoran Anggota</h2>
              <p className="text-stone-400 text-xs mt-0.5">Anggota akan mendapat notifikasi untuk konfirmasi</p>
            </div>
            <form onSubmit={handleCatatSetoran} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-1.5">Anggota *</label>
                  <select required value={formSetoran.anggota_id}
                    onChange={e => setFormSetoran(f => ({ ...f, anggota_id: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500">
                    <option value="">Pilih anggota...</option>
                    {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
                  </select>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-1.5">Jumlah (Rp) *</label>
                  <input required type="number" min="1000" value={formSetoran.jumlah}
                    onChange={e => setFormSetoran(f => ({ ...f, jumlah: e.target.value }))}
                    placeholder="100000"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500" />
                </div>
              </div>
              <div>
                <label className="block text-stone-600 text-xs uppercase tracking-wide font-medium mb-1.5">Keterangan</label>
                <input value={formSetoran.keterangan}
                  onChange={e => setFormSetoran(f => ({ ...f, keterangan: e.target.value }))}
                  placeholder="Simpanan wajib Juli"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500" />
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
                {saving ? 'Mencatat...' : 'Catat & Kirim ke Anggota'}
              </button>
            </form>
          </div>

          {simpananAksi.length > 0 && (
            <div className="space-y-3">
              <p className="text-stone-700 text-sm font-semibold">Perlu tindakan ({simpananAksi.length})</p>
              {simpananAksi.map(s => {
                const jamLalu = (Date.now() - new Date(s.tanggal).getTime()) / 3_600_000
                const isLama = s.status === 'pending_member_confirm' && jamLalu > 24
                return (
                  <div key={s.id} className={`bg-white border-l-4 rounded-xl shadow-sm p-4
                    ${s.status === 'disputed' ? 'border border-red-300 border-l-red-500'
                      : s.status === 'claimed' ? 'border border-amber-300 border-l-amber-500'
                      : isLama ? 'border border-red-200 border-l-red-400'
                      : 'border border-stone-200 border-l-stone-400'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-stone-900 font-semibold">{s.anggota?.nama ?? '--'}</p>
                          {s.status === 'pending_admin_confirm' && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Clock size={9} /> Diajukan anggota
                            </span>
                          )}
                          {s.status === 'pending_member_confirm' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border inline-flex items-center gap-1
                              ${isLama ? 'bg-red-50 text-red-600 border-red-200' : 'bg-stone-50 text-stone-500 border-stone-200'}`}>
                              <Clock size={9} /> Menunggu konfirmasi anggota {isLama ? `— ${Math.floor(jamLalu)}j` : ''}
                            </span>
                          )}
                          {s.status === 'disputed' && (
                            <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full">
                              Disengketakan anggota
                            </span>
                          )}
                          {s.status === 'claimed' && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              Klaim tidak tercatat
                            </span>
                          )}
                        </div>
                        <p className="text-stone-900 font-bold text-lg mt-0.5">Rp {s.jumlah.toLocaleString('id-ID')}</p>
                        {s.keterangan && <p className="text-stone-500 text-sm">{s.keterangan}</p>}
                        {s.status === 'disputed' && s.disputed_note && (
                          <p className="text-red-600 text-xs mt-1 bg-red-50 border border-red-100 rounded px-2 py-1">
                            Laporan anggota: "{s.disputed_note}"
                          </p>
                        )}
                        {s.status === 'claimed' && (
                          <p className="text-amber-700 text-xs mt-1">Anggota mengklaim sudah setor tapi belum tercatat.</p>
                        )}
                      </div>
                      <p className="text-stone-400 text-xs shrink-0">
                        {new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    {(s.status === 'pending_admin_confirm' || s.status === 'claimed' || s.status === 'disputed') && (
                      <div className="flex gap-2">
                        <button onClick={() => s.status === 'claimed' ? confirmClaimed(s.id) : s.status === 'disputed' ? resolveDisputed(s.id) : confirmClaimed(s.id)}
                          disabled={saving}
                          className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                          <CheckCircle size={13} />
                          {s.status === 'pending_admin_confirm' ? 'Konfirmasi Setoran'
                            : s.status === 'claimed' ? 'Konfirmasi Klaim'
                            : 'Selesaikan Sengketa'}
                        </button>
                        {(s.status === 'claimed' || s.status === 'pending_admin_confirm') && (
                          <button onClick={() => rejectClaimed(s.id, s.anggota?.nama ?? '')} disabled={saving}
                            className="flex-1 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                            <X size={13} /> {s.status === 'pending_admin_confirm' ? 'Tolak' : 'Tolak Klaim'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {simpananAksi.length === 0 && (
            <div className="text-center py-12 bg-white border border-stone-200 rounded-xl shadow-sm">
              <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <p className="text-green-700 font-semibold">Tidak ada item perlu tindakan</p>
            </div>
          )}
        </div>
      )}

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
