'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import type { Pinjaman, Angsuran, Anggota } from '@/types'
import { AlertTriangle, CheckCircle, Plus, Clock, X } from 'lucide-react'

const STATUS_COLOR: Record<string, React.CSSProperties> = {
  diajukan: { background: 'rgba(201,150,58,.14)', color: '#8a6420', border: '1px solid rgba(201,150,58,.3)' },
  aktif:    { background: 'rgba(59,130,246,.1)', color: '#3b7fd4', border: '1px solid rgba(59,130,246,.25)' },
  lunas:    { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' },
  macet:    { background: 'rgba(214,87,69,.12)', color: '#c0392b', border: '1px solid rgba(214,87,69,.28)' },
  ditolak:  { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' },
}

const badgeStyle = (s: React.CSSProperties): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, display: 'inline-block', ...s,
})

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

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.14)',
  borderRadius: 10, padding: '10px 13px', color: '#0f2a1d', fontSize: 13.5, outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', color: '#46544b', fontSize: 12, fontWeight: 600, marginBottom: 6 }
const greenBtn: React.CSSProperties = {
  background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none',
  fontWeight: 700, borderRadius: 12, padding: '10px 18px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}
const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,.6)', color: '#1a4731', border: '1px solid rgba(26,71,49,.18)',
  fontWeight: 700, borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}
const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '13px 16px', textAlign: 'left', whiteSpace: 'nowrap',
}

function RiskBadge({ r }: { r: RiskProfile | null }) {
  if (!r) return null
  const score = r.total === 0 ? 100 : Math.max(0, Math.round((1 - r.macet / r.total) * 100))
  const level = r.macet > 0 ? 'merah' : r.aktif >= 2 ? 'kuning' : 'hijau'
  const barColor = level === 'merah' ? '#d65745' : level === 'kuning' ? '#c9963a' : '#2f9e63'
  const accentBorder = level === 'merah' ? '#d65745' : level === 'kuning' ? '#c9963a' : '#2f9e63'
  const textColor = level === 'merah' ? '#c0392b' : level === 'kuning' ? '#8a6420' : '#1d7a4d'
  const bgColor = level === 'merah' ? 'rgba(214,87,69,.08)' : level === 'kuning' ? 'rgba(201,150,58,.08)' : 'rgba(47,158,99,.08)'
  const labelText = level === 'merah' ? 'BERISIKO TINGGI' : level === 'kuning' ? 'PERLU PERHATIAN' : 'BAIK'
  const rec = level === 'merah'
    ? 'Pertimbangkan untuk menolak atau meminta jaminan tambahan sebelum menyetujui.'
    : level === 'kuning'
    ? 'Verifikasi kapasitas cicilan — anggota sudah memiliki pinjaman aktif.'
    : r.total > 0 ? `${r.total} pinjaman tercatat, semua lunas. Rekam jejak bersih.` : 'Peminjam pertama kali di platform — tidak ada riwayat negatif.'

  return (
    <div style={{ background: bgColor, border: `1px solid ${accentBorder}`, borderLeft: `4px solid ${accentBorder}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: textColor, fontWeight: 800, fontSize: 13.5 }}>Skor Kredit: {labelText}</span>
          {r.cross_koperasi && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#3b7fd4', background: 'rgba(59,130,246,.1)', border: '1px solid rgba(59,130,246,.25)', padding: '2px 9px', borderRadius: 999 }}>
              Lintas Koperasi
            </span>
          )}
        </div>
        <span style={{ color: textColor, fontSize: 24, fontWeight: 800 }}>{score}</span>
      </div>
      <div style={{ height: 7, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: barColor, borderRadius: 999, width: `${score}%`, transition: 'width .5s' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#7a857d', flexWrap: 'wrap' }}>
        <span>{r.total} total pinjaman</span>
        {r.macet > 0 && <span style={{ color: '#c0392b', fontWeight: 600 }}>{r.macet} macet</span>}
        {r.aktif > 0 && <span style={{ color: '#8a6420' }}>{r.aktif} aktif berjalan</span>}
        <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: '#9aa39c' }}>
          {r.cross_koperasi ? 'data dari seluruh platform Lumbung' : 'koperasi ini saja'}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: textColor, borderTop: `1px solid ${accentBorder}`, paddingTop: 10 }}>{rec}</p>
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
    const risk = await api.get<RiskProfile>(`/api/anggota/${p.anggota_id}/risk`).catch(() => null)
    setLocalRisk(risk)
    setChecked(true)
    setChecking(false)
  }

  return (
    <div style={{ ...glass, borderRadius: 18, overflow: 'hidden', borderLeft: '4px solid #c9963a' }}>
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f2a1d' }}>{p.anggota?.nama ?? '--'}</p>
            <p style={{ fontSize: 13.5, color: '#46544b', marginTop: 2 }}>
              Rp {p.jumlah_pokok.toLocaleString('id-ID')} · {p.tenor_bulan} bulan · Rp {p.angsuran_per_bulan.toLocaleString('id-ID')}/bln
            </p>
            <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 3 }}>
              Diajukan: {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span style={badgeStyle(STATUS_COLOR.diajukan)}>Menunggu Review</span>
        </div>

        {!checked ? (
          <button onClick={doCheck} disabled={checking}
            style={{ width: '100%', padding: '9px', borderRadius: 11, border: '1px solid rgba(26,71,49,.16)', background: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: 600, color: '#46544b', cursor: 'pointer', marginBottom: 12, opacity: checking ? 0.6 : 1 }}>
            {checking ? 'Mengecek riwayat lintas koperasi...' : 'Cek Riwayat Pinjaman (Lintas Koperasi)'}
          </button>
        ) : (
          <div style={{ marginBottom: 12 }}><RiskBadge r={localRisk} /></div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onApprove(p)} disabled={saving}
            style={{ ...greenBtn, flex: 1, justifyContent: 'center', opacity: saving ? 0.5 : 1 }}>
            Setujui & Aktifkan
          </button>
          <button onClick={() => onReject(p)} disabled={saving}
            style={{ ...ghostBtn, flex: 1, justifyContent: 'center', color: '#c0392b', border: '1px solid rgba(214,87,69,.3)', opacity: saving ? 0.5 : 1 }}>
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
    const interval = setInterval(() => load(), 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function checkRisk(anggotaId: string) {
    if (!anggotaId) { setRisk(null); return }
    setRiskLoading(true)
    const risk = await api.get<RiskProfile>(`/api/anggota/${anggotaId}/risk`).catch(() => null)
    setRisk(risk)
    setRiskLoading(false)
  }

  function setP(k: string, v: string) { setFormP(f => ({ ...f, [k]: v })); if (k === 'anggota_id') checkRisk(v) }

  async function handleBuatPinjaman(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const me = await getMe()
    const pokok = parseInt(formP.jumlah_pokok), tenor = parseInt(formP.tenor_bulan)
    const pinjaman = await api.post<PinjamanWithMeta>('/api/pinjaman', {
      koperasi_id: me?.koperasi_id, anggota_id: formP.anggota_id, jumlah_pokok: pokok,
      tenor_bulan: tenor, tanggal_mulai: formP.tanggal_mulai, angsuran_per_bulan: Math.ceil(pokok / tenor), status: 'aktif',
    }).catch(() => null)
    if (pinjaman) { /* angsuran di-generate server-side */ }
    setSaving(false); setRisk(null)
    setFormP({ anggota_id: '', jumlah_pokok: '', tenor_bulan: '12', tanggal_mulai: new Date().toISOString().split('T')[0] })
    setTab('pinjaman'); load()
  }

  async function handleApprove(p: PinjamanWithMeta) {
    setSaving(true)
    await api.put<void>(`/api/pinjaman/${p.id}`, { status: 'aktif' }).catch(() => null)
    setSaving(false); load()
  }

  async function handleReject(p: PinjamanWithMeta) {
    if (!confirm(`Tolak pengajuan dari ${p.anggota?.nama}?`)) return
    setSaving(true)
    await api.put<void>(`/api/pinjaman/${p.id}`, { status: 'ditolak' }).catch(() => null)
    setSaving(false); load()
  }

  async function handleBuatAnggota(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const me = await getMe()
    await api.post<void>('/api/anggota', {
      koperasi_id: me?.koperasi_id, nama: formA.nama, no_hp: formA.no_hp || null, nama_penjamin: formA.nama_penjamin || null,
    }).catch(() => null)
    setSaving(false); setFormA({ nama: '', no_hp: '', nama_penjamin: '' }); setTab('pinjaman'); load()
  }

  async function handleCatatSetoran(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const me = await getMe()
    await api.post<void>('/api/simpanan', {
      koperasi_id: me?.koperasi_id, anggota_id: formSetoran.anggota_id,
      jumlah: parseFloat(formSetoran.jumlah), keterangan: formSetoran.keterangan || null, status: 'pending_member_confirm',
    }).catch(() => null)
    setSaving(false); setFormSetoran({ anggota_id: '', jumlah: '', keterangan: '' }); load()
  }

  async function confirmClaimed(id: string) {
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, { status: 'confirmed', confirmed_at: new Date().toISOString() }).catch(() => null)
    setSaving(false); load()
  }

  async function rejectClaimed(id: string, nama: string) {
    if (!confirm(`Tolak klaim dari ${nama}?`)) return
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, { status: 'rejected' }).catch(() => null)
    setSaving(false); load()
  }

  async function resolveDisputed(id: string) {
    setSaving(true)
    await api.put<void>(`/api/simpanan/${id}`, { status: 'confirmed', confirmed_at: new Date().toISOString(), disputed_note: null }).catch(() => null)
    setSaving(false); load()
  }

  async function bayarAngsuran(angsuran: Angsuran) {
    await api.put<void>(`/api/pinjaman/angsuran/${angsuran.id}`, {
      tanggal_bayar: new Date().toISOString().split('T')[0], jumlah_bayar: selected!.angsuran_per_bulan, status: 'lunas',
    }).catch(() => null)
    const terbayar = (selected!.angsuran ?? []).filter(a => a.status === 'lunas').length + 1
    if (terbayar >= selected!.tenor_bulan) await api.put<void>(`/api/pinjaman/${selected!.id}`, { status: 'lunas' }).catch(() => null)
    load()
    const updated = await api.get<PinjamanWithMeta>(`/api/pinjaman/${selected!.id}`).catch(() => null)
    if (updated) setSelected(updated)
  }

  const lunasCount = (p: PinjamanWithMeta) => (p.angsuran ?? []).filter(a => a.status === 'lunas').length

  const tabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', padding: '9px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Simpan Pinjam</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>Kelola pinjaman dan anggota koperasi</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setTab('anggota')} style={ghostBtn}><Plus size={15} /> Anggota</button>
          <button onClick={() => { setTab('baru'); setRisk(null); setFormP(f => ({ ...f, anggota_id: '' })) }} style={greenBtn}><Plus size={15} /> Pinjaman</button>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18, flexWrap: 'wrap' }}>
        {(['pinjaman', 'pengajuan', 'setoran', 'baru', 'anggota'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ ...tabBtn(tab === t), position: 'relative' }}>
            {t === 'baru' ? 'Pinjaman Baru' : t === 'anggota' ? 'Tambah Anggota' : t === 'pengajuan' ? 'Pengajuan' : t === 'setoran' ? 'Setoran' : 'Daftar Pinjaman'}
            {t === 'pengajuan' && pengajuan.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#d65745', color: '#fff', fontSize: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                {pengajuan.length}
              </span>
            )}
            {t === 'setoran' && simpananAksi.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#d65745', color: '#fff', fontSize: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
                {simpananAksi.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PENGAJUAN */}
      {tab === 'pengajuan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pengajuan.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
              <CheckCircle size={40} style={{ margin: '0 auto 12px', color: '#1d7a4d' }} />
              <p style={{ fontWeight: 700, color: '#1d7a4d', fontSize: 15 }}>Tidak Ada Pengajuan</p>
              <p style={{ fontSize: 13, color: '#7a857d', marginTop: 4 }}>Semua pengajuan sudah diproses</p>
            </div>
          ) : pengajuan.map(p => (
            <PengajuanCard key={p.id} p={p} onApprove={handleApprove} onReject={handleReject} saving={saving} />
          ))}
        </div>
      )}

      {/* SETORAN */}
      {tab === 'setoran' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
              <h2 style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Catat Setoran Anggota</h2>
              <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>Anggota akan mendapat notifikasi untuk konfirmasi</p>
            </div>
            <form onSubmit={handleCatatSetoran} style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Anggota *</label>
                  <select required value={formSetoran.anggota_id}
                    onChange={e => setFormSetoran(f => ({ ...f, anggota_id: e.target.value }))}
                    style={inputStyle}>
                    <option value="">Pilih anggota...</option>
                    {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Jumlah (Rp) *</label>
                  <input required type="number" min="1000" value={formSetoran.jumlah}
                    onChange={e => setFormSetoran(f => ({ ...f, jumlah: e.target.value }))}
                    placeholder="100000" style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Keterangan</label>
                <input value={formSetoran.keterangan}
                  onChange={e => setFormSetoran(f => ({ ...f, keterangan: e.target.value }))}
                  placeholder="Simpanan wajib Juli" style={inputStyle} />
              </div>
              <button type="submit" disabled={saving}
                style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Mencatat...' : 'Catat & Kirim ke Anggota'}
              </button>
            </form>
          </div>

          {simpananAksi.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f2a1d' }}>Perlu tindakan ({simpananAksi.length})</p>
              {simpananAksi.map(s => {
                const jamLalu = (Date.now() - new Date(s.tanggal).getTime()) / 3_600_000
                const isLama = s.status === 'pending_member_confirm' && jamLalu > 24
                const accentColor = s.status === 'disputed' ? '#d65745' : s.status === 'claimed' ? '#c9963a' : isLama ? '#d65745' : 'rgba(26,71,49,.2)'
                return (
                  <div key={s.id} style={{ ...glass, borderRadius: 16, overflow: 'hidden', borderLeft: `4px solid ${accentColor}` }}>
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d' }}>{s.anggota?.nama ?? '--'}</p>
                            {s.status === 'pending_admin_confirm' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6420', background: 'rgba(201,150,58,.12)', border: '1px solid rgba(201,150,58,.25)', padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={9} /> Diajukan anggota
                              </span>
                            )}
                            {s.status === 'pending_member_confirm' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: isLama ? '#c0392b' : '#7a857d', background: isLama ? 'rgba(214,87,69,.1)' : 'rgba(26,71,49,.06)', border: `1px solid ${isLama ? 'rgba(214,87,69,.25)' : 'rgba(26,71,49,.1)'}`, padding: '2px 8px', borderRadius: 999, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <Clock size={9} /> Menunggu konfirmasi anggota {isLama ? `— ${Math.floor(jamLalu)}j` : ''}
                              </span>
                            )}
                            {s.status === 'disputed' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#c0392b', background: 'rgba(214,87,69,.1)', border: '1px solid rgba(214,87,69,.25)', padding: '2px 8px', borderRadius: 999 }}>
                                Disengketakan anggota
                              </span>
                            )}
                            {s.status === 'claimed' && (
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#8a6420', background: 'rgba(201,150,58,.12)', border: '1px solid rgba(201,150,58,.25)', padding: '2px 8px', borderRadius: 999 }}>
                                Klaim tidak tercatat
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#0f2a1d' }}>Rp {s.jumlah.toLocaleString('id-ID')}</p>
                          {s.keterangan && <p style={{ fontSize: 13, color: '#7a857d', marginTop: 2 }}>{s.keterangan}</p>}
                          {s.status === 'disputed' && s.disputed_note && (
                            <p style={{ fontSize: 12, color: '#c0392b', marginTop: 6, background: 'rgba(214,87,69,.08)', border: '1px solid rgba(214,87,69,.15)', borderRadius: 8, padding: '6px 10px' }}>
                              Laporan anggota: &ldquo;{s.disputed_note}&rdquo;
                            </p>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: '#9aa39c', flexShrink: 0 }}>
                          {new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      {(s.status === 'pending_admin_confirm' || s.status === 'claimed' || s.status === 'disputed') && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => s.status === 'disputed' ? resolveDisputed(s.id) : confirmClaimed(s.id)}
                            disabled={saving}
                            style={{ ...greenBtn, flex: 1, justifyContent: 'center', opacity: saving ? 0.5 : 1 }}>
                            <CheckCircle size={13} />
                            {s.status === 'pending_admin_confirm' ? 'Konfirmasi Setoran' : s.status === 'claimed' ? 'Konfirmasi Klaim' : 'Selesaikan Sengketa'}
                          </button>
                          {(s.status === 'claimed' || s.status === 'pending_admin_confirm') && (
                            <button onClick={() => rejectClaimed(s.id, s.anggota?.nama ?? '')} disabled={saving}
                              style={{ ...ghostBtn, flex: 1, justifyContent: 'center', color: '#c0392b', border: '1px solid rgba(214,87,69,.3)', opacity: saving ? 0.5 : 1 }}>
                              <X size={13} /> {s.status === 'pending_admin_confirm' ? 'Tolak' : 'Tolak Klaim'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {simpananAksi.length === 0 && (
            <div style={{ ...glass, borderRadius: 16, padding: '40px 0', textAlign: 'center' }}>
              <CheckCircle size={30} style={{ margin: '0 auto 10px', color: '#1d7a4d' }} />
              <p style={{ fontWeight: 700, color: '#1d7a4d', fontSize: 14 }}>Tidak ada item perlu tindakan</p>
            </div>
          )}
        </div>
      )}

      {/* BUAT PINJAMAN */}
      {tab === 'baru' && (
        <form onSubmit={handleBuatPinjaman} style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>Buat Pinjaman Baru</h2>
            <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>Dibuat langsung oleh pengurus — langsung aktif</p>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Anggota *</label>
              <select required value={formP.anggota_id} onChange={e => setP('anggota_id', e.target.value)} style={inputStyle}>
                <option value="">Pilih anggota...</option>
                {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </select>
            </div>
            {formP.anggota_id && (
              riskLoading
                ? <p style={{ fontSize: 12.5, color: '#9aa39c', fontStyle: 'italic' }}>Mengecek riwayat lintas koperasi...</p>
                : <RiskBadge r={risk} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Jumlah Pokok (Rp) *</label>
                <input required type="number" min="0" value={formP.jumlah_pokok}
                  onChange={e => setP('jumlah_pokok', e.target.value)} placeholder="5000000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Tenor (bulan) *</label>
                <select value={formP.tenor_bulan} onChange={e => setP('tenor_bulan', e.target.value)} style={inputStyle}>
                  {[3,6,9,12,18,24,36].map(t => <option key={t} value={t}>{t} bulan</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Tanggal Mulai</label>
              <input type="date" value={formP.tanggal_mulai} onChange={e => setP('tanggal_mulai', e.target.value)} style={inputStyle} />
            </div>
            {formP.jumlah_pokok && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.1)', borderRadius: 12, padding: '12px 16px' }}>
                <span style={{ fontSize: 13.5, color: '#46544b' }}>Angsuran per bulan</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#1a4731' }}>
                  Rp {Math.ceil(parseInt(formP.jumlah_pokok) / parseInt(formP.tenor_bulan)).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.4)' }}>
            <button type="submit" disabled={saving}
              style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Membuat...' : 'Buat Pinjaman'}
            </button>
          </div>
        </form>
      )}

      {/* TAMBAH ANGGOTA */}
      {tab === 'anggota' && (
        <form onSubmit={handleBuatAnggota} style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>Tambah Anggota</h2>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Nama *</label>
              <input required value={formA.nama} onChange={e => setFormA(f => ({ ...f, nama: e.target.value }))}
                placeholder="Pak Hendra" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>No. HP</label>
                <input value={formA.no_hp} onChange={e => setFormA(f => ({ ...f, no_hp: e.target.value }))}
                  placeholder="081234567890" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nama Penjamin</label>
                <input value={formA.nama_penjamin} onChange={e => setFormA(f => ({ ...f, nama_penjamin: e.target.value }))}
                  placeholder="Pak Budi" style={inputStyle} />
              </div>
            </div>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.4)' }}>
            <button type="submit" disabled={saving}
              style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Menyimpan...' : 'Simpan Anggota'}
            </button>
          </div>
        </form>
      )}

      {/* DAFTAR PINJAMAN */}
      {tab === 'pinjaman' && (
        <>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
            </div>
          ) : data.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center', color: '#7a857d' }}>
              <p style={{ fontWeight: 700, color: '#46544b', fontSize: 15 }}>Belum Ada Pinjaman</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Klik &ldquo;+ Pinjaman&rdquo; untuk membuat pinjaman baru</p>
            </div>
          ) : (
            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                      {['No','Anggota','Pokok','Angsuran/bln','Status','Mulai','Progress'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((p, idx) => {
                      const terbayar = lunasCount(p)
                      const pct = Math.round((terbayar / p.tenor_bulan) * 100)
                      const isSelected = selected?.id === p.id
                      return (
                        <tr key={p.id}
                          onClick={() => setSelected(isSelected ? null : p)}
                          style={{ borderBottom: '1px solid rgba(26,71,49,.05)', cursor: 'pointer', transition: 'background .15s', background: isSelected ? 'rgba(201,150,58,.06)' : 'transparent', borderLeft: isSelected ? '3px solid #c9963a' : '3px solid transparent' }}
                          onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                          onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                          <td style={{ padding: '13px 16px', color: '#9aa39c', fontSize: 12 }}>{idx + 1}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <p style={{ fontWeight: 700, color: '#0f2a1d' }}>{p.anggota?.nama ?? '--'}</p>
                          </td>
                          <td style={{ padding: '13px 16px', color: '#46544b' }}>Rp{p.jumlah_pokok.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '13px 16px', color: '#46544b' }}>Rp{p.angsuran_per_bulan.toLocaleString('id-ID')}</td>
                          <td style={{ padding: '13px 16px' }}>
                            <span style={badgeStyle(STATUS_COLOR[p.status] ?? STATUS_COLOR.ditolak)}>{p.status}</span>
                          </td>
                          <td style={{ padding: '13px 16px', color: '#9aa39c', fontSize: 12, whiteSpace: 'nowrap' }}>
                            {new Date(p.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </td>
                          <td style={{ padding: '13px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                              <div style={{ flex: 1, height: 6, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 999, background: pct >= 100 ? '#2f9e63' : '#c9963a', width: `${pct}%`, transition: 'width .4s' }} />
                              </div>
                              <span style={{ fontSize: 12, color: '#9aa39c' }}>{terbayar}/{p.tenor_bulan}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selected && (
            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', borderLeft: '4px solid #c9963a' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontWeight: 800, color: '#0f2a1d', fontSize: 14 }}>{selected.anggota?.nama}</p>
                  <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>
                    Angsuran Rp{selected.angsuran_per_bulan.toLocaleString('id-ID')}/bulan · {selected.tenor_bulan} bulan
                  </p>
                </div>
                <button onClick={() => setSelected(null)} style={{ fontSize: 12, color: '#7a857d', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Tutup</button>
              </div>
              <div style={{ padding: '16px 20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                  {(selected.angsuran ?? []).sort((a, b) => a.bulan_ke - b.bulan_ke).map(a => {
                    const isOverdue = a.status !== 'lunas' && new Date(a.tanggal_jatuh_tempo) < new Date()
                    const cardBg = a.status === 'lunas' ? 'rgba(47,158,99,.1)' : isOverdue ? 'rgba(214,87,69,.1)' : 'rgba(26,71,49,.05)'
                    const cardBorder = a.status === 'lunas' ? 'rgba(47,158,99,.25)' : isOverdue ? 'rgba(214,87,69,.25)' : 'rgba(26,71,49,.1)'
                    return (
                      <div key={a.id} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: '11px 10px', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: '#9aa39c', marginBottom: 6 }}>Bln {a.bulan_ke}</p>
                        {a.status === 'lunas' ? (
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#1d7a4d', background: 'rgba(47,158,99,.14)', border: '1px solid rgba(47,158,99,.3)', padding: '2px 7px', borderRadius: 999 }}>Lunas</span>
                        ) : (
                          <button onClick={e => { e.stopPropagation(); bayarAngsuran(a) }}
                            style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: isOverdue ? '#d65745' : '#1a4731', border: 'none', padding: '4px 8px', borderRadius: 8, cursor: 'pointer' }}>
                            {isOverdue ? 'Terlambat' : 'Bayar'}
                          </button>
                        )}
                        <p style={{ fontSize: 10, color: '#9aa39c', marginTop: 5 }}>{a.tanggal_jatuh_tempo}</p>
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
