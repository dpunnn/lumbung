'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Droplets, Plus, Pencil } from 'lucide-react'

type Meteran = {
  id: string
  koperasi_id: string
  anggota_id: string | null
  nama_pelanggan: string
  nomor_meteran: string
  alamat: string | null
  tarif_per_m3: number
  aktif: boolean
}

type Tagihan = {
  id: string
  meteran_id: string
  bulan: string
  meter_awal: number
  meter_akhir: number
  pemakaian: number
  jumlah_tagihan: number
  status: 'belum_bayar' | 'lunas'
  tanggal_bayar: string | null
  meteran: { nama_pelanggan: string; nomor_meteran: string } | null
}

const BULAN_INI = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

export default function AirPage() {
  const [tab, setTab] = useState<'tagihan' | 'meteran'>('tagihan')
  const [meteranList, setMeteranList] = useState<Meteran[]>([])
  const [tagihan, setTagihan] = useState<Tagihan[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [filterBulan, setFilterBulan] = useState(BULAN_INI)
  const [showMeteranForm, setShowMeteranForm] = useState(false)
  const [showTagihanForm, setShowTagihanForm] = useState(false)
  const [editMeteranId, setEditMeteranId] = useState<string | null>(null)
  const [formMeteran, setFormMeteran] = useState({
    nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500',
  })
  const [formTagihan, setFormTagihan] = useState({
    meteran_id: '', bulan: BULAN_INI, meter_awal: '', meter_akhir: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: m }, { data: t }] = await Promise.all([
      supabase.from('meteran_air').select('*').order('nama_pelanggan'),
      supabase.from('tagihan_air')
        .select('*, meteran:meteran_id(nama_pelanggan, nomor_meteran)')
        .order('bulan', { ascending: false }),
    ])
    setMeteranList(m ?? [])
    setTagihan((t ?? []) as Tagihan[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const channel = supabase.channel('air-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tagihan_air' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meteran_air' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  async function handleSaveMeteran(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()

    const payload = {
      nama_pelanggan: formMeteran.nama_pelanggan,
      nomor_meteran: formMeteran.nomor_meteran,
      alamat: formMeteran.alamat || null,
      tarif_per_m3: parseInt(formMeteran.tarif_per_m3) || 1500,
    }

    if (editMeteranId) {
      await supabase.from('meteran_air').update(payload).eq('id', editMeteranId)
    } else {
      await supabase.from('meteran_air').insert({ ...payload, koperasi_id: profile!.koperasi_id })
    }

    setSaving(false)
    setShowMeteranForm(false)
    setEditMeteranId(null)
    setFormMeteran({ nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500' })
    load()
  }

  async function handleInputTagihan(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const meteran = meteranList.find(m => m.id === formTagihan.meteran_id)
    if (!meteran) { setSaving(false); return }

    const awal = parseFloat(formTagihan.meter_awal)
    const akhir = parseFloat(formTagihan.meter_akhir)
    const pemakaian = akhir - awal
    const tagihan_amount = Math.round(pemakaian * meteran.tarif_per_m3)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from('profiles').select('koperasi_id').eq('id', user!.id).single()

    const { data: existing } = await supabase
      .from('tagihan_air')
      .select('id')
      .eq('meteran_id', formTagihan.meteran_id)
      .eq('bulan', formTagihan.bulan)
      .maybeSingle()

    if (existing) {
      await supabase.from('tagihan_air').update({
        meter_awal: awal, meter_akhir: akhir, jumlah_tagihan: tagihan_amount,
      }).eq('id', existing.id)
    } else {
      await supabase.from('tagihan_air').insert({
        koperasi_id: profile!.koperasi_id,
        meteran_id: formTagihan.meteran_id,
        bulan: formTagihan.bulan,
        meter_awal: awal,
        meter_akhir: akhir,
        jumlah_tagihan: tagihan_amount,
        status: 'belum_bayar',
      })
    }

    setSaving(false)
    setShowTagihanForm(false)
    setFormTagihan({ meteran_id: '', bulan: BULAN_INI, meter_awal: '', meter_akhir: '' })
    load()
  }

  async function handleBayar(id: string) {
    await supabase.from('tagihan_air').update({
      status: 'lunas',
      tanggal_bayar: new Date().toISOString().split('T')[0],
    }).eq('id', id)
    load()
  }

  function openEditMeteran(m: Meteran) {
    setEditMeteranId(m.id)
    setFormMeteran({
      nama_pelanggan: m.nama_pelanggan, nomor_meteran: m.nomor_meteran,
      alamat: m.alamat ?? '', tarif_per_m3: m.tarif_per_m3.toString(),
    })
    setShowMeteranForm(true)
    setTab('meteran')
  }

  const filteredTagihan = filterBulan
    ? tagihan.filter(t => t.bulan === filterBulan)
    : tagihan

  const belumBayar = filteredTagihan.filter(t => t.status === 'belum_bayar')
  const totalTagihan = filteredTagihan.reduce((s, t) => s + t.jumlah_tagihan, 0)
  const totalTerbayar = filteredTagihan.filter(t => t.status === 'lunas').reduce((s, t) => s + t.jumlah_tagihan, 0)

  const bulanOptions = [...new Set(tagihan.map(t => t.bulan))].sort().reverse()

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Utilitas Air</h1>
          <p className="text-stone-400 text-sm">{meteranList.length} pelanggan terdaftar</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowTagihanForm(true); setShowMeteranForm(false); setTab('tagihan') }}
            className="bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Input Bacaan
          </button>
          <button onClick={() => { setShowMeteranForm(true); setShowTagihanForm(false); setTab('meteran'); setEditMeteranId(null); setFormMeteran({ nama_pelanggan: '', nomor_meteran: '', alamat: '', tarif_per_m3: '1500' }) }}
            className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Pelanggan
          </button>
        </div>
      </div>

      {filteredTagihan.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
            <p className="text-stone-400 text-xs mb-1">Total Tagihan</p>
            <p className="text-stone-900 text-xl font-bold">Rp {totalTagihan.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl shadow-sm p-4">
            <p className="text-stone-400 text-xs mb-1">Sudah Terbayar</p>
            <p className="text-green-700 text-xl font-bold">Rp {totalTerbayar.toLocaleString('id-ID')}</p>
          </div>
          <div className={`rounded-xl shadow-sm p-4 ${belumBayar.length > 0 ? 'bg-red-50 border border-red-200' : 'bg-white border border-stone-200'}`}>
            <p className="text-stone-400 text-xs mb-1">Belum Bayar</p>
            <p className={`text-xl font-bold ${belumBayar.length > 0 ? 'text-red-600' : 'text-stone-400'}`}>{belumBayar.length} pelanggan</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['tagihan', 'meteran'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'tagihan' ? 'Tagihan' : 'Data Meteran'}
          </button>
        ))}
      </div>

      {tab === 'tagihan' && showTagihanForm && (
        <form onSubmit={handleInputTagihan} className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-stone-900 font-medium">Input Bacaan Meteran</h2>
            <button type="button" onClick={() => setShowTagihanForm(false)} className="text-stone-400 hover:text-stone-600 text-sm">Batal</button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-stone-600 text-xs mb-1">Pelanggan *</label>
              <select required value={formTagihan.meteran_id} onChange={e => setFormTagihan(f => ({ ...f, meteran_id: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
                <option value="">Pilih pelanggan...</option>
                {meteranList.filter(m => m.aktif).map(m => (
                  <option key={m.id} value={m.id}>{m.nama_pelanggan} ({m.nomor_meteran})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Bulan</label>
              <input type="month" value={formTagihan.bulan} onChange={e => setFormTagihan(f => ({ ...f, bulan: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div />
            <div>
              <label className="block text-stone-600 text-xs mb-1">Meter Awal (m3) *</label>
              <input required type="number" min="0" step="0.1" value={formTagihan.meter_awal}
                onChange={e => setFormTagihan(f => ({ ...f, meter_awal: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
            <div>
              <label className="block text-stone-600 text-xs mb-1">Meter Akhir (m3) *</label>
              <input required type="number" min="0" step="0.1" value={formTagihan.meter_akhir}
                onChange={e => setFormTagihan(f => ({ ...f, meter_akhir: e.target.value }))}
                className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
            </div>
          </div>

          {formTagihan.meter_awal && formTagihan.meter_akhir && formTagihan.meteran_id && (() => {
            const meteran = meteranList.find(m => m.id === formTagihan.meteran_id)
            const pemakaian = parseFloat(formTagihan.meter_akhir) - parseFloat(formTagihan.meter_awal)
            const tagihan_amount = Math.round(pemakaian * (meteran?.tarif_per_m3 ?? 1500))
            return pemakaian >= 0 ? (
              <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-stone-400">Pemakaian</span><p className="text-stone-900 font-semibold">{pemakaian.toFixed(1)} m3</p></div>
                <div><span className="text-stone-400">Total Tagihan</span><p className="text-amber-700 font-bold">Rp {tagihan_amount.toLocaleString('id-ID')}</p></div>
              </div>
            ) : null
          })()}

          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
            {saving ? 'Menyimpan...' : 'Simpan Tagihan'}
          </button>
        </form>
      )}

      {tab === 'tagihan' && !showTagihanForm && (
        <div className="space-y-4">

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-stone-400 text-xs">Filter:</span>
            <button onClick={() => setFilterBulan(BULAN_INI)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterBulan === BULAN_INI ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300'}`}>
              Bulan Ini
            </button>
            {bulanOptions.filter(b => b !== BULAN_INI).slice(0, 3).map(b => (
              <button key={b} onClick={() => setFilterBulan(filterBulan === b ? '' : b)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filterBulan === b ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300'}`}>
                {b}
              </button>
            ))}
            <button onClick={() => setFilterBulan('')}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${!filterBulan ? 'bg-amber-700 text-white border-amber-700' : 'bg-white text-stone-600 border-stone-300'}`}>
              Semua
            </button>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-8 justify-center">
              <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
              <p className="text-stone-400 text-sm">Memuat tagihan...</p>
            </div>
          ) : filteredTagihan.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-400">
              <Droplets className="w-10 h-10 mx-auto mb-3" />
              <p>Belum ada tagihan. Klik "+ Input Bacaan" untuk mencatat.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-medium">
                    <th className="px-4 py-3 text-left">Pelanggan</th>
                    <th className="px-4 py-3 text-left">Bulan</th>
                    <th className="px-4 py-3 text-right">Pemakaian</th>
                    <th className="px-4 py-3 text-right">Tagihan</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredTagihan.map(t => (
                    <tr key={t.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-stone-900 font-medium">{t.meteran?.nama_pelanggan ?? '—'}</p>
                        <p className="text-stone-400 text-xs">{t.meteran?.nomor_meteran}</p>
                      </td>
                      <td className="px-4 py-3 text-stone-600 text-sm">{t.bulan}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{t.pemakaian} m3</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-stone-900 font-semibold">Rp {t.jumlah_tagihan.toLocaleString('id-ID')}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {t.status === 'lunas' ? (
                          <div>
                            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full">Lunas</span>
                            {t.tanggal_bayar && <p className="text-stone-400 text-[10px] mt-0.5">{new Date(t.tanggal_bayar).toLocaleDateString('id-ID')}</p>}
                          </div>
                        ) : (
                          <span className="text-xs bg-red-50 text-red-600 border border-red-200 px-2.5 py-0.5 rounded-full">Belum Bayar</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.status === 'belum_bayar' && (
                          <button onClick={() => handleBayar(t.id)}
                            className="bg-amber-700 hover:bg-amber-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                            Tandai Lunas
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'meteran' && (
        <div className="space-y-4">
          {showMeteranForm && (
            <form onSubmit={handleSaveMeteran} className="bg-white border border-amber-200 rounded-xl shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-stone-900 font-medium">{editMeteranId ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h2>
                <button type="button" onClick={() => setShowMeteranForm(false)} className="text-stone-400 hover:text-stone-600 text-sm">Batal</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Nama Pelanggan *</label>
                  <input required value={formMeteran.nama_pelanggan} onChange={e => setFormMeteran(f => ({ ...f, nama_pelanggan: e.target.value }))}
                    placeholder="Pak Ahmad"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">No. Meteran *</label>
                  <input required value={formMeteran.nomor_meteran} onChange={e => setFormMeteran(f => ({ ...f, nomor_meteran: e.target.value }))}
                    placeholder="M-001"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Alamat</label>
                  <input value={formMeteran.alamat} onChange={e => setFormMeteran(f => ({ ...f, alamat: e.target.value }))}
                    placeholder="RT 03 / RW 01"
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-stone-600 text-xs mb-1">Tarif per m3 (Rp)</label>
                  <input type="number" min="0" value={formMeteran.tarif_per_m3} onChange={e => setFormMeteran(f => ({ ...f, tarif_per_m3: e.target.value }))}
                    className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </form>
          )}

          {meteranList.length === 0 ? (
            <div className="text-center py-20 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-400">
              <Droplets className="w-10 h-10 mx-auto mb-3" />
              <p>Belum ada pelanggan. Klik "+ Pelanggan".</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 text-xs font-medium">
                    <th className="px-4 py-3 text-left">Pelanggan</th>
                    <th className="px-4 py-3 text-left">No. Meteran</th>
                    <th className="px-4 py-3 text-left">Alamat</th>
                    <th className="px-4 py-3 text-right">Tarif/m3</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {meteranList.map(m => (
                    <tr key={m.id} className="hover:bg-stone-50 transition-colors">
                      <td className="px-4 py-3 text-stone-900 font-medium">{m.nama_pelanggan}</td>
                      <td className="px-4 py-3 text-stone-600 font-mono text-xs">{m.nomor_meteran}</td>
                      <td className="px-4 py-3 text-stone-400 text-xs">{m.alamat ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-stone-600 text-xs">Rp {m.tarif_per_m3.toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${m.aktif ? 'bg-green-50 text-green-700 border-green-200' : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                          {m.aktif ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEditMeteran(m)} className="text-stone-400 hover:text-stone-900 text-xs inline-flex items-center gap-1">
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
