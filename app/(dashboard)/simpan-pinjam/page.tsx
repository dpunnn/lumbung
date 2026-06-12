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
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold tracking-tight">Simpan Pinjam</h1>
          <p className="text-slate-400 text-sm mt-1">Kelola pinjaman dan anggota koperasi</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('anggota')}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg border border-slate-700 transition-colors">
            + Anggota
          </button>
          <button onClick={() => setTab('baru')}
            className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            + Pinjaman
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {['pinjaman','baru','anggota'].map(t => (
          <button key={t} onClick={() => setTab(t as typeof tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-green-600 text-white shadow-lg shadow-green-900/30' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
            {t === 'baru' ? 'Pinjaman Baru' : t === 'anggota' ? 'Tambah Anggota' : 'Daftar Pinjaman'}
          </button>
        ))}
      </div>

      {/* Form pinjaman baru */}
      {tab === 'baru' && (
        <form onSubmit={handleBuatPinjaman} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Buat Pinjaman Baru</h2>
            <p className="text-slate-500 text-xs mt-0.5">Isi form berikut untuk membuat pinjaman</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Anggota *</label>
              <select required value={formP.anggota_id} onChange={e => setP('anggota_id', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                <option value="">Pilih anggota...</option>
                {anggotaList.map(a => <option key={a.id} value={a.id}>{a.nama}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Jumlah Pokok (Rp) *</label>
                <input required type="number" min="0" value={formP.jumlah_pokok} onChange={e => setP('jumlah_pokok', e.target.value)}
                  placeholder="5000000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Tenor (bulan) *</label>
                <select value={formP.tenor_bulan} onChange={e => setP('tenor_bulan', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                  {[3,6,9,12,18,24,36].map(t => <option key={t} value={t}>{t} bulan</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Tanggal Mulai</label>
              <input type="date" value={formP.tanggal_mulai} onChange={e => setP('tanggal_mulai', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            {formP.jumlah_pokok && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-slate-400 text-sm">Angsuran per bulan</span>
                <span className="text-green-400 text-lg font-bold">
                  Rp{Math.ceil(parseInt(formP.jumlah_pokok)/parseInt(formP.tenor_bulan)).toLocaleString('id-ID')}
                </span>
              </div>
            )}
          </div>
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40">
            <button type="submit" disabled={saving}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              {saving ? 'Membuat...' : 'Buat Pinjaman'}
            </button>
          </div>
        </form>
      )}

      {/* Form tambah anggota */}
      {tab === 'anggota' && (
        <form onSubmit={handleBuatAnggota} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-white font-semibold">Tambah Anggota</h2>
            <p className="text-slate-500 text-xs mt-0.5">Daftarkan anggota baru ke koperasi</p>
          </div>
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Nama *</label>
              <input required value={formA.nama} onChange={e => setA('nama', e.target.value)}
                placeholder="Pak Hendra"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">No. HP</label>
                <input value={formA.no_hp} onChange={e => setA('no_hp', e.target.value)}
                  placeholder="081234567890"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
              <div>
                <label className="block text-slate-400 text-xs uppercase tracking-wide font-medium mb-2">Nama Penjamin</label>
                <input value={formA.nama_penjamin} onChange={e => setA('nama_penjamin', e.target.value)}
                  placeholder="Pak Budi (penjamin)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
              </div>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40">
            <button type="submit" disabled={saving}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2.5 text-sm transition-colors">
              {saving ? 'Menyimpan...' : 'Simpan Anggota'}
            </button>
          </div>
        </form>
      )}

      {/* Daftar pinjaman - Table view */}
      {tab === 'pinjaman' && (
        <>
          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm">Memuat data pinjaman...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-20 bg-slate-900 border border-slate-800 rounded-xl">
              <div className="w-16 h-16 bg-slate-800 border border-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <span className="text-slate-500 text-2xl">Rp</span>
              </div>
              <p className="text-slate-300 font-semibold">Belum Ada Pinjaman</p>
              <p className="text-slate-500 text-sm mt-1">Klik "+ Pinjaman" untuk membuat pinjaman baru</p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">No</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Anggota</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Pokok</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Angsuran/bln</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Mulai</th>
                    <th className="px-4 py-3 text-left text-slate-500 text-xs uppercase tracking-wide font-medium">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {data.map((p, idx) => {
                    const terbayar = lunas(p)
                    const pct = Math.round((terbayar / p.tenor_bulan) * 100)
                    const isSelected = selected?.id === p.id
                    return (
                      <tr key={p.id}
                        onClick={() => setSelected(isSelected ? null : p)}
                        className={`cursor-pointer transition-colors ${isSelected ? 'bg-green-900/10 border-l-4 border-l-green-500' : 'hover:bg-slate-800/40'}`}>
                        <td className="px-4 py-3 text-slate-500 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium text-sm">{(p.anggota as unknown as {nama:string})?.nama ?? '--'}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm">Rp{p.jumlah_pokok.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm">Rp{p.angsuran_per_bulan.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${STATUS_STYLE[p.status] ?? 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                          {new Date(p.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-green-600'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-slate-500 text-xs w-14 text-right">{terbayar}/{p.tenor_bulan}</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Panel angsuran detail (di bawah tabel) */}
          {selected && (
            <div className="bg-slate-900 border border-green-800/30 border-l-4 border-l-green-500 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-white font-semibold">{(selected.anggota as unknown as {nama:string})?.nama}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Angsuran Rp{selected.angsuran_per_bulan.toLocaleString('id-ID')}/bulan · {selected.tenor_bulan} bulan</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-300 text-xs transition-colors">Tutup</button>
              </div>

              {/* Angsuran grid */}
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {selected.angsuran.sort((a,b) => a.bulan_ke - b.bulan_ke).map(a => {
                    const isOverdue = a.status !== 'lunas' && new Date(a.tanggal_jatuh_tempo) < new Date()
                    return (
                      <div key={a.id} className={`rounded-lg p-3 text-center border ${
                        a.status === 'lunas'
                          ? 'bg-green-900/20 border-green-800/40'
                          : isOverdue
                            ? 'bg-red-900/20 border-red-800/40'
                            : 'bg-slate-800/60 border-slate-700'
                      }`}>
                        <p className="text-slate-500 text-xs mb-1">Bln {a.bulan_ke}</p>
                        {a.status === 'lunas' ? (
                          <span className="bg-green-900/40 text-green-400 border border-green-800 text-xs px-2 py-0.5 rounded-full font-medium">Lunas</span>
                        ) : isOverdue ? (
                          <button
                            onClick={e => { e.stopPropagation(); bayarAngsuran(a) }}
                            className="bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-medium transition-colors">
                            Terlambat
                          </button>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); bayarAngsuran(a) }}
                            className="bg-yellow-900/40 text-yellow-400 border border-yellow-800 text-xs px-2 py-0.5 rounded-full font-medium hover:bg-yellow-900/60 transition-colors">
                            Pending
                          </button>
                        )}
                        <p className="text-slate-600 text-[10px] mt-1">{a.tanggal_jatuh_tempo}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
