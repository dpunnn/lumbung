'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Coins, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Koperasi = { id: string; nama: string }
type Simpanan = { id: string; jumlah: number; keterangan: string | null; tanggal: string; koperasi: Koperasi | null }

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

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
          <h1 className="text-stone-900 text-xl font-bold">Simpanan Saya</h1>
          <p className="text-stone-500 text-sm">Simpanan di semua koperasi yang kamu ikuti</p>
        </div>
        <button onClick={() => setTab('setor')}
          className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
          <Plus size={15} /> Setor
        </button>
      </div>

      {totalPerKop.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {totalPerKop.map(k => (
            <div key={k.id} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
              <p className="text-stone-500 text-xs truncate">{k.nama}</p>
              <p className="text-stone-900 text-xl font-bold mt-1">
                Rp {k.total.toLocaleString('id-ID')}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1 w-fit">
        {(['list', 'setor'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
            {t === 'list' ? 'Riwayat' : 'Setor Simpanan'}
          </button>
        ))}
      </div>

      {tab === 'setor' && (
        <form onSubmit={handleSetor} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Koperasi *</label>
            <select required value={form.koperasi_id} onChange={e => setForm(f => ({ ...f, koperasi_id: e.target.value }))} className={inputCls}>
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Jumlah (Rp) *</label>
            <input required type="number" min="1000" value={form.jumlah}
              onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="100000" className={inputCls} />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {saving ? 'Menyimpan...' : 'Setor Simpanan'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        simpanan.length === 0
          ? (
            <div className="text-center py-16 text-stone-400 bg-white border border-stone-200 rounded-xl">
              <Coins size={32} className="mx-auto mb-2 text-stone-300" />
              <p className="text-sm">Belum ada simpanan.</p>
            </div>
          )
          : (
            <div className="space-y-2">
              {simpanan.map(s => (
                <div key={s.id} className="bg-white border border-stone-200 rounded-xl px-4 py-3 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="text-stone-900 text-sm font-medium">Rp {s.jumlah.toLocaleString('id-ID')}</p>
                    <p className="text-stone-500 text-xs">{s.koperasi?.nama}</p>
                  </div>
                  <p className="text-stone-400 text-xs">{new Date(s.tanggal).toLocaleDateString('id-ID')}</p>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  )
}

export default function MemberSimpananPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SimpananContent />
    </Suspense>
  )
}
