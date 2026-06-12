'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { loadModel, hitungTernak, type HasilDeteksi } from '@/lib/vision'
import { runInsight } from '@/lib/insight/engine'
import { hitungSkorKoperasi } from '@/lib/insight/scoring'
import type { Signal, InsightInput } from '@/lib/insight/types'
import type { Koperasi, Anggota, Transaksi, StokItem, Ternak } from '@/lib/types'

type Tab = 'verifikasi' | 'skor' | 'sinyal'

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'border-red-800 bg-red-950/40',
  warning:  'border-yellow-800 bg-yellow-950/30',
  info:     'border-slate-700 bg-slate-900',
}
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-900/60 text-red-400 border-red-800',
  warning:  'bg-yellow-900/60 text-yellow-400 border-yellow-800',
  info:     'bg-blue-900/60 text-blue-400 border-blue-800',
}

export default function InsightPage() {
  const [tab, setTab] = useState<Tab>('verifikasi')
  const [koperasiId, setKoperasiId] = useState('')

  // COCO-SSD state
  const imgRef = useRef<HTMLImageElement>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [hasil, setHasil] = useState<HasilDeteksi | null>(null)
  const [modelReady, setModelReady] = useState(false)

  // Engine state
  const [signals, setSignals] = useState<Signal[]>([])
  const [skor, setSkor] = useState<ReturnType<typeof hitungSkorKoperasi> | null>(null)
  const [loadingEngine, setLoadingEngine] = useState(false)

  // Preload model di background
  useEffect(() => {
    loadModel().then(() => setModelReady(true)).catch(console.error)
  }, [])

  // Ambil koperasi_id dari profile
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('koperasi_id').eq('id', user.id).single()
      if (p?.koperasi_id) {
        setKoperasiId(p.koperasi_id)
        loadEngine(p.koperasi_id)
      }
    })
  }, [])

  async function loadEngine(kopId: string) {
    setLoadingEngine(true)
    try {
      const [
        { data: kopData },
        { data: anggotaRows },
        { data: simpananRows },
        { data: pinjamanRows },
        { data: angsuranRows },
        { data: pakanRows },
        { data: ternakRows },
      ] = await Promise.all([
        supabase.from('koperasi').select('id, nama, fokus_usaha, modules').eq('id', kopId).single(),
        supabase.from('anggota').select('id, nama, bergabung_at').eq('koperasi_id', kopId),
        supabase.from('simpanan').select('id, anggota_id, jumlah, created_at').eq('koperasi_id', kopId),
        supabase.from('pinjaman').select('id, anggota_id, jumlah, created_at').eq('koperasi_id', kopId),
        supabase.from('angsuran').select('id, jumlah_bayar, created_at, pinjaman_id').limit(200),
        supabase.from('pakan').select('id, nama, stok, satuan').eq('koperasi_id', kopId),
        supabase.from('ternak').select('id, kode, jenis, umur_bulan, status, vaksin_terakhir, jumlah_terverifikasi').eq('koperasi_id', kopId),
      ])

      if (!kopData) return

      // Map ke InsightInput types
      const koperasi: Koperasi = {
        id: kopData.id,
        nama: kopData.nama,
        fokusUsaha: kopData.fokus_usaha,
        modules: (kopData.modules ?? []) as any,
        literasi: 'menengah',
        lokasi: '',
      }

      const anggota: Anggota[] = (anggotaRows ?? []).map(a => ({
        id: a.id,
        tenantId: kopId,
        nama: a.nama,
        bergabung: a.bergabung_at ?? new Date().toISOString(),
      }))

      const transaksi: Transaksi[] = [
        ...(simpananRows ?? []).map(s => ({
          id: s.id, tenantId: kopId, tipe: 'simpanan' as const,
          anggotaId: s.anggota_id, jumlah: s.jumlah, ts: s.created_at,
        })),
        ...(pinjamanRows ?? []).map(p => ({
          id: p.id, tenantId: kopId, tipe: 'pinjaman' as const,
          anggotaId: p.anggota_id, jumlah: p.jumlah, ts: p.created_at,
        })),
        ...(angsuranRows ?? []).map(a => ({
          id: a.id, tenantId: kopId, tipe: 'angsuran' as const,
          jumlah: a.jumlah_bayar ?? 0, ts: a.created_at,
        })),
      ]

      const stok: StokItem[] = (pakanRows ?? []).map(p => ({
        id: p.id, tenantId: kopId, nama: p.nama,
        qty: p.stok, satuan: p.satuan, kondisi: 'baik' as const,
      }))

      const ternak: Ternak[] = (ternakRows ?? []).map(t => ({
        id: t.id, tenantId: kopId, tag: t.kode, jenis: t.jenis,
        umurBulan: t.umur_bulan ?? 0, bobotKg: 0,
        vaksin: t.vaksin_terakhir ? [t.vaksin_terakhir] : [],
        status: t.status === 'pantau' ? 'perlu_vaksin' : (t.status ?? 'sehat') as any,
      }))

      const input: InsightInput = { koperasi, anggota, transaksi, stok, ternak }
      const sgnls = runInsight(input)
      setSignals(sgnls)
      setSkor(hitungSkorKoperasi(input))
    } catch (e) {
      console.error('Engine error:', e)
    }
    setLoadingEngine(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    setHasil(null)
  }

  async function handleDeteksi() {
    if (!imgRef.current || !imgUrl) return
    setDetecting(true)
    try {
      const h = await hitungTernak(imgRef.current)
      setHasil(h)
    } catch (err) {
      console.error(err)
    }
    setDetecting(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-white text-xl font-semibold">Lumbung Insight</h1>
        <p className="text-slate-400 text-sm">AI pendukung keputusan — verifikasi aset + analisis risiko</p>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {([
          { key: 'verifikasi', label: 'Verifikasi Ternak' },
          { key: 'skor', label: 'Skor Koperasi' },
          { key: 'sinyal', label: `Sinyal AI${signals.length > 0 ? ` (${signals.length})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t.key ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Verifikasi Ternak (COCO-SSD) */}
      {tab === 'verifikasi' && (
        <div className="space-y-4">
          <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
            <span>ℹ</span>
            <span>Model COCO-SSD berjalan di browser — tidak ada data foto dikirim ke server.</span>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            {/* Upload */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Upload Foto Ternak</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-xl cursor-pointer hover:border-green-600 transition-colors">
                <span className="text-slate-500 text-sm">Klik untuk pilih foto</span>
                <span className="text-slate-600 text-xs mt-1">JPG / PNG / WEBP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {/* Preview */}
            {imgUrl && (
              <div className="space-y-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={imgRef} src={imgUrl} alt="preview"
                  className="w-full rounded-xl object-contain max-h-72 bg-slate-800" />

                <button onClick={handleDeteksi}
                  disabled={detecting || !modelReady}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
                  {!modelReady ? 'Memuat model AI...' : detecting ? 'Mendeteksi...' : 'Deteksi Ternak'}
                </button>
              </div>
            )}

            {/* Hasil */}
            {hasil && (
              <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-semibold text-lg">{hasil.jumlah} ternak terdeteksi</p>
                  <span className="bg-green-900/60 text-green-400 border border-green-800 text-xs px-2 py-0.5 rounded-full">
                    Terverifikasi
                  </span>
                </div>

                {Object.entries(hasil.rincian).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(hasil.rincian).map(([kelas, jml]) => (
                      <span key={kelas} className="bg-slate-700 text-slate-200 text-xs px-3 py-1 rounded-full">
                        {kelas}: {jml}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-slate-400 space-y-1">
                  {hasil.deteksi.filter(d => ['cow', 'sheep', 'horse'].includes(d.class)).map((d, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{d.class}</span>
                      <span className="text-slate-500">{Math.round(d.score * 100)}% confidence</span>
                    </div>
                  ))}
                </div>

                <p className="text-slate-400 text-xs border-t border-slate-700 pt-2">
                  Hasil ini dapat disimpan sebagai bukti verifikasi aset untuk Lumbung Pass.
                </p>
              </div>
            )}

            {imgUrl && !hasil && !detecting && modelReady && (
              <p className="text-slate-500 text-xs text-center">Klik tombol deteksi untuk memulai analisis.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Skor Koperasi */}
      {tab === 'skor' && (
        <div className="space-y-4">
          {loadingEngine ? (
            <p className="text-slate-500 text-sm">Menghitung skor...</p>
          ) : !skor ? (
            <p className="text-slate-500 text-sm">Tidak ada data untuk dihitung.</p>
          ) : (
            <div className="space-y-4">
              {/* Skor besar */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-slate-400 text-sm mb-1">Skor Kesehatan Koperasi</p>
                    <p className={`text-5xl font-bold ${skor.skor >= 75 ? 'text-green-400' : skor.skor >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {skor.skor}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">/100 — {skor.level}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${skor.skor >= 75 ? 'bg-green-500' : skor.skor >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                        style={{ width: `${skor.skor}%` }} />
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="space-y-2">
                  {skor.explain.map((e, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400">{e.faktor}</span>
                          <span className="text-white">{e.nilai}/100</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-green-600/70 rounded-full" style={{ width: `${e.nilai}%` }} />
                        </div>
                      </div>
                      <span className="text-slate-500 text-xs w-10 text-right">{Math.round(e.bobot * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-slate-500 text-xs text-center">
                Skor ini digunakan sebagai dasar Lumbung Pass untuk pemodal.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Sinyal AI */}
      {tab === 'sinyal' && (
        <div className="space-y-3">
          {loadingEngine ? (
            <p className="text-slate-500 text-sm">Menganalisis data...</p>
          ) : signals.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-2">✓</p>
              <p>Tidak ada sinyal peringatan. Kondisi normal.</p>
            </div>
          ) : (
            signals.map(s => (
              <div key={s.id} className={`border rounded-xl p-4 ${SEVERITY_COLOR[s.severity]}`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-white font-medium text-sm">{s.judul}</p>
                  <span className={`text-xs border px-2 py-0.5 rounded-full ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                </div>
                <p className="text-slate-400 text-xs leading-relaxed">{s.narasi}</p>

                {s.explain.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                    {s.explain.filter(e => e.bobot > 0).map((e, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-500">
                        <span>{e.faktor}</span>
                        <span>{e.nilai}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
