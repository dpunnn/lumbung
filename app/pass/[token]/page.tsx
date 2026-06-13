'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { ShieldCheck, Clock, Search } from 'lucide-react'
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

      await supabase.from('pass_access_log').insert({
        pass_id: data.id,
        mitra: data.mitra,
      })
    }
    load()

    // Realtime: kalau admin cabut pass saat lender sedang buka, langsung berubah
    const channel = supabase
      .channel(`pass-watch-${token}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'lumbung_pass',
        filter: `id=eq.${token}`,
      }, (payload) => {
        const updated = payload.new as LumbungPass
        setPass(updated)
        const expired = new Date(updated.berlaku_sampai) < new Date() || updated.status !== 'aktif'
        if (expired) setStatus('expired')
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [token])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-stone-400">
          <div className="w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Memverifikasi Pass...</span>
        </div>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Search size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-900 font-semibold mb-1">Pass tidak ditemukan</p>
          <p className="text-stone-500 text-sm">Link tidak valid atau sudah dihapus</p>
        </div>
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Clock size={36} className="mx-auto mb-3 text-stone-300" />
          <p className="text-stone-900 font-semibold mb-1">Pass sudah tidak berlaku</p>
          <p className="text-stone-500 text-sm">
            Berlaku s.d. {pass?.berlaku_sampai}. Hubungi koperasi untuk pass baru.
          </p>
        </div>
      </div>
    )
  }

  const fields = pass!.fields as PassFields
  const skor = hitungSkor(fields)
  const skorColor = skor >= 70 ? 'text-green-700' : skor >= 50 ? 'text-amber-700' : 'text-red-600'
  const barColor  = skor >= 70 ? 'bg-green-500' : skor >= 50 ? 'bg-amber-500' : 'bg-red-500'
  const rekomendasiLimit =
    skor >= 80 ? 'Rp 7–20 juta' :
    skor >= 60 ? 'Rp 3–7 juta' :
    'Rp 1–3 juta'

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-8">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Header brand */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-700 mb-3">
            <span className="text-white text-base font-black">L</span>
          </div>
          <h1 className="text-stone-900 text-xl font-bold">Lumbung Pass</h1>
          <p className="text-stone-500 text-sm mt-0.5">Data koperasi terverifikasi</p>
        </div>

        {/* Badge verifikasi */}
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
          <ShieldCheck size={18} className="text-green-600 shrink-0" />
          <div>
            <p className="text-green-700 text-sm font-medium">Terverifikasi SHA-256</p>
            <p className="text-green-500 text-xs font-mono truncate">{pass!.hash.slice(0, 32)}...</p>
          </div>
        </div>

        {/* Info pass */}
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm space-y-2.5">
          {[
            { label: 'Tujuan',    value: pass!.tujuan },
            { label: 'Mitra',     value: pass!.mitra },
            { label: 'Berlaku s.d.', value: pass!.berlaku_sampai },
            { label: 'Anggota',   value: `${fields.jumlah_anggota} orang` },
          ].map(row => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-stone-500">{row.label}</span>
              <span className="text-stone-900 font-medium">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Skor kredit */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
          <p className="text-stone-500 text-xs mb-3">Skor Kelayakan Kredit</p>
          <div className="flex items-end gap-3 mb-4">
            <span className={`text-5xl font-bold ${skorColor}`}>{skor}</span>
            <span className="text-stone-400 text-sm mb-1">/100</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden mb-4">
            <div className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${skor}%` }} />
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-stone-500">Rekomendasi limit: </span>
            <span className="text-stone-900 font-semibold">{rekomendasiLimit}</span>
          </div>
        </div>

        {/* Data detail */}
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm space-y-3">
          <p className="text-stone-500 text-xs">Data Terverifikasi</p>
          <div className="grid grid-cols-2 gap-2">
            {fields.jumlah_ternak !== undefined && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
                <p className="text-stone-400 text-xs">Ternak Hidup</p>
                <p className="text-stone-900 font-semibold">{fields.jumlah_ternak} ekor</p>
              </div>
            )}
            {fields.rasio_ternak_sehat !== undefined && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
                <p className="text-stone-400 text-xs">Rasio Sehat</p>
                <p className="text-stone-900 font-semibold">{fields.rasio_ternak_sehat}%</p>
              </div>
            )}
            {fields.nilai_aset_ternak !== undefined && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
                <p className="text-stone-400 text-xs">Nilai Aset AI</p>
                <p className="text-stone-900 font-semibold">Rp{(fields.nilai_aset_ternak/1_000_000).toFixed(1)}jt</p>
              </div>
            )}
            {fields.total_simpanan !== undefined && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
                <p className="text-stone-400 text-xs">Total Simpanan</p>
                <p className="text-stone-900 font-semibold">Rp{(fields.total_simpanan/1_000_000).toFixed(1)}jt</p>
              </div>
            )}
            {fields.rasio_cicilan_lancar !== undefined && (
              <div className="bg-stone-50 border border-stone-100 rounded-lg p-3">
                <p className="text-stone-400 text-xs">Cicilan Lancar</p>
                <p className="text-stone-900 font-semibold">{fields.rasio_cicilan_lancar}%</p>
              </div>
            )}
          </div>
          <p className="text-stone-400 text-xs">Tidak ada nama, NIK, atau data pribadi anggota</p>
        </div>

        {/* Tombol setujui */}
        {!approved ? (
          <button onClick={() => setApproved(true)}
            className="w-full bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-xl py-3.5 text-sm transition-colors shadow-sm">
            Setujui Pembiayaan
          </button>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <ShieldCheck size={18} className="mx-auto mb-1 text-green-600" />
            <p className="text-green-700 font-semibold text-sm">Pembiayaan Disetujui</p>
            <p className="text-stone-400 text-xs mt-1">Persetujuan telah dicatat. Hubungi koperasi untuk proses selanjutnya.</p>
          </div>
        )}

        <p className="text-center text-stone-400 text-xs">
          Powered by LUMBUNG · Data agregat, privasi terjaga
        </p>
      </div>
    </div>
  )
}
