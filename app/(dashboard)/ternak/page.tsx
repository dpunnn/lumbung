'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { db } from '@/lib/db'
import type { Ternak } from '@/types'

const STATUS_STYLE: Record<string, string> = {
  sehat:  'bg-green-900/50 text-green-400 border-green-800',
  pantau: 'bg-yellow-900/50 text-yellow-400 border-yellow-800',
  sakit:  'bg-red-900/50 text-red-400 border-red-800',
  mati:   'bg-slate-800 text-slate-500 border-slate-700',
}

export default function TernakPage() {
  const [data, setData] = useState<Ternak[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: rows }, localRows] = await Promise.all([
      supabase.from('ternak').select('*').order('created_at', { ascending: false }),
      db.ternak.where('synced').equals(0).toArray(),
    ])
    // Merge: local pending di atas, server di bawah (dedup by id)
    const serverIds = new Set((rows ?? []).map((r: Ternak) => r.id))
    const localOnly = localRows.filter(r => !serverIds.has(r.id))
    setData([...localOnly as unknown as Ternak[], ...(rows ?? [])])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const counts = { sehat: 0, pantau: 0, sakit: 0, mati: 0 }
  data.forEach(t => counts[t.status]++)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Ternak</h1>
          <p className="text-slate-400 text-sm">{data.length} total</p>
        </div>
        <Link href="/ternak/tambah"
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Tambah
        </Link>
      </div>

      {/* Ringkasan status */}
      <div className="grid grid-cols-4 gap-3">
        {(['sehat','pantau','sakit','mati'] as const).map(s => (
          <div key={s} className={`border rounded-xl p-3 text-center ${STATUS_STYLE[s]}`}>
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className="text-xs capitalize mt-0.5">{s}</div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      {loading ? (
        <p className="text-slate-500 text-sm">Memuat...</p>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-2">🐄</p>
          <p>Belum ada ternak. <Link href="/ternak/tambah" className="text-green-400 underline">Tambah sekarang</Link></p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-xs">
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Jenis</th>
                <th className="px-4 py-3 text-left">Umur</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Nilai</th>
                <th className="px-4 py-3 text-center">Verif</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {data.map(t => (
                <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{t.kode}</td>
                  <td className="px-4 py-3 text-slate-300 capitalize">{t.jenis}</td>
                  <td className="px-4 py-3 text-slate-400">{t.umur_bulan ? `${t.umur_bulan} bln` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs border ${STATUS_STYLE[t.status]}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-300">
                    {t.nilai_estimasi > 0 ? `Rp${(t.nilai_estimasi/1000000).toFixed(1)}jt` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.terverifikasi
                      ? <span className="text-green-400 text-xs">✓ AI</span>
                      : <span className="text-slate-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/ternak/${t.id}`} className="text-slate-400 hover:text-white text-xs underline">
                      Edit
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
