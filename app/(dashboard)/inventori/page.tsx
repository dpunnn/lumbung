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

const MUTU_STYLE: Record<BatchPenerimaan['mutu'], string> = {
  bagus: 'bg-green-50 text-green-700 border-green-200',
  layak: 'bg-amber-50 text-amber-700 border-amber-200',
  layu:  'bg-red-50 text-red-600 border-red-200',
}

const STATUS_BATCH_STYLE: Record<BatchPenerimaan['status'], string> = {
  menunggu:    'bg-stone-100 text-stone-600 border-stone-200',
  dijadwalkan: 'bg-blue-50 text-blue-700 border-blue-200',
  terkirim:    'bg-green-50 text-green-700 border-green-200',
}

function daysUntilExpiry(date: string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function ExpiryBadge({ date }: { date: string | null }) {
  if (!date) return null
  const days = daysUntilExpiry(date)!
  if (days < 0) return <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Kedaluwarsa</span>
  if (days <= 3) return <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full animate-pulse">{days}h lagi</span>
  if (days <= 7) return <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">{days}h</span>
  return <span className="text-xs text-stone-400">{new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Inventori & Jadwal Panen</h1>
          <p className="text-stone-400 text-sm">{items.length} item terdaftar · {batches.length} catatan batch</p>
        </div>
        <div className="flex items-center gap-2">
          {pageTab === 'inventori' && (
            <button onClick={openTambah}
              className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          )}
          {pageTab === 'jadwal' && (
            <button onClick={() => setShowBatchForm(true)}
              className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Catat Penerimaan
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1 w-fit">
        <button onClick={() => setPageTab('inventori')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5
            ${pageTab === 'inventori' ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
          <Package className="w-3.5 h-3.5" /> Stok
        </button>
        <button onClick={() => setPageTab('jadwal')}
          className={`px-4 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 relative
            ${pageTab === 'jadwal' ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
          <Calendar className="w-3.5 h-3.5" /> Jadwal Panen
          {batchMenunggu > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {batchMenunggu}
            </span>
          )}
        </button>
      </div>

      {pageTab === 'inventori' && (
        <>
          {lowStock.length > 0 && (
            <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 rounded-xl px-4 py-3">
              <p className="text-red-700 text-sm font-medium inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Stok Menipis</p>
              <p className="text-red-600 text-xs mt-0.5">{lowStock.map(i => `${i.nama} (${i.stok} ${i.satuan})`).join(' · ')}</p>
            </div>
          )}
          {expiringSoon.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl px-4 py-3">
              <p className="text-amber-700 text-sm font-medium inline-flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Segera Kedaluwarsa</p>
              <p className="text-amber-700 text-xs mt-0.5">
                {expiringSoon.map(i => { const d = daysUntilExpiry(i.kadaluwarsa); return `${i.nama} (${d! < 0 ? 'sudah lewat' : d + ' hari lagi'})` }).join(' · ')}
              </p>
            </div>
          )}

          {showForm && (
            <form onSubmit={handleSave} className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-stone-900 font-medium">{editId ? 'Edit Item' : 'Tambah Item Inventori'}</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600 text-sm">Batal</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-stone-600 text-xs mb-1">Nama Item *</label>
                  <input required value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Wortel Lokal"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Kategori</label>
                  <select value={form.kategori} onChange={e => set('kategori', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                    {KATEGORI.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Stok *</label>
                  <input required type="number" min="0" step="0.1" value={form.stok} onChange={e => set('stok', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Satuan</label>
                  <select value={form.satuan} onChange={e => set('satuan', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                    {['pcs', 'kg', 'gram', 'liter', 'ml', 'karung', 'sak', 'box', 'lusin'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Harga Beli (Rp)</label>
                  <input type="number" min="0" value={form.harga_beli} onChange={e => set('harga_beli', e.target.value)} placeholder="0"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Harga Jual (Rp)</label>
                  <input type="number" min="0" value={form.harga_jual} onChange={e => set('harga_jual', e.target.value)} placeholder="0"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Batas Minimum Stok</label>
                  <input type="number" min="0" step="0.1" value={form.batas_minimum} onChange={e => set('batas_minimum', e.target.value)} placeholder="0"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Tanggal Kedaluwarsa</label>
                  <input type="date" value={form.kadaluwarsa} onChange={e => set('kadaluwarsa', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Lokasi / Rak</label>
                  <input value={form.lokasi} onChange={e => set('lokasi', e.target.value)} placeholder="Rak A-3 / Cold Room 1"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-stone-600 text-xs mb-1">Keterangan</label>
                  <input value={form.keterangan} onChange={e => set('keterangan', e.target.value)} placeholder="Opsional"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama item..."
              className="bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors w-44" />
            <button onClick={() => setFilterKat('')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!filterKat ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
              Semua
            </button>
            {[...new Set(items.map(i => i.kategori))].map(k => (
              <button key={k} onClick={() => setFilterKat(filterKat === k ? '' : k)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${filterKat === k ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
                {k}
              </button>
            ))}
            <span className="text-stone-400 text-xs ml-auto">{filtered.length} item</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Memuat inventori...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-400">
              <Package className="w-10 h-10 mx-auto mb-3" />
              <p>{items.length === 0 ? 'Belum ada item. Klik "+ Tambah Item".' : 'Tidak ada item yang cocok.'}</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-medium">
                    <th className="px-4 py-3 text-left">Nama</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-right">Stok</th>
                    <th className="px-4 py-3 text-right">Harga Jual</th>
                    <th className="px-4 py-3 text-center">Kadaluwarsa</th>
                    <th className="px-4 py-3 text-left">Lokasi</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map(item => {
                    const isLow = item.batas_minimum > 0 && item.stok <= item.batas_minimum
                    const expiryDays = daysUntilExpiry(item.kadaluwarsa)
                    const isExpired = expiryDays !== null && expiryDays < 0
                    const isExpiringSoon = expiryDays !== null && expiryDays >= 0 && expiryDays <= 7
                    return (
                      <tr key={item.id} className={`hover:bg-stone-50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-stone-900 font-medium">{item.nama}</p>
                          {item.keterangan && <p className="text-stone-400 text-xs mt-0.5">{item.keterangan}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-stone-600 text-xs capitalize bg-stone-100 px-2 py-0.5 rounded border border-stone-200">{item.kategori}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-stone-900'}`}>{item.stok}</span>
                          <span className="text-stone-400 text-xs ml-1">{item.satuan}</span>
                          {isLow && <p className="text-red-600 text-[10px]">min {item.batas_minimum}</p>}
                        </td>
                        <td className="px-4 py-3 text-right text-stone-600 text-xs">{rupiah(item.harga_jual)}</td>
                        <td className="px-4 py-3 text-center"><ExpiryBadge date={item.kadaluwarsa} /></td>
                        <td className="px-4 py-3 text-stone-400 text-xs">{item.lokasi ?? '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {isExpired ? (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Exp</span>
                          ) : isLow ? (
                            <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">Menipis</span>
                          ) : isExpiringSoon ? (
                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Periksa</span>
                          ) : (
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Aman</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(item)} className="text-stone-400 hover:text-stone-900 text-xs inline-flex items-center gap-1 mr-3">
                            <Pencil className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => handleHapus(item.id)} className="text-red-500 hover:text-red-600 text-xs inline-flex items-center gap-1">
                            <Trash2 className="w-3.5 h-3.5" /> Hapus
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {pageTab === 'jadwal' && (
        <>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-stone-400 text-xs">Total Batch</p>
              <p className="text-stone-900 text-2xl font-bold">{batches.length}</p>
            </div>
            <div className={`border rounded-xl p-4 ${batchMenunggu > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-stone-200'}`}>
              <p className="text-stone-400 text-xs">Menunggu Jadwal</p>
              <p className={`text-2xl font-bold ${batchMenunggu > 0 ? 'text-amber-700' : 'text-stone-900'}`}>{batchMenunggu}</p>
            </div>
            <div className={`border rounded-xl p-4 ${batchDijadwalkan > 0 ? 'bg-blue-50 border-blue-200' : 'bg-white border-stone-200'}`}>
              <p className="text-stone-400 text-xs">Dijadwalkan Kirim</p>
              <p className={`text-2xl font-bold ${batchDijadwalkan > 0 ? 'text-blue-700' : 'text-stone-900'}`}>{batchDijadwalkan}</p>
            </div>
          </div>

          {showBatchForm && (
            <form onSubmit={handleTambahBatch} className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-stone-900 font-semibold">Catat Penerimaan Hasil Panen</h2>
                <button type="button" onClick={() => setShowBatchForm(false)} className="text-stone-400 hover:text-stone-600 text-sm">Batal</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-stone-600 text-xs mb-1">Komoditas *</label>
                  <input
                    list="item-list" required
                    value={batchForm.item_nama}
                    onChange={e => setBatchForm(f => ({ ...f, item_nama: e.target.value }))}
                    placeholder="Cabai Merah / Beras / Wortel..."
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                  <datalist id="item-list">
                    {items.map(i => <option key={i.id} value={i.nama} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Mutu Panen *</label>
                  <select value={batchForm.mutu} onChange={e => setBatchForm(f => ({ ...f, mutu: e.target.value as BatchPenerimaan['mutu'] }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                    <option value="bagus">Bagus — siap ekspor / pasar swalayan</option>
                    <option value="layak">Layak — pasar lokal / pengepul</option>
                    <option value="layu">Layu — perlu segera dijual / olah</option>
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Jumlah *</label>
                  <input required type="number" min="0" step="0.1" value={batchForm.jumlah}
                    onChange={e => setBatchForm(f => ({ ...f, jumlah: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Satuan</label>
                  <select value={batchForm.satuan} onChange={e => setBatchForm(f => ({ ...f, satuan: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                    {['kg', 'ton', 'karung', 'sak', 'liter', 'pcs'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Tanggal Terima *</label>
                  <input required type="date" value={batchForm.tanggal_terima}
                    onChange={e => setBatchForm(f => ({ ...f, tanggal_terima: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Offtaker / Pembeli</label>
                  <input value={batchForm.offtaker} placeholder="PT Indofood / Pasar Wage / ..."
                    onChange={e => setBatchForm(f => ({ ...f, offtaker: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div className="col-span-2">
                  <label className="block text-stone-600 text-xs mb-1">Catatan</label>
                  <input value={batchForm.catatan} placeholder="Opsional — kondisi khusus, re-alokasi, dll"
                    onChange={e => setBatchForm(f => ({ ...f, catatan: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
              </div>
              <button type="submit"
                className="w-full bg-amber-700 hover:bg-amber-800 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
                Simpan Penerimaan
              </button>
            </form>
          )}

          {batches.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-400">
              <Calendar className="w-10 h-10 mx-auto mb-3" />
              <p className="font-medium">Belum ada catatan penerimaan hasil panen.</p>
              <p className="text-sm mt-1">Klik "+ Catat Penerimaan" untuk mulai mencatat batch masuk.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {batches.map(b => (
                <div key={b.id} className={`bg-white border rounded-xl shadow-sm overflow-hidden
                  ${b.mutu === 'layu' ? 'border-l-4 border-l-red-400' : b.mutu === 'layak' ? 'border-l-4 border-l-amber-400' : 'border-l-4 border-l-green-400'}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-stone-900 font-semibold">{b.item_nama}</p>
                        <p className="text-stone-500 text-sm">{b.jumlah} {b.satuan} · Diterima {new Date(b.tanggal_terima).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        {b.offtaker && <p className="text-stone-400 text-xs mt-0.5 flex items-center gap-1"><Truck className="w-3 h-3" /> {b.offtaker}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${MUTU_STYLE[b.mutu]}`}>
                          <Star className="w-3 h-3 inline mr-0.5" />{b.mutu}
                        </span>
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_BATCH_STYLE[b.status]}`}>
                          {b.status}
                        </span>
                      </div>
                    </div>

                    {b.catatan && <p className="text-stone-400 text-xs italic mb-2">{b.catatan}</p>}

                    {b.status === 'menunggu' && (
                      <div className="flex gap-2 items-center mt-2">
                        <input type="date" value={jadwalInput[b.id] ?? ''}
                          onChange={e => setJadwalInput(j => ({ ...j, [b.id]: e.target.value }))}
                          className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-1.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                        <button onClick={() => setBatchJadwal(b.id)} disabled={!jadwalInput[b.id]}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">
                          Jadwalkan Kirim
                        </button>
                      </div>
                    )}

                    {b.status === 'dijadwalkan' && b.jadwal_kirim && (
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-blue-600 text-xs flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Dijadwalkan kirim: <strong>{new Date(b.jadwal_kirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                        </p>
                        <button onClick={() => setBatchStatus(b.id, 'terkirim')}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1 rounded-lg transition-colors">
                          Tandai Terkirim
                        </button>
                      </div>
                    )}

                    {b.status === 'terkirim' && (
                      <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                        <span>✓</span> Sudah terkirim ke {b.offtaker || 'pembeli'}
                        {b.jadwal_kirim && ` · ${new Date(b.jadwal_kirim).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`}
                      </p>
                    )}

                    <div className="flex justify-end mt-2">
                      <button onClick={() => hapusBatch(b.id)} className="text-stone-300 hover:text-red-500 text-xs transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
