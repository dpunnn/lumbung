'use client'

import { Suspense, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { hitungSkor } from '@/lib/pass'

type Pass = {
  id: string; tujuan: string; mitra: string; fields: Record<string, unknown>
  status: string; berlaku_sampai: string; created_at: string
  koperasi: { nama: string } | null
}

const STATUS_COLOR: Record<string, string> = {
  aktif:       'bg-green-900/50 text-green-400 border-green-800',
  dicabut:     'bg-red-900/50 text-red-400 border-red-800',
  kadaluarsa:  'bg-slate-800 text-slate-500 border-slate-700',
  kedaluwarsa: 'bg-slate-800 text-slate-500 border-slate-700',
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

  if (loading) return <p className="text-slate-500 text-sm">Memuat...</p>

  if (passes.length === 0) return (
    <div className="text-center py-16 text-slate-500">
      <p className="text-4xl mb-2">🔑</p>
      <p>Belum ada Pass diterbitkan.</p>
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
          <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-white font-medium">{p.koperasi?.nama}</p>
                <p className="text-slate-400 text-xs mt-0.5">{p.tujuan} · {p.mitra}</p>
                <p className="text-slate-600 text-xs font-mono">{p.id.slice(0, 16)}...</p>
              </div>
              <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_COLOR[isExpired ? 'kadaluarsa' : p.status]}`}>
                {isExpired ? 'Kadaluarsa' : p.status}
              </span>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Skor Kredit</span>
                <span className={`font-bold ${skor >= 70 ? 'text-green-400' : skor >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {skor}/100
                </span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${skor >= 70 ? 'bg-green-500' : skor >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${skor}%` }} />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                Salin Link Pass
              </button>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                className="flex-1 text-center border border-slate-700 hover:border-slate-500 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors">
                Lihat Pass
              </a>
            </div>

            <p className="text-slate-600 text-xs mt-2">
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
        <h1 className="text-white text-xl font-semibold">Pass Saya</h1>
        <p className="text-slate-400 text-sm">Lumbung Pass untuk pengajuan pembiayaan lintas koperasi</p>
      </div>
      <Suspense fallback={<p className="text-slate-500 text-sm">Memuat...</p>}>
        <PassContent />
      </Suspense>
    </div>
  )
}
