'use client'

import { Suspense, useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Landmark, Plus, ChevronDown, ChevronUp, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

type Koperasi = { id: string; nama: string }

type Angsuran = {
  id: string
  bulan_ke: number
  tanggal_jatuh_tempo: string
  jumlah_bayar: number | null
  status: 'pending' | 'lunas' | 'terlambat'
  tanggal_bayar: string | null
}

type Pinjaman = {
  id: string
  jumlah_pokok: number
  tenor_bulan: number
  angsuran_per_bulan: number
  status: string
  created_at: string
  koperasi: Koperasi | null
  angsuran: Angsuran[]
}

const STATUS_COLOR: Record<string, string> = {
  diajukan: 'bg-amber-50 text-amber-700 border border-amber-200',
  aktif:    'bg-green-50 text-green-700 border border-green-200',
  lunas:    'bg-stone-100 text-stone-600 border border-stone-200',
  macet:    'bg-red-50 text-red-600 border border-red-200',
  ditolak:  'bg-red-50 text-red-600 border border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  diajukan: 'Menunggu Persetujuan',
  aktif:    'Aktif',
  lunas:    'Lunas',
  macet:    'Macet',
  ditolak:  'Ditolak',
}

const ANG_ICON: Record<string, React.ReactNode> = {
  lunas:    <CheckCircle size={14} className="text-green-600 shrink-0" />,
  pending:  <Clock size={14} className="text-stone-400 shrink-0" />,
  terlambat:<AlertTriangle size={14} className="text-red-500 shrink-0" />,
}

const ANG_ROW: Record<string, string> = {
  lunas:    'bg-green-50 border-green-100',
  pending:  'bg-white border-stone-100',
  terlambat:'bg-red-50 border-red-100',
}

const ANG_TEXT: Record<string, string> = {
  lunas:    'text-green-700',
  pending:  'text-stone-500',
  terlambat:'text-red-600',
}

const ANG_LABEL: Record<string, string> = {
  lunas:    'Lunas',
  pending:  'Belum Dibayar',
  terlambat:'Terlambat',
}

function AngsuranTimeline({ angsuran, angsuranPerBulan }: { angsuran: Angsuran[]; angsuranPerBulan: number }) {
  const sorted = [...angsuran].sort((a, b) => a.bulan_ke - b.bulan_ke)
  const lunasCount = sorted.filter(a => a.status === 'lunas').length
  const pct = sorted.length > 0 ? Math.round((lunasCount / sorted.length) * 100) : 0

  return (
    <div className="mt-3 space-y-2.5">
      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-stone-500 mb-1">
          <span>{lunasCount} dari {sorted.length} angsuran lunas</span>
          <span className="font-semibold text-stone-700">{pct}%</span>
        </div>
        <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* List angsuran — read only */}
      <div className="space-y-1.5">
        {sorted.map(a => {
          const jatuhTempo = new Date(a.tanggal_jatuh_tempo)
          const isOverdue = a.status !== 'lunas' && jatuhTempo < new Date()
          const effectiveStatus = isOverdue ? 'terlambat' : a.status
          return (
            <div key={a.id}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm ${ANG_ROW[effectiveStatus] ?? 'bg-white border-stone-100'}`}>
              <div className="flex items-center gap-2">
                {ANG_ICON[effectiveStatus] ?? <Clock size={14} className="text-stone-400 shrink-0" />}
                <div>
                  <span className="text-stone-800 font-semibold">Bulan {a.bulan_ke}</span>
                  <span className="text-stone-400 text-xs ml-2">
                    Jatuh tempo {jatuhTempo.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-semibold text-xs ${ANG_TEXT[effectiveStatus] ?? 'text-stone-500'}`}>
                  Rp {angsuranPerBulan.toLocaleString('id-ID')}
                </p>
                <p className={`text-[10px] ${ANG_TEXT[effectiveStatus] ?? 'text-stone-400'}`}>
                  {a.status === 'lunas' && a.tanggal_bayar
                    ? `Dibayar ${new Date(a.tanggal_bayar).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
                    : ANG_LABEL[effectiveStatus] ?? '—'}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-stone-400 text-xs text-center">Status diperbarui real-time oleh kasir koperasi.</p>
    </div>
  )
}

function PinjamanCard({ p }: { p: Pinjaman }) {
  const [open, setOpen] = useState(false)
  const hasAngsuran = p.angsuran.length > 0

  return (
    <div className={`bg-white border rounded-xl shadow-sm overflow-hidden
      ${p.status === 'macet' ? 'border-red-200' : p.status === 'diajukan' ? 'border-amber-200' : 'border-stone-200'}`}>
      <div className="p-4">
        <div className="flex justify-between items-start mb-1.5">
          <div>
            <p className="text-stone-900 font-semibold">Rp {p.jumlah_pokok.toLocaleString('id-ID')}</p>
            <p className="text-stone-400 text-xs mt-0.5">
              {p.koperasi?.nama} · {p.tenor_bulan} bulan
              {p.angsuran_per_bulan > 0 && ` · Rp ${p.angsuran_per_bulan.toLocaleString('id-ID')}/bln`}
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[p.status] ?? 'bg-stone-100 text-stone-600 border border-stone-200'}`}>
            {STATUS_LABEL[p.status] ?? p.status}
          </span>
        </div>

        <p className="text-stone-400 text-xs">
          Diajukan {new Date(p.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {p.status === 'diajukan' && (
          <p className="text-amber-700 text-xs mt-2">Menunggu persetujuan pengurus</p>
        )}
        {p.status === 'ditolak' && (
          <p className="text-red-600 text-xs mt-2">Pengajuan ditolak oleh pengurus</p>
        )}

        {hasAngsuran && (
          <button onClick={() => setOpen(v => !v)}
            className="mt-3 w-full flex items-center justify-between text-xs text-stone-500 hover:text-stone-900 border border-stone-200 rounded-lg px-3 py-2 hover:bg-stone-50 transition-colors">
            <span>Lihat jadwal angsuran ({p.angsuran.length} bulan)</span>
            {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {open && hasAngsuran && (
        <div className="border-t border-stone-100 px-4 pb-4">
          <AngsuranTimeline angsuran={p.angsuran} angsuranPerBulan={p.angsuran_per_bulan} />
        </div>
      )}
    </div>
  )
}

function PinjamanContent() {
  const params = useSearchParams()
  const defaultKop = params.get('koperasi') ?? ''

  const [userId, setUserId] = useState('')
  const [joinedKoperasi, setJoinedKoperasi] = useState<Koperasi[]>([])
  const [pinjaman, setPinjaman] = useState<Pinjaman[]>([])
  const [tab, setTab] = useState<'list' | 'ajukan'>('list')
  const [form, setForm] = useState({ koperasi_id: defaultKop, jumlah: '', tenor_bulan: '12' })
  const [anggotaIds, setAnggotaIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const loadPinjaman = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const { data: pin } = await supabase
      .from('pinjaman')
      .select('id, jumlah_pokok, tenor_bulan, angsuran_per_bulan, status, created_at, koperasi(id, nama), angsuran(id, bulan_ke, tanggal_jatuh_tempo, jumlah_bayar, status, tanggal_bayar)')
      .in('anggota_id', ids)
      .order('created_at', { ascending: false })
    setPinjaman((pin ?? []) as unknown as Pinjaman[])
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)

      const { data: mem } = await supabase
        .from('anggota_koperasi').select('koperasi_id, koperasi(id, nama)').eq('anggota_id', user.id)
      const kops = (mem ?? []).map((m: any) => m.koperasi).filter(Boolean) as Koperasi[]
      setJoinedKoperasi(kops)

      const { data: prof } = await supabase.from('profiles').select('nama').eq('id', user.id).single()
      if (!prof?.nama) return

      const { data: anggotaRows } = await supabase
        .from('anggota').select('id, koperasi_id, koperasi(id, nama)').ilike('nama', prof.nama)
      if (!anggotaRows?.length) return

      const extraKops = (anggotaRows as any[])
        .map(a => a.koperasi).filter(Boolean)
        .filter(k => !kops.find((e: Koperasi) => e.id === k.id))
      if (extraKops.length) setJoinedKoperasi(prev => [...prev, ...extraKops])

      const ids = anggotaRows.map((a: any) => a.id)
      setAnggotaIds(ids)
      loadPinjaman(ids)
    })
  }, [loadPinjaman])

  // Realtime: status pinjaman berubah (disetujui/ditolak) atau angsuran dibayar admin
  useEffect(() => {
    if (!anggotaIds.length) return
    const channel = supabase.channel('member-pinjaman-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pinjaman' },  () => loadPinjaman(anggotaIds))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'angsuran' },  () => loadPinjaman(anggotaIds))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [anggotaIds, loadPinjaman])

  async function handleAjukan(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess(false)
    if (!form.koperasi_id) { setError('Pilih koperasi terlebih dahulu'); return }
    setSaving(true)

    const { data: existingAng } = await supabase
      .from('anggota')
      .select('id')
      .eq('koperasi_id', form.koperasi_id)
      .eq('user_id', userId)
      .maybeSingle()

    let anggotaId = existingAng?.id

    if (!anggotaId) {
      const { data: p } = await supabase.from('profiles').select('nama').eq('id', userId).single()
      const { data: newAng, error: angErr } = await supabase.from('anggota').insert({
        koperasi_id: form.koperasi_id,
        nama: p?.nama ?? 'Anggota',
        user_id: userId,
      }).select('id').single()
      if (angErr || !newAng) { setError('Gagal mendaftarkan profil anggota. Coba lagi.'); setSaving(false); return }
      anggotaId = newAng.id
      await supabase.from('anggota_koperasi').upsert({
        anggota_id: userId,
        koperasi_id: form.koperasi_id,
      }, { onConflict: 'anggota_id,koperasi_id' })
    }

    const jumlah = parseFloat(form.jumlah)
    const tenor = parseInt(form.tenor_bulan)

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
    // Reload by anggota_id supaya konsisten
    const { data: anggotaRows } = await supabase.from('anggota').select('id').eq('user_id', userId)
    loadPinjaman((anggotaRows ?? []).map((a: any) => a.id))
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
          <Plus size={15} /> Ajukan
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
              <Landmark size={36} className="mx-auto mb-3" />
              <p>Belum ada pinjaman.</p>
            </div>
          : <div className="space-y-3">
              {pinjaman.map(p => <PinjamanCard key={p.id} p={p} />)}
            </div>
      )}
    </div>
  )
}

export default function MemberPinjamanPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center gap-3 py-8 justify-center">
        <div className="w-5 h-5 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
        <p className="text-stone-400 text-sm">Memuat...</p>
      </div>
    }>
      <PinjamanContent />
    </Suspense>
  )
}
