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

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'border-red-200 bg-red-50',
  warning:  'border-amber-200 bg-amber-50',
  info:     'border-stone-200 bg-white',
}
const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-50 text-red-600 border border-red-200',
  warning:  'bg-amber-50 text-amber-700 border border-amber-200',
  info:     'bg-blue-50 text-blue-700 border border-blue-200',
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
      const [
        kopData,
        anggotaRows,
        simpananRows,
        pinjamanRows,
        angsuranRows,
        pakanRows,
        ternakRows,
      ] = await Promise.all([
        api.get<{ id: string; nama: string; fokus_usaha: string; modules: string[] }>(`/api/koperasi/${kopId}`).catch(() => null),
        api.get<{ id: string; nama: string; bergabung_at: string }[]>(`/api/anggota?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; anggota_id: string; jumlah: number; tanggal: string }[]>(`/api/simpanan?koperasi_id=${kopId}&status=confirmed`).catch(() => []),
        api.get<{ id: string; anggota_id: string; jumlah_pokok: number; created_at: string }[]>(`/api/pinjaman?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; jumlah_bayar: number; created_at: string; pinjaman_id: string }[]>(`/api/angsuran?koperasi_id=${kopId}&limit=500`).catch(() => []),
        api.get<{ id: string; nama: string; stok: number; satuan: string }[]>(`/api/stok?koperasi_id=${kopId}`).catch(() => []),
        api.get<{ id: string; kode: string; jenis: string; umur_bulan: number; status: string; vaksin_terakhir: string; jumlah_terverifikasi: number }[]>(`/api/stok/ternak?koperasi_id=${kopId}`).catch(() => []),
      ])

      if (!kopData) return

      const koperasi: Koperasi = {
        id: kopData.id,
        nama: kopData.nama,
        fokusUsaha: kopData.fokus_usaha,
        modules: (kopData.modules ?? []) as any,
        literasi: 'menengah',
        lokasi: '',
      }

      const anggota: Anggota[] = anggotaRows.map(a => ({
        id: a.id,
        tenantId: kopId,
        nama: a.nama,
        bergabung: a.bergabung_at ?? new Date().toISOString(),
      }))

      const transaksi: Transaksi[] = [
        ...simpananRows.map(s => ({
          id: s.id, tenantId: kopId, tipe: 'simpanan' as const,
          anggotaId: s.anggota_id, jumlah: s.jumlah,
          ts: s.tanggal ? new Date(s.tanggal).toISOString() : new Date().toISOString(),
        })),
        ...pinjamanRows.map(p => ({
          id: p.id, tenantId: kopId, tipe: 'pinjaman' as const,
          anggotaId: p.anggota_id, jumlah: p.jumlah_pokok,
          ts: p.created_at,
        })),
        ...angsuranRows.map(a => ({
          id: a.id, tenantId: kopId, tipe: 'angsuran' as const,
          jumlah: a.jumlah_bayar ?? 0, ts: a.created_at,
        })),
      ]

      const stok: StokItem[] = pakanRows.map(p => ({
        id: p.id, tenantId: kopId, nama: p.nama,
        qty: p.stok, satuan: p.satuan, kondisi: 'baik' as const,
      }))

      const ternak: Ternak[] = ternakRows.map(t => ({
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
        <h1 className="text-stone-900 text-xl font-bold">Lumbung Insight</h1>
        <p className="text-stone-600 text-sm">AI pendukung keputusan — verifikasi aset + analisis risiko</p>
      </div>

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {([
          { key: 'verifikasi', label: 'Verifikasi Ternak' },
          { key: 'skor', label: 'Skor Koperasi' },
          { key: 'sinyal', label: `Sinyal AI${signals.length > 0 ? ` (${signals.length})` : ''}` },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t.key ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'verifikasi' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Model COCO-SSD berjalan di browser — tidak ada data foto dikirim ke server.</span>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-4">

            <div>
              <label className="block text-stone-600 text-sm font-medium mb-2">Upload Foto Ternak</label>
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-300 rounded-xl cursor-pointer hover:border-amber-500 transition-colors">
                <Upload className="w-6 h-6 text-stone-400 mb-1" />
                <span className="text-stone-400 text-sm">Klik untuk pilih foto</span>
                <span className="text-stone-400 text-xs mt-1">JPG / PNG / WEBP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {imgUrl && (
              <div className="space-y-3">

                <img ref={imgRef} src={imgUrl} alt="preview"
                  className="w-full rounded-xl object-contain max-h-72 bg-stone-100" />

                <button onClick={handleDeteksi}
                  disabled={detecting || !modelReady}
                  className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
                  {!modelReady ? 'Memuat model AI...' : detecting ? 'Mendeteksi...' : 'Deteksi Ternak'}
                </button>
              </div>
            )}

            {hasil && (
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-stone-900 font-semibold text-lg">{hasil.jumlah} ternak terdeteksi</p>
                  <span className="bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full">
                    Terverifikasi
                  </span>
                </div>

                {Object.entries(hasil.rincian).length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(hasil.rincian).map(([kelas, jml]) => (
                      <span key={kelas} className="bg-stone-100 text-stone-600 border border-stone-200 text-xs px-3 py-1 rounded-full">
                        {kelas}: {jml}
                      </span>
                    ))}
                  </div>
                )}

                <div className="text-xs text-stone-400 space-y-1">
                  {hasil.deteksi.filter(d => ['cow', 'sheep', 'horse'].includes(d.class)).map((d, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{d.class}</span>
                      <span className="text-stone-400">{Math.round(d.score * 100)}% confidence</span>
                    </div>
                  ))}
                </div>

                <p className="text-stone-400 text-xs border-t border-stone-200 pt-2">
                  Hasil ini dapat disimpan sebagai bukti verifikasi aset untuk Lumbung Pass.
                </p>
              </div>
            )}

            {imgUrl && !hasil && !detecting && modelReady && (
              <p className="text-stone-400 text-xs text-center">Klik tombol deteksi untuk memulai analisis.</p>
            )}
          </div>
        </div>
      )}

      {tab === 'skor' && (
        <div className="space-y-4">
          {loadingEngine ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Menghitung skor...</p>
            </div>
          ) : !skor ? (
            <p className="text-stone-400 text-sm">Tidak ada data untuk dihitung.</p>
          ) : (
            <div className="space-y-4">

              <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5">
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-stone-600 text-sm mb-1">Skor Kesehatan Koperasi</p>
                    <p className={`text-5xl font-bold ${skor.skor >= 75 ? 'text-green-700' : skor.skor >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                      {skor.skor}
                    </p>
                    <p className="text-stone-400 text-sm mt-1">/100 — {skor.level}</p>
                  </div>
                  <div className="flex-1">
                    <div className="h-3 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${skor.skor >= 75 ? 'bg-green-500' : skor.skor >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${skor.skor}%` }} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {skor.explain.map((e, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-stone-600">{e.faktor}</span>
                          <span className="text-stone-900">{e.nilai}/100</span>
                        </div>
                        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-600/70 rounded-full" style={{ width: `${e.nilai}%` }} />
                        </div>
                      </div>
                      <span className="text-stone-400 text-xs w-10 text-right">{Math.round(e.bobot * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-stone-400 text-xs text-center">
                Skor ini digunakan sebagai dasar Lumbung Pass untuk pemodal.
              </p>
            </div>
          )}
        </div>
      )}

      {tab === 'sinyal' && (
        <div className="space-y-3">
          {loadingEngine ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Menganalisis data...</p>
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-3" />
              <p>Tidak ada sinyal peringatan. Kondisi normal.</p>
            </div>
          ) : (
            signals.map(s => (
              <div key={s.id} className={`border rounded-xl p-4 ${SEVERITY_COLOR[s.severity]}`}>
                <div className="flex items-start justify-between mb-2">
                  <p className="text-stone-900 font-medium text-sm">{s.judul}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${SEVERITY_BADGE[s.severity]}`}>
                    {s.severity}
                  </span>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">{s.narasi}</p>

                {s.explain.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-stone-200 space-y-1">
                    {s.explain.filter(e => e.bobot > 0).map((e, i) => (
                      <div key={i} className="flex justify-between text-xs text-stone-400">
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
