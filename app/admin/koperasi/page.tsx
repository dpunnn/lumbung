'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string; fokus_usaha: string; modules: string[] }

const ALL_MODULES = [
  { key: 'ternak', label: 'Ternak' },
  { key: 'pakan', label: 'Pakan' },
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
    setEditModules(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    )
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
        <h1 className="text-white text-xl font-semibold">Kelola Koperasi</h1>
        <p className="text-slate-400 text-sm">Aktifkan atau nonaktifkan modul per koperasi</p>
      </div>

      <div className="space-y-4">
        {list.map(k => (
          <div key={k.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-medium">{k.nama}</p>
                <p className="text-slate-400 text-sm">{k.fokus_usaha}</p>
              </div>
              {editing !== k.id ? (
                <button onClick={() => startEdit(k)}
                  className="text-xs border border-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                  Edit Modul
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(null)}
                    className="text-xs border border-slate-700 text-slate-400 px-3 py-1.5 rounded-lg hover:bg-slate-800">
                    Batal
                  </button>
                  <button onClick={() => saveModules(k.id)} disabled={saving}
                    className="text-xs bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg">
                    {saving ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              )}
            </div>

            {editing === k.id ? (
              <div className="flex flex-wrap gap-2">
                {ALL_MODULES.map(m => (
                  <button key={m.key} onClick={() => toggleModule(m.key)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors
                      ${editModules.includes(m.key)
                        ? 'bg-green-700 text-white border-green-600'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {k.modules.length === 0
                  ? <span className="text-slate-600 text-xs">Tidak ada modul aktif</span>
                  : k.modules.map(m => (
                      <span key={m} className="bg-green-900/30 text-green-400 border border-green-800 text-xs px-2 py-0.5 rounded-full">
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
