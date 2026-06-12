'use client'

import { Suspense, useEffect, useState } from 'react'
import { CreditCard, Copy, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { hitungSkor } from '@/lib/pass'

type Pass = {
  id: string; tujuan: string; mitra: string; fields: Record<string, unknown>
  status: string; berlaku_sampai: string; created_at: string
  koperasi: { nama: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  aktif:       'bg-green-50 text-green-700 border-green-200',
  dicabut:     'bg-red-50 text-red-600 border-red-200',
  kadaluarsa:  'bg-stone-100 text-stone-500 border-stone-200',
  kedaluwarsa: 'bg-stone-100 text-stone-500 border-stone-200',
}

function PassContent() {
  const [passes, setPasses] = useState<Pass[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: mem } = await supabase
        .from('anggota_koperasi').select('koperasi_id').eq('anggota_id', user.id)
      const kops = (mem ?? []).map((m: any) => m.koperasi_id)
      if (kops.length === 0) { setLoading(false); return }
      const { data } = await supabase
        .from('lumbung_pass')
        .select('id, tujuan, mitra, fields, status, berlaku_sampai, created_at, koperasi(nama)')
        .in('koperasi_id', kops)
        .order('created_at', { ascending: false })
      setPasses((data ?? []) as Pass[])
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (passes.length === 0) return (
    <div className="text-center py-16 text-stone-400 bg-white border border-stone-200 rounded-xl">
      <CreditCard size={32} className="mx-auto mb-2 text-stone-300" />
      <p className="text-sm font-medium text-stone-600">Belum ada Pass diterbitkan</p>
      <p className="text-xs mt-1">Minta pengurus koperasimu untuk menerbitkan Pass.</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {passes.map(p => {
        const isExpired = new Date(p.berlaku_sampai) < new Date()
        const skor = p.fields ? hitungSkor(p.fields as any) : 0
        const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/pass/${p.id}`
        return (
          <div key={p.id} className="bg-white border border-stone-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-stone-900 font-semibold">{p.koperasi?.nama}</p>
                <p className="text-stone-500 text-xs mt-0.5">{p.tujuan} · {p.mitra}</p>
                <p className="text-stone-300 text-xs font-mono mt-0.5">{p.id.slice(0, 16)}...</p>
              </div>
              <span className={`text-xs border px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[isExpired ? 'kadaluarsa' : p.status]}`}>
                {isExpired ? 'Kadaluarsa' : p.status}
              </span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-stone-500">Skor Kredit</span>
                <span className={`font-bold ${skor >= 70 ? 'text-green-700' : skor >= 50 ? 'text-amber-700' : 'text-red-600'}`}>
                  {skor}/100
                </span>
              </div>
              <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${skor >= 70 ? 'bg-green-500' : skor >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${skor}%` }} />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="flex-1 flex items-center justify-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                <Copy size={13} /> Salin Link
              </button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 border border-stone-300 hover:border-stone-400 text-stone-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                <ExternalLink size={13} /> Lihat Pass
              </a>
            </div>

            <p className="text-stone-400 text-xs mt-3">
              Berlaku hingga {new Date(p.berlaku_sampai).toLocaleDateString('id-ID')}
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default function MemberPassPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-stone-900 text-xl font-bold">Pass Saya</h1>
        <p className="text-stone-500 text-sm">Lumbung Pass untuk pengajuan pembiayaan lintas koperasi</p>
      </div>
      <Suspense fallback={
        <div className="flex justify-center py-12">
          <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <PassContent />
      </Suspense>
    </div>
  )
}
