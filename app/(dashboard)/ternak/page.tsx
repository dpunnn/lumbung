'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import type { Ternak } from '@/types'
import { Beef, Plus, Pencil, CheckCircle } from 'lucide-react'

const STATUS_STYLE: Record<string, string> = {
  sehat:  'bg-green-50 text-green-700 border border-green-200',
  pantau: 'bg-amber-50 text-amber-700 border border-amber-200',
  sakit:  'bg-red-50 text-red-600 border border-red-200',
  mati:   'bg-stone-100 text-stone-600 border border-stone-200',
}

export default function TernakPage() {
  const [data, setData] = useState<Ternak[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: rows }, localRows] = await Promise.all([
      supabase.from('ternak').select('*').order('created_at', { ascending: false }),
      db.ternak.where('synced').equals(0).toArray(),
    ])
    const serverIds = new Set((rows ?? []).map((r: Ternak) => r.id))
    const localOnly = localRows.filter(r => !serverIds.has(r.id))
    setData([...localOnly as unknown as Ternak[], ...(rows ?? [])])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('ternak-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ternak' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const counts = { sehat: 0, pantau: 0, sakit: 0, mati: 0 }
  data.forEach(t => counts[t.status]++)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Ternak</h1>
          <p className="text-stone-400 text-sm">{data.length} total</p>
        </div>
        <Link href="/ternak/tambah"
          className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Tambah
        </Link>
      </div>

      {/* Ringkasan status */}
      <div className="grid grid-cols-4 gap-3">
        {(['sehat','pantau','sakit','mati'] as const).map(s => (
          <div key={s} className={`rounded-xl p-3 text-center ${STATUS_STYLE[s]}`}>
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className="text-xs capitalize mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      {loading ? (
        <div className="flex items-center gap-3 py-8 justify-center">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-400 text-sm">Memuat...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <Beef className="w-10 h-10 mx-auto mb-3" />
          <p>Belum ada ternak. <Link href="/ternak/tambah" className="text-amber-700 underline">Tambah sekarang</Link></p>
        </div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-medium">
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Jenis</th>
                <th className="px-4 py-3 text-left">Umur</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Nilai</th>
                <th className="px-4 py-3 text-center">Verif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.map(t => (
                <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 text-stone-900 font-medium">{t.kode}</td>
                  <td className="px-4 py-3 text-stone-600 capitalize">{t.jenis}</td>
                  <td className="px-4 py-3 text-stone-400">{t.umur_bulan ? `${t.umur_bulan} bln` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${STATUS_STYLE[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-600">
                    {t.nilai_estimasi > 0 ? `Rp${(t.nilai_estimasi/1000000).toFixed(1)}jt` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.terverifikasi
                      ? <span className="text-green-700 text-xs inline-flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> AI</span>
                      : <span className="text-stone-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/ternak/${t.id}`} className="text-stone-400 hover:text-stone-900 text-xs inline-flex items-center gap-1">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
