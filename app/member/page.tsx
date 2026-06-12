'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string; fokus_usaha: string; modules: string[] }
type Membership = { koperasi_id: string; status: string; tanggal_bergabung: string }

export default function MemberPage() {
  const [userId, setUserId] = useState('')
  const [allKoperasi, setAllKoperasi] = useState<Koperasi[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [joining, setJoining] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const [{ data: kop }, { data: mem }] = await Promise.all([
        supabase.from('koperasi').select('id, nama, fokus_usaha, modules').order('nama'),
        supabase.from('anggota_koperasi').select('koperasi_id, status, tanggal_bergabung').eq('anggota_id', user.id),
      ])

      setAllKoperasi((kop ?? []).map(k => ({ ...k, modules: k.modules ?? [] })))
      setMemberships(mem ?? [])
      setLoading(false)
    })
  }, [])

  async function joinKoperasi(koperasiId: string) {
    setJoining(koperasiId)
    const { error } = await supabase.from('anggota_koperasi').insert({
      anggota_id: userId,
      koperasi_id: koperasiId,
      status: 'aktif',
    })
    if (!error) {
      setMemberships(prev => [...prev, {
        koperasi_id: koperasiId,
        status: 'aktif',
        tanggal_bergabung: new Date().toISOString(),
      }])
    }
    setJoining(null)
  }

  const joinedIds = new Set(memberships.map(m => m.koperasi_id))
  const joinedKoperasi = allKoperasi.filter(k => joinedIds.has(k.id))
  const availableKoperasi = allKoperasi.filter(k => !joinedIds.has(k.id))

  if (loading) return <p className="text-slate-500 text-sm">Memuat...</p>

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h1 className="text-white text-2xl font-bold tracking-tight">Halo, selamat datang di Portal Anggota LUMBUNG</h1>
        <p className="text-slate-400 text-sm mt-2">Kelola keanggotaan dan akses layanan koperasi Anda dari satu tempat.</p>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-slate-400 text-xs">{joinedKoperasi.length} koperasi aktif</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-slate-400 text-xs">{availableKoperasi.length} tersedia</span>
          </div>
        </div>
      </div>

      {/* Koperasi yang sudah diikuti */}
      {joinedKoperasi.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-white text-sm font-semibold">Koperasi Saya</p>
            <p className="text-slate-500 text-xs mt-0.5">Koperasi yang sudah Anda ikuti</p>
          </div>
          {joinedKoperasi.map(k => {
            const mem = memberships.find(m => m.koperasi_id === k.id)
            return (
              <div key={k.id} className="bg-slate-900 border border-green-800/30 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <p className="text-white font-semibold text-lg">{k.nama}</p>
                        <span className="bg-green-900/40 text-green-400 border border-green-800 text-xs px-2.5 py-0.5 rounded-full font-medium">
                          Aktif
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm">{k.fokus_usaha}</p>
                      {mem && (
                        <p className="text-slate-600 text-xs mt-1">
                          Bergabung sejak {new Date(mem.tanggal_bergabung).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Module chips */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {k.modules.map(m => (
                      <span key={m} className="bg-slate-800 text-slate-300 text-xs px-2.5 py-1 rounded-lg border border-slate-700">
                        {m}
                      </span>
                    ))}
                    {k.modules.length === 0 && (
                      <span className="text-slate-600 text-xs">Belum ada modul aktif</span>
                    )}
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="border-t border-slate-800 bg-slate-950/40 px-5 py-3 flex gap-2">
                  <a href={`/member/pinjaman?koperasi=${k.id}`}
                    className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-700 transition-colors">
                    Pinjaman
                  </a>
                  <a href={`/member/simpanan?koperasi=${k.id}`}
                    className="flex-1 text-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2.5 rounded-lg border border-slate-700 transition-colors">
                    Simpanan
                  </a>
                  <a href={`/member/pass?koperasi=${k.id}`}
                    className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">
                    Pass
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Koperasi tersedia */}
      {availableKoperasi.length > 0 && (
        <div className="space-y-4">
          <div>
            <p className="text-white text-sm font-semibold">Koperasi Tersedia</p>
            <p className="text-slate-500 text-xs mt-0.5">Bergabung untuk mengakses layanan</p>
          </div>
          {availableKoperasi.map(k => (
            <div key={k.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-white font-semibold">{k.nama}</p>
                  <p className="text-slate-400 text-sm mt-0.5">{k.fokus_usaha}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {k.modules.slice(0, 4).map(m => (
                      <span key={m} className="bg-slate-800 text-slate-500 text-xs px-2 py-0.5 rounded border border-slate-700">
                        {m}
                      </span>
                    ))}
                    {k.modules.length > 4 && (
                      <span className="text-slate-600 text-xs self-center">+{k.modules.length - 4} lainnya</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => joinKoperasi(k.id)}
                  disabled={joining === k.id}
                  className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap">
                  {joining === k.id ? 'Mendaftar...' : 'Bergabung'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {joinedKoperasi.length === 0 && availableKoperasi.length === 0 && (
        <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-slate-500 text-2xl">--</span>
          </div>
          <p className="text-slate-300 font-semibold">Belum Ada Koperasi</p>
          <p className="text-slate-500 text-sm mt-1">Belum ada koperasi terdaftar di platform ini</p>
        </div>
      )}
    </div>
  )
}
