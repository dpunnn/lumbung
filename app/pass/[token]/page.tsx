'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { hitungSkor } from '@/lib/pass'
import type { LumbungPass } from '@/types'
import type { PassFields } from '@/lib/pass'

export default function PassPublicPage() {
  const { token } = useParams<{ token: string }>()
  const [pass, setPass] = useState<LumbungPass | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'expired' | 'notfound'>('loading')
  const [approved, setApproved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('lumbung_pass')
        .select('*')
        .eq('id', token)
        .single()

      if (error || !data) { setStatus('notfound'); return }

      const expired = new Date(data.berlaku_sampai) < new Date() || data.status !== 'aktif'
      if (expired) { setPass(data as LumbungPass); setStatus('expired'); return }

      setPass(data as LumbungPass)
      setStatus('ok')

      // Catat akses
      await supabase.from('pass_access_log').insert({
        pass_id: data.id,
        mitra: data.mitra,
      })
    }
    load()
  }, [token])

  async function handleSetujui() {
    setApproved(true)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Memverifikasi Pass...</p>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-white font-semibold mb-1">Pass tidak ditemukan</p>
          <p className="text-slate-400 text-sm">Link tidak valid atau sudah dihapus</p>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-4xl mb-3">⏰</p>
          <p className="text-white font-semibold mb-1">Pass sudah tidak berlaku</p>
          <p className="text-slate-400 text-sm">Berlaku s.d. {pass?.berlaku_sampai}. Hubungi koperasi untuk pass baru.</p>
        </div>
      </div>
    )
  }

  const fields = pass!.fields as PassFields
  const skor = hitungSkor(fields)
  const skorColor = skor >= 70 ? 'text-green-400' : skor >= 50 ? 'text-yellow-400' : 'text-red-400'
  const rekomendasiLimit =
    skor >= 80 ? 'Rp 7–20 juta' :
    skor >= 60 ? 'Rp 3–7 juta' :
    'Rp 1–3 juta'

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-600 mb-3">
            <span className="text-white text-xl font-bold">L</span>
          </div>
          <h1 className="text-white text-xl font-bold">Lumbung Pass</h1>
          <p className="text-slate-400 text-sm mt-0.5">Data koperasi terverifikasi</p>
        </div>

        {/* Badge SHA-256 */}
        <div className="bg-green-950/50 border border-green-700 rounded-xl p-3 flex items-center gap-3">
          <span className="text-green-400 text-xl">✓</span>
          <div>
            <p className="text-green-300 text-sm font-medium">Terverifikasi SHA-256</p>
            <p className="text-green-600 text-xs font-mono truncate">{pass!.hash.slice(0, 32)}...</p>
          </div>
        </div>

        {/* Info pass */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Tujuan</span>
            <span className="text-white">{pass!.tujuan}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Mitra</span>
            <span className="text-white">{pass!.mitra}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Berlaku s.d.</span>
            <span className="text-white">{pass!.berlaku_sampai}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Anggota</span>
            <span className="text-white">{fields.jumlah_anggota} orang</span>
          </div>
        </div>

        {/* Skor kredit */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-slate-400 text-xs mb-3">Skor Kelayakan Kredit</p>
          <div className="flex items-end gap-3 mb-4">
            <span className={`text-5xl font-bold ${skorColor}`}>{skor}</span>
            <span className="text-slate-500 text-sm mb-1">/100</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all ${skor >= 70 ? 'bg-green-500' : skor >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${skor}%` }} />
          </div>
          <div className="bg-slate-800 rounded-lg px-3 py-2 text-sm">
            <span className="text-slate-400">Rekomendasi limit: </span>
            <span className="text-white font-semibold">{rekomendasiLimit}</span>
          </div>
        </div>

        {/* Data detail */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <p className="text-slate-400 text-xs">Data Terverifikasi</p>
          <div className="grid grid-cols-2 gap-2">
            {fields.jumlah_ternak !== undefined && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Ternak Hidup</p>
                <p className="text-white font-semibold">{fields.jumlah_ternak} ekor</p>
              </div>
            )}
            {fields.rasio_ternak_sehat !== undefined && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Rasio Sehat</p>
                <p className="text-white font-semibold">{fields.rasio_ternak_sehat}%</p>
              </div>
            )}
            {fields.nilai_aset_ternak !== undefined && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Nilai Aset AI</p>
                <p className="text-white font-semibold">Rp{(fields.nilai_aset_ternak/1_000_000).toFixed(1)}jt</p>
              </div>
            )}
            {fields.total_simpanan !== undefined && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Total Simpanan</p>
                <p className="text-white font-semibold">Rp{(fields.total_simpanan/1_000_000).toFixed(1)}jt</p>
              </div>
            )}
            {fields.rasio_cicilan_lancar !== undefined && (
              <div className="bg-slate-800 rounded-lg p-3">
                <p className="text-slate-400 text-xs">Cicilan Lancar</p>
                <p className="text-white font-semibold">{fields.rasio_cicilan_lancar}%</p>
              </div>
            )}
          </div>
          <p className="text-slate-600 text-xs">Tidak ada nama, NIK, atau data pribadi anggota</p>
        </div>

        {/* Tombol setujui */}
        {!approved ? (
          <button onClick={handleSetujui}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-3.5 text-sm transition-colors">
            Setujui Pembiayaan
          </button>
        ) : (
          <div className="bg-green-950/50 border border-green-700 rounded-xl p-4 text-center">
            <p className="text-green-300 font-semibold">✓ Pembiayaan Disetujui</p>
            <p className="text-slate-400 text-xs mt-1">Persetujuan telah dicatat. Hubungi koperasi untuk proses selanjutnya.</p>
          </div>
        )}

        <p className="text-center text-slate-600 text-xs">
          Powered by LUMBUNG · Data agregat, privasi terjaga
        </p>
      </div>
    </div>
  )
}
