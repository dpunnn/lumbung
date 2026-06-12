'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string }
type Simpanan = { id: string; jumlah: number; keterangan: string | null; tanggal: string; koperasi: Koperasi | null }

function SimpananContent() {
  const params = useSearchParams()
  const defaultKop = params.get('koperasi') ?? ''

  const [userId, setUserId] = useState('')
  const [joinedKoperasi, setJoinedKoperasi] = useState<Koperasi[]>([])
  const [simpanan, setSimpanan] = useState<Simpanan[]>([])
  const [tab, setTab] = useState<'list' | 'setor'>('list')
  const [form, setForm] = useState({ koperasi_id: defaultKop, jumlah: '', keterangan: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const { data: mem } = await supabase
        .from('anggota_koperasi').select('koperasi_id, koperasi(id, nama)').eq('anggota_id', user.id)
      const kops = (mem ?? []).map((m: any) => m.koperasi).filter(Boolean) as Koperasi[]
      setJoinedKoperasi(kops)

      const { data: smp } = await supabase
        .from('simpanan').select('id, jumlah, keterangan, tanggal, koperasi(id, nama)')
        .in('koperasi_id', kops.map(k => k.id))
        .order('tanggal', { ascending: false })
      setSimpanan((smp ?? []) as Simpanan[])
    })
  }, [])

  async function handleSetor(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const { data: p } = await supabase.from('profiles').select('nama').eq('id', userId).single()
    let anggotaId: string | undefined
    const { data: ang } = await supabase.from('anggota').select('id').eq('koperasi_id', form.koperasi_id).limit(1).single()
    if (ang) { anggotaId = ang.id }
    else {
      const { data: newAng } = await supabase.from('anggota').insert({ koperasi_id: form.koperasi_id, nama: p?.nama ?? 'Anggota' }).select().single()
      anggotaId = newAng?.id
    }

    await supabase.from('simpanan').insert({
      koperasi_id: form.koperasi_id, anggota_id: anggotaId,
      jumlah: parseFloat(form.jumlah), keterangan: form.keterangan || null,
    })

    setTab('list')
    setForm({ koperasi_id: defaultKop, jumlah: '', keterangan: '' })
    setSaving(false)

    const kops = joinedKoperasi.map(k => k.id)
    const { data: smp } = await supabase.from('simpanan').select('id, jumlah, keterangan, tanggal, koperasi(id, nama)').in('koperasi_id', kops).order('tanggal', { ascending: false })
    setSimpanan((smp ?? []) as Simpanan[])
  }

  const totalPerKop = joinedKoperasi.map(k => ({
    ...k,
    total: simpanan.filter(s => s.koperasi?.id === k.id).reduce((sum, s) => sum + s.jumlah, 0),
  }))

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-xl font-semibold">Simpanan Saya</h1>
          <p className="text-slate-400 text-sm">Simpanan di semua koperasi yang kamu ikuti</p>
        </div>
        <button onClick={() => setTab('setor')}
          className="bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Setor
        </button>
      </div>

      {/* Total per koperasi */}
      {totalPerKop.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {totalPerKop.map(k => (
            <div key={k.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3">
              <p className="text-slate-400 text-xs truncate">{k.nama}</p>
              <p className="text-white text-lg font-bold mt-1">
                Rp {k.total.toLocaleString('id-ID')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['list', 'setor'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-green-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {t === 'list' ? 'Riwayat' : 'Setor Simpanan'}
          </button>
        ))}
      </div>

      {tab === 'setor' && (
        <form onSubmit={handleSetor} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Koperasi *</label>
            <select required value={form.koperasi_id} onChange={e => setForm(f => ({ ...f, koperasi_id: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-1.5">Jumlah (Rp) *</label>
            <input required type="number" min="1000" value={form.jumlah}
              onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="100000"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm">
            {saving ? 'Menyimpan...' : 'Setor Simpanan'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        simpanan.length === 0
          ? <div className="text-center py-16 text-slate-500"><p className="text-4xl mb-2">🪙</p><p>Belum ada simpanan.</p></div>
          : <div className="space-y-2">
              {simpanan.map(s => (
                <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-white text-sm font-medium">Rp {s.jumlah.toLocaleString('id-ID')}</p>
                    <p className="text-slate-400 text-xs">{s.koperasi?.nama}</p>
                  </div>
                  <p className="text-slate-600 text-xs">{new Date(s.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
            </div>
      )}
    </div>
  )
}

export default function MemberSimpananPage() {
  return (
    <Suspense fallback={<p className="text-slate-500 text-sm p-4">Memuat...</p>}>
      <SimpananContent />
    </Suspense>
  )
}
