'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { Droplets, Plus, Pencil, CheckCircle } from 'lucide-react'

type Meteran = {
  id: string; koperasi_id: string; anggota_id: string | null
  nama_pelanggan: string; nomor_meteran: string; alamat: string | null
  tarif_per_m3: number; aktif: boolean
}
type Tagihan = {
  id: string; meteran_id: string; bulan: string
  meter_awal: number; meter_akhir: number; pemakaian: number
  jumlah_tagihan: number; status: 'belum_bayar' | 'lunas'
  tanggal_bayar: string | null
  meteran: { nama_pelanggan: string; nomor_meteran: string } | null
}

const BULAN_INI = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
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
const ghostBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,.6)', color: '#1a4731', border: '1px solid rgba(26,71,49,.18)',
  fontWeight: 700, borderRadius: 12, padding: '10px 16px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}
const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '13px 16px', textAlign: 'left', whiteSpace: 'nowrap',
}

export default function AirPage() {
  const [tab, setTab] = useState<'tagihan' | 'meteran'>('tagihan')
  const [meteranList, setMeteranList] = useState<Meteran[]>([])
  const [tagihan, setTagihan] = useState<Tagihan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterBulan, setFilterBulan] = useState(BULAN_INI)
  const [showMeteranForm, setShowMeteranForm] = useState(false)
  const [showTagihanForm, setShowTagihanForm] = useState(false)
  const [editMeteranId, setEditMeteranId] = useState<string | null>(null)
  const [formMeteran, setFormMeteran] = useState({ nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500' })
  const [formTagihan, setFormTagihan] = useState({ meteran_id: '', bulan: BULAN_INI, meter_awal: '', meter_akhir: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [m, t] = await Promise.all([
      api.get<Meteran[]>('/api/air/meteran').catch(() => [] as Meteran[]),
      api.get<Tagihan[]>('/api/air/tagihan').catch(() => [] as Tagihan[]),
    ])
    setMeteranList(m ?? [])
    setTagihan((t ?? []) as Tagihan[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const interval = setInterval(() => load(), 30_000)
    return () => clearInterval(interval)
  }, [load])

  async function handleSaveMeteran(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const me = await getMe()
    const payload = {
      nama_pelanggan: formMeteran.nama_pelanggan, nomor_meteran: formMeteran.nomor_meteran,
      alamat: formMeteran.alamat || null, tarif_per_m3: parseInt(formMeteran.tarif_per_m3) || 1500,
    }
    if (editMeteranId) {
      await api.put<void>(`/api/air/meteran/${editMeteranId}`, payload).catch(() => null)
    } else {
      await api.post<void>('/api/air/meteran', { ...payload, koperasi_id: me?.koperasi_id }).catch(() => null)
    }
    setSaving(false); setShowMeteranForm(false); setEditMeteranId(null)
    setFormMeteran({ nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500' })
    load()
  }

  async function handleInputTagihan(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const meteran = meteranList.find(m => m.id === formTagihan.meteran_id)
    if (!meteran) { setSaving(false); return }
    const awal = parseFloat(formTagihan.meter_awal)
    const akhir = parseFloat(formTagihan.meter_akhir)
    const pemakaian = akhir - awal
    const tagihan_amount = Math.round(pemakaian * meteran.tarif_per_m3)
    const me = await getMe()
    const existingList = await api.get<Tagihan[]>(`/api/air/tagihan?meteran_id=${formTagihan.meteran_id}&bulan=${formTagihan.bulan}`).catch(() => [] as Tagihan[])
    const existing = existingList?.[0] ?? null
    if (existing) {
      await api.put<void>(`/api/air/tagihan/${existing.id}`, { meter_awal: awal, meter_akhir: akhir, jumlah_tagihan: tagihan_amount }).catch(() => null)
    } else {
      await api.post<void>('/api/air/tagihan', {
        koperasi_id: me?.koperasi_id, meteran_id: formTagihan.meteran_id, bulan: formTagihan.bulan,
        meter_awal: awal, meter_akhir: akhir, jumlah_tagihan: tagihan_amount, status: 'belum_bayar',
      }).catch(() => null)
    }
    setSaving(false); setShowTagihanForm(false)
    setFormTagihan({ meteran_id: '', bulan: BULAN_INI, meter_awal: '', meter_akhir: '' })
    load()
  }

  async function handleBayar(id: string) {
    await api.put<void>(`/api/air/tagihan/${id}`, { status: 'lunas', tanggal_bayar: new Date().toISOString().split('T')[0] }).catch(() => null)
    load()
  }

  function openEditMeteran(m: Meteran) {
    setEditMeteranId(m.id)
    setFormMeteran({ nama_pelanggan: m.nama_pelanggan, nomor_meteran: m.nomor_meteran, alamat: m.alamat ?? '', tarif_per_m3: m.tarif_per_m3.toString() })
    setShowMeteranForm(true); setTab('meteran')
  }

  const filteredTagihan = filterBulan ? tagihan.filter(t => t.bulan === filterBulan) : tagihan
  const belumBayar = filteredTagihan.filter(t => t.status === 'belum_bayar')
  const totalTagihan = filteredTagihan.reduce((s, t) => s + t.jumlah_tagihan, 0)
  const totalTerbayar = filteredTagihan.filter(t => t.status === 'lunas').reduce((s, t) => s + t.jumlah_tagihan, 0)
  const bulanOptions = [...new Set(tagihan.map(t => t.bulan))].sort().reverse()

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  const filterBtn = (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: 'none',
    background: active ? '#1a4731' : 'rgba(255,255,255,.7)', color: active ? '#fff' : '#46544b',
    borderWidth: 1, borderStyle: 'solid', borderColor: active ? '#1a4731' : 'rgba(26,71,49,.14)',
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Utilitas Air</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>{meteranList.length} pelanggan terdaftar</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowTagihanForm(true); setShowMeteranForm(false); setTab('tagihan') }} style={ghostBtn}>
            <Plus size={15} /> Input Bacaan
          </button>
          <button onClick={() => {
            setShowMeteranForm(true); setShowTagihanForm(false); setTab('meteran')
            setEditMeteranId(null); setFormMeteran({ nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500' })
          }} style={greenBtn}>
            <Plus size={15} /> Pelanggan
          </button>
        </div>
      </div>

      {/* Stat cards */}
      {filteredTagihan.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
          <div style={{ ...glass, borderRadius: 18, padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Total Tagihan</p>
            <p style={{ fontSize: 21, fontWeight: 800, color: '#0f2a1d' }}>Rp {totalTagihan.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ ...glass, borderRadius: 18, padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Sudah Terbayar</p>
            <p style={{ fontSize: 21, fontWeight: 800, color: '#1d7a4d' }}>Rp {totalTerbayar.toLocaleString('id-ID')}</p>
          </div>
          <div style={{ background: belumBayar.length > 0 ? 'rgba(214,87,69,.1)' : 'rgba(255,255,255,.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: belumBayar.length > 0 ? '1px solid rgba(214,87,69,.25)' : '1px solid rgba(255,255,255,.7)', boxShadow: '0 10px 26px rgba(26,71,49,.08)', borderRadius: 18, padding: '16px 20px' }}>
            <p style={{ fontSize: 12, color: '#9aa39c', marginBottom: 6 }}>Belum Bayar</p>
            <p style={{ fontSize: 21, fontWeight: 800, color: belumBayar.length > 0 ? '#c0392b' : '#9aa39c' }}>{belumBayar.length} pelanggan</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        <button onClick={() => setTab('tagihan')} style={tabBtn(tab === 'tagihan')}>Tagihan</button>
        <button onClick={() => setTab('meteran')} style={tabBtn(tab === 'meteran')}>Data Meteran</button>
      </div>

      {/* TAGIHAN TAB */}
      {tab === 'tagihan' && showTagihanForm && (
        <form onSubmit={handleInputTagihan} style={{ ...glass, borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>Input Bacaan Meteran</h2>
            <button type="button" onClick={() => setShowTagihanForm(false)} style={{ background: 'none', border: 'none', color: '#7a857d', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Batal</button>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Pelanggan *</label>
              <select required value={formTagihan.meteran_id} onChange={e => setFormTagihan(f => ({ ...f, meteran_id: e.target.value }))} style={inputStyle}>
                <option value="">Pilih pelanggan...</option>
                {meteranList.filter(m => m.aktif).map(m => <option key={m.id} value={m.id}>{m.nama_pelanggan} ({m.nomor_meteran})</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Bulan</label>
                <input type="month" value={formTagihan.bulan} onChange={e => setFormTagihan(f => ({ ...f, bulan: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Meter Awal (m3) *</label>
                <input required type="number" min="0" step="0.1" value={formTagihan.meter_awal}
                  onChange={e => setFormTagihan(f => ({ ...f, meter_awal: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Meter Akhir (m3) *</label>
                <input required type="number" min="0" step="0.1" value={formTagihan.meter_akhir}
                  onChange={e => setFormTagihan(f => ({ ...f, meter_akhir: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            {formTagihan.meter_awal && formTagihan.meter_akhir && formTagihan.meteran_id && (() => {
              const meteran = meteranList.find(m => m.id === formTagihan.meteran_id)
              const pemakaian = parseFloat(formTagihan.meter_akhir) - parseFloat(formTagihan.meter_awal)
              const tagihan_amount = Math.round(pemakaian * (meteran?.tarif_per_m3 ?? 1500))
              return pemakaian >= 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.1)', borderRadius: 12, padding: '12px 16px' }}>
                  <div>
                    <p style={{ fontSize: 12, color: '#9aa39c' }}>Pemakaian</p>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#0f2a1d', marginTop: 2 }}>{pemakaian.toFixed(1)} m3</p>
                  </div>
                  <div>
                    <p style={{ fontSize: 12, color: '#9aa39c' }}>Total Tagihan</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#1a4731', marginTop: 2 }}>Rp {tagihan_amount.toLocaleString('id-ID')}</p>
                  </div>
                </div>
              ) : null
            })()}
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.4)' }}>
            <button type="submit" disabled={saving}
              style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Menyimpan...' : 'Simpan Tagihan'}
            </button>
          </div>
        </form>
      )}

      {tab === 'tagihan' && !showTagihanForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#9aa39c' }}>Filter:</span>
            <button style={filterBtn(filterBulan === BULAN_INI)} onClick={() => setFilterBulan(BULAN_INI)}>Bulan Ini</button>
            {bulanOptions.filter(b => b !== BULAN_INI).slice(0, 3).map(b => (
              <button key={b} style={filterBtn(filterBulan === b)} onClick={() => setFilterBulan(filterBulan === b ? '' : b)}>{b}</button>
            ))}
            <button style={filterBtn(!filterBulan)} onClick={() => setFilterBulan('')}>Semua</button>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
            </div>
          ) : filteredTagihan.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
              <Droplets size={36} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
              <p style={{ fontWeight: 700, color: '#46544b' }}>Belum ada tagihan</p>
              <p style={{ fontSize: 13, color: '#9aa39c', marginTop: 4 }}>Klik &ldquo;+ Input Bacaan&rdquo; untuk mencatat</p>
            </div>
          ) : (
            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                      {['Pelanggan','Bulan','Pemakaian','Tagihan','Status',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTagihan.map(t => (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <td style={{ padding: '13px 16px' }}>
                          <p style={{ fontWeight: 700, color: '#0f2a1d' }}>{t.meteran?.nama_pelanggan ?? '—'}</p>
                          <p style={{ fontSize: 12, color: '#9aa39c' }}>{t.meteran?.nomor_meteran}</p>
                        </td>
                        <td style={{ padding: '13px 16px', color: '#46544b' }}>{t.bulan}</td>
                        <td style={{ padding: '13px 16px', color: '#46544b', textAlign: 'right' }}>{t.pemakaian} m3</td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 700, color: '#0f2a1d' }}>Rp {t.jumlah_tagihan.toLocaleString('id-ID')}</span>
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                          {t.status === 'lunas' ? (
                            <div>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#1d7a4d', background: 'rgba(47,158,99,.14)', border: '1px solid rgba(47,158,99,.3)', padding: '3px 10px', borderRadius: 999 }}>Lunas</span>
                              {t.tanggal_bayar && <p style={{ fontSize: 11, color: '#9aa39c', marginTop: 3 }}>{new Date(t.tanggal_bayar).toLocaleDateString('id-ID')}</p>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', background: 'rgba(214,87,69,.12)', border: '1px solid rgba(214,87,69,.28)', padding: '3px 10px', borderRadius: 999 }}>Belum Bayar</span>
                          )}
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          {t.status === 'belum_bayar' && (
                            <button onClick={() => handleBayar(t.id)}
                              style={{ background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 8, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                              <CheckCircle size={12} /> Tandai Lunas
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* METERAN TAB */}
      {tab === 'meteran' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {showMeteranForm && (
            <form onSubmit={handleSaveMeteran} style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(26,71,49,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontSize: 14.5, fontWeight: 800, color: '#0f2a1d' }}>{editMeteranId ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h2>
                <button type="button" onClick={() => setShowMeteranForm(false)} style={{ background: 'none', border: 'none', color: '#7a857d', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              </div>
              <div style={{ padding: '18px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nama Pelanggan *</label>
                  <input required value={formMeteran.nama_pelanggan} onChange={e => setFormMeteran(f => ({ ...f, nama_pelanggan: e.target.value }))}
                    placeholder="Pak Ahmad" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>No. Meteran *</label>
                  <input required value={formMeteran.nomor_meteran} onChange={e => setFormMeteran(f => ({ ...f, nomor_meteran: e.target.value }))}
                    placeholder="M-001" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Alamat</label>
                  <input value={formMeteran.alamat} onChange={e => setFormMeteran(f => ({ ...f, alamat: e.target.value }))}
                    placeholder="RT 03 / RW 01" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tarif per m3 (Rp)</label>
                  <input type="number" min="0" value={formMeteran.tarif_per_m3}
                    onChange={e => setFormMeteran(f => ({ ...f, tarif_per_m3: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.4)' }}>
                <button type="submit" disabled={saving}
                  style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '12px', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          )}

          {meteranList.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
              <Droplets size={36} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
              <p style={{ fontWeight: 700, color: '#46544b' }}>Belum ada pelanggan</p>
              <p style={{ fontSize: 13, color: '#9aa39c', marginTop: 4 }}>Klik &ldquo;+ Pelanggan&rdquo; untuk tambah</p>
            </div>
          ) : (
            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                      {['Pelanggan','No. Meteran','Alamat','Tarif/m3','Status',''].map(h => <th key={h} style={thStyle}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {meteranList.map(m => (
                      <tr key={m.id} style={{ borderBottom: '1px solid rgba(26,71,49,.05)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <td style={{ padding: '13px 16px', fontWeight: 700, color: '#0f2a1d' }}>{m.nama_pelanggan}</td>
                        <td style={{ padding: '13px 16px', color: '#46544b', fontFamily: 'monospace', fontSize: 12 }}>{m.nomor_meteran}</td>
                        <td style={{ padding: '13px 16px', color: '#9aa39c', fontSize: 12 }}>{m.alamat ?? '—'}</td>
                        <td style={{ padding: '13px 16px', color: '#46544b', fontSize: 12, textAlign: 'right' }}>Rp {m.tarif_per_m3.toLocaleString('id-ID')}</td>
                        <td style={{ padding: '13px 16px', textAlign: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, ...(m.aktif ? { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' } : { background: 'rgba(26,71,49,.07)', color: '#46544b', border: '1px solid rgba(26,71,49,.12)' }) }}>
                            {m.aktif ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td style={{ padding: '13px 16px', textAlign: 'right' }}>
                          <button onClick={() => openEditMeteran(m)}
                            style={{ background: 'none', border: 'none', color: '#9aa39c', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600 }}>
                            <Pencil size={13} /> Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
