'use client'

import { useEffect, useState } from 'react'
import { Pencil, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string; fokus_usaha: string; modules: string[] }

const ALL_MODULES = [
  { key: 'ternak', label: 'Ternak' },
  { key: 'pakan', label: 'Pakan' },
  { key: 'inventori', label: 'Inventori' },
  { key: 'air', label: 'Utilitas Air' },
  { key: 'simpan_pinjam', label: 'Simpan Pinjam' },
  { key: 'pass', label: 'Pass' },
  { key: 'insight', label: 'Insight AI' },
  { key: 'lens', label: 'Lens' },
  { key: 'guard', label: 'Guard' },
  { key: 'pasar', label: 'Pasar' },
  { key: 'atlas', label: 'Atlas' },
]

export default function AdminKoperasiPage() {
  const [list, setList] = useState<Koperasi[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editModules, setEditModules] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase.from('koperasi').select('id, nama, fokus_usaha, modules').order('nama')
    setList((data ?? []).map(k => ({ ...k, modules: k.modules ?? [] })))
  }

  function startEdit(k: Koperasi) {
    setEditing(k.id)
    setEditModules([...k.modules])
  }

  function toggleModule(m: string) {
    setEditModules(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  async function saveModules(id: string) {
    setSaving(true)
    await supabase.from('koperasi').update({ modules: editModules }).eq('id', id)
    setList(prev => prev.map(k => k.id === id ? { ...k, modules: editModules } : k))
    setEditing(null)
    setSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Kelola Koperasi</h1>
        <p className="text-stone-500 text-sm">Aktifkan atau nonaktifkan modul per koperasi</p>
      </div>

      <div className="space-y-3">
        {list.map(k => (
          <div key={k.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-stone-900 font-semibold">{k.nama}</p>
                <p className="text-stone-500 text-sm">{k.fokus_usaha}</p>
              </div>
              {editing !== k.id ? (
                <button onClick={() => startEdit(k)}
                  className="flex items-center gap-1.5 text-xs border border-stone-300 text-stone-600 hover:text-stone-900 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                  <Pencil size={12} /> Edit Modul
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)}
                    className="flex items-center gap-1 text-xs border border-stone-300 text-stone-500 px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors">
                    <X size={12} /> Batal
                  </button>
                  <button onClick={() => saveModules(k.id)} disabled={saving}
                    className="flex items-center gap-1 text-xs bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <Check size={12} /> {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              )}
            </div>

            {editing === k.id ? (
              <div className="flex flex-wrap gap-2">
                {ALL_MODULES.map(m => (
                  <button key={m.key} onClick={() => toggleModule(m.key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium
                      ${editModules.includes(m.key)
                        ? 'bg-amber-700 text-white border-amber-700'
                        : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {k.modules.length === 0
                  ? <span className="text-stone-400 text-xs">Tidak ada modul aktif</span>
                  : k.modules.map(m => (
                      <span key={m} className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                        {ALL_MODULES.find(x => x.key === m)?.label ?? m}
                      </span>
                    ))
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
