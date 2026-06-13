'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getAnomalyKasir, type AnomalyKasir } from '@/lib/anomaly'
import type { AnomalyAnalysis } from '@/app/api/anomali/route'
import { ShieldCheck, Info, ChevronDown, Sparkles, AlertTriangle, Loader2 } from 'lucide-react'

type AuditLog = {
  id: string; tabel_nama: string; aksi: string
  nilai_lama: Record<string, unknown> | null
  nilai_baru: Record<string, unknown> | null
  dilakukan_pada: string
  profiles: { nama: string } | null
}

const SEVERITY_STYLE: Record<string, string> = {
  tinggi:  'bg-red-50 text-red-600 border-red-200',
  sedang:  'bg-amber-50 text-amber-700 border-amber-200',
  rendah:  'bg-stone-50 text-stone-600 border-stone-200',
}

const JENIS_LABEL: Record<string, string> = {
  simpanan_dispute:    'Sengketa nominal setoran',
  simpanan_claim:      'Setoran tidak tercatat',
  hapus_finansial:     'Penghapusan data finansial',
  ubah_nominal:        'Perubahan nominal setelah konfirmasi',
  pembatalan_luar_jam: 'Pembatalan di luar jam kerja',
}

export default function GuardPage() {
  const [tab, setTab] = useState<'anomali' | 'audit'>('anomali')
  const [anomali, setAnomali] = useState<AnomalyKasir[]>([])
  const [auditLog, setAuditLog] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTabel, setFilterTabel] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [auditVisible, setAuditVisible] = useState(20)

  // AI analysis per anomali
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [aiResult, setAiResult] = useState<Record<string, AnomalyAnalysis>>({})

  const loadAnomali = useCallback(async () => {
    setLoading(true)
    const data = await getAnomalyKasir()
    setAnomali(data)
    setLoading(false)
  }, [])

  const loadAudit = useCallback(async () => {
    const { data } = await supabase
      .from('audit_log')
      .select('*, profiles(nama)')
      .order('dilakukan_pada', { ascending: false })
      .limit(100)
    setAuditLog((data ?? []) as AuditLog[])
  }, [])

  useEffect(() => {
    loadAnomali()
    loadAudit()
  }, [loadAnomali, loadAudit])

  useEffect(() => {
    const channel = supabase.channel('guard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_log' }, () => {
        loadAnomali(); loadAudit()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'simpanan' }, () => {
        loadAnomali()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadAnomali, loadAudit])

  async function analyzeWithAI(a: AnomalyKasir) {
    const key = a.user_id
    if (aiResult[key] || aiLoading[key]) return
    setAiLoading(prev => ({ ...prev, [key]: true }))
    try {
      const res = await fetch('/api/anomali', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nama: a.nama,
          jumlah_flag: a.jumlah_flag,
          jenis: a.jenis,
          kejadian: a.kejadian.slice(0, 10),
          simpanan_disputed: a.simpanan_disputed,
          simpanan_claimed: a.simpanan_claimed,
        }),
      })
      const data: AnomalyAnalysis = await res.json()
      setAiResult(prev => ({ ...prev, [key]: data }))
    } finally {
      setAiLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  function handleExpand(id: string, anomaly: AnomalyKasir) {
    const next = expandedId === id ? null : id
    setExpandedId(next)
    if (next) analyzeWithAI(anomaly)
  }

  const filteredAudit = filterTabel ? auditLog.filter(l => l.tabel_nama === filterTabel) : auditLog
  const tabelOptions = [...new Set(auditLog.map(l => l.tabel_nama))]

  const AKSI_COLOR: Record<string, string> = {
    INSERT: 'bg-green-50 text-green-700 border-green-200',
    UPDATE: 'bg-amber-50 text-amber-700 border-amber-200',
    DELETE: 'bg-red-50 text-red-600 border-red-200',
    CANCEL: 'bg-red-50 text-red-600 border-red-200',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Lumbung Guard</h1>
        <p className="text-stone-600 text-sm mt-1">Deteksi anomali & audit trail integritas data</p>
      </div>

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['anomali', 'audit'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all relative
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'anomali' ? 'Anomali' : 'Audit Trail'}
            {t === 'anomali' && anomali.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {anomali.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Anomali */}
      {tab === 'anomali' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 border-l-4 border-l-blue-500 rounded-xl px-4 py-3 flex items-start gap-3">
            <Info className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
            <p className="text-blue-700 text-xs leading-relaxed">
              Sistem mendeteksi pola tidak biasa secara otomatis. Klik Detail untuk analisis AI —
              bukan tuduhan, investigasi tetap dilakukan manusia.
            </p>
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
          ) : anomali.map(a => {
            const key = a.user_id
            const ai = aiResult[key]
            const isExpanded = expandedId === key
            const borderColor = a.jenis === 'hapus_finansial' || a.jenis === 'ubah_nominal'
              ? 'border-red-200 border-l-red-500'
              : a.jenis === 'pembatalan_luar_jam'
              ? 'border-purple-200 border-l-purple-500'
              : a.jenis === 'simpanan_dispute'
              ? 'border-orange-200 border-l-orange-500'
              : 'border-amber-200 border-l-amber-500'

            return (
              <div key={key} className={`bg-white border border-l-4 ${borderColor} rounded-xl shadow-sm overflow-hidden`}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <p className="text-stone-900 font-semibold">{a.nama}</p>
                        <span className="bg-red-50 text-red-600 border border-red-200 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          {a.jumlah_flag} flag
                        </span>
                        {ai && (
                          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${SEVERITY_STYLE[ai.severity]}`}>
                            {ai.severity}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-500 text-sm">{JENIS_LABEL[a.jenis]}</p>
                      {a.jenis === 'pembatalan_luar_jam' && a.rasio_luar_jam !== undefined && (
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                            {a.rasio_luar_jam}% luar jam
                          </span>
                          <span className="text-xs text-stone-400">
                            {a.luar_jam_count} dari {a.total_aksi} pembatalan setelah jam tutup
                          </span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleExpand(key, a)}
                      className="bg-white hover:bg-stone-50 text-stone-600 text-xs border border-stone-300 rounded-lg px-3 py-2 transition-colors flex items-center gap-1.5 shrink-0">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>{isExpanded ? 'Tutup' : 'Analisis AI'}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-stone-200 bg-stone-50 p-4 space-y-4">
                    {/* AI Analysis */}
                    {aiLoading[key] ? (
                      <div className="flex items-center gap-2 text-amber-700 text-sm py-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Menganalisis dengan AI...
                      </div>
                    ) : ai ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-stone-500">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          Analisis {ai.sumber === 'ai' ? 'Claude AI' : 'sistem'}
                        </div>
                        <div className={`rounded-xl p-4 border ${
                          ai.severity === 'tinggi' ? 'bg-red-50 border-red-200'
                          : ai.severity === 'sedang' ? 'bg-amber-50 border-amber-200'
                          : 'bg-stone-50 border-stone-200'}`}>
                          <p className="text-stone-800 text-sm leading-relaxed">{ai.ringkasan}</p>
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-stone-500 text-xs font-medium uppercase tracking-wide">Yang harus dicek:</p>
                          {ai.apa_yang_harus_dicek.map((item, i) => (
                            <div key={i} className="flex items-start gap-2 bg-white border border-stone-200 rounded-lg px-3 py-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <p className="text-stone-700 text-sm">{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Timeline kejadian */}
                    <div>
                      <p className="text-stone-400 text-xs uppercase tracking-wide font-medium mb-3">Timeline Kejadian</p>
                      <div className="space-y-2">
                        {a.kejadian.slice(0, 8).map((k, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-2 h-2 rounded-full ${
                                k.aksi === 'INSERT' ? 'bg-green-500'
                                : k.aksi === 'DELETE' || k.aksi === 'CANCEL' ? 'bg-red-500'
                                : 'bg-amber-500'}`} />
                              {i < Math.min(a.kejadian.length, 8) - 1 && <div className="w-px h-5 bg-stone-200" />}
                            </div>
                            <div className="flex-1 flex items-center justify-between bg-white border border-stone-200 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${AKSI_COLOR[k.aksi] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                                  {k.aksi}
                                </span>
                                <span className="text-stone-600 text-xs">{k.tabel}</span>
                              </div>
                              <span className="text-stone-400 text-xs">
                                {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab Audit Trail */}
      {tab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setFilterTabel('')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!filterTabel ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
              Semua
            </button>
            {tabelOptions.map(t => (
              <button key={t} onClick={() => setFilterTabel(filterTabel === t ? '' : t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterTabel === t ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300 hover:border-stone-400'}`}>
                {t}
              </button>
            ))}
            <span className="text-stone-400 text-xs ml-auto">{filteredAudit.length} entri</span>
          </div>

          {filteredAudit.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm">
              <p className="text-stone-600 font-medium">Belum Ada Log Audit</p>
              <p className="text-stone-400 text-sm mt-1">Log akan muncul saat ada perubahan data</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    {['Waktu', 'User', 'Tabel', 'Aksi', 'Perubahan'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-stone-500 text-xs font-medium">{h}</th>
                    ))}
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
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${AKSI_COLOR[log.aksi] ?? 'bg-stone-50 text-stone-600 border-stone-200'}`}>
                          {log.aksi}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400 max-w-xs truncate">
                        {log.nilai_lama && log.nilai_baru
                          ? Object.keys(log.nilai_baru).join(', ')
                          : log.aksi === 'INSERT' ? 'data baru' : 'dihapus'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAudit.length > auditVisible && (
                <div className="border-t border-stone-200 p-3 text-center">
                  <button onClick={() => setAuditVisible(v => v + 20)}
                    className="bg-white hover:bg-stone-50 text-stone-700 text-xs font-medium px-6 py-2 rounded-lg border border-stone-300 transition-colors">
                    Muat {Math.min(20, filteredAudit.length - auditVisible)} lagi
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
