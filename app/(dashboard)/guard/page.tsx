'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAnomalyKasir, type AnomalyKasir } from '@/lib/anomaly'

type AuditLog = {
  id: string
  tabel_nama: string
  aksi: string
  nilai_lama: Record<string, unknown> | null
  nilai_baru: Record<string, unknown> | null
  dilakukan_pada: string
  profiles: { nama: string } | null
}

export default function GuardPage() {
  const [tab, setTab] = useState<'anomali' | 'audit'>('anomali')
  const [anomali, setAnomali] = useState<AnomalyKasir[]>([])
  const [auditLog, setAuditLog] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTabel, setFilterTabel] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    loadAnomali()
    loadAudit()
  }, [])

  async function loadAnomali() {
    setLoading(true)
    const data = await getAnomalyKasir()
    setAnomali(data)
    setLoading(false)
  }

  async function loadAudit() {
    const { data } = await supabase
      .from('audit_log')
      .select('*, profiles(nama)')
      .order('dilakukan_pada', { ascending: false })
      .limit(100)
    setAuditLog((data ?? []) as AuditLog[])
  }

  const filteredAudit = filterTabel
    ? auditLog.filter(l => l.tabel_nama === filterTabel)
    : auditLog

  const tabelOptions = [...new Set(auditLog.map(l => l.tabel_nama))]

  const AKSI_COLOR: Record<string, string> = {
    INSERT: 'text-green-400',
    UPDATE: 'text-yellow-400',
    DELETE: 'text-red-400',
    CANCEL: 'text-red-500',
  }

  const [auditVisible, setAuditVisible] = useState(20)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-white text-2xl font-bold tracking-tight">Lumbung Guard</h1>
        <p className="text-slate-400 text-sm mt-1">Deteksi anomali & audit trail integritas data</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['anomali', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-green-600 text-white shadow-lg shadow-green-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            {t === 'anomali' ? 'Anomali Kasir' : 'Audit Trail'}
            {t === 'anomali' && anomali.length > 0 && (
              <span className="ml-2 bg-red-500/80 text-white text-xs px-1.5 py-0.5 rounded-full">{anomali.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Anomali */}
      {tab === 'anomali' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="bg-slate-800/40 border border-slate-700 border-l-4 border-l-blue-500 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-blue-400 text-sm font-bold mt-0.5">i</span>
            <p className="text-slate-400 text-xs leading-relaxed">Sistem mendeteksi pola tidak biasa untuk ditinjau pengurus. Bukan tuduhan — investigasi tetap dilakukan manusia.</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Menganalisis pola...</p>
            </div>
          ) : anomali.length === 0 ? (
            <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="w-16 h-16 bg-green-900/30 border border-green-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-green-400 text-2xl font-bold">OK</span>
              </div>
              <p className="text-green-400 font-semibold text-lg">Tidak Ada Anomali</p>
              <p className="text-slate-500 text-sm mt-1">Tidak ada pola mencurigakan dalam 7 hari terakhir</p>
            </div>
          ) : (
            anomali.map(a => (
              <div key={a.user_id} className="bg-slate-900 border border-red-900/40 border-l-4 border-l-red-500 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <p className="text-white font-semibold">{a.nama}</p>
                        <span className="bg-red-900/40 text-red-400 border border-red-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          {a.jumlah_flag} flag
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">
                        Transaksi di luar jam normal (7 hari terakhir)
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === a.user_id ? null : a.user_id)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5">
                      <span>{expandedId === a.user_id ? 'Tutup' : 'Detail'}</span>
                      <span className={`transition-transform ${expandedId === a.user_id ? 'rotate-180' : ''}`}>v</span>
                    </button>
                  </div>
                </div>

                {expandedId === a.user_id && (
                  <div className="border-t border-slate-800 bg-slate-950/50 p-4 space-y-2">
                    <p className="text-slate-500 text-xs uppercase tracking-wide font-medium mb-3">Timeline Kejadian</p>
                    {a.kejadian.slice(0, 10).map((k, i) => (
                      <div key={i} className="flex items-center gap-3 group">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full ${k.aksi === 'INSERT' ? 'bg-green-500' : k.aksi === 'UPDATE' ? 'bg-yellow-500' : 'bg-red-500'}`} />
                          {i < Math.min(a.kejadian.length, 10) - 1 && <div className="w-px h-6 bg-slate-800" />}
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${AKSI_COLOR[k.aksi] ?? 'text-slate-300'} bg-slate-900/50`}>{k.aksi}</span>
                            <span className="text-slate-300 text-xs">{k.tabel}</span>
                          </div>
                          <span className="text-slate-500 text-xs">
                            {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <button className="w-full mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium rounded-lg py-2.5 transition-colors">
                      Mulai Investigasi
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Audit Trail */}
      {tab === 'audit' && (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterTabel('')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!filterTabel ? 'bg-green-600 text-white border-green-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}>
              Semua
            </button>
            {tabelOptions.map(t => (
              <button key={t}
                onClick={() => setFilterTabel(filterTabel === t ? '' : t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterTabel === t ? 'bg-green-600 text-white border-green-600' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'}`}>
                {t}
              </button>
            ))}
            <span className="text-slate-600 text-xs ml-auto">{filteredAudit.length} entri</span>
          </div>

          {filteredAudit.length === 0 ? (
            <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-slate-500 text-2xl">--</span>
              </div>
              <p className="text-slate-400 font-medium">Belum Ada Log Audit</p>
              <p className="text-slate-600 text-sm mt-1">Log akan muncul saat ada perubahan data</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900 z-10">
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Waktu</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">User</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Tabel</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Aksi</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredAudit.slice(0, auditVisible).map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {new Date(log.dilakukan_pada).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {log.profiles?.nama ?? <span className="text-slate-600">--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700">{log.tabel_nama}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          log.aksi === 'INSERT' ? 'bg-green-900/40 text-green-400 border-green-800' :
                          log.aksi === 'UPDATE' ? 'bg-yellow-900/40 text-yellow-400 border-yellow-800' :
                          'bg-red-900/40 text-red-400 border-red-800'
                        }`}>
                          {log.aksi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                        {log.nilai_lama && log.nilai_baru
                          ? `${Object.keys(log.nilai_baru).join(', ')}`
                          : log.aksi === 'INSERT' ? 'data baru' : 'dihapus'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Load more */}
              {filteredAudit.length > auditVisible && (
                <div className="border-t border-slate-800 p-3 text-center">
                  <button
                    onClick={() => setAuditVisible(v => v + 20)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-6 py-2 rounded-lg border border-slate-700 transition-colors">
                    Muat {Math.min(20, filteredAudit.length - auditVisible)} lagi ({auditVisible}/{filteredAudit.length})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
