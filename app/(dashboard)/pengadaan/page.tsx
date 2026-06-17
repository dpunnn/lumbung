'use client'

import { useEffect, useState } from 'react'
import { Plus, ShoppingBag, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'

type Koperasi = { id: string; nama: string }
type Alokasi = {
  id: string; koperasi_id: string; kebutuhan: number; alokasi_dapat: number
  status_rekening: 'terhubung' | 'belum_terhubung'; catatan: string | null; koperasi: Koperasi
}
type Pengadaan = {
  id: string; judul: string; item: string; satuan: string; total_kebutuhan: number
  status: 'draft' | 'aktif' | 'selesai'; dibuat_oleh_koperasi_id: string; created_at: string
  pengadaan_alokasi: Alokasi[]; koperasi: Koperasi
}

const STATUS_PILL: Record<string, React.CSSProperties> = {
  draft:   { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' },
  aktif:   { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' },
  selesai: { background: 'rgba(59,130,246,.1)', color: '#3b7fd4', border: '1px solid rgba(59,130,246,.25)' },
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}
const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.14)',
  borderRadius: 10, padding: '9px 12px', color: '#0f2a1d', fontSize: 13.5, outline: 'none',
}
const labelStyle: React.CSSProperties = { display: 'block', color: '#46544b', fontSize: 12, fontWeight: 600, marginBottom: 5 }
const greenBtn: React.CSSProperties = {
  background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none',
  fontWeight: 700, borderRadius: 12, padding: '10px 18px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}
const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap',
}

export default function PengadaanPage() {
  const [tab, setTab] = useState<'daftar' | 'buat'>('daftar')
  const [data, setData] = useState<Pengadaan[]>([])
  const [myKoperasiId, setMyKoperasiId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [finalisasiError, setFinalisasiError] = useState<string | null>(null)
  const [form, setForm] = useState({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
  const [ajukanForm, setAjukanForm] = useState<Record<string, { kebutuhan: string; status_rekening: string }>>({})

  useEffect(() => {
    async function init() {
      const me = await getMe()
      if (me?.koperasi_id) setMyKoperasiId(me.koperasi_id)
    }
    init(); loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const rows = await api.get<Pengadaan[]>('/api/pengadaan').catch(() => [] as Pengadaan[])
    setData(rows ?? [])
    setLoading(false)
  }

  async function handleBuat(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const pengadaan = await api.post<Pengadaan>('/api/pengadaan', {
      judul: form.judul, item: form.item, satuan: form.satuan,
      status: 'aktif', dibuat_oleh_koperasi_id: myKoperasiId,
    }).catch(() => null)
    if (pengadaan) {
      await api.post<void>(`/api/pengadaan/${pengadaan.id}/alokasi`, {
        koperasi_id: myKoperasiId, kebutuhan: parseFloat(form.kebutuhan) || 0, status_rekening: 'terhubung',
      }).catch(() => null)
    }
    setSaving(false); setForm({ judul: '', item: '', satuan: 'kg', kebutuhan: '' })
    setTab('daftar'); loadData()
  }

  async function handleFinalisasi(pengadaanId: string) {
    setSaving(true); setFinalisasiError(null)
    const allocs = await api.get<Alokasi[]>(`/api/pengadaan/${pengadaanId}/alokasi`).catch(() => [] as Alokasi[])
    for (const a of allocs ?? []) {
      await api.put<void>(`/api/pengadaan/${pengadaanId}/alokasi/${a.id}`, { alokasi_dapat: a.kebutuhan }).catch(() => null)
    }
    const err = await api.put<void>(`/api/pengadaan/${pengadaanId}`, { status: 'selesai' }).catch((e: Error) => e)
    if (err instanceof Error) { setFinalisasiError('Gagal memperbarui status: ' + err.message); setSaving(false); return }
    setData(prev => prev.map(p =>
      p.id === pengadaanId
        ? { ...p, status: 'selesai', pengadaan_alokasi: p.pengadaan_alokasi.map(a => ({ ...a, alokasi_dapat: a.kebutuhan })) }
        : p
    ))
    setConfirmId(null); setSaving(false)
  }

  async function handleAjukan(pengadaanId: string) {
    const f = ajukanForm[pengadaanId]
    if (!f?.kebutuhan) return
    setSaving(true)
    const allocs = await api.get<Alokasi[]>(`/api/pengadaan/${pengadaanId}/alokasi`).catch(() => [] as Alokasi[])
    const existing = (allocs ?? []).find(a => a.koperasi_id === myKoperasiId)
    if (existing) {
      await api.put<void>(`/api/pengadaan/${pengadaanId}/alokasi/${existing.id}`, { kebutuhan: parseFloat(f.kebutuhan), status_rekening: f.status_rekening }).catch(() => null)
    } else {
      await api.post<void>(`/api/pengadaan/${pengadaanId}/alokasi`, { koperasi_id: myKoperasiId, kebutuhan: parseFloat(f.kebutuhan), status_rekening: f.status_rekening ?? 'terhubung' }).catch(() => null)
    }
    const total = (allocs ?? []).reduce((s: number, r: Alokasi) => s + (r.kebutuhan ?? 0), 0) + parseFloat(f.kebutuhan)
    await api.put<void>(`/api/pengadaan/${pengadaanId}`, { total_kebutuhan: total }).catch(() => null)
    setSaving(false)
    setAjukanForm(f => ({ ...f, [pengadaanId]: { kebutuhan: '', status_rekening: 'terhubung' } }))
    loadData()
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Pasar</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>Pengadaan bersama antar koperasi</p>
        </div>
        <button onClick={() => setTab('buat')} style={greenBtn}><Plus size={15} /> Buat Pengadaan</button>
      </div>

      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        <button onClick={() => setTab('daftar')} style={tabBtn(tab === 'daftar')}>Daftar Pengadaan</button>
        <button onClick={() => setTab('buat')} style={tabBtn(tab === 'buat')}>Buat Baru</button>
      </div>

      {tab === 'buat' && (
        <form onSubmit={handleBuat} style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(26,71,49,.08)' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>Buat Pengadaan Bersama</h2>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Judul *</label>
              <input required value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                placeholder="Pengadaan Pupuk Urea Juni 2026" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Item *</label>
                <input required value={form.item} onChange={e => setForm(f => ({ ...f, item: e.target.value }))}
                  placeholder="Pupuk Urea" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Satuan</label>
                <select value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))} style={inputStyle}>
                  {['kg', 'sak', 'liter', 'ton', 'karung'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Kebutuhan Koperasi Kamu ({form.satuan})</label>
              <input type="number" min="0" value={form.kebutuhan} onChange={e => setForm(f => ({ ...f, kebutuhan: e.target.value }))}
                placeholder="50" style={inputStyle} />
            </div>
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.4)' }}>
            <button type="submit" disabled={saving}
              style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Membuat...' : 'Buat & Daftarkan Kebutuhan'}
            </button>
          </div>
        </form>
      )}

      {tab === 'daftar' && (
        loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
          </div>
        ) : data.length === 0 ? (
          <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
            <ShoppingBag size={36} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
            <p style={{ fontWeight: 700, color: '#46544b', fontSize: 15 }}>Belum ada pengadaan bersama</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.map(p => {
              const totalKebutuhan = p.pengadaan_alokasi.reduce((s, a) => s + (a.kebutuhan ?? 0), 0)
              const adaBelumTerhubung = p.pengadaan_alokasi.some(a => a.status_rekening === 'belum_terhubung')
              const sudahDaftar = p.pengadaan_alokasi.some(a => a.koperasi_id === myKoperasiId)
              const isExpanded = expandedId === p.id

              return (
                <div key={p.id} style={{ ...glass, borderRadius: 18, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', cursor: 'pointer' }}
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>{p.judul}</p>
                        <p style={{ fontSize: 13, color: '#7a857d', marginTop: 2 }}>{p.item} · {p.koperasi?.nama}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, ...STATUS_PILL[p.status] }}>{p.status}</span>
                        {isExpanded ? <ChevronUp size={14} style={{ color: '#9aa39c' }} /> : <ChevronDown size={14} style={{ color: '#9aa39c' }} />}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#7a857d' }}>Total: <strong style={{ color: '#0f2a1d' }}>{totalKebutuhan} {p.satuan}</strong></span>
                      <span style={{ fontSize: 12, color: '#9aa39c' }}>{p.pengadaan_alokasi.length} koperasi</span>
                      {adaBelumTerhubung && (
                        <span style={{ fontSize: 12, color: '#8a6420', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertTriangle size={12} /> Ada koperasi belum punya rekening
                        </span>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid rgba(26,71,49,.08)', padding: '16px 20px', background: 'rgba(247,244,236,.3)', display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <p style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c' }}>Rekapitulasi Kebutuhan</p>
                      <div style={{ ...glass, borderRadius: 14, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                              {['Koperasi','Kebutuhan','Dapat','Rekening'].map((h, i) => (
                                <th key={h} style={{ ...thStyle, textAlign: i > 0 ? 'center' : 'left' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {p.pengadaan_alokasi.map(a => (
                              <tr key={a.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}>
                                <td style={{ padding: '10px 14px', color: '#46544b', fontWeight: 600 }}>{a.koperasi?.nama ?? '—'}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0f2a1d' }}>{a.kebutuhan} {p.satuan}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center', color: '#9aa39c' }}>{a.alokasi_dapat || '—'}</td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  {a.status_rekening === 'terhubung' ? (
                                    <span style={{ fontSize: 12, color: '#1d7a4d', display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Terhubung</span>
                                  ) : (
                                    <span style={{ fontSize: 12, color: '#c0392b', display: 'inline-flex', alignItems: 'center', gap: 4 }}><AlertTriangle size={11} /> Belum</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                            <tr style={{ borderTop: '2px solid rgba(26,71,49,.1)', background: 'rgba(201,150,58,.06)' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f2a1d' }}>Total</td>
                              <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 800, color: '#8a6420' }}>{totalKebutuhan} {p.satuan}</td>
                              <td colSpan={2} />
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {!sudahDaftar && p.status === 'aktif' && (
                        <div style={{ ...glass, borderRadius: 14, padding: '14px 16px' }}>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d', marginBottom: 10 }}>Daftarkan Kebutuhan Koperasimu</p>
                          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                            <input type="number" min="0" placeholder={`Jumlah (${p.satuan})`}
                              value={ajukanForm[p.id]?.kebutuhan ?? ''}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], kebutuhan: e.target.value } }))}
                              style={{ ...inputStyle, flex: 1 }} />
                            <select value={ajukanForm[p.id]?.status_rekening ?? 'terhubung'}
                              onChange={e => setAjukanForm(f => ({ ...f, [p.id]: { ...f[p.id], status_rekening: e.target.value } }))}
                              style={{ ...inputStyle, flex: 1 }}>
                              <option value="terhubung">Rekening Terhubung</option>
                              <option value="belum_terhubung">Belum Punya Rekening</option>
                            </select>
                          </div>
                          <button onClick={() => handleAjukan(p.id)} disabled={saving || !ajukanForm[p.id]?.kebutuhan}
                            style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '11px', opacity: (saving || !ajukanForm[p.id]?.kebutuhan) ? 0.5 : 1 }}>
                            {saving ? 'Mendaftar...' : 'Ajukan Kebutuhan'}
                          </button>
                        </div>
                      )}

                      {sudahDaftar && (
                        <p style={{ fontSize: 13, color: '#1d7a4d', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle size={13} /> Koperasimu sudah terdaftar di pengadaan ini
                        </p>
                      )}

                      {p.pengadaan_alokasi.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#7a857d', marginBottom: 6 }}>
                            <span>Rekening terhubung</span>
                            <span style={{ fontWeight: 700, color: '#0f2a1d' }}>
                              {p.pengadaan_alokasi.filter(a => a.status_rekening === 'terhubung').length} / {p.pengadaan_alokasi.length} koperasi
                            </span>
                          </div>
                          <div style={{ height: 7, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#2f9e63', borderRadius: 999, transition: 'width .4s', width: `${(p.pengadaan_alokasi.filter(a => a.status_rekening === 'terhubung').length / p.pengadaan_alokasi.length) * 100}%` }} />
                          </div>
                        </div>
                      )}

                      {p.dibuat_oleh_koperasi_id === myKoperasiId && p.status === 'aktif' && confirmId !== p.id && (
                        <button onClick={() => { setConfirmId(p.id); setFinalisasiError(null) }}
                          style={{ width: '100%', background: 'rgba(59,130,246,.12)', color: '#3b7fd4', border: '1px solid rgba(59,130,246,.25)', borderRadius: 12, padding: '11px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
                          Finalisasi & Tetapkan Alokasi
                        </button>
                      )}

                      {confirmId === p.id && p.status === 'aktif' && (
                        <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.25)', borderRadius: 14, padding: '16px 18px' }}>
                          <p style={{ fontSize: 14, fontWeight: 800, color: '#3b7fd4', marginBottom: 8 }}>Konfirmasi Finalisasi</p>
                          <p style={{ fontSize: 13, color: '#46544b', marginBottom: 12, lineHeight: 1.6 }}>
                            Status pengadaan akan diubah menjadi <strong>selesai</strong> dan alokasi untuk setiap koperasi akan ditetapkan. Tindakan ini tidak dapat dibatalkan.
                          </p>
                          {finalisasiError && (
                            <p style={{ fontSize: 12, color: '#c0392b', background: 'rgba(214,87,69,.1)', border: '1px solid rgba(214,87,69,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                              {finalisasiError}
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => handleFinalisasi(p.id)} disabled={saving}
                              style={{ flex: 1, background: '#3b7fd4', color: '#fff', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                              {saving ? 'Memproses...' : 'Ya, Finalisasi'}
                            </button>
                            <button onClick={() => { setConfirmId(null); setFinalisasiError(null) }} disabled={saving}
                              style={{ flex: 1, background: 'transparent', color: '#46544b', border: '1px solid rgba(26,71,49,.18)', borderRadius: 10, padding: '10px', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
                              Batal
                            </button>
                          </div>
                        </div>
                      )}

                      {p.status === 'selesai' && (
                        <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700, color: '#3b7fd4', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle size={14} /> Pengadaan selesai — alokasi sudah ditetapkan
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
