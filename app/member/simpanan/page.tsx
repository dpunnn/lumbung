'use client'

import { useEffect, useState, useRef } from 'react'
import { Coins, Clock, CheckCircle, AlertTriangle, X, Plus, MessageSquare } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'

type Koperasi = { id: string; nama: string }
type Simpanan = {
  id: string; jumlah: number; keterangan: string | null
  tanggal: string; status: string; confirmed_at: string | null
  disputed_note: string | null; koperasi: Koperasi | null
}
type Toast = { id: number; type: 'success' | 'warn' | 'error'; msg: string }

const inputCls = 'w-full bg-white border border-stone-300 rounded-lg px-3 py-2.5 text-stone-900 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-500 transition-colors'

export default function MemberSimpananPage() {
  const [userId, setUserId] = useState('')
  const [anggotaIds, setAnggotaIds] = useState<string[]>([])
  const [kopIds, setKopIds] = useState<string[]>([])
  const [joinedKoperasi, setJoinedKoperasi] = useState<Koperasi[]>([])
  const [simpanan, setSimpanan] = useState<Simpanan[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [tab, setTab] = useState<'list' | 'setor' | 'lapor'>('list')
  const [disputeId, setDisputeId] = useState<string | null>(null)
  const [disputeNote, setDisputeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [setor, setSetor] = useState({ koperasi_id: '', jumlah: '', keterangan: '' })
  const [lapor, setLapor] = useState({ koperasi_id: '', jumlah: '', keterangan: '' })
  const counter = useRef(0)

  function addToast(type: Toast['type'], msg: string) {
    const id = ++counter.current
    setToasts(p => [...p, { id, type, msg }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 6000)
  }

  async function loadSimpanan(kIds: string[]) {
    if (!kIds.length) return
    const data = await api.get<Simpanan[]>(`/api/simpanan?koperasi_id=${kIds.join(',')}`).catch(() => [] as Simpanan[])
    setSimpanan(data ?? [])
  }

  useEffect(() => {
    async function init() {
      const me = await getMe()
      if (!me) return
      setUserId(me.id)

      const [mem, angRows] = await Promise.all([
        api.get<{ koperasi_id: string; koperasi: Koperasi }[]>(`/api/anggota?anggota_id=${me.id}`).catch(() => [] as { koperasi_id: string; koperasi: Koperasi }[]),
        api.get<{ id: string }[]>(`/api/anggota?user_id=${me.id}`).catch(() => [] as { id: string }[]),
      ])

      const kops = (mem ?? []).map((m: any) => m.koperasi).filter(Boolean) as Koperasi[]
      const ids = (angRows ?? []).map((a: any) => a.id)
      const kIds = kops.map(k => k.id)

      setJoinedKoperasi(kops)
      setAnggotaIds(ids)
      setKopIds(kIds)
      loadSimpanan(kIds)
    }
    init()
  }, [])

  useEffect(() => {
    if (!anggotaIds.length) return
    // Realtime Supabase diganti polling karena backend kini Go/REST, bukan Supabase direct.
    const timer = setInterval(() => loadSimpanan(kopIds), 30_000)
    return () => clearInterval(timer)
  }, [anggotaIds, kopIds])

  async function resolveAnggotaId(koperasiId: string): Promise<string | undefined> {
    // TODO: implement via API — resolusi anggota_id via member-svc (lookup by koperasi_id+user_id atau auto-create)
    // Sementara kembalikan undefined agar backend menangani lewat field user_id di body
    return undefined
  }

  async function handleSetor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const anggotaId = await resolveAnggotaId(setor.koperasi_id)
    try {
      await api.post('/api/simpanan', {
        koperasi_id: setor.koperasi_id,
        anggota_id: anggotaId,
        jumlah: parseFloat(setor.jumlah),
        keterangan: setor.keterangan || null,
        status: 'pending_admin_confirm',
      })
    } catch { /* biarkan lanjut */ }
    setSaving(false)
    setSetor({ koperasi_id: '', jumlah: '', keterangan: '' })
    setTab('list')
    addToast('success', 'Setoran dikirim. Menunggu konfirmasi pengurus.')
    loadSimpanan(kopIds)
  }

  async function handleLapor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const anggotaId = await resolveAnggotaId(lapor.koperasi_id)
    try {
      await api.post('/api/simpanan', {
        koperasi_id: lapor.koperasi_id,
        anggota_id: anggotaId,
        jumlah: parseFloat(lapor.jumlah),
        keterangan: lapor.keterangan || 'Klaim setoran tidak tercatat',
        status: 'claimed',
      })
    } catch { /* biarkan lanjut */ }
    setSaving(false)
    setLapor({ koperasi_id: '', jumlah: '', keterangan: '' })
    setTab('list')
    addToast('warn', 'Laporan dikirim ke pengurus untuk diverifikasi.')
    loadSimpanan(kopIds)
  }

  async function handleConfirm(id: string) {
    setSaving(true)
    try {
      await api.put(`/api/simpanan/${id}`, { status: 'confirmed', confirmed_at: new Date().toISOString() })
    } catch { /* biarkan lanjut */ }
    setSaving(false)
    loadSimpanan(kopIds)
  }

  async function handleDispute(id: string) {
    if (!disputeNote.trim()) return
    setSaving(true)
    try {
      await api.put(`/api/simpanan/${id}`, { status: 'disputed', disputed_note: disputeNote.trim() })
    } catch { /* biarkan lanjut */ }
    setSaving(false)
    setDisputeId(null)
    setDisputeNote('')
    addToast('warn', 'Laporan sengketa dikirim ke pengurus.')
    loadSimpanan(kopIds)
  }

  const needConfirm = simpanan.filter(s => s.status === 'pending_member_confirm')
  const confirmed = simpanan.filter(s => s.status === 'confirmed')
  const total = confirmed.reduce((sum, s) => sum + s.jumlah, 0)
  const pendingMe = simpanan.filter(s => s.status === 'pending_admin_confirm').length

  function statusBadge(s: Simpanan) {
    if (s.status === 'confirmed')          return <span className="inline-flex items-center gap-1 text-[10px] bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full"><CheckCircle size={9}/> Dikonfirmasi</span>
    if (s.status === 'pending_admin_confirm') return <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full"><Clock size={9}/> Menunggu admin</span>
    if (s.status === 'disputed')           return <span className="inline-flex items-center gap-1 text-[10px] bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded-full"><AlertTriangle size={9}/> Sengketa</span>
    if (s.status === 'claimed')            return <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full"><Clock size={9}/> Klaim dikirim</span>
    if (s.status === 'rejected')           return <span className="inline-flex items-center gap-1 text-[10px] bg-stone-100 text-stone-500 border border-stone-200 px-1.5 py-0.5 rounded-full"><X size={9}/> Ditolak</span>
    return null
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">

      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-start gap-2 px-4 py-3 rounded-xl shadow-lg text-sm pointer-events-auto max-w-xs
            ${t.type === 'success' ? 'bg-green-700 text-white' : t.type === 'error' ? 'bg-red-700 text-white' : 'bg-amber-700 text-white'}`}>
            {t.type === 'success' ? <CheckCircle size={15} className="shrink-0 mt-0.5"/> : t.type === 'error' ? <X size={15} className="shrink-0 mt-0.5"/> : <AlertTriangle size={15} className="shrink-0 mt-0.5"/>}
            {t.msg}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-stone-900 text-xl font-bold">Simpanan Saya</h1>
          <p className="text-stone-500 text-sm">Total dikonfirmasi: Rp {total.toLocaleString('id-ID')}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setTab('lapor')}
            className="flex items-center gap-1.5 border border-stone-300 hover:bg-stone-50 text-stone-700 text-sm px-3 py-2 rounded-lg transition-colors">
            <MessageSquare size={14}/> Laporkan
          </button>
          <button onClick={() => setTab('setor')}
            className="flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm">
            <Plus size={15}/> Setor
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-stone-100 border border-stone-200 rounded-xl p-1 w-fit">
        {(['list', 'setor', 'lapor'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors relative
              ${tab === t ? 'bg-amber-700 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'}`}>
            {t === 'list' ? 'Riwayat' : t === 'setor' ? 'Setor Simpanan' : 'Laporkan'}
            {t === 'list' && (needConfirm.length + pendingMe) > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {needConfirm.length + pendingMe}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'setor' && (
        <form onSubmit={handleSetor} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
            Pengurus akan mengkonfirmasi setoranmu. Kamu akan mendapat notifikasi setelah dikonfirmasi.
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Koperasi *</label>
            <select required value={setor.koperasi_id} onChange={e => setSetor(f => ({ ...f, koperasi_id: e.target.value }))} className={inputCls}>
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Jumlah (Rp) *</label>
            <input required type="number" min="1000" value={setor.jumlah}
              onChange={e => setSetor(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="100000" className={inputCls}/>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Keterangan</label>
            <input value={setor.keterangan} onChange={e => setSetor(f => ({ ...f, keterangan: e.target.value }))}
              placeholder="Simpanan rutin Juli" className={inputCls}/>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {saving ? 'Mengirim...' : 'Kirim Setoran'}
          </button>
        </form>
      )}

      {tab === 'lapor' && (
        <form onSubmit={handleLapor} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
            Gunakan ini jika kamu sudah serahkan uang ke kasir tapi tidak ada pencatatan. Pengurus akan memverifikasi.
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Koperasi *</label>
            <select required value={lapor.koperasi_id} onChange={e => setLapor(f => ({ ...f, koperasi_id: e.target.value }))} className={inputCls}>
              <option value="">Pilih koperasi...</option>
              {joinedKoperasi.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Jumlah yang disetor (Rp) *</label>
            <input required type="number" min="1000" value={lapor.jumlah}
              onChange={e => setLapor(f => ({ ...f, jumlah: e.target.value }))}
              placeholder="100000" className={inputCls}/>
          </div>
          <div>
            <label className="block text-stone-700 text-sm font-medium mb-1.5">Keterangan (tanggal, ke kasir siapa) *</label>
            <input required value={lapor.keterangan} onChange={e => setLapor(f => ({ ...f, keterangan: e.target.value }))}
              placeholder="Setor Senin pagi ke Pak Budi" className={inputCls}/>
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {saving ? 'Mengirim...' : 'Kirim Laporan'}
          </button>
        </form>
      )}

      {tab === 'list' && (
        <div className="space-y-4">

          {needConfirm.length > 0 && (
            <div className="space-y-3">
              <p className="text-stone-700 text-sm font-semibold flex items-center gap-1.5">
                <Clock size={14} className="text-amber-600"/> Perlu konfirmasimu ({needConfirm.length})
              </p>
              {needConfirm.map(s => (
                <div key={s.id} className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-stone-600 text-xs">Kasir mencatat setoran atas namamu:</p>
                    <p className="text-stone-900 text-2xl font-bold mt-0.5">Rp {s.jumlah.toLocaleString('id-ID')}</p>
                    <p className="text-stone-500 text-xs mt-0.5">
                      {s.koperasi?.nama}{s.keterangan ? ` · ${s.keterangan}` : ''}
                      {' · '}{new Date(s.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  {disputeId === s.id ? (
                    <div className="space-y-2">
                      <input value={disputeNote} onChange={e => setDisputeNote(e.target.value)}
                        placeholder="Nominal salah, saya setor Rp 200.000 bukan Rp 100.000"
                        className={inputCls}/>
                      <div className="flex gap-2">
                        <button onClick={() => handleDispute(s.id)} disabled={saving || !disputeNote.trim()}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg">
                          Kirim Laporan
                        </button>
                        <button onClick={() => { setDisputeId(null); setDisputeNote('') }}
                          className="px-4 border border-stone-300 rounded-lg text-stone-600 text-sm hover:bg-stone-50">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => handleConfirm(s.id)} disabled={saving}
                        className="flex-1 bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                        <CheckCircle size={14}/> Ya, sudah setor
                      </button>
                      <button onClick={() => setDisputeId(s.id)}
                        className="flex-1 border border-red-200 hover:bg-red-50 text-red-600 text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5">
                        <X size={14}/> Tidak sesuai
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {simpanan.filter(s => s.status !== 'pending_member_confirm').length === 0 && needConfirm.length === 0 ? (
            <div className="text-center py-16 bg-white border border-stone-200 rounded-xl">
              <Coins size={32} className="mx-auto mb-2 text-stone-300"/>
              <p className="text-stone-400 text-sm">Belum ada simpanan.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {simpanan.filter(s => s.status !== 'pending_member_confirm').map(s => (
                <div key={s.id} className={`bg-white border rounded-xl px-4 py-3 shadow-sm
                  ${s.status === 'disputed' || s.status === 'claimed' ? 'border-red-200' : 'border-stone-200'}`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-stone-900 text-sm font-medium">Rp {s.jumlah.toLocaleString('id-ID')}</p>
                        {statusBadge(s)}
                      </div>
                      <p className="text-stone-500 text-xs">
                        {s.koperasi?.nama}{s.keterangan ? ` · ${s.keterangan}` : ''}
                      </p>
                      {s.status === 'disputed' && s.disputed_note && (
                        <p className="text-red-500 text-xs">Laporan: {s.disputed_note}</p>
                      )}
                    </div>
                    <p className="text-stone-400 text-xs shrink-0">{new Date(s.tanggal).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
