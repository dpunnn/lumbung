'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Package, Plus, Pencil, Trash2, AlertTriangle } from 'lucide-react'

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

const KATEGORI = ['umum', 'sayuran', 'buah', 'beras', 'pupuk', 'obat', 'pakan', 'alat', 'elektronik', 'lainnya']

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

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('inventori').select('*').order('nama')
    setItems(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

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
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()

    const payload = {
      nama: form.nama,
      kategori: form.kategori,
      stok: parseFloat(form.stok) || 0,
      satuan: form.satuan,
      harga_beli: parseInt(form.harga_beli) || 0,
      harga_jual: parseInt(form.harga_jual) || 0,
      batas_minimum: parseFloat(form.batas_minimum) || 0,
      kadaluwarsa: form.kadaluwarsa || null,
      lokasi: form.lokasi || null,
      keterangan: form.keterangan || null,
      updated_at: new Date().toISOString(),
    }

    if (editId) {
      await supabase.from('inventori').update(payload).eq('id', editId)
    } else {
      await supabase.from('inventori').insert({ ...payload, koperasi_id: profile!.koperasi_id })
    }

    setSaving(false)
    setShowForm(false)
    setEditId(null)
    load()
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus item ini?')) return
    await supabase.from('inventori').delete().eq('id', id)
    load()
  }

  const filtered = items.filter(i => {
    if (filterKat && i.kategori !== filterKat) return false
    if (search && !i.nama.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const lowStock = items.filter(i => i.batas_minimum > 0 && i.stok <= i.batas_minimum)
  const expiringSoon = items.filter(i => {
    const d = daysUntilExpiry(i.kadaluwarsa)
    return d !== null && d <= 7
  })

  const rupiah = (n: number) => n > 0 ? 'Rp ' + n.toLocaleString('id-ID') : '—'

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Inventori</h1>
          <p className="text-stone-400 text-sm">{items.length} item terdaftar</p>
        </div>
        <button onClick={openTambah}
          className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah Item
        </button>
      </div>

      {/* Alert banners */}
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
            {expiringSoon.map(i => {
              const d = daysUntilExpiry(i.kadaluwarsa)
              return `${i.nama} (${d! < 0 ? 'sudah lewat' : d + ' hari lagi'})`
            }).join(' · ')}
          </p>
        </div>
      )}

      {/* Form tambah/edit */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-stone-900 font-medium">{editId ? 'Edit Item' : 'Tambah Item Inventori'}</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600 text-sm">Batal</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-stone-600 text-xs mb-1">Nama Item *</label>
              <input required value={form.nama} onChange={e => set('nama', e.target.value)}
                placeholder="Wortel Lokal"
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
                {['pcs','kg','gram','liter','ml','karung','sak','box','lusin'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Harga Beli (Rp)</label>
              <input type="number" min="0" value={form.harga_beli} onChange={e => set('harga_beli', e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Harga Jual (Rp)</label>
              <input type="number" min="0" value={form.harga_jual} onChange={e => set('harga_jual', e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Batas Minimum Stok</label>
              <input type="number" min="0" step="0.1" value={form.batas_minimum} onChange={e => set('batas_minimum', e.target.value)}
                placeholder="0"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Tanggal Kedaluwarsa</label>
              <input type="date" value={form.kadaluwarsa} onChange={e => set('kadaluwarsa', e.target.value)}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Lokasi / Rak</label>
              <input value={form.lokasi} onChange={e => set('lokasi', e.target.value)}
                placeholder="Rak A-3 / Cold Room 1"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-stone-600 text-xs mb-1">Keterangan</label>
              <input value={form.keterangan} onChange={e => set('keterangan', e.target.value)}
                placeholder="Opsional"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama item..."
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

      {/* Tabel */}
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
                  <tr key={item.id}
                    className={`hover:bg-stone-50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="text-stone-900 font-medium">{item.nama}</p>
                      {item.keterangan && <p className="text-stone-400 text-xs mt-0.5">{item.keterangan}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-stone-600 text-xs capitalize bg-stone-100 px-2 py-0.5 rounded border border-stone-200">{item.kategori}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${isLow ? 'text-red-600' : 'text-stone-900'}`}>
                        {item.stok}
                      </span>
                      <span className="text-stone-400 text-xs ml-1">{item.satuan}</span>
                      {isLow && <p className="text-red-600 text-[10px]">min {item.batas_minimum}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-600 text-xs">{rupiah(item.harga_jual)}</td>
                    <td className="px-4 py-3 text-center">
                      <ExpiryBadge date={item.kadaluwarsa} />
                    </td>
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
    </div>
  )
}
