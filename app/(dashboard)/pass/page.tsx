'use client'

import { useEffect, useState, useCallback } from 'react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import { buildFields, hashFields } from '@/lib/pass'
import { cekKelayakan } from '@/lib/credit'
import type { ConsentMap, PassFields } from '@/lib/pass'
import type { HasilKelayakan } from '@/lib/credit'
import type { LumbungPass } from '@/types'
import { CreditCard, Plus, CheckCircle, ChevronRight, Info } from 'lucide-react'

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.14)',
  borderRadius: 10, padding: '10px 13px', color: '#0f2a1d', fontSize: 13.5, outline: 'none',
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#46544b', fontSize: 12, fontWeight: 600, marginBottom: 6 }

const greenBtn: React.CSSProperties = {
  background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none',
  fontWeight: 700, borderRadius: 12, padding: '11px 18px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}

export default function PassPage() {
  const [tab, setTab] = useState<'buat' | 'daftar' | 'cek'>('daftar')
  const [passList, setPassList] = useState<LumbungPass[]>([])
  const [consent, setConsent] = useState<ConsentMap>({ ternak: true, simpanan: true, pinjaman: true })
  const [form, setForm] = useState({ tujuan: '', mitra: '', hari: '30' })
  const [preview, setPreview] = useState<PassFields | null>(null)
  const [generated, setGenerated] = useState<LumbungPass | null>(null)
  const [loading, setLoading] = useState(false)
  const [koperasiId, setKoperasiId] = useState('')
  const [nik, setNik] = useState('')
  const [hasilCek, setHasilCek] = useState<HasilKelayakan | null>(null)
  const [loadingCek, setLoadingCek] = useState(false)

  const loadPasses = useCallback(async () => {
    const data = await api.get<LumbungPass[]>('/api/pass').catch(() => [] as LumbungPass[])
    setPassList(data ?? [])
  }, [])

  useEffect(() => {
    async function init() {
      const me = await getMe()
      if (me?.koperasi_id) setKoperasiId(me.koperasi_id)
    }
    init()
    loadPasses()
  }, [loadPasses])

  useEffect(() => {
    const timer = setInterval(() => loadPasses(), 30_000)
    return () => clearInterval(timer)
  }, [loadPasses])

  async function handlePreview() {
    if (!koperasiId) return
    setLoading(true)
    const fields = await buildFields(koperasiId, consent)
    setPreview(fields)
    setLoading(false)
  }

  async function handleGenerate() {
    if (!preview || !koperasiId || !form.tujuan || !form.mitra) return
    setLoading(true)
    const hash = await hashFields(preview)
    const berlakuSampai = new Date()
    berlakuSampai.setDate(berlakuSampai.getDate() + parseInt(form.hari))
    try {
      const data = await api.post<LumbungPass>('/api/pass', {
        koperasi_id: koperasiId, tujuan: form.tujuan, mitra: form.mitra,
        fields: preview, hash, consent,
        berlaku_sampai: berlakuSampai.toISOString().split('T')[0], status: 'aktif',
      })
      if (data) { setGenerated(data); setTab('daftar'); loadPasses() }
    } catch { /* lanjut */ }
    setLoading(false)
  }

  async function handleCabut(id: string) {
    if (!confirm('Cabut pass ini? Pemodal tidak bisa lagi mengaksesnya.')) return
    try { await api.put(`/api/pass/${id}`, { status: 'dicabut' }) } catch { /* lanjut */ }
    loadPasses()
  }

  const toggleConsent = (k: keyof ConsentMap) => setConsent(c => ({ ...c, [k]: !c[k] }))

  async function handleCek() {
    if (!nik.trim()) return
    setLoadingCek(true)
    setHasilCek(null)
    const hasil = await cekKelayakan(nik)
    setHasilCek(hasil)
    setLoadingCek(false)
  }

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '9px 18px', borderRadius: 10, fontSize: 13.5, cursor: 'pointer', border: 'none',
    background: active ? '#fff' : 'transparent', color: active ? '#0f2a1d' : '#7a857d',
    fontWeight: active ? 700 : 600, boxShadow: active ? '0 2px 8px rgba(26,71,49,.1)' : 'none',
  })

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Pass</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>Bagikan data koperasi secara aman ke pemodal</p>
        </div>
        <button onClick={() => { setTab('buat'); setPreview(null); setGenerated(null) }} style={greenBtn}>
          <Plus size={16} /> Terbitkan Pass
        </button>
      </div>

      <div style={{ display: 'flex', gap: 4, ...glass, borderRadius: 14, padding: 5, width: 'fit-content', marginBottom: 18 }}>
        {(['daftar', 'buat', 'cek'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
            {t === 'buat' ? 'Terbitkan Baru' : t === 'cek' ? 'Cek Anggota' : 'Daftar Pass'}
          </button>
        ))}
      </div>

      {tab === 'buat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* pilih data */}
          <div style={{ ...glass, borderRadius: 20, padding: 22 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d', marginBottom: 14 }}>1. Pilih Data yang Dibagikan</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {([
                { key: 'ternak', label: 'Data Ternak', desc: 'Jumlah, rasio sehat, nilai aset terverifikasi' },
                { key: 'simpanan', label: 'Data Simpanan', desc: 'Total simpanan anggota (agregat, bukan per anggota)' },
                { key: 'pinjaman', label: 'Riwayat Pinjaman', desc: 'Rasio cicilan lancar vs macet' },
              ] as { key: keyof ConsentMap; label: string; desc: string }[]).map(item => (
                <label key={item.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'rgba(26,71,49,.04)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={consent[item.key]} onChange={() => toggleConsent(item.key)}
                    style={{ marginTop: 2, accentColor: '#1a4731' }} />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#0f2a1d' }}>{item.label}</p>
                    <p style={{ fontSize: 12, color: '#7a857d', marginTop: 2 }}>{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* info pass */}
          <div style={{ ...glass, borderRadius: 20, padding: 22 }}>
            <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d', marginBottom: 14 }}>2. Informasi Pass</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={labelStyle}>Tujuan Pembiayaan *</label>
                <input value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))}
                  placeholder="Pengembangan usaha ternak sapi" style={inputStyle} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Nama Mitra / Pemodal *</label>
                  <input value={form.mitra} onChange={e => setForm(f => ({ ...f, mitra: e.target.value }))}
                    placeholder="BRI Desa / Pak Hendra" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Berlaku (hari)</label>
                  <select value={form.hari} onChange={e => setForm(f => ({ ...f, hari: e.target.value }))} style={inputStyle}>
                    {['7','14','30','60','90'].map(h => <option key={h} value={h}>{h} hari</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {!preview ? (
            <button onClick={handlePreview} disabled={loading || !form.tujuan || !form.mitra}
              style={{ width: '100%', padding: '13px', borderRadius: 13, border: '1px solid rgba(26,71,49,.2)', background: 'rgba(255,255,255,.6)', fontSize: 14, fontWeight: 700, color: '#1a4731', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (loading || !form.tujuan || !form.mitra) ? 0.5 : 1 }}>
              {loading ? 'Mengambil data...' : <><span>Preview Data</span><ChevronRight size={16} /></>}
            </button>
          ) : (
            <div style={{ ...glass, borderRadius: 20, padding: 22, border: '1px solid rgba(201,150,58,.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d' }}>3. Preview Data yang Akan Dibagikan</h2>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#1d7a4d', background: 'rgba(47,158,99,.12)', border: '1px solid rgba(47,158,99,.25)', padding: '3px 10px', borderRadius: 999 }}>Data Agregat</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                {preview.jumlah_ternak !== undefined && (
                  <div style={{ background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11.5, color: '#7a857d', fontWeight: 600 }}>Ternak Hidup</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', marginTop: 4 }}>{preview.jumlah_ternak} ekor</p>
                  </div>
                )}
                {preview.rasio_ternak_sehat !== undefined && (
                  <div style={{ background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11.5, color: '#7a857d', fontWeight: 600 }}>Rasio Sehat</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', marginTop: 4 }}>{preview.rasio_ternak_sehat}%</p>
                  </div>
                )}
                {preview.total_simpanan !== undefined && (
                  <div style={{ background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11.5, color: '#7a857d', fontWeight: 600 }}>Total Simpanan</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', marginTop: 4 }}>Rp{(preview.total_simpanan/1_000_000).toFixed(1)}jt</p>
                  </div>
                )}
                {preview.rasio_cicilan_lancar !== undefined && (
                  <div style={{ background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 11.5, color: '#7a857d', fontWeight: 600 }}>Cicilan Lancar</p>
                    <p style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', marginTop: 4 }}>{preview.rasio_cicilan_lancar}%</p>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)', borderRadius: 12, marginBottom: 14 }}>
                <Info size={14} style={{ color: '#3b7fd4', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#3b7fd4' }}>Tidak ada nama, NIK, atau nominal per anggota yang dibagikan</span>
              </div>
              <button onClick={handleGenerate} disabled={loading}
                style={{ ...greenBtn, width: '100%', justifyContent: 'center', padding: '13px', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Menerbitkan...' : 'Terbitkan Pass + Generate Link'}
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'cek' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ ...glass, borderRadius: 20, padding: 22 }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d', marginBottom: 6 }}>Cek Kelayakan Anggota</h2>
            <p style={{ fontSize: 13, color: '#7a857d', marginBottom: 16, lineHeight: 1.6 }}>
              Periksa riwayat kredit pemohon di seluruh jaringan koperasi sebelum menyetujui pinjaman. Hanya sinyal agregat yang ditampilkan.
            </p>
            <div>
              <label style={labelStyle}>NIK Pemohon</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={nik} onChange={e => setNik(e.target.value)}
                  placeholder="Mis. 3273010101900001" style={{ ...inputStyle, flex: 1 }} />
                <button onClick={handleCek} disabled={loadingCek || !nik.trim()}
                  style={{ ...greenBtn, opacity: (loadingCek || !nik.trim()) ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {loadingCek ? 'Mengecek...' : 'Cek'}
                </button>
              </div>
              <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 6 }}>NIK di-hash (SHA-256) sebelum dicocokkan — NIK asli tidak dikirim.</p>
            </div>
          </div>

          {hasilCek && (() => {
            const rek = hasilCek.rekomendasi
            const barColor = rek === 'SETUJUI' ? '#2f9e63' : rek === 'TINJAU' ? '#c9963a' : '#d65745'
            const accentBorder = rek === 'SETUJUI' ? 'rgba(47,158,99,.3)' : rek === 'TINJAU' ? 'rgba(201,150,58,.3)' : 'rgba(214,87,69,.28)'
            const pillStyle: React.CSSProperties = {
              fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 999,
              background: rek === 'SETUJUI' ? 'rgba(47,158,99,.14)' : rek === 'TINJAU' ? 'rgba(201,150,58,.14)' : 'rgba(214,87,69,.12)',
              color: rek === 'SETUJUI' ? '#1d7a4d' : rek === 'TINJAU' ? '#8a6420' : '#c0392b',
              border: `1px solid ${accentBorder}`,
            }
            const r = hasilCek.riwayat
            return (
              <div style={{ ...glass, borderRadius: 20, padding: 22, borderLeft: `4px solid ${barColor}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: '#7a857d' }}>Rekomendasi Sistem</p>
                  <span style={pillStyle}>{rek}</span>
                </div>

                {hasilCek.ditemukan && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 42, fontWeight: 800, color: barColor, lineHeight: 1 }}>{hasilCek.skor}</span>
                      <span style={{ fontSize: 14, color: '#7a857d', marginBottom: 4 }}>/100 skor kelayakan</span>
                    </div>
                    <div style={{ height: 7, background: 'rgba(26,71,49,.1)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: barColor, borderRadius: 999, width: `${hasilCek.skor}%`, transition: 'width .6s' }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {hasilCek.alasan.map((a, i) => (
                    <p key={i} style={{ fontSize: 13.5, color: '#46544b', display: 'flex', gap: 8 }}>
                      <span style={{ color: '#9aa39c' }}>•</span><span>{a}</span>
                    </p>
                  ))}
                </div>

                {r && r.jumlah_koperasi > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                    {[
                      { val: r.angsuran_tepat, label: 'Tepat waktu' },
                      { val: r.angsuran_terlambat, label: 'Terlambat' },
                      { val: r.pinjaman_macet, label: 'Macet' },
                    ].map(s => (
                      <div key={s.label} style={{ background: 'rgba(26,71,49,.05)', border: '1px solid rgba(26,71,49,.08)', borderRadius: 12, padding: '12px', textAlign: 'center' }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#0f2a1d' }}>{s.val}</p>
                        <p style={{ fontSize: 12, color: '#7a857d', marginTop: 2 }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.18)', borderRadius: 12 }}>
                  <Info size={14} style={{ color: '#3b7fd4', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: '#3b7fd4' }}>Keputusan akhir ada di tangan <b>pengurus koperasi tujuan</b>. Sistem hanya merekomendasikan.</span>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {generated && (
        <div style={{ background: 'rgba(47,158,99,.1)', border: '1px solid rgba(47,158,99,.25)', borderRadius: 18, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1d7a4d', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15} /> Pass berhasil diterbitkan!
          </p>
          <div style={{ background: 'rgba(255,255,255,.8)', border: '1px solid rgba(26,71,49,.1)', borderRadius: 12, padding: '12px 14px', wordBreak: 'break-all' }}>
            <p style={{ fontSize: 11.5, color: '#9aa39c', marginBottom: 4 }}>Link untuk pemodal:</p>
            <p style={{ fontSize: 13.5, color: '#c9963a' }}>{ORIGIN}/pass/{generated.id}</p>
          </div>
          <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${generated.id}`)}
            style={{ fontSize: 13, fontWeight: 700, color: '#1a4731', padding: '9px 18px', borderRadius: 10, border: '1px solid rgba(26,71,49,.2)', background: 'rgba(255,255,255,.6)', cursor: 'pointer', width: 'fit-content' }}>
            Salin Link
          </button>
        </div>
      )}

      {tab === 'daftar' && (
        passList.length === 0 ? (
          <div style={{ ...glass, borderRadius: 20, padding: '60px 0', textAlign: 'center', color: '#7a857d' }}>
            <CreditCard size={40} style={{ margin: '0 auto 12px', color: '#c4ccc6' }} />
            <p style={{ fontWeight: 700, color: '#46544b' }}>Belum Ada Pass</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Klik "Terbitkan Pass" untuk membuat pass pertama.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {passList.map(p => {
              const expired = new Date(p.berlaku_sampai) < new Date()
              const isAktif = p.status === 'aktif' && !expired
              const statusPill: React.CSSProperties = isAktif
                ? { fontSize: 12, fontWeight: 700, color: '#1d7a4d', background: 'rgba(47,158,99,.14)', border: '1px solid rgba(47,158,99,.3)', padding: '3px 10px', borderRadius: 999 }
                : { fontSize: 12, fontWeight: 700, color: '#46544b', background: 'rgba(26,71,49,.07)', border: '1px solid rgba(26,71,49,.12)', padding: '3px 10px', borderRadius: 999 }
              return (
                <div key={p.id} style={{ ...glass, borderRadius: 16, padding: '16px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#0f2a1d' }}>{p.tujuan}</p>
                      <p style={{ fontSize: 12, color: '#9aa39c', marginTop: 2 }}>Mitra: {p.mitra} · Berlaku s.d. {p.berlaku_sampai}</p>
                    </div>
                    <span style={statusPill}>{expired ? 'kedaluwarsa' : p.status}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <a href={`/pass/${p.id}`} target="_blank"
                      style={{ fontSize: 13, fontWeight: 700, color: '#c9963a', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      Buka Link <ChevronRight size={13} />
                    </a>
                    <button onClick={() => navigator.clipboard.writeText(`${ORIGIN}/pass/${p.id}`)}
                      style={{ fontSize: 13, color: '#9aa39c', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Salin
                    </button>
                    {p.status === 'aktif' && (
                      <button onClick={() => handleCabut(p.id)}
                        style={{ fontSize: 13, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>
                        Cabut
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
