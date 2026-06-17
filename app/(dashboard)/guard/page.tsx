'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
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

const JENIS_LABEL: Record<string, string> = {
  simpanan_dispute:    'Sengketa nominal setoran',
  simpanan_claim:      'Setoran tidak tercatat',
  hapus_finansial:     'Penghapusan data finansial',
  ubah_nominal:        'Perubahan nominal setelah konfirmasi',
  pembatalan_luar_jam: 'Pembatalan di luar jam kerja',
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '13px 16px', textAlign: 'left', whiteSpace: 'nowrap',
}

const pill = (bg: string, color: string, border: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: bg, color, border: `1px solid ${border}`,
  display: 'inline-flex', alignItems: 'center', gap: 5,
})

const SEVERITY_PILL: Record<string, React.CSSProperties> = {
  tinggi: pill('rgba(214,87,69,.12)', '#c0392b', 'rgba(214,87,69,.28)'),
  sedang: pill('rgba(201,150,58,.14)', '#8a6420', 'rgba(201,150,58,.3)'),
  rendah: pill('rgba(26,71,49,.07)', '#46544b', 'rgba(26,71,49,.12)'),
}

const AKSI_PILL: Record<string, React.CSSProperties> = {
  INSERT: pill('rgba(47,158,99,.14)', '#1d7a4d', 'rgba(47,158,99,.3)'),
  UPDATE: pill('rgba(201,150,58,.14)', '#8a6420', 'rgba(201,150,58,.3)'),
  DELETE: pill('rgba(214,87,69,.12)', '#c0392b', 'rgba(214,87,69,.28)'),
  CANCEL: pill('rgba(214,87,69,.12)', '#c0392b', 'rgba(214,87,69,.28)'),
}

const BORDER_LEFT: Record<string, string> = {
  hapus_finansial:     '#d65745',
  ubah_nominal:        '#d65745',
  pembatalan_luar_jam: '#7c3aed',
  simpanan_dispute:    '#f97316',
  simpanan_claim:      '#c9963a',
}

export default function GuardPage() {
  const [tab, setTab] = useState<'anomali' | 'audit'>('anomali')
  const [anomali, setAnomali] = useState<AnomalyKasir[]>([])
  const [auditLog, setAuditLog] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTabel, setFilterTabel] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [auditVisible, setAuditVisible] = useState(20)
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({})
  const [aiResult, setAiResult] = useState<Record<string, AnomalyAnalysis>>({})

  const loadAnomali = useCallback(async () => {
    setLoading(true)
    const data = await getAnomalyKasir()
    setAnomali(data)
    setLoading(false)
  }, [])

  const loadAudit = useCallback(async () => {
    const data = await api.get<AuditLog[]>('/api/audit-log?limit=100').catch(() => [] as AuditLog[])
    setAuditLog(data)
  }, [])

  useEffect(() => { loadAnomali(); loadAudit() }, [loadAnomali, loadAudit])

  useEffect(() => {
    const timer = setInterval(() => { loadAnomali(); loadAudit() }, 30_000)
    return () => clearInterval(timer)
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
          nama: a.nama, jumlah_flag: a.jumlah_flag, jenis: a.jenis,
          kejadian: a.kejadian.slice(0, 10), simpanan_disputed: a.simpanan_disputed, simpanan_claimed: a.simpanan_claimed,
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

  const tabBtn = (active: boolean): React.CSSProperties => ({
    position: 'relative', padding: '9px 20px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  const filterBtn = (active: boolean): React.CSSProperties => ({
    fontSize: 12, padding: '6px 13px', borderRadius: 10, cursor: 'pointer',
    border: active ? '1px solid #1a4731' : '1px solid rgba(26,71,49,.16)',
    background: active ? 'linear-gradient(150deg,#1a4731,#0f2a1d)' : 'rgba(255,255,255,.6)',
    color: active ? '#fff' : '#46544b', fontWeight: active ? 700 : 600,
  })

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Guard</h1>
        <p style={{ fontSize: 13.5, color: '#6a766e' }}>Deteksi anomali & audit trail integritas data</p>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        <button onClick={() => setTab('anomali')} style={{ ...tabBtn(tab === 'anomali'), position: 'relative' }}>
          Anomali
          {anomali.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, background: '#d65745', color: '#fff', fontSize: 10, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              {anomali.length}
            </span>
          )}
        </button>
        <button onClick={() => setTab('audit')} style={tabBtn(tab === 'audit')}>
          Audit Trail
        </button>
      </div>

      {tab === 'anomali' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* info banner */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 14, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)' }}>
            <Info size={15} style={{ color: '#3b7fd4', marginTop: 1, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: '#3b7fd4', lineHeight: 1.55 }}>
              Sistem mendeteksi pola tidak biasa secara otomatis. Klik Analisis AI untuk penjelasan — bukan tuduhan, investigasi tetap dilakukan manusia.
            </p>
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
            </div>
          ) : anomali.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'rgba(47,158,99,.12)', border: '1px solid rgba(47,158,99,.2)', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <ShieldCheck size={30} style={{ color: '#1d7a4d' }} />
              </div>
              <p style={{ color: '#1d7a4d', fontWeight: 700, fontSize: 16 }}>Tidak Ada Anomali</p>
              <p style={{ color: '#7a857d', fontSize: 13, marginTop: 4 }}>Tidak ada pola mencurigakan dalam 7 hari terakhir</p>
            </div>
          ) : anomali.map(a => {
            const key = a.user_id
            const ai = aiResult[key]
            const isExpanded = expandedId === key
            const borderColor = BORDER_LEFT[a.jenis] ?? '#c9963a'
            return (
              <div key={key} style={{ ...glass, borderRadius: 18, overflow: 'hidden', borderLeft: `4px solid ${borderColor}` }}>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>{a.nama}</span>
                        <span style={pill('rgba(214,87,69,.12)', '#c0392b', 'rgba(214,87,69,.28)')}>{a.jumlah_flag} flag</span>
                        {ai && <span style={SEVERITY_PILL[ai.severity] ?? SEVERITY_PILL.rendah}>{ai.severity}</span>}
                      </div>
                      <p style={{ fontSize: 13.5, color: '#52605c' }}>{JENIS_LABEL[a.jenis]}</p>
                      {a.jenis === 'pembatalan_luar_jam' && a.rasio_luar_jam !== undefined && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                          <span style={pill('rgba(124,58,237,.1)', '#7c3aed', 'rgba(124,58,237,.25)')}>{a.rasio_luar_jam}% luar jam</span>
                          <span style={{ fontSize: 12, color: '#9aa39c' }}>{a.luar_jam_count} dari {a.total_aksi} pembatalan setelah jam tutup</span>
                        </div>
                      )}
                    </div>
                    <button onClick={() => handleExpand(key, a)}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 13px', borderRadius: 10, border: '1px solid rgba(26,71,49,.16)', background: 'rgba(255,255,255,.6)', fontSize: 12.5, fontWeight: 700, color: '#46544b', cursor: 'pointer', flexShrink: 0 }}>
                      <Sparkles size={13} style={{ color: '#c9963a' }} />
                      {isExpanded ? 'Tutup' : 'Analisis AI'}
                      <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(26,71,49,.08)', background: 'rgba(247,244,236,.5)', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {aiLoading[key] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#c9963a', fontSize: 13.5 }}>
                        <Loader2 size={16} style={{ animation: 'lmbSpin 0.8s linear infinite' }} />
                        Menganalisis dengan AI...
                      </div>
                    ) : ai ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#9aa39c' }}>
                          <Sparkles size={12} style={{ color: '#c9963a' }} />
                          Analisis {ai.sumber === 'ai' ? 'Claude AI' : 'sistem'}
                        </div>
                        <div style={{
                          borderRadius: 14, padding: '14px 16px',
                          background: ai.severity === 'tinggi' ? 'rgba(214,87,69,.08)' : ai.severity === 'sedang' ? 'rgba(201,150,58,.1)' : 'rgba(26,71,49,.05)',
                          border: ai.severity === 'tinggi' ? '1px solid rgba(214,87,69,.2)' : ai.severity === 'sedang' ? '1px solid rgba(201,150,58,.2)' : '1px solid rgba(26,71,49,.08)',
                        }}>
                          <p style={{ fontSize: 13.5, color: '#2c382f', lineHeight: 1.6 }}>{ai.ringkasan}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <p style={{ fontSize: 11.5, fontWeight: 800, color: '#9aa39c', letterSpacing: '.06em', textTransform: 'uppercase' }}>Yang harus dicek:</p>
                          {ai.apa_yang_harus_dicek.map((item, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 11, padding: '10px 12px' }}>
                              <AlertTriangle size={13} style={{ color: '#c9963a', flexShrink: 0, marginTop: 1 }} />
                              <p style={{ fontSize: 13.5, color: '#46544b' }}>{item}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div>
                      <p style={{ fontSize: 11.5, fontWeight: 800, color: '#9aa39c', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 12 }}>Timeline Kejadian</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {a.kejadian.slice(0, 8).map((k, i) => {
                          const dotColor = k.aksi === 'INSERT' ? '#2f9e63' : (k.aksi === 'DELETE' || k.aksi === 'CANCEL') ? '#d65745' : '#c9963a'
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                                {i < Math.min(a.kejadian.length, 8) - 1 && <div style={{ width: 1, height: 18, background: 'rgba(26,71,49,.1)' }} />}
                              </div>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 10, padding: '8px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={AKSI_PILL[k.aksi] ?? pill('rgba(26,71,49,.07)', '#46544b', 'rgba(26,71,49,.12)')}>{k.aksi}</span>
                                  <span style={{ fontSize: 13, color: '#52605c' }}>{k.tabel}</span>
                                </div>
                                <span style={{ fontSize: 12, color: '#9aa39c' }}>
                                  {new Date(k.waktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterTabel('')} style={filterBtn(!filterTabel)}>Semua</button>
            {tabelOptions.map(t => (
              <button key={t} onClick={() => setFilterTabel(filterTabel === t ? '' : t)} style={filterBtn(filterTabel === t)}>{t}</button>
            ))}
            <span style={{ fontSize: 12, color: '#9aa39c', marginLeft: 'auto' }}>{filteredAudit.length} entri</span>
          </div>

          {filteredAudit.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center', color: '#7a857d' }}>
              <p style={{ fontWeight: 700, color: '#46544b' }}>Belum Ada Log Audit</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Log akan muncul saat ada perubahan data</p>
            </div>
          ) : (
            <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                      {['Waktu', 'User', 'Tabel', 'Aksi', 'Perubahan'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAudit.slice(0, auditVisible).map(log => (
                      <tr key={log.id}
                        style={{ borderBottom: '1px solid rgba(26,71,49,.05)', transition: 'background .15s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <td style={{ padding: '12px 16px', color: '#9aa39c', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {new Date(log.dilakukan_pada).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ padding: '12px 16px', color: '#0f2a1d', fontWeight: 700 }}>
                          {log.profiles?.nama ?? <span style={{ color: '#9aa39c' }}>--</span>}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11.5, color: '#46544b', background: 'rgba(26,71,49,.07)', padding: '3px 9px', borderRadius: 8, border: '1px solid rgba(26,71,49,.1)', fontWeight: 600 }}>
                            {log.tabel_nama}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={AKSI_PILL[log.aksi] ?? pill('rgba(26,71,49,.07)', '#46544b', 'rgba(26,71,49,.12)')}>
                            {log.aksi}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#9aa39c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                          {log.nilai_lama && log.nilai_baru
                            ? Object.keys(log.nilai_baru).join(', ')
                            : log.aksi === 'INSERT' ? 'data baru' : 'dihapus'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filteredAudit.length > auditVisible && (
                <div style={{ borderTop: '1px solid rgba(26,71,49,.08)', padding: '12px 0', textAlign: 'center' }}>
                  <button onClick={() => setAuditVisible(v => v + 20)}
                    style={{ fontSize: 13, fontWeight: 700, color: '#1a4731', padding: '8px 22px', borderRadius: 10, border: '1px solid rgba(26,71,49,.2)', background: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
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
