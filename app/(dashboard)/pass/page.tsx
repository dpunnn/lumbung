'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buildFields, hashFields, hitungSkor } from '@/lib/pass'
import type { ConsentMap, PassFields } from '@/lib/pass'
import type { LumbungPass } from '@/types'

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

export default function PassPage() {
  const [tab, setTab] = useState<'buat' | 'daftar'>('daftar')
  const [passList, setPassList] = useState<LumbungPass[]>([])
  const [consent, setConsent] = useState<ConsentMap>({ ternak: true, simpanan: true, pinjaman: true })
  const [form, setForm] = useState({ tujuan: '', mitra: '', hari: '30' })
  const [preview, setPreview] = useState<PassFields | null>(null)
  const [generated, setGenerated] = useState<LumbungPass | null>(null)
  const [loading, setLoading] = useState(false)
  const [koperasiId, setKoperasiId] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('koperasi_id').eq('id', user.id).single()
      if (p) setKoperasiId(p.koperasi_id)
    })
    loadPasses()
  }, [])

  async function loadPasses() {
    const { data } = await supabase.from('lumbung_pass').select('*').order('created_at', { ascending: false })
    setPassList(data ?? [])
  }

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

    const { data, error } = await supabase.from('lumbung_pass').insert({
      koperasi_id: koperasiId,
      tujuan: form.tujuan,
      mitra: form.mitra,
      fields: preview,
      hash,
      consent,
      berlaku_sampai: berlakuSampai.toISOString().split('T')[0],
      status: 'aktif',
    }).select().single()

    if (!error && data) {
      setGenerated(data as LumbungPass)
      setTab('daftar')
      loadPasses()
    }
    setLoading(false)
  }

  async function handleCabut(id: string) {
    if (!confirm('Cabut pass ini? Pemodal tidak bisa lagi mengaksesnya.')) return
    await supabase.from('lumbung_pass').update({ status: 'dicabut' }).eq('id', id)
    loadPasses()
  }

  const toggleConsent = (k: keyof ConsentMap) =>
    setConsent(c => ({ ...c, [k]: !c[k] }))

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Lumbung Pass</h1>
          <p className="text-slate-400 text-sm">Bagikan data koperasi secara aman ke pemodal</p>
        </div>
        <button onClick={() => { setTab('buat'); setPreview(null); setGenerated(null) }}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          + Terbitkan Pass
        </button>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['daftar', 'buat'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors capitalize
              ${tab === t ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'buat' ? 'Terbitkan Baru' : 'Daftar Pass'}
          </button>
        ))}
      </div>

      {/* Form terbitkan baru */}
      {tab === 'buat' && (
        <div className="space-y-4">
          {/* Step 1: Consent */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-white font-medium text-sm">1. Pilih Data yang Dibagikan</h2>
            <div className="space-y-2">
              {([
                { key: 'ternak', label: 'Data Ternak', desc: 'Jumlah, rasio sehat, nilai aset terverifikasi' },
                { key: 'simpanan', label: 'Data Simpanan', desc: 'Total simpanan anggota (agregat, bukan per anggota)' },
                { key: 'pinjaman', label: 'Riwayat Pinjaman', desc: 'Rasio cicilan lancar vs macet' },
              ] as { key: keyof ConsentMap; label: string; desc: string }[]).map(item => (
                <label key={item.key} className="flex items-start gap-3 p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
                  <input type="checkbox" checked={consent[item.key]} onChange={() => toggleConsent(item.key)}
                    className="mt-0.5 accent-green-500" />
                  <div>
                    <p className="text-white text-sm font-medium">{item.label}</p>
                    <p className="text-slate-400 text-xs">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Step 2: Info */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h2 className="text-white font-medium text-sm">2. Informasi Pass</h2>
            <div>
              <label className="block text-slate-300 text-xs mb-1.5">Tujuan Pembiayaan *</label>
              <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))}
                placeholder="Pengembangan usaha ternak sapi"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 text-xs mb-1.5">Nama Mitra / Pemodal *</label>
                <input value={form.mitra} onChange={e => setForm(f => ({ ...f, mitra: e.target.value }))}
                  placeholder="BRI Desa / Pak Hendra"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label className="block text-slate-300 text-xs mb-1.5">Berlaku (hari)</label>
                <select value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                  {['7','14','30','60','90'].map(h => <option key={h} value={h}>{h} hari</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Preview */}
          {!preview ? (
            <button onClick={handlePreview} disabled={loading || !form.tujuan || !form.mitra}
              className="w-full border border-green-700 hover:bg-green-900/30 disabled:opacity-50 text-green-400 font-medium rounded-xl py-3 text-sm transition-colors">
              {loading ? 'Mengambil data...' : 'Preview Data →'}
            </button>
          ) : (
            <div className="bg-slate-900 border border-green-700/50 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-medium text-sm">3. Preview Data yang Akan Dibagikan</h2>
                <span className="text-green-400 text-xs bg-green-900/30 px-2 py-0.5 rounded-full">Data Agregat</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {preview.jumlah_ternak !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Ternak Hidup</p>
                    <p className="text-white font-semibold">{preview.jumlah_ternak} ekor</p>
                  </div>
                )}
                {preview.rasio_ternak_sehat !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Rasio Sehat</p>
                    <p className="text-white font-semibold">{preview.rasio_ternak_sehat}%</p>
                  </div>
                )}
                {preview.total_simpanan !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Total Simpanan</p>
                    <p className="text-white font-semibold">Rp{(preview.total_simpanan/1_000_000).toFixed(1)}jt</p>
                  </div>
                )}
                {preview.rasio_cicilan_lancar !== undefined && (
                  <div className="bg-slate-800 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">Cicilan Lancar</p>
                    <p className="text-white font-semibold">{preview.rasio_cicilan_lancar}%</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 bg-blue-950/50 border border-blue-900 rounded-lg px-3 py-2 text-xs text-blue-300">
                <span>ℹ</span>
                <span>Tidak ada nama, NIK, atau nominal per anggota yang dibagikan</span>
              </div>
              <button onClick={handleGenerate} disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-colors">
                {loading ? 'Menerbitkan...' : 'Terbitkan Pass + Generate Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Hasil generate */}
      {generated && (
        <div className="bg-green-950/50 border border-green-700 rounded-xl p-5 space-y-3">
          <p className="text-green-300 font-medium text-sm">✓ Pass berhasil diterbitkan!</p>
          <div className="bg-slate-900 rounded-lg p-3 break-all">
            <p className="text-slate-400 text-xs mb-1">Link untuk pemodal:</p>
            <p className="text-green-400 text-sm">{ORIGIN}/pass/{generated.id}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${generated.id}`)}
            className="text-sm border border-green-700 text-green-400 px-4 py-2 rounded-lg hover:bg-green-900/30">
            Salin Link
          </button>
        </div>
      )}

      {/* Daftar pass */}
      {tab === 'daftar' && (
        passList.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-2">🔑</p>
            <p>Belum ada Pass yang diterbitkan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passList.map(p => {
              const expired = new Date(p.berlaku_sampai) < new Date()
              const statusColor = p.status === 'aktif' && !expired
                ? 'bg-green-900/50 text-green-400 border-green-800'
                : 'bg-slate-800 text-slate-500 border-slate-700'
              return (
                <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">{p.tujuan}</p>
                      <p className="text-slate-400 text-xs">Mitra: {p.mitra} · Berlaku s.d. {p.berlaku_sampai}</p>
                    </div>
                    <span className={`text-xs border px-2 py-0.5 rounded-full ${statusColor}`}>
                      {expired ? 'kedaluwarsa' : p.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <a href={`/pass/${p.id}`} target="_blank"
                      className="text-green-400 text-xs hover:underline">
                      Buka Link →
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${p.id}`)}
                      className="text-slate-400 text-xs hover:text-white">
                      Salin
                    </button>
                    {p.status === 'aktif' && (
                      <button onClick={() => handleCabut(p.id)}
                        className="text-red-500 text-xs hover:text-red-400 ml-auto">
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
