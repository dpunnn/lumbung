'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { buildFields, hashFields } from '@/lib/pass'
import { cekKelayakan } from '@/lib/credit'
import type { ConsentMap, PassFields } from '@/lib/pass'
import type { HasilKelayakan } from '@/lib/credit'
import type { LumbungPass } from '@/types'
import { CreditCard, Plus, CheckCircle, ChevronRight, Info } from 'lucide-react'

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

export default function PassPage() {
  const [tab, setTab] = useState<'buat' | 'daftar' | 'cek'>('daftar')
  const [passList, setPassList] = useState<LumbungPass[]>([])
  const [consent, setConsent] = useState<ConsentMap>({ ternak: true, simpanan: true, pinjaman: true })
  const [form, setForm] = useState({ tujuan: '', mitra: '', hari: '30' })
  const [preview, setPreview] = useState<PassFields | null>(null)
  const [generated, setGenerated] = useState<LumbungPass | null>(null)
  const [loading, setLoading] = useState(false)
  const [koperasiId, setKoperasiId] = useState('')
  const [nik, setNik] = useState('')
  const [hasilCek, setHasilCek] = useState<HasilKelayakan | null>(null)
  const [loadingCek, setLoadingCek] = useState(false)

  const loadPasses = useCallback(async () => {
    const data = await api.get<LumbungPass[]>('/api/pass').catch(() => [] as LumbungPass[])
    setPassList(data ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      const me = await getMe()
      if (me?.koperasi_id) setKoperasiId(me.koperasi_id)
    }
    init()
    loadPasses()
  }, [loadPasses])

  useEffect(() => {
    // Realtime Supabase diganti polling karena backend kini Go/REST, bukan Supabase direct.
    const timer = setInterval(() => loadPasses(), 30_000)
    return () => clearInterval(timer)
  }, [loadPasses])

  async function handlePreview() {
    if (!koperasiId) return
    setLoading(true)
    const fields = await buildFields(koperasiId, consent)
    setPreview(fields)
    setLoading(false)
  }

  async function handleGenerate() {
    if (!preview || !koperasiId || !form.tujuan || !form.mitra) return
    setLoading(true)

    const hash = await hashFields(preview)
    const berlakuSampai = new Date()
    berlakuSampai.setDate(berlakuSampai.getDate() + parseInt(form.hari))

    try {
      const data = await api.post<LumbungPass>('/api/pass', {
        koperasi_id: koperasiId,
        tujuan: form.tujuan,
        mitra: form.mitra,
        fields: preview,
        hash,
        consent,
        berlaku_sampai: berlakuSampai.toISOString().split('T')[0],
        status: 'aktif',
      })
      if (data) {
        setGenerated(data)
        setTab('daftar')
        loadPasses()
      }
    } catch { /* biarkan lanjut */ }
    setLoading(false)
  }

  async function handleCabut(id: string) {
    if (!confirm('Cabut pass ini? Pemodal tidak bisa lagi mengaksesnya.')) return
    try {
      await api.put(`/api/pass/${id}`, { status: 'dicabut' })
    } catch { /* biarkan lanjut */ }
    loadPasses()
  }

  const toggleConsent = (k: keyof ConsentMap) =>
    setConsent(c => ({ ...c, [k]: !c[k] }))

  async function handleCek() {
    if (!nik.trim()) return
    setLoadingCek(true)
    setHasilCek(null)
    const hasil = await cekKelayakan(nik)
    setHasilCek(hasil)
    setLoadingCek(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Lumbung Pass</h1>
          <p className="text-stone-600 text-sm">Bagikan data koperasi secara aman ke pemodal</p>
        </div>
        <button onClick={() => { setTab('buat'); setPreview(null); setGenerated(null) }}
          className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Terbitkan Pass
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['daftar', 'buat', 'cek'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'buat' ? 'Terbitkan Baru' : t === 'cek' ? 'Cek Anggota' : 'Daftar Pass'}
          </button>
        ))}
      </div>

      {tab === 'buat' && (
        <div className="space-y-4">

          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-4">
            <h2 className="text-stone-900 font-medium text-sm">1. Pilih Data yang Dibagikan</h2>
            <div className="space-y-2">
              {([
                { key: 'ternak', label: 'Data Ternak', desc: 'Jumlah, rasio sehat, nilai aset terverifikasi' },
                { key: 'simpanan', label: 'Data Simpanan', desc: 'Total simpanan anggota (agregat, bukan per anggota)' },
                { key: 'pinjaman', label: 'Riwayat Pinjaman', desc: 'Rasio cicilan lancar vs macet' },
              ] as { key: keyof ConsentMap; label: string; desc: string }[]).map(item => (
                <label key={item.key} className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg cursor-pointer hover:bg-stone-100 transition-colors">
                  <input type="checkbox" checked={consent[item.key]} onChange={() => toggleConsent(item.key)}
                    className="mt-0.5 accent-amber-700" />
                  <div>
                    <p className="text-stone-900 text-sm font-medium">{item.label}</p>
                    <p className="text-stone-400 text-xs">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-3">
            <h2 className="text-stone-900 font-medium text-sm">2. Informasi Pass</h2>
            <div>
              <label className="block text-stone-600 text-xs mb-1.5">Tujuan Pembiayaan *</label>
              <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))}
                placeholder="Pengembangan usaha ternak sapi"
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-stone-600 text-xs mb-1.5">Nama Mitra / Pemodal *</label>
                <input value={form.mitra} onChange={e => setForm(f => ({ ...f, mitra: e.target.value }))}
                  placeholder="BRI Desa / Pak Hendra"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="block text-stone-600 text-xs mb-1.5">Berlaku (hari)</label>
                <select value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))}
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                  {['7','14','30','60','90'].map(h => <option key={h} value={h}>{h} hari</option>)}
                </select>
              </div>
            </div>
          </div>

          {!preview ? (
            <button onClick={handlePreview} disabled={loading || !form.tujuan || !form.mitra}
              className="w-full border border-amber-700 hover:bg-amber-50 disabled:opacity-50 text-amber-700 font-medium rounded-xl py-3 text-sm transition-colors inline-flex items-center justify-center gap-1.5">
              {loading ? 'Mengambil data...' : <><span>Preview Data</span> <ChevronRight className="w-4 h-4" /></>}
            </button>
          ) : (
            <div className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-stone-900 font-medium text-sm">3. Preview Data yang Akan Dibagikan</h2>
                <span className="text-green-700 text-xs bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">Data Agregat</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {preview.jumlah_ternak !== undefined && (
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-stone-400 text-xs">Ternak Hidup</p>
                    <p className="text-stone-900 font-semibold">{preview.jumlah_ternak} ekor</p>
                  </div>
                )}
                {preview.rasio_ternak_sehat !== undefined && (
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-stone-400 text-xs">Rasio Sehat</p>
                    <p className="text-stone-900 font-semibold">{preview.rasio_ternak_sehat}%</p>
                  </div>
                )}
                {preview.total_simpanan !== undefined && (
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-stone-400 text-xs">Total Simpanan</p>
                    <p className="text-stone-900 font-semibold">Rp{(preview.total_simpanan/1_000_000).toFixed(1)}jt</p>
                  </div>
                )}
                {preview.rasio_cicilan_lancar !== undefined && (
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-stone-400 text-xs">Cicilan Lancar</p>
                    <p className="text-stone-900 font-semibold">{preview.rasio_cicilan_lancar}%</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                <Info className="w-4 h-4 shrink-0" />
                <span>Tidak ada nama, NIK, atau nominal per anggota yang dibagikan</span>
              </div>
              <button onClick={handleGenerate} disabled={loading}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
                {loading ? 'Menerbitkan...' : 'Terbitkan Pass + Generate Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'cek' && (
        <div className="space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <h2 className="text-stone-900 font-medium text-sm">Cek Kelayakan Anggota</h2>
              <p className="text-stone-500 text-xs mt-1">
                Periksa riwayat kredit pemohon di seluruh jaringan koperasi sebelum menyetujui pinjaman.
                Hanya sinyal agregat yang ditampilkan — tanpa nama, nominal, atau identitas koperasi lain.
              </p>
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1.5">NIK Pemohon</label>
              <div className="flex gap-2">
                <input value={nik} onChange={e => setNik(e.target.value)}
                  placeholder="Mis. 3273010101900001"
                  className="flex-1 bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                <button onClick={handleCek} disabled={loadingCek || !nik.trim()}
                  className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap">
                  {loadingCek ? 'Mengecek...' : 'Cek Kelayakan'}
                </button>
              </div>
              <p className="text-stone-400 text-xs mt-1.5">NIK di-hash (SHA-256) sebelum dicocokkan — NIK asli tidak dikirim.</p>
            </div>
          </div>

          {hasilCek && (() => {
            const rek = hasilCek.rekomendasi
            const tema = rek === 'SETUJUI'
              ? { border: 'border-green-200', badge: 'bg-green-50 text-green-700 border-green-200', bar: 'bg-green-500', skor: 'text-green-700' }
              : rek === 'TINJAU'
              ? { border: 'border-amber-200', badge: 'bg-amber-50 text-amber-700 border-amber-200', bar: 'bg-amber-500', skor: 'text-amber-700' }
              : { border: 'border-red-200', badge: 'bg-red-50 text-red-600 border-red-200', bar: 'bg-red-500', skor: 'text-red-600' }
            const r = hasilCek.riwayat
            return (
              <div className={`bg-white border ${tema.border} rounded-xl shadow-sm p-5 space-y-4`}>
                <div className="flex items-center justify-between">
                  <p className="text-stone-500 text-xs">Rekomendasi Sistem</p>
                  <span className={`text-xs font-semibold border px-2.5 py-1 rounded-full ${tema.badge}`}>{rek}</span>
                </div>

                {hasilCek.ditemukan && (
                  <div>
                    <div className="flex items-end gap-2 mb-2">
                      <span className={`text-4xl font-bold ${tema.skor}`}>{hasilCek.skor}</span>
                      <span className="text-stone-400 text-sm mb-1">/100 skor kelayakan</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${tema.bar}`} style={{ width: `${hasilCek.skor}%` }} />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  {hasilCek.alasan.map((a, i) => (
                    <p key={i} className="text-stone-700 text-sm flex gap-2">
                      <span className="text-stone-400">•</span><span>{a}</span>
                    </p>
                  ))}
                </div>

                {r && r.jumlah_koperasi > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-stone-50 border border-stone-100 rounded-lg p-3 text-center">
                      <p className="text-stone-900 font-semibold">{r.angsuran_tepat}</p>
                      <p className="text-stone-400 text-xs">Tepat waktu</p>
                    </div>
                    <div className="bg-stone-50 border border-stone-100 rounded-lg p-3 text-center">
                      <p className="text-stone-900 font-semibold">{r.angsuran_terlambat}</p>
                      <p className="text-stone-400 text-xs">Terlambat</p>
                    </div>
                    <div className="bg-stone-50 border border-stone-100 rounded-lg p-3 text-center">
                      <p className="text-stone-900 font-semibold">{r.pinjaman_macet}</p>
                      <p className="text-stone-400 text-xs">Macet</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <span className="shrink-0">ℹ</span>
                  <span>Keputusan akhir ada di tangan <b>pengurus koperasi tujuan</b>. Sistem hanya merekomendasikan — tidak menyetujui/menolak otomatis.</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {generated && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
          <p className="text-green-700 font-medium text-sm inline-flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Pass berhasil diterbitkan!</p>
          <div className="bg-white border border-stone-200 rounded-lg p-3 break-all">
            <p className="text-stone-400 text-xs mb-1">Link untuk pemodal:</p>
            <p className="text-amber-700 text-sm">{ORIGIN}/pass/{generated.id}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${generated.id}`)}
            className="text-sm bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 px-4 py-2 rounded-lg transition-colors">
            Salin Link
          </button>
        </div>
      )}

      {tab === 'daftar' && (
        passList.length === 0 ? (
          <div className="text-center py-16 text-stone-400">
            <CreditCard className="w-10 h-10 mx-auto mb-3" />
            <p>Belum ada Pass yang diterbitkan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passList.map(p => {
              const expired = new Date(p.berlaku_sampai) < new Date()
              const statusColor = p.status === 'aktif' && !expired
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-stone-100 text-stone-600 border border-stone-200'
              return (
                <div key={p.id} className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-stone-900 font-medium text-sm">{p.tujuan}</p>
                      <p className="text-stone-400 text-xs">Mitra: {p.mitra} · Berlaku s.d. {p.berlaku_sampai}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                      {expired ? 'kedaluwarsa' : p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <a href={`/pass/${p.id}`} target="_blank"
                      className="text-amber-700 text-xs hover:underline inline-flex items-center gap-1">
                      Buka Link <ChevronRight className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${p.id}`)}
                      className="text-stone-400 text-xs hover:text-stone-900">
                      Salin
                    </button>
                    {p.status === 'aktif' && (
                      <button onClick={() => handleCabut(p.id)}
                        className="text-red-600 text-xs hover:text-red-500 ml-auto">
                        Cabut
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
