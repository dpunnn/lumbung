'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pakan } from '@/types'

export default function PakanPage() {
  const [data, setData] = useState<Pakan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nama: '', stok: '', satuan: 'kg', batas_minimum: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase.from('pakan').select('*').order('nama')
    setData(rows ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function openTambah() {
    setEditId(null)
    setForm({ nama: '', stok: '', satuan: 'kg', batas_minimum: '' })
    setShowForm(true)
  }

  function openEdit(p: Pakan) {
    setEditId(p.id)
    setForm({ nama: p.nama, stok: p.stok.toString(), satuan: p.satuan, batas_minimum: p.batas_minimum.toString() })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()

    const payload = {
      nama: form.nama,
      stok: parseFloat(form.stok),
      satuan: form.satuan,
      batas_minimum: parseFloat(form.batas_minimum) || 0,
      updated_at: new Date().toISOString(),
    }

    if (editId) {
      await supabase.from('pakan').update(payload).eq('id', editId)
    } else {
      await supabase.from('pakan').insert({ ...payload, koperasi_id: profile!.koperasi_id })
    }

    setSaving(false)
    setShowForm(false)
    load()
  }

  async function handleHapus(id: string) {
    if (!confirm('Hapus data pakan ini?')) return
    await supabase.from('pakan').delete().eq('id', id)
    load()
  }

  const lowStock = data.filter(p => p.stok <= p.batas_minimum && p.batas_minimum > 0)

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Pakan</h1>
          <p className="text-slate-400 text-sm">{data.length} jenis pakan</p>
        </div>
        <button onClick={openTambah}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Tambah
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-3 flex items-start gap-2">
          <span className="text-red-400 text-sm">⚠</span>
          <div className="text-red-300 text-sm">
            <strong>Stok menipis:</strong>{' '}
            {lowStock.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', ')}
          </div>
        </div>
      )}

      {/* Form tambah/edit inline */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-green-700/50 rounded-xl p-4 space-y-4">
          <h2 className="text-white font-medium text-sm">{editId ? 'Edit Pakan' : 'Tambah Pakan'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 text-xs mb-1">Nama Pakan *</label>
              <input required value={form.nama} onChange={e => set('nama', e.target.value)}
                placeholder="Konsentrat Sapi"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-slate-300 text-xs mb-1">Satuan</label>
              <select value={form.satuan} onChange={e => set('satuan', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                {['kg','liter','karung','sak'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-xs mb-1">Stok Saat Ini *</label>
              <input required type="number" min="0" step="0.1" value={form.stok} onChange={e => set('stok', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-slate-300 text-xs mb-1">Batas Minimum</label>
              <input type="number" min="0" step="0.1" value={form.batas_minimum} onChange={e => set('batas_minimum', e.target.value)}
                placeholder="0"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg hover:bg-slate-800">
              Batal
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Memuat...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-2">🌾</p>
          <p>Belum ada data pakan.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Nama Pakan</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map(p => {
                const isLow = p.batas_minimum > 0 && p.stok <= p.batas_minimum
                return (
                  <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{p.nama}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{p.stok} {p.satuan}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{p.batas_minimum} {p.satuan}</td>
                    <td className="px-4 py-3 text-center">
                      {isLow
                        ? <span className="bg-red-900/50 text-red-400 border border-red-800 px-2 py-0.5 rounded-full text-xs">Menipis</span>
                        : <span className="bg-green-900/50 text-green-400 border border-green-800 px-2 py-0.5 rounded-full text-xs">Aman</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)} className="text-slate-400 hover:text-white text-xs underline mr-3">Edit</button>
                      <button onClick={() => handleHapus(p.id)} className="text-red-500 hover:text-red-400 text-xs">Hapus</button>
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
