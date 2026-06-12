'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getAnomalyKasir, type AnomalyKasir } from '@/lib/anomaly'
import { ShieldCheck, Info, ChevronDown } from 'lucide-react'

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
    INSERT: 'text-green-700',
    UPDATE: 'text-amber-700',
    DELETE: 'text-red-600',
    CANCEL: 'text-red-600',
  }

  const [auditVisible, setAuditVisible] = useState(20)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Lumbung Guard</h1>
        <p className="text-stone-600 text-sm mt-1">Deteksi anomali & audit trail integritas data</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['anomali', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'anomali' ? 'Anomali Kasir' : 'Audit Trail'}
            {t === 'anomali' && anomali.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{anomali.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Anomali */}
      {tab === 'anomali' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-500 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
            <p className="text-blue-700 text-xs leading-relaxed">Sistem mendeteksi pola tidak biasa untuk ditinjau pengurus. Bukan tuduhan — investigasi tetap dilakukan manusia.</p>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Menganalisis pola...</p>
            </div>
          ) : anomali.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm">
              <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-8 h-8 text-green-700" />
              </div>
              <p className="text-green-700 font-semibold text-lg">Tidak Ada Anomali</p>
              <p className="text-stone-400 text-sm mt-1">Tidak ada pola mencurigakan dalam 7 hari terakhir</p>
            </div>
          ) : (
            anomali.map(a => (
              <div key={a.user_id} className="bg-white border border-red-200 border-l-4 border-l-red-500 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-2">
                        <p className="text-stone-900 font-semibold">{a.nama}</p>
                        <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          {a.jumlah_flag} flag
                        </span>
                      </div>
                      <p className="text-stone-600 text-sm">
                        Transaksi di luar jam normal (7 hari terakhir)
                      </p>
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === a.user_id ? null : a.user_id)}
                      className="bg-white hover:bg-stone-50 text-stone-600 text-xs border border-stone-300 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5">
                      <span>{expandedId === a.user_id ? 'Tutup' : 'Detail'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedId === a.user_id ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {expandedId === a.user_id && (
                  <div className="border-t border-stone-200 bg-stone-50 p-4 space-y-2">
                    <p className="text-stone-400 text-xs uppercase tracking-wide font-medium mb-3">Timeline Kejadian</p>
                    {a.kejadian.slice(0, 10).map((k, i) => (
                      <div key={i} className="flex items-center gap-3 group">
                        {/* Timeline dot */}
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full ${k.aksi === 'INSERT' ? 'bg-green-500' : k.aksi === 'UPDATE' ? 'bg-amber-500' : 'bg-red-500'}`} />
                          {i < Math.min(a.kejadian.length, 10) - 1 && <div className="w-px h-6 bg-stone-200" />}
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${AKSI_COLOR[k.aksi] ?? 'text-stone-600'} bg-stone-50`}>{k.aksi}</span>
                            <span className="text-stone-600 text-xs">{k.tabel}</span>
                          </div>
                          <span className="text-stone-400 text-xs">
                            {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                      </div>
                    ))}
                    <button className="w-full mt-3 bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-medium rounded-lg py-2.5 transition-colors">
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
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!filterTabel ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
              Semua
            </button>
            {tabelOptions.map(t => (
              <button key={t}
                onClick={() => setFilterTabel(filterTabel === t ? '' : t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterTabel === t ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
                {t}
              </button>
            ))}
            <span className="text-stone-400 text-xs ml-auto">{filteredAudit.length} entri</span>
          </div>

          {filteredAudit.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm">
              <div className="w-16 h-16 bg-stone-100 border border-stone-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-stone-400 text-2xl">--</span>
              </div>
              <p className="text-stone-600 font-medium">Belum Ada Log Audit</p>
              <p className="text-stone-400 text-sm mt-1">Log akan muncul saat ada perubahan data</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="px-4 py-3 text-left text-stone-500 text-xs font-medium">Waktu</th>
                    <th className="px-4 py-3 text-left text-stone-500 text-xs font-medium">User</th>
                    <th className="px-4 py-3 text-left text-stone-500 text-xs font-medium">Tabel</th>
                    <th className="px-4 py-3 text-left text-stone-500 text-xs font-medium">Aksi</th>
                    <th className="px-4 py-3 text-left text-stone-500 text-xs font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredAudit.slice(0, auditVisible).map(log => (
                    <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-stone-400 whitespace-nowrap">
                        {new Date(log.dilakukan_pada).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-stone-900 font-medium">
                        {log.profiles?.nama ?? <span className="text-stone-400">--</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-stone-100 text-stone-600 text-xs px-2 py-0.5 rounded border border-stone-200">{log.tabel_nama}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                          log.aksi === 'INSERT' ? 'bg-green-50 text-green-700 border-green-200' :
                          log.aksi === 'UPDATE' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {log.aksi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400 max-w-xs truncate">
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
                <div className="border-t border-stone-200 p-3 text-center">
                  <button
                    onClick={() => setAuditVisible(v => v + 20)}
                    className="bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium px-6 py-2 rounded-lg border border-stone-300 transition-colors">
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
