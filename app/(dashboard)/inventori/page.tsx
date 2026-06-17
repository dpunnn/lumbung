'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { Package, Plus, Pencil, Trash2, AlertTriangle, Calendar, Truck, Star } from 'lucide-react'

type Item = {
  id: string
  koperasi_id: string
  nama: string
  kategori: string
  stok: number
  satuan: string
  harga_beli: number
  harga_jual: number
  batas_minimum: number
  kadaluwarsa: string | null
  lokasi: string | null
  keterangan: string | null
  updated_at: string
}

type BatchPenerimaan = {
  id: string
  item_nama: string
  satuan: string
  jumlah: number
  mutu: 'bagus' | 'layak' | 'layu'
  tanggal_terima: string
  offtaker: string
  catatan: string
  status: 'menunggu' | 'dijadwalkan' | 'terkirim'
  jadwal_kirim: string | null
}

const KATEGORI = ['umum', 'sayuran', 'buah', 'beras', 'pupuk', 'obat', 'pakan', 'alat', 'elektronik', 'lainnya']

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

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
})
const badgeOk = pill('rgba(47,158,99,.14)', '#1d7a4d', 'rgba(47,158,99,.3)')
const badgeWarn = pill('rgba(201,150,58,.14)', '#8a6420', 'rgba(201,150,58,.3)')
const badgeErr = pill('rgba(214,87,69,.12)', '#c0392b', 'rgba(214,87,69,.28)')
const badgeBlue = pill('rgba(59,130,246,.1)', '#3b82f6', 'rgba(59,130,246,.25)')
const badgeNeutral = pill('rgba(26,71,49,.07)', '#46544b', 'rgba(26,71,49,.12)')

const MUTU_BADGE: Record<BatchPenerimaan['mutu'], React.CSSProperties> = {
  bagus: badgeOk, layak: badgeWarn, layu: badgeErr,
}
const STATUS_BATCH_BADGE: Record<BatchPenerimaan['status'], React.CSSProperties> = {
  menunggu: badgeNeutral, dijadwalkan: badgeBlue, terkirim: badgeOk,
}

function daysUntilExpiry(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return null
  const days = daysUntilExpiry(date)!
  if (days < 0) return <span style={badgeErr}>Kedaluwarsa</span>
  if (days <= 3) return <span style={{ ...badgeErr, animation: 'lmbBlink 1s ease-in-out infinite' }}>{days}h lagi</span>
  if (days <= 7) return <span style={badgeWarn}>{days}h</span>
  return <span style={{ fontSize: 12, color: '#9aa39c' }}>{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
}

export default function InventoriPage() {
  const [pageTab, setPageTab] = useState<'inventori' | 'jadwal'>('inventori')

  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterKat, setFilterKat] = useState('')
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({
    nama: '', kategori: 'umum', stok: '', satuan: 'pcs',
    harga_beli: '', harga_jual: '', batas_minimum: '',
    kadaluwarsa: '', lokasi: '', keterangan: '',
  })

  const [batches, setBatches] = useState<BatchPenerimaan[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('lumbung_batches') ?? '[]') } catch { return [] }
  })
  const [showBatchForm, setShowBatchForm] = useState(false)
  const [batchForm, setBatchForm] = useState({
    item_nama: '', satuan: 'kg', jumlah: '', mutu: 'bagus' as BatchPenerimaan['mutu'],
    tanggal_terima: new Date().toISOString().split('T')[0], offtaker: '', catatan: '',
  })
  const [jadwalInput, setJadwalInput] = useState<Record<string, string>>({})

  useEffect(() => {
    localStorage.setItem('lumbung_batches', JSON.stringify(batches))
  }, [batches])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.get<Item[]>('/api/stok').catch(() => [] as Item[])
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    // Polling pengganti realtime Supabase channel (inventori-rt)
    const interval = setInterval(() => load(), 30_000)
    return () => clearInterval(interval)
  }, [load])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function openTambah() {
    setEditId(null)
    setForm({ nama: '', kategori: 'umum', stok: '', satuan: 'pcs', harga_beli: '', harga_jual: '', batas_minimum: '', kadaluwarsa: '', lokasi: '', keterangan: '' })
    setShowForm(true)
  }

  function openEdit(item: Item) {
    setEditId(item.id)
    setForm({
      nama: item.nama, kategori: item.kategori, stok: item.stok.toString(),
      satuan: item.satuan, harga_beli: item.harga_beli.toString(),
      harga_jual: item.harga_jual.toString(), batas_minimum: item.batas_minimum.toString(),
      kadaluwarsa: item.kadaluwarsa ?? '', lokasi: item.lokasi ?? '', keterangan: item.keterangan ?? '',
    })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const me = await getMe()

    const payload = {
      nama: form.nama, kategori: form.kategori,
      stok: parseFloat(form.stok) || 0, satuan: form.satuan,
      harga_beli: parseInt(form.harga_beli) || 0,
      harga_jual: parseInt(form.harga_jual) || 0,
      batas_minimum: parseFloat(form.batas_minimum) || 0,
      kadaluwarsa: form.kadaluwarsa || null, lokasi: form.lokasi || null,
      keterangan: form.keterangan || null, updated_at: new Date().toISOString(),
    }

    if (editId) {
      await api.put<void>(`/api/stok/${editId}`, payload).catch(() => null)
    } else {
      await api.post<void>('/api/stok', { ...payload, koperasi_id: me?.koperasi_id }).catch(() => null)
    }

    setSaving(false)
    setShowForm(false)
    setEditId(null)
    load()
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus item ini?')) return
    await api.delete<void>(`/api/stok/${id}`).catch(() => null)
    load()
  }

  function handleTambahBatch(e: React.FormEvent) {
    e.preventDefault()
    const newBatch: BatchPenerimaan = {
      id: crypto.randomUUID(),
      item_nama: batchForm.item_nama,
      satuan: batchForm.satuan,
      jumlah: parseFloat(batchForm.jumlah) || 0,
      mutu: batchForm.mutu,
      tanggal_terima: batchForm.tanggal_terima,
      offtaker: batchForm.offtaker,
      catatan: batchForm.catatan,
      status: 'menunggu',
      jadwal_kirim: null,
    }
    setBatches(bs => [newBatch, ...bs])
    setBatchForm({ item_nama: '', satuan: 'kg', jumlah: '', mutu: 'bagus', tanggal_terima: new Date().toISOString().split('T')[0], offtaker: '', catatan: '' })
    setShowBatchForm(false)
  }

  function setBatchStatus(id: string, status: BatchPenerimaan['status']) {
    setBatches(bs => bs.map(b => b.id === id ? { ...b, status } : b))
  }

  function setBatchJadwal(id: string) {
    const tgl = jadwalInput[id]
    if (!tgl) return
    setBatches(bs => bs.map(b => b.id === id ? { ...b, jadwal_kirim: tgl, status: 'dijadwalkan' } : b))
    setJadwalInput(j => ({ ...j, [id]: '' }))
  }

  function hapusBatch(id: string) {
    if (!confirm('Hapus catatan batch ini?')) return
    setBatches(bs => bs.filter(b => b.id !== id))
  }

  const filtered = items.filter(i => {
    if (filterKat && i.kategori !== filterKat) return false
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowStock = items.filter(i => i.batas_minimum > 0 && i.stok <= i.batas_minimum)
  const expiringSoon = items.filter(i => { const d = daysUntilExpiry(i.kadaluwarsa); return d !== null && d <= 7 })
  const rupiah = (n: number) => n > 0 ? 'Rp ' + n.toLocaleString('id-ID') : '—'

  const batchMenunggu = batches.filter(b => b.status === 'menunggu').length
  const batchDijadwalkan = batches.filter(b => b.status === 'dijadwalkan').length

  const filterChip = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '6px 13px', borderRadius: 10, cursor: 'pointer', textTransform: 'capitalize',
    border: active ? '1px solid #1a4731' : '1px solid rgba(26,71,49,.16)',
    background: active ? 'linear-gradient(150deg,#1a4731,#0f2a1d)' : 'rgba(255,255,255,.6)',
    color: active ? '#fff' : '#46544b', fontWeight: active ? 700 : 600,
  })

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Inventori & Jadwal Panen</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>{items.length} item terdaftar · {batches.length} catatan batch</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pageTab === 'inventori' && (
            <button onClick={openTambah} style={greenBtn}>
              <Plus size={16} /> Tambah Item
            </button>
          )}
          {pageTab === 'jadwal' && (
            <button onClick={() => setShowBatchForm(true)} style={greenBtn}>
              <Plus size={16} /> Catat Penerimaan
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        <button onClick={() => setPageTab('inventori')}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
            background: pageTab === 'inventori' ? '#fff' : 'transparent',
            color: pageTab === 'inventori' ? '#0f2a1d' : '#7a857d',
            fontWeight: pageTab === 'inventori' ? 700 : 600,
            boxShadow: pageTab === 'inventori' ? '0 2px 8px rgba(26,71,49,.1)' : 'none' }}>
          <Package size={14} /> Stok
        </button>
        <button onClick={() => setPageTab('jadwal')}
          style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
            background: pageTab === 'jadwal' ? '#fff' : 'transparent',
            color: pageTab === 'jadwal' ? '#0f2a1d' : '#7a857d',
            fontWeight: pageTab === 'jadwal' ? 700 : 600,
            boxShadow: pageTab === 'jadwal' ? '0 2px 8px rgba(26,71,49,.1)' : 'none' }}>
          <Calendar size={14} /> Jadwal Panen
          {batchMenunggu > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#d65745', color: '#fff', fontSize: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              {batchMenunggu}
            </span>
          )}
        </button>
      </div>

      {pageTab === 'inventori' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {lowStock.length > 0 && (
            <div style={{ background: 'rgba(214,87,69,.1)', border: '1px solid rgba(214,87,69,.22)', borderLeft: '4px solid #d65745', borderRadius: 15, padding: '13px 16px' }}>
              <p style={{ color: '#c0392b', fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Stok Menipis</p>
              <p style={{ color: '#c0392b', fontSize: 12, marginTop: 2 }}>{lowStock.map(i => `${i.nama} (${i.stok} ${i.satuan})`).join(' · ')}</p>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div style={{ background: 'rgba(201,150,58,.1)', border: '1px solid rgba(201,150,58,.24)', borderLeft: '4px solid #c9963a', borderRadius: 15, padding: '13px 16px' }}>
              <p style={{ color: '#8a6420', fontSize: 13.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} /> Segera Kedaluwarsa</p>
              <p style={{ color: '#8a6420', fontSize: 12, marginTop: 2 }}>
                {expiringSoon.map(i => { const d = daysUntilExpiry(i.kadaluwarsa); return `${i.nama} (${d! < 0 ? 'sudah lewat' : d + ' hari lagi'})` }).join(' · ')}
              </p>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSave} style={{ ...glass, borderRadius: 18, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: '#0f2a1d', fontWeight: 800, fontSize: 15 }}>{editId ? 'Edit Item' : 'Tambah Item Inventori'}</h2>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: '#7a857d', fontSize: 13.5, cursor: 'pointer' }}>Batal</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Nama Item *</label>
                  <input required value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Wortel Lokal" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Kategori</label>
                  <select value={form.kategori} onChange={e => set('kategori', e.target.value)} style={inputStyle}>
                    {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Stok *</label>
                  <input required type="number" min="0" step="0.1" value={form.stok} onChange={e => set('stok', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Satuan</label>
                  <select value={form.satuan} onChange={e => set('satuan', e.target.value)} style={inputStyle}>
                    {['pcs', 'kg', 'gram', 'liter', 'ml', 'karung', 'sak', 'box', 'lusin'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Harga Beli (Rp)</label>
                  <input type="number" min="0" value={form.harga_beli} onChange={e => set('harga_beli', e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Harga Jual (Rp)</label>
                  <input type="number" min="0" value={form.harga_jual} onChange={e => set('harga_jual', e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Batas Minimum Stok</label>
                  <input type="number" min="0" step="0.1" value={form.batas_minimum} onChange={e => set('batas_minimum', e.target.value)} placeholder="0" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Kedaluwarsa</label>
                  <input type="date" value={form.kadaluwarsa} onChange={e => set('kadaluwarsa', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Lokasi / Rak</label>
                  <input value={form.lokasi} onChange={e => set('lokasi', e.target.value)} placeholder="Rak A-3 / Cold Room 1" style={inputStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Keterangan</label>
                  <input value={form.keterangan} onChange={e => set('keterangan', e.target.value)} placeholder="Opsional" style={inputStyle} />
                </div>
              </div>
              <button type="submit" disabled={saving} style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '11px 18px', opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama item..."
              style={{ ...inputStyle, width: 176, padding: '7px 12px' }} />
            <button onClick={() => setFilterKat('')} style={filterChip(!filterKat)}>Semua</button>
            {[...new Set(items.map(i => i.kategori))].map(k => (
              <button key={k} onClick={() => setFilterKat(filterKat === k ? '' : k)} style={filterChip(filterKat === k)}>
                {k}
              </button>
            ))}
            <span style={{ color: '#9aa39c', fontSize: 12, marginLeft: 'auto' }}>{filtered.length} item</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#7a857d', ...glass, borderRadius: 20 }}>
              <Package size={40} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
              <p style={{ fontSize: 13.5 }}>{items.length === 0 ? 'Belum ada item. Klik "+ Tambah Item".' : 'Tidak ada item yang cocok.'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              {filtered.map(item => {
                const isLow = item.batas_minimum > 0 && item.stok <= item.batas_minimum
                const expiryDays = daysUntilExpiry(item.kadaluwarsa)
                const isExpired = expiryDays !== null && expiryDays < 0
                const isExpiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 7

                const kondisi = isExpired ? 'Kedaluwarsa' : isLow ? 'Menipis' : isExpiringSoon ? 'Periksa' : 'Baik'
                const kondStyle: React.CSSProperties = isExpired || isLow ? badgeErr : isExpiringSoon ? badgeWarn : badgeOk

                return (
                  <div key={item.id} style={{ ...glass, borderRadius: 18, padding: 20, opacity: isExpired ? 0.72 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 14, background: 'rgba(26,71,49,.08)', color: '#1a4731', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, flexShrink: 0 }}>
                        {item.stok}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.nama}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <span style={{ fontSize: 11.5, color: '#46544b', textTransform: 'capitalize', background: 'rgba(26,71,49,.07)', padding: '2px 8px', borderRadius: 7, border: '1px solid rgba(26,71,49,.1)' }}>{item.kategori}</span>
                          {item.kadaluwarsa && <ExpiryBadge date={item.kadaluwarsa} />}
                        </div>
                      </div>
                      <span style={kondStyle}>{kondisi}</span>
                    </div>

                    {(item.harga_jual > 0 || item.lokasi || item.keterangan) && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(26,71,49,.07)', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', fontSize: 12, color: '#7a857d' }}>
                        {item.harga_jual > 0 && <span>{rupiah(item.harga_jual)} / {item.satuan}</span>}
                        {item.lokasi && <span>{item.lokasi}</span>}
                        {item.keterangan && <span style={{ fontStyle: 'italic' }}>{item.keterangan}</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button onClick={() => openEdit(item)}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#1a4731', background: 'rgba(26,71,49,.07)', border: 'none', padding: '7px 0', borderRadius: 9, cursor: 'pointer' }}>
                        <Pencil size={13} /> Edit
                      </button>
                      <button onClick={() => handleHapus(item.id)}
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: 12.5, fontWeight: 700, color: '#c0392b', background: 'rgba(214,87,69,.06)', border: 'none', padding: '7px 0', borderRadius: 9, cursor: 'pointer' }}>
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {pageTab === 'jadwal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <div style={{ ...glass, borderRadius: 18, padding: 18 }}>
              <p style={{ color: '#7a857d', fontSize: 12 }}>Total Batch</p>
              <p style={{ color: '#0f2a1d', fontSize: 24, fontWeight: 800 }}>{batches.length}</p>
            </div>
            <div style={{ ...glass, borderRadius: 18, padding: 18, ...(batchMenunggu > 0 ? { background: 'rgba(201,150,58,.1)', border: '1px solid rgba(201,150,58,.24)' } : {}) }}>
              <p style={{ color: '#7a857d', fontSize: 12 }}>Menunggu Jadwal</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: batchMenunggu > 0 ? '#8a6420' : '#0f2a1d' }}>{batchMenunggu}</p>
            </div>
            <div style={{ ...glass, borderRadius: 18, padding: 18, ...(batchDijadwalkan > 0 ? { background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)' } : {}) }}>
              <p style={{ color: '#7a857d', fontSize: 12 }}>Dijadwalkan Kirim</p>
              <p style={{ fontSize: 24, fontWeight: 800, color: batchDijadwalkan > 0 ? '#3b82f6' : '#0f2a1d' }}>{batchDijadwalkan}</p>
            </div>
          </div>

          {showBatchForm && (
            <form onSubmit={handleTambahBatch} style={{ ...glass, borderRadius: 18, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: '#0f2a1d', fontWeight: 800, fontSize: 15 }}>Catat Penerimaan Hasil Panen</h2>
                <button type="button" onClick={() => setShowBatchForm(false)} style={{ background: 'transparent', border: 'none', color: '#7a857d', fontSize: 13.5, cursor: 'pointer' }}>Batal</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Komoditas *</label>
                  <input
                    list="item-list" required
                    value={batchForm.item_nama}
                    onChange={e => setBatchForm(f => ({ ...f, item_nama: e.target.value }))}
                    placeholder="Cabai Merah / Beras / Wortel..."
                    style={inputStyle} />
                  <datalist id="item-list">
                    {items.map(i => <option key={i.id} value={i.nama} />)}
                  </datalist>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Mutu Panen *</label>
                  <select value={batchForm.mutu} onChange={e => setBatchForm(f => ({ ...f, mutu: e.target.value as BatchPenerimaan['mutu'] }))} style={inputStyle}>
                    <option value="bagus">Bagus — siap ekspor / pasar swalayan</option>
                    <option value="layak">Layak — pasar lokal / pengepul</option>
                    <option value="layu">Layu — perlu segera dijual / olah</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Jumlah *</label>
                  <input required type="number" min="0" step="0.1" value={batchForm.jumlah}
                    onChange={e => setBatchForm(f => ({ ...f, jumlah: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Satuan</label>
                  <select value={batchForm.satuan} onChange={e => setBatchForm(f => ({ ...f, satuan: e.target.value }))} style={inputStyle}>
                    {['kg', 'ton', 'karung', 'sak', 'liter', 'pcs'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Tanggal Terima *</label>
                  <input required type="date" value={batchForm.tanggal_terima}
                    onChange={e => setBatchForm(f => ({ ...f, tanggal_terima: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Offtaker / Pembeli</label>
                  <input value={batchForm.offtaker} placeholder="PT Indofood / Pasar Wage / ..."
                    onChange={e => setBatchForm(f => ({ ...f, offtaker: e.target.value }))} style={inputStyle} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={labelStyle}>Catatan</label>
                  <input value={batchForm.catatan} placeholder="Opsional — kondisi khusus, re-alokasi, dll"
                    onChange={e => setBatchForm(f => ({ ...f, catatan: e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <button type="submit" style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '11px 18px' }}>
                Simpan Penerimaan
              </button>
            </form>
          )}

          {batches.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#7a857d', ...glass, borderRadius: 20 }}>
              <Calendar size={40} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
              <p style={{ fontWeight: 700, color: '#46544b' }}>Belum ada catatan penerimaan hasil panen.</p>
              <p style={{ fontSize: 13.5, marginTop: 4 }}>Klik "+ Catat Penerimaan" untuk mulai mencatat batch masuk.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {batches.map(b => {
                const accent = b.mutu === 'layu' ? '#d65745' : b.mutu === 'layak' ? '#c9963a' : '#2f9e63'
                return (
                  <div key={b.id} style={{ ...glass, borderRadius: 18, overflow: 'hidden', borderLeft: `4px solid ${accent}` }}>
                    <div style={{ padding: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div>
                          <p style={{ color: '#0f2a1d', fontWeight: 800, fontSize: 14 }}>{b.item_nama}</p>
                          <p style={{ color: '#46544b', fontSize: 13 }}>{b.jumlah} {b.satuan} · Diterima {new Date(b.tanggal_terima).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          {b.offtaker && <p style={{ color: '#9aa39c', fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Truck size={12} /> {b.offtaker}</p>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <span style={{ ...MUTU_BADGE[b.mutu], textTransform: 'capitalize' }}>
                            <Star size={12} style={{ display: 'inline', marginRight: 2, verticalAlign: 'middle' }} />{b.mutu}
                          </span>
                          <span style={{ ...STATUS_BATCH_BADGE[b.status], textTransform: 'capitalize' }}>
                            {b.status}
                          </span>
                        </div>
                      </div>

                      {b.catatan && <p style={{ color: '#9aa39c', fontSize: 12, fontStyle: 'italic', marginBottom: 8 }}>{b.catatan}</p>}

                      {b.status === 'menunggu' && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                          <input type="date" value={jadwalInput[b.id] ?? ''}
                            onChange={e => setJadwalInput(j => ({ ...j, [b.id]: e.target.value }))}
                            style={{ ...inputStyle, flex: 1, padding: '7px 12px' }} />
                          <button onClick={() => setBatchJadwal(b.id)} disabled={!jadwalInput[b.id]}
                            style={{ background: '#3b82f6', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, padding: '8px 14px', borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap', opacity: !jadwalInput[b.id] ? 0.4 : 1 }}>
                            Jadwalkan Kirim
                          </button>
                        </div>
                      )}

                      {b.status === 'dijadwalkan' && b.jadwal_kirim && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                          <p style={{ color: '#3b82f6', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={14} />
                            Dijadwalkan kirim: <strong>{new Date(b.jadwal_kirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                          </p>
                          <button onClick={() => setBatchStatus(b.id, 'terkirim')}
                            style={{ background: 'linear-gradient(150deg,#2f9e63,#1d7a4d)', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700, padding: '7px 13px', borderRadius: 10, cursor: 'pointer' }}>
                            Tandai Terkirim
                          </button>
                        </div>
                      )}

                      {b.status === 'terkirim' && (
                        <p style={{ color: '#1d7a4d', fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>✓</span> Sudah terkirim ke {b.offtaker || 'pembeli'}
                          {b.jadwal_kirim && ` · ${new Date(b.jadwal_kirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                        </p>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button onClick={() => hapusBatch(b.id)} style={{ background: 'transparent', border: 'none', color: '#c4ccc6', cursor: 'pointer' }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
