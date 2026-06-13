'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, AlertTriangle, Wheat } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Pakan } from '@/types'

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

export default function PakanPage() {
  const [data, setData] = useState<Pakan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nama: '', stok: '', satuan: 'kg', batas_minimum: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: rows } = await supabase.from('pakan').select('*').order('nama')
    setData(rows ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('pakan-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pakan' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

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
          <h1 className="text-stone-900 text-xl font-bold">Stok Pakan</h1>
          <p className="text-stone-500 text-sm">{data.length} jenis pakan tercatat</p>
        </div>
        <button onClick={openTambah}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
          <Plus size={15} /> Tambah
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
          <div className="text-red-700 text-sm">
            <strong>Stok menipis:</strong>{' '}
            {lowStock.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', ')}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSave}
          className="bg-white border border-amber-200 rounded-xl p-5 space-y-4 shadow-sm">
          <h2 className="text-stone-900 font-semibold text-sm">{editId ? 'Edit Pakan' : 'Tambah Pakan'}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-stone-700 text-xs font-medium mb-1">Nama Pakan *</label>
              <input required value={form.nama} onChange={e => set('nama', e.target.value)}
                placeholder="Konsentrat Sapi" className={inputCls} />
            </div>
            <div>
              <label className="block text-stone-700 text-xs font-medium mb-1">Satuan</label>
              <select value={form.satuan} onChange={e => set('satuan', e.target.value)} className={inputCls}>
                {['kg', 'liter', 'karung', 'sak'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-stone-700 text-xs font-medium mb-1">Stok Saat Ini *</label>
              <input required type="number" min="0" step="0.1" value={form.stok}
                onChange={e => set('stok', e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-stone-700 text-xs font-medium mb-1">Batas Minimum</label>
              <input type="number" min="0" step="0.1" value={form.batas_minimum}
                onChange={e => set('batas_minimum', e.target.value)} placeholder="0" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="border border-stone-300 text-stone-600 text-sm px-4 py-2 rounded-lg hover:bg-stone-50 transition-colors">
              Batal
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-stone-400 bg-white border border-stone-200 rounded-xl">
          <Wheat size={32} className="mx-auto mb-2 text-stone-300" />
          <p className="text-sm">Belum ada data pakan.</p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs">
                <th className="px-4 py-3 text-left font-medium">Nama Pakan</th>
                <th className="px-4 py-3 text-right font-medium">Stok</th>
                <th className="px-4 py-3 text-right font-medium">Min</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map(p => {
                const isLow = p.batas_minimum > 0 && p.stok <= p.batas_minimum
                return (
                  <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 text-stone-900 font-medium">{p.nama}</td>
                    <td className="px-4 py-3 text-right text-stone-700">{p.stok} {p.satuan}</td>
                    <td className="px-4 py-3 text-right text-stone-400">{p.batas_minimum} {p.satuan}</td>
                    <td className="px-4 py-3 text-center">
                      {isLow
                        ? <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-xs font-medium">Menipis</span>
                        : <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-xs font-medium">Aman</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEdit(p)}
                        className="text-stone-400 hover:text-stone-700 mr-3 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleHapus(p.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
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
