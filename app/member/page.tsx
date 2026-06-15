'use client'

import { useEffect, useState } from 'react'
import { Building2, CheckCircle, ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'

type Koperasi = { id: string; nama: string; fokus_usaha: string; modules: string[] }
type Membership = { koperasi_id: string; status: string; tanggal_bergabung: string }

const MODULE_LABEL: Record<string, string> = {
  simpan_pinjam: 'Simpan Pinjam',
  inventori: 'Inventori',
  ternak: 'Ternak',
  air: 'Utilitas Air',
  pakan: 'Stok Pakan',
  pass: 'Pass',
  insight: 'Insight AI',
}

export default function MemberPage() {
  const [userId, setUserId] = useState('')
  const [allKoperasi, setAllKoperasi] = useState<Koperasi[]>([])
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [joining, setJoining] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const me = await getMe()
      if (!me) return
      setUserId(me.id)
      const [kop, mem] = await Promise.all([
        api.get<Koperasi[]>('/api/koperasi').catch(() => [] as Koperasi[]),
        api.get<Membership[]>(`/api/anggota?anggota_id=${me.id}`).catch(() => [] as Membership[]),
      ])
      setAllKoperasi((kop ?? []).map(k => ({ ...k, modules: k.modules ?? [] })))
      setMemberships(mem ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function joinKoperasi(koperasiId: string) {
    setJoining(koperasiId)
    try {
      await api.post('/api/anggota', {
        anggota_id: userId, koperasi_id: koperasiId, status: 'aktif',
      })
      setMemberships(prev => [...prev, {
        koperasi_id: koperasiId, status: 'aktif',
        tanggal_bergabung: new Date().toISOString(),
      }])
    } catch {
      // gagal join — biarkan user coba lagi
    }
    setJoining(null)
  }

  const joinedIds = new Set(memberships.map(m => m.koperasi_id))
  const joinedKoperasi = allKoperasi.filter(k => joinedIds.has(k.id))
  const availableKoperasi = allKoperasi.filter(k => !joinedIds.has(k.id))

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div className="bg-amber-700 rounded-xl p-6 text-white">
        <h1 className="text-xl font-bold">Selamat datang di Portal Anggota</h1>
        <p className="text-amber-200 text-sm mt-1">Kelola keanggotaan dan layanan koperasi dari satu tempat.</p>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-300" />
            <span className="text-amber-100 text-xs">{joinedKoperasi.length} koperasi aktif</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-600" />
            <span className="text-amber-200 text-xs">{availableKoperasi.length} tersedia</span>
          </div>
        </div>
      </div>

      {joinedKoperasi.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-stone-900 text-sm font-semibold">Koperasi Saya</p>
            <p className="text-stone-500 text-xs mt-0.5">Koperasi yang sudah Anda ikuti</p>
          </div>
          {joinedKoperasi.map(k => {
            const mem = memberships.find(m => m.koperasi_id === k.id)
            return (
              <div key={k.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2.5 mb-1">
                        <p className="text-stone-900 font-semibold">{k.nama}</p>
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs px-2 py-0.5 rounded-full font-medium">
                          <CheckCircle size={10} /> Aktif
                        </span>
                      </div>
                      <p className="text-stone-500 text-sm">{k.fokus_usaha}</p>
                      {mem && (
                        <p className="text-stone-400 text-xs mt-1">
                          Bergabung sejak {new Date(mem.tanggal_bergabung).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {k.modules.map(m => (
                      <span key={m} className="bg-stone-100 text-stone-600 text-xs px-2.5 py-1 rounded-lg border border-stone-200">
                        {MODULE_LABEL[m] ?? m}
                      </span>
                    ))}
                    {k.modules.length === 0 && (
                      <span className="text-stone-400 text-xs">Belum ada modul aktif</span>
                    )}
                  </div>
                </div>

                <div className="border-t border-stone-100 bg-stone-50 px-5 py-3 flex gap-2">
                  <a href={`/member/pinjaman?koperasi=${k.id}`}
                    className="flex-1 text-center bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg border border-stone-300 transition-colors">
                    Pinjaman
                  </a>
                  <a href={`/member/simpanan?koperasi=${k.id}`}
                    className="flex-1 text-center bg-white hover:bg-stone-50 text-stone-700 text-sm font-medium px-4 py-2 rounded-lg border border-stone-300 transition-colors">
                    Simpanan
                  </a>
                  <a href={`/member/pass?koperasi=${k.id}`}
                    className="flex-1 text-center bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                    Pass
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {availableKoperasi.length > 0 && (
        <div className="space-y-3">
          <div>
            <p className="text-stone-900 text-sm font-semibold">Koperasi Tersedia</p>
            <p className="text-stone-500 text-xs mt-0.5">Bergabung untuk mengakses layanan</p>
          </div>
          {availableKoperasi.map(k => (
            <div key={k.id} className="bg-white border border-stone-200 rounded-xl p-5 hover:border-stone-300 transition-colors shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex-1 mr-4">
                  <p className="text-stone-900 font-semibold text-sm">{k.nama}</p>
                  <p className="text-stone-500 text-sm mt-0.5">{k.fokus_usaha}</p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {k.modules.slice(0, 4).map(m => (
                      <span key={m} className="bg-stone-100 text-stone-500 text-xs px-2 py-0.5 rounded border border-stone-200">
                        {MODULE_LABEL[m] ?? m}
                      </span>
                    ))}
                    {k.modules.length > 4 && (
                      <span className="text-stone-400 text-xs self-center">+{k.modules.length - 4} lainnya</span>
                    )}
                  </div>
                </div>
                <button onClick={() => joinKoperasi(k.id)} disabled={joining === k.id}
                  className="bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors whitespace-nowrap shadow-sm">
                  {joining === k.id ? 'Mendaftar...' : 'Bergabung'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {joinedKoperasi.length === 0 && availableKoperasi.length === 0 && (
        <div className="text-center py-20 bg-white border border-stone-200 rounded-xl">
          <div className="w-14 h-14 bg-stone-100 border border-stone-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Building2 size={24} className="text-stone-400" />
          </div>
          <p className="text-stone-700 font-semibold">Belum Ada Koperasi</p>
          <p className="text-stone-400 text-sm mt-1">Belum ada koperasi terdaftar di platform ini</p>
        </div>
      )}
    </div>
  )
}
