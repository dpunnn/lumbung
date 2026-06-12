'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Landmark, Plus } from 'lucide-react'

type Koperasi = { id: string; nama: string }
type Pinjaman = {
  id: string; jumlah_pokok: number; tenor_bulan: number; status: string
  created_at: string; koperasi: Koperasi | null
}

const STATUS_COLOR: Record<string, string> = {
  diajukan:  'bg-amber-50 text-amber-700 border border-amber-200',
  aktif:     'bg-green-50 text-green-700 border border-green-200',
  lunas:     'bg-stone-100 text-stone-600 border border-stone-200',
  macet:     'bg-red-50 text-red-600 border border-red-200',
  ditolak:   'bg-red-50 text-red-600 border border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  diajukan: 'Menunggu Persetujuan',
  aktif:    'Aktif',
  lunas:    'Lunas',
  macet:    'Macet',
  ditolak:  'Ditolak',
}

function PinjamanContent() {
  const params = useSearchParams()
  const defaultKop = params.get('koperasi') ?? ''

  const [userId, setUserId] = useState('')
  const [joinedKoperasi, setJoinedKoperasi] = useState<Koperasi[]>([])
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([])
  const [tab, setTab] = useState<'list' | 'ajukan'>('list')
  const [form, setForm] = useState({ koperasi_id: defaultKop, jumlah: '', tenor_bulan: '12' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const { data: mem } = await supabase
        .from('anggota_koperasi')
        .select('koperasi_id, koperasi(id, nama)')
        .eq('anggota_id', user.id)
      const kops = (mem ?? []).map((m: any) => m.koperasi).filter(Boolean) as Koperasi[]
      setJoinedKoperasi(kops)
      loadPinjaman(kops.map(k => k.id))
    })
  }, [])

  async function loadPinjaman(koperasiIds: string[]) {
    if (!koperasiIds.length) return
    const { data: pin } = await supabase
      .from('pinjaman')
      .select('id, jumlah_pokok, tenor_bulan, status, created_at, koperasi(id, nama)')
      .in('koperasi_id', koperasiIds)
      .order('created_at', { ascending: false })
    setPinjaman((pin ?? []) as Pinjaman[])
  }

  async function handleAjukan(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!form.koperasi_id) { setError('Pilih koperasi terlebih dahulu'); return }

    setSaving(true)

    // Cari anggota row di koperasi ini (yang sudah punya user_id = userId)
    const { data: existingAng } = await supabase
      .from('anggota')
      .select('id')
      .eq('koperasi_id', form.koperasi_id)
      .eq('user_id', userId)
      .maybeSingle()

    let anggotaId = existingAng?.id

    if (!anggotaId) {
      // Buat row anggota baru dan link ke user_id
      const { data: p } = await supabase.from('profiles').select('nama').eq('id', userId).single()
      const { data: newAng, error: angErr } = await supabase.from('anggota').insert({
        koperasi_id: form.koperasi_id,
        nama: p?.nama ?? 'Anggota',
        user_id: userId,
      }).select('id').single()

      if (angErr || !newAng) {
        setError('Gagal mendaftarkan profil anggota. Coba lagi.')
        setSaving(false)
        return
      }
      anggotaId = newAng.id

      // Juga daftarkan ke anggota_koperasi jika belum ada
      await supabase.from('anggota_koperasi').upsert({
        anggota_id: userId,
        koperasi_id: form.koperasi_id,
      }, { onConflict: 'anggota_id,koperasi_id' })
    }

    const jumlah = parseFloat(form.jumlah)
    const tenor = parseInt(form.tenor_bulan)

    // Status 'diajukan' — pengurus harus approve dulu
    const { error: pinErr } = await supabase.from('pinjaman').insert({
      koperasi_id: form.koperasi_id,
      anggota_id: anggotaId,
      jumlah_pokok: jumlah,
      tenor_bulan: tenor,
      angsuran_per_bulan: Math.ceil(jumlah / tenor),
      tanggal_mulai: new Date().toISOString().split('T')[0],
      status: 'diajukan',
    })

    if (pinErr) { setError(pinErr.message); setSaving(false); return }

    setSuccess(true)
    setTab('list')
    setForm(f => ({ ...f, jumlah: '', tenor_bulan: '12' }))
    setSaving(false)
    loadPinjaman(joinedKoperasi.map(k => k.id))
  }

  const diajukan = pinjaman.filter(p => p.status === 'diajukan')

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Pinjaman Saya</h1>
          <p className="text-stone-600 text-sm">Pengajuan di semua koperasi yang kamu ikuti</p>
        </div>
        <button onClick={() => { setTab('ajukan'); setSuccess(false); setError('') }}
          className="bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Ajukan
        </button>
      </div>

      <div className="flex gap-1 bg-white border border-stone-200 rounded-xl shadow-sm p-1 w-fit">
        {(['list', 'ajukan'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors relative
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
            {t === 'list' ? 'Riwayat' : 'Ajukan Baru'}
            {t === 'list' && diajukan.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {diajukan.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          Pengajuan berhasil dikirim. Tunggu persetujuan pengurus koperasi.
        </div>
      )}

      {tab === 'ajukan' && (
        <form onSubmit={handleAjukan} className="bg-white border border-stone-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 text-xs text-stone-600">
            Pengajuan akan diteruskan ke pengurus koperasi untuk ditinjau. Histori pinjaman di semua koperasi akan dicek.
          </div>
          <div>
            <label className="block text-stone-600 text-sm mb-1.5">Koperasi *</label>
            <select required value={form.koperasi_id} onChange={e => setForm(f => ({ ...f, koperasi_id: e.target.value }))}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-stone-600 text-sm mb-1.5">Jumlah Pinjaman (Rp) *</label>
            <input required type="number" min="100000" value={form.jumlah}
              onChange={e => setForm(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="5000000"
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors" />
          </div>
          <div>
            <label className="block text-stone-600 text-sm mb-1.5">Tenor (bulan)</label>
            <select value={form.tenor_bulan} onChange={e => setForm(f => ({ ...f, tenor_bulan: e.target.value }))}
              className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors">
              {[3, 6, 12, 24, 36].map(n => <option key={n} value={n}>{n} bulan</option>)}
            </select>
          </div>
          {form.jumlah && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="text-stone-600 text-sm">Estimasi angsuran/bulan</span>
              <span className="text-amber-700 font-bold">
                Rp {Math.ceil(parseFloat(form.jumlah) / parseInt(form.tenor_bulan)).toLocaleString('id-ID')}
              </span>
            </div>
          )}
          {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {saving ? 'Mengirim Pengajuan...' : 'Kirim Pengajuan'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        pinjaman.length === 0
          ? <div className="text-center py-16 bg-white border border-stone-200 rounded-xl shadow-sm text-stone-400">
              <Landmark className="w-10 h-10 mx-auto mb-3" />
              <p>Belum ada pinjaman.</p>
            </div>
          : <div className="space-y-3">
              {pinjaman.map(p => (
                <div key={p.id} className={`bg-white border rounded-xl shadow-sm p-4 ${p.status === 'macet' ? 'border-red-200' : p.status === 'diajukan' ? 'border-amber-200' : 'border-stone-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-stone-900 font-medium">Rp {p.jumlah_pokok.toLocaleString('id-ID')}</p>
                      <p className="text-stone-400 text-xs mt-0.5">{p.koperasi?.nama} · {p.tenor_bulan} bulan</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[p.status] ?? 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                  <p className="text-stone-400 text-xs">{new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  {p.status === 'diajukan' && (
                    <p className="text-amber-700 text-xs mt-2">Menunggu persetujuan pengurus</p>
                  )}
                  {p.status === 'ditolak' && (
                    <p className="text-red-600 text-xs mt-2">Pengajuan ditolak oleh pengurus</p>
                  )}
                </div>
              ))}
            </div>
      )}
    </div>
  )
}

export default function MemberPinjamanPage() {
  return (
    <Suspense fallback={<div className="flex items-center gap-3 py-8 justify-center"><div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" /><p className="text-stone-400 text-sm">Memuat...</p></div>}>
      <PinjamanContent />
    </Suspense>
  )
}
