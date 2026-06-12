'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Pinjaman, Angsuran, Anggota } from '@/types'

const STATUS_STYLE: Record<string, string> = {
  aktif: 'bg-blue-900/50 text-blue-400 border-blue-800',
  lunas: 'bg-green-900/50 text-green-400 border-green-800',
  macet: 'bg-red-900/50 text-red-400 border-red-800',
}

type PinjamanWithAngsuran = Pinjaman & { angsuran: Angsuran[] }

export default function SimpanPinjamPage() {
  const [tab, setTab] = useState<'pinjaman' | 'baru' | 'anggota'>('pinjaman')
  const [data, setData] = useState<PinjamanWithAngsuran[]>([])
  const [anggotaList, setAnggotaList] = useState<Anggota[]>([])
  const [selected, setSelected] = useState<PinjamanWithAngsuran | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form pinjaman baru
  const [formP, setFormP] = useState({ anggota_id: '', jumlah_pokok: '', tenor_bulan: '12', tanggal_mulai: new Date().toISOString().split('T')[0] })
  // Form anggota baru
  const [formA, setFormA] = useState({ nama: '', no_hp: '', nama_penjamin: '' })

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('pinjaman')
      .select('*, anggota(nama), angsuran(*)')
      .order('created_at', { ascending: false })
    setData((rows as PinjamanWithAngsuran[]) ?? [])

    const { data: ag } = await supabase.from('anggota').select('*').order('nama')
    setAnggotaList(ag ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function setP(k: string, v: string) { setFormP(f => ({ ...f, [k]: v })) }
  function setA(k: string, v: string) { setFormA(f => ({ ...f, [k]: v })) }

  async function handleBuatPinjaman(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()

    const pokok = parseInt(formP.jumlah_pokok)
    const tenor = parseInt(formP.tenor_bulan)
    const angsuranPerBulan = Math.ceil(pokok / tenor)

    const { data: pinjaman } = await supabase.from('pinjaman').insert({
      koperasi_id: profile!.koperasi_id,
      anggota_id: formP.anggota_id,
      jumlah_pokok: pokok,
      tenor_bulan: tenor,
      tanggal_mulai: formP.tanggal_mulai,
      angsuran_per_bulan: angsuranPerBulan,
      status: 'aktif',
    }).select().single()

    if (pinjaman) {
      // Generate baris angsuran otomatis
      const angsuranRows = Array.from({ length: tenor }, (_, i) => {
        const jatuhTempo = new Date(formP.tanggal_mulai)
        jatuhTempo.setMonth(jatuhTempo.getMonth() + i + 1)
        return {
          pinjaman_id: pinjaman.id,
          bulan_ke: i + 1,
          tanggal_jatuh_tempo: jatuhTempo.toISOString().split('T')[0],
          status: 'pending',
        }
      })
      await supabase.from('angsuran').insert(angsuranRows)
    }

    setSaving(false)
    setFormP({ anggota_id: '', jumlah_pokok: '', tenor_bulan: '12', tanggal_mulai: new Date().toISOString().split('T')[0] })
    setTab('pinjaman')
    load()
  }

  async function handleBuatAnggota(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()
    await supabase.from('anggota').insert({
      koperasi_id: profile!.koperasi_id,
      nama: formA.nama,
      no_hp: formA.no_hp || null,
      nama_penjamin: formA.nama_penjamin || null,
    })
    setSaving(false)
    setFormA({ nama: '', no_hp: '', nama_penjamin: '' })
    setTab('pinjaman')
    load()
  }

  async function bayarAngsuran(angsuran: Angsuran) {
    await supabase.from('angsuran').update({
      tanggal_bayar: new Date().toISOString().split('T')[0],
      jumlah_bayar: selected!.angsuran_per_bulan,
      status: 'lunas',
    }).eq('id', angsuran.id)

    // Cek apakah semua lunas -> update status pinjaman
    const terbayar = selected!.angsuran.filter(a => a.status === 'lunas').length + 1
    if (terbayar >= selected!.tenor_bulan) {
      await supabase.from('pinjaman').update({ status: 'lunas' }).eq('id', selected!.id)
    }

    load()
    const { data } = await supabase.from('pinjaman').select('*, anggota(nama), angsuran(*)').eq('id', selected!.id).single()
    setSelected(data as PinjamanWithAngsuran)
  }

  const lunas = (p: PinjamanWithAngsuran) => p.angsuran.filter(a => a.status === 'lunas').length

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-white text-xl font-semibold">Simpan Pinjam</h1>
        <div className="flex gap-2">
          <button onClick={() => setTab('anggota')}
            className="border border-slate-700 hover:border-green-700 text-slate-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
            + Anggota
          </button>
          <button onClick={() => setTab('baru')}
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Pinjaman
          </button>
        </div>
      </div>

      {/* Tab */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {['pinjaman','baru','anggota'].map(t => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors capitalize
              ${tab === t ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'baru' ? 'Pinjaman Baru' : t === 'anggota' ? 'Tambah Anggota' : 'Daftar Pinjaman'}
          </button>
        ))}
      </div>

      {/* Form pinjaman baru */}
      {tab === 'baru' && (
        <form onSubmit={handleBuatPinjaman} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-medium">Buat Pinjaman Baru</h2>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Anggota *</label>
            <select required value={formP.anggota_id} onChange={e => setP('anggota_id', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              <option value="">Pilih anggota...</option>
              {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1.5">Jumlah Pokok (Rp) *</label>
              <input required type="number" min="0" value={formP.jumlah_pokok} onChange={e => setP('jumlah_pokok', e.target.value)}
                placeholder="5000000"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1.5">Tenor (bulan) *</label>
              <select value={formP.tenor_bulan} onChange={e => setP('tenor_bulan', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                {[3,6,9,12,18,24,36].map(t => <option key={t} value={t}>{t} bulan</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Tanggal Mulai</label>
            <input type="date" value={formP.tanggal_mulai} onChange={e => setP('tanggal_mulai', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          {formP.jumlah_pokok && (
            <p className="text-slate-400 text-sm bg-slate-800 rounded-lg px-3 py-2">
              Angsuran/bulan: <strong className="text-white">
                Rp{Math.ceil(parseInt(formP.jumlah_pokok)/parseInt(formP.tenor_bulan)).toLocaleString('id-ID')}
              </strong>
            </p>
          )}
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm">
            {saving ? 'Membuat...' : 'Buat Pinjaman'}
          </button>
        </form>
      )}

      {/* Form tambah anggota */}
      {tab === 'anggota' && (
        <form onSubmit={handleBuatAnggota} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-white font-medium">Tambah Anggota</h2>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Nama *</label>
            <input required value={formA.nama} onChange={e => setA('nama', e.target.value)}
              placeholder="Pak Hendra"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 text-sm mb-1.5">No. HP</label>
              <input value={formA.no_hp} onChange={e => setA('no_hp', e.target.value)}
                placeholder="081234567890"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-1.5">Nama Penjamin</label>
              <input value={formA.nama_penjamin} onChange={e => setA('nama_penjamin', e.target.value)}
                placeholder="Pak Budi (penjamin)"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm">
            {saving ? 'Menyimpan...' : 'Simpan Anggota'}
          </button>
        </form>
      )}

      {/* Daftar pinjaman */}
      {tab === 'pinjaman' && (
        <>
          {loading ? (
            <p className="text-slate-500 text-sm">Memuat...</p>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-2">💰</p>
              <p>Belum ada pinjaman.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map(p => {
                const terbayar = lunas(p)
                const pct = Math.round((terbayar / p.tenor_bulan) * 100)
                return (
                  <div key={p.id}
                    onClick={() => setSelected(selected?.id === p.id ? null : p)}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-slate-700 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-white font-medium">{(p.anggota as unknown as {nama:string})?.nama ?? '—'}</p>
                        <p className="text-slate-400 text-sm">Rp{p.jumlah_pokok.toLocaleString('id-ID')} · {p.tenor_bulan} bulan</p>
                      </div>
                      <span className={`text-xs border px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>{p.status}</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>{terbayar}/{p.tenor_bulan} angsuran lunas</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-green-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Detail angsuran */}
                    {selected?.id === p.id && (
                      <div className="mt-4 border-t border-slate-800 pt-4">
                        <p className="text-slate-400 text-xs mb-2">Riwayat Angsuran — Rp{p.angsuran_per_bulan.toLocaleString('id-ID')}/bulan</p>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                          {p.angsuran.sort((a,b) => a.bulan_ke - b.bulan_ke).map(a => (
                            <div key={a.id} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                              <span className="text-slate-300 text-xs">Bulan {a.bulan_ke} · {a.tanggal_jatuh_tempo}</span>
                              {a.status === 'lunas' ? (
                                <span className="text-green-400 text-xs">✓ Lunas {a.tanggal_bayar}</span>
                              ) : (
                                <button
                                  onClick={e => { e.stopPropagation(); bayarAngsuran(a) }}
                                  className="bg-green-700 hover:bg-green-600 text-white text-xs px-3 py-1 rounded-lg">
                                  Bayar
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
