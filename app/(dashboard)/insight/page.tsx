'use client'

import { useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { loadModel, hitungTernak, type HasilDeteksi } from '@/lib/vision'
import { runInsight } from '@/lib/insight/engine'
import { hitungSkorKoperasi } from '@/lib/insight/scoring'
import type { Signal, InsightInput } from '@/lib/insight/types'
import type { Koperasi, Anggota, Transaksi, StokItem, Ternak } from '@/lib/types'
import { CheckCircle, Info, Upload } from 'lucide-react'

type Tab = 'verifikasi' | 'skor' | 'sinyal'

const SEVERITY_PILL: Record<string, React.CSSProperties> = {
  critical: { background: 'rgba(214,87,69,.1)', color: '#c0392b', border: '1px solid rgba(214,87,69,.25)' },
  warning:  { background: 'rgba(201,150,58,.12)', color: '#8a6420', border: '1px solid rgba(201,150,58,.3)' },
  info:     { background: 'rgba(59,130,246,.1)', color: '#3b7fd4', border: '1px solid rgba(59,130,246,.25)' },
}
const SEVERITY_CARD: Record<string, React.CSSProperties> = {
  critical: { background: 'rgba(214,87,69,.07)', border: '1px solid rgba(214,87,69,.2)', borderLeft: '4px solid #d65745' },
  warning:  { background: 'rgba(201,150,58,.07)', border: '1px solid rgba(201,150,58,.2)', borderLeft: '4px solid #c9963a' },
  info:     { background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.7)', borderLeft: '4px solid rgba(26,71,49,.3)' },
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)', boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}
const greenBtn: React.CSSProperties = {
  background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none',
  fontWeight: 700, borderRadius: 12, padding: '12px 18px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 13.5, width: '100%',
}

export default function InsightPage() {
  const [tab, setTab] = useState<Tab>('verifikasi')
  const [koperasiId, setKoperasiId] = useState('')

  const imgRef = useRef<HTMLImageElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [hasil, setHasil] = useState<HasilDeteksi | null>(null)
  const [modelReady, setModelReady] = useState(false)

  const [signals, setSignals] = useState<Signal[]>([])
  const [skor, setSkor] = useState<ReturnType<typeof hitungSkorKoperasi> | null>(null)
  const [loadingEngine, setLoadingEngine] = useState(false)

  useEffect(() => {
    loadModel().then(() => setModelReady(true)).catch(console.error)
  }, [])

  useEffect(() => {
    getMe().then(me => {
      if (!me?.koperasi_id) return
      setKoperasiId(me.koperasi_id)
      loadEngine(me.koperasi_id)
    })
  }, [])

  async function loadEngine(kopId: string) {
    setLoadingEngine(true)
    try {
      const [kopData, anggotaRows, simpananRows, pinjamanRows, angsuranRows, pakanRows, ternakRows] = await Promise.all([
        api.get<{ id: string; nama: string; fokus_usaha: string; modules: string[] }>(`/api/koperasi/${kopId}`).catch(() => null),
        api.get<{ id: string; nama: string; bergabung_at: string }[]>(`/api/anggota?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; anggota_id: string; jumlah: number; tanggal: string }[]>(`/api/simpanan?koperasi_id=${kopId}&status=confirmed`).catch(() => []),
        api.get<{ id: string; anggota_id: string; jumlah_pokok: number; created_at: string }[]>(`/api/pinjaman?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; jumlah_bayar: number; created_at: string; pinjaman_id: string }[]>(`/api/angsuran?koperasi_id=${kopId}&limit=500`).catch(() => []),
        api.get<{ id: string; nama: string; stok: number; satuan: string }[]>(`/api/stok?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; kode: string; jenis: string; umur_bulan: number; status: string; vaksin_terakhir: string; jumlah_terverifikasi: number }[]>(`/api/stok/ternak?koperasi_id=${kopId}`).catch(() => []),
      ])
      if (!kopData) return

      const koperasi: Koperasi = { id: kopData.id, nama: kopData.nama, fokusUsaha: kopData.fokus_usaha, modules: (kopData.modules ?? []) as any, literasi: 'menengah', lokasi: '' }
      const anggota: Anggota[] = anggotaRows.map(a => ({ id: a.id, tenantId: kopId, nama: a.nama, bergabung: a.bergabung_at ?? new Date().toISOString() }))
      const transaksi: Transaksi[] = [
        ...simpananRows.map(s => ({ id: s.id, tenantId: kopId, tipe: 'simpanan' as const, anggotaId: s.anggota_id, jumlah: s.jumlah, ts: s.tanggal ? new Date(s.tanggal).toISOString() : new Date().toISOString() })),
        ...pinjamanRows.map(p => ({ id: p.id, tenantId: kopId, tipe: 'pinjaman' as const, anggotaId: p.anggota_id, jumlah: p.jumlah_pokok, ts: p.created_at })),
        ...angsuranRows.map(a => ({ id: a.id, tenantId: kopId, tipe: 'angsuran' as const, jumlah: a.jumlah_bayar ?? 0, ts: a.created_at })),
      ]
      const stok: StokItem[] = pakanRows.map(p => ({ id: p.id, tenantId: kopId, nama: p.nama, qty: p.stok, satuan: p.satuan, kondisi: 'baik' as const }))
      const ternak: Ternak[] = ternakRows.map(t => ({ id: t.id, tenantId: kopId, tag: t.kode, jenis: t.jenis, umurBulan: t.umur_bulan ?? 0, bobotKg: 0, vaksin: t.vaksin_terakhir ? [t.vaksin_terakhir] : [], status: t.status === 'pantau' ? 'perlu_vaksin' : (t.status ?? 'sehat') as any }))

      const input: InsightInput = { koperasi, anggota, transaksi, stok, ternak }
      setSignals(runInsight(input))
      setSkor(hitungSkorKoperasi(input))
    } catch (e) { console.error('Engine error:', e) }
    setLoadingEngine(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImgUrl(URL.createObjectURL(file)); setHasil(null)
  }

  async function handleDeteksi() {
    if (!imgRef.current || !imgUrl) return
    setDetecting(true)
    try { setHasil(await hitungTernak(imgRef.current)) } catch (err) { console.error(err) }
    setDetecting(false)
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '9px 16px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  return (
    <div style={{ maxWidth: 768, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Insight</h1>
        <p style={{ fontSize: 13.5, color: '#6a766e' }}>AI pendukung keputusan — verifikasi aset + analisis risiko</p>
      </div>

      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        {([
          { key: 'verifikasi', label: 'Verifikasi Ternak' },
          { key: 'skor', label: 'Skor Koperasi' },
          { key: 'sinyal', label: `Sinyal AI${signals.length > 0 ? ` (${signals.length})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={tabBtn(tab === t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'verifikasi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 14, padding: '12px 16px', fontSize: 13, color: '#3b7fd4', display: 'flex', alignItems: 'flex-start', gap: 9 }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Model COCO-SSD berjalan di browser — tidak ada data foto dikirim ke server.</span>
          </div>

          <div style={{ ...glass, borderRadius: 20, padding: '20px' }}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f2a1d', marginBottom: 8 }}>Upload Foto Ternak</p>
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: 120, border: '2px dashed rgba(26,71,49,.2)', borderRadius: 14, cursor: 'pointer', transition: 'border-color .2s' }}>
                <Upload size={24} style={{ color: '#c4ccc6', marginBottom: 8 }} />
                <span style={{ fontSize: 13.5, color: '#9aa39c' }}>Klik untuk pilih foto</span>
                <span style={{ fontSize: 12, color: '#c4ccc6', marginTop: 4 }}>JPG / PNG / WEBP</span>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              </label>
            </div>

            {imgUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <img ref={imgRef} src={imgUrl} alt="preview"
                  style={{ width: '100%', borderRadius: 14, objectFit: 'contain', maxHeight: 280, background: 'rgba(26,71,49,.04)' }} />
                <button onClick={handleDeteksi} disabled={detecting || !modelReady}
                  style={{ ...greenBtn, opacity: (detecting || !modelReady) ? 0.5 : 1 }}>
                  {!modelReady ? 'Memuat model AI...' : detecting ? 'Mendeteksi...' : 'Deteksi Ternak'}
                </button>
              </div>
            )}

            {hasil && (
              <div style={{ background: 'rgba(26,71,49,.04)', border: '1px solid rgba(26,71,49,.1)', borderRadius: 16, padding: '16px', marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p style={{ fontSize: 18, fontWeight: 800, color: '#0f2a1d' }}>{hasil.jumlah} ternak terdeteksi</p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1d7a4d', background: 'rgba(47,158,99,.14)', border: '1px solid rgba(47,158,99,.3)', padding: '3px 10px', borderRadius: 999 }}>Terverifikasi</span>
                </div>
                {Object.entries(hasil.rincian).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                    {Object.entries(hasil.rincian).map(([kelas, jml]) => (
                      <span key={kelas} style={{ fontSize: 12, fontWeight: 600, color: '#46544b', background: 'rgba(26,71,49,.07)', border: '1px solid rgba(26,71,49,.12)', padding: '4px 12px', borderRadius: 999 }}>
                        {kelas}: {jml}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: '#9aa39c' }}>
                  {hasil.deteksi.filter(d => ['cow', 'sheep', 'horse'].includes(d.class)).map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{d.class}</span>
                      <span>{Math.round(d.score * 100)}% confidence</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#9aa39c', borderTop: '1px solid rgba(26,71,49,.08)', paddingTop: 10, marginTop: 10 }}>
                  Hasil ini dapat disimpan sebagai bukti verifikasi aset untuk Lumbung Pass.
                </p>
              </div>
            )}

            {imgUrl && !hasil && !detecting && modelReady && (
              <p style={{ fontSize: 12, color: '#9aa39c', textAlign: 'center', marginTop: 12 }}>Klik tombol deteksi untuk memulai analisis.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'skor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {loadingEngine ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '60px 0', ...glass, borderRadius: 20 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13.5, color: '#9aa39c' }}>Menghitung skor...</p>
            </div>
          ) : !skor ? (
            <p style={{ fontSize: 13.5, color: '#9aa39c' }}>Tidak ada data untuk dihitung.</p>
          ) : (
            <>
              <div style={{ ...glass, borderRadius: 20, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 13, color: '#9aa39c', marginBottom: 6 }}>Skor Kesehatan Koperasi</p>
                    <p style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: skor.skor >= 75 ? '#1d7a4d' : skor.skor >= 50 ? '#8a6420' : '#c0392b' }}>{skor.skor}</p>
                    <p style={{ fontSize: 13, color: '#9aa39c', marginTop: 6 }}>/100 — {skor.level}</p>
                  </div>
                  <div style={{ flex: 1, marginBottom: 8 }}>
                    <div style={{ height: 12, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 999, transition: 'width .5s', background: skor.skor >= 75 ? '#2f9e63' : skor.skor >= 50 ? '#c9963a' : '#d65745', width: `${skor.skor}%` }} />
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {skor.explain.map((e, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
                        <span style={{ color: '#46544b' }}>{e.faktor}</span>
                        <span style={{ color: '#0f2a1d', fontWeight: 700 }}>{e.nilai}/100</span>
                      </div>
                      <div style={{ height: 7, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'rgba(201,150,58,.5)', borderRadius: 999, width: `${e.nilai}%` }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#9aa39c', marginTop: 3, textAlign: 'right' }}>{Math.round(e.bobot * 100)}% bobot</p>
                    </div>
                  ))}
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#9aa39c', textAlign: 'center' }}>Skor ini digunakan sebagai dasar Lumbung Pass untuk pemodal.</p>
            </>
          )}
        </div>
      )}

      {tab === 'sinyal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loadingEngine ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, padding: '60px 0', ...glass, borderRadius: 20 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13.5, color: '#9aa39c' }}>Menganalisis data...</p>
            </div>
          ) : signals.length === 0 ? (
            <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center' }}>
              <CheckCircle size={36} style={{ margin: '0 auto 12px', color: '#2f9e63' }} />
              <p style={{ fontWeight: 700, color: '#1d7a4d', fontSize: 15 }}>Tidak ada sinyal peringatan</p>
              <p style={{ fontSize: 13, color: '#9aa39c', marginTop: 4 }}>Kondisi normal</p>
            </div>
          ) : signals.map(s => (
            <div key={s.id} style={{ ...SEVERITY_CARD[s.severity], backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', boxShadow: '0 10px 26px rgba(26,71,49,.08)', borderRadius: 16, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d', flex: 1, marginRight: 10 }}>{s.judul}</p>
                <span style={{ fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999, flexShrink: 0, ...SEVERITY_PILL[s.severity] }}>{s.severity}</span>
              </div>
              <p style={{ fontSize: 13, color: '#46544b', lineHeight: 1.6 }}>{s.narasi}</p>
              {s.explain.length > 0 && (
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(26,71,49,.08)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {s.explain.filter(e => e.bobot > 0).map((e, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9aa39c' }}>
                      <span>{e.faktor}</span><span>{e.nilai}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
