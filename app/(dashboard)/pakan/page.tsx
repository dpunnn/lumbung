'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Wheat, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { getMe } from '@/lib/auth'
import type { Pakan } from '@/types'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,.7)', border: '1px solid rgba(26,71,49,.14)',
  borderRadius: 10, padding: '9px 12px', color: '#0f2a1d', fontSize: 13.5, outline: 'none',
}

const labelStyle: React.CSSProperties = { display: 'block', color: '#46544b', fontSize: 12, fontWeight: 600, marginBottom: 5 }

const greenBtn: React.CSSProperties = {
  background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none',
  fontWeight: 700, borderRadius: 12, padding: '10px 18px', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13.5,
}

const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '13px 22px', textAlign: 'left', whiteSpace: 'nowrap',
}

function StockBadge({ isLow }: { isLow: boolean }) {
  const style: React.CSSProperties = isLow
    ? { background: 'rgba(214,87,69,.12)', color: '#c0392b', border: '1px solid rgba(214,87,69,.28)' }
    : { background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' }
  const dotBg = isLow ? '#d65745' : '#2f9e63'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, ...style }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotBg, flexShrink: 0 }} />
      {isLow ? 'Menipis' : 'Aman'}
    </span>
  )
}

export default function PakanPage() {
  const [data, setData] = useState<Pakan[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ nama: '', stok: '', satuan: 'kg', batas_minimum: '' })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const rows = await api.get<Pakan[]>('/api/stok/pakan').catch(() => [] as Pakan[])
    setData(rows)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(() => load(), 30_000)
    return () => clearInterval(timer)
  }, [load])

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  function openTambah() {
    setEditId(null)
    setForm({ nama: '', stok: '', satuan: 'kg', batas_minimum: '' })
    setShowForm(true)
  }

  function openEdit(p: Pakan) {
    setEditId(p.id)
    setForm({ nama: p.nama, stok: p.stok.toString(), satuan: p.satuan, batas_minimum: p.batas_minimum.toString() })
    setShowForm(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const me = await getMe()
    const payload = {
      nama: form.nama,
      stok: parseFloat(form.stok),
      satuan: form.satuan,
      batas_minimum: parseFloat(form.batas_minimum) || 0,
      updated_at: new Date().toISOString(),
    }
    if (editId) {
      await api.put(`/api/stok/pakan/${editId}`, payload).catch(() => null)
    } else {
      await api.post('/api/stok/pakan', { ...payload, koperasi_id: me?.koperasi_id }).catch(() => null)
    }
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function handleHapus(id: string) {
    setConfirmDelete(null)
    await api.delete(`/api/stok/pakan/${id}`).catch(() => null)
    load()
  }

  const lowStock = data.filter(p => p.stok <= p.batas_minimum && p.batas_minimum > 0)

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Stok / Pakan</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>{data.length} jenis pakan tercatat</p>
        </div>
        <button onClick={openTambah} style={greenBtn}>
          <Plus size={15} /> Tambah
        </button>
      </div>

      {/* Low stock alert */}
      {lowStock.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '15px 18px', borderRadius: 15, background: 'rgba(214,87,69,.1)', border: '1px solid rgba(214,87,69,.22)', marginBottom: 18 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: 'rgba(214,87,69,.16)', color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#9e2f23' }}>{lowStock.length} jenis pakan butuh segera direstok</div>
            <div style={{ fontSize: 12.5, color: '#a8554a', marginTop: 2 }}>
              {lowStock.map(p => `${p.nama} (${p.stok} ${p.satuan})`).join(', ')} di bawah batas minimum.
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <form onSubmit={handleSave} style={{ ...glass, borderRadius: 18, padding: 20, marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ color: '#0f2a1d', fontWeight: 800, fontSize: 15 }}>{editId ? 'Edit Pakan' : 'Tambah Pakan'}</h2>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: '#7a857d', fontSize: 13.5, cursor: 'pointer' }}>Batal</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Nama Pakan *</label>
              <input required value={form.nama} onChange={e => set('nama', e.target.value)}
                placeholder="Konsentrat Sapi" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Satuan</label>
              <select value={form.satuan} onChange={e => set('satuan', e.target.value)} style={inputStyle}>
                {['kg', 'liter', 'karung', 'sak'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Stok Saat Ini *</label>
              <input required type="number" min="0" step="0.1" value={form.stok}
                onChange={e => set('stok', e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Batas Minimum</label>
              <input type="number" min="0" step="0.1" value={form.batas_minimum}
                onChange={e => set('batas_minimum', e.target.value)} placeholder="0" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={saving} style={{ ...greenBtn, opacity: saving ? 0.5 : 1 }}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ border: '1px solid rgba(26,71,49,.18)', background: 'transparent', color: '#46544b', fontSize: 13.5, fontWeight: 600, padding: '10px 18px', borderRadius: 12, cursor: 'pointer' }}>
              Batal
            </button>
          </div>
        </form>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,26,18,.4)', backdropFilter: 'blur(4px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ ...glass, borderRadius: 20, padding: 28, maxWidth: 360, width: '90%', textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#0f2a1d', marginBottom: 8 }}>Hapus data pakan ini?</p>
            <p style={{ fontSize: 13, color: '#7a857d', marginBottom: 22 }}>Data yang dihapus tidak dapat dikembalikan.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)}
                style={{ padding: '9px 22px', borderRadius: 11, border: '1px solid rgba(26,71,49,.18)', background: 'transparent', color: '#46544b', fontWeight: 600, cursor: 'pointer', fontSize: 13.5 }}>
                Batal
              </button>
              <button onClick={() => handleHapus(confirmDelete)}
                style={{ padding: '9px 22px', borderRadius: 11, border: 'none', background: '#d65745', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13.5 }}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#7a857d', ...glass, borderRadius: 20 }}>
          <Wheat size={32} style={{ margin: '0 auto 8px', color: '#c4ccc6' }} />
          <p style={{ fontSize: 13.5 }}>Belum ada data pakan. Klik "+ Tambah" untuk mulai.</p>
        </div>
      ) : (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.5fr 1fr .6fr', gap: 14, padding: '13px 22px', borderBottom: '1px solid rgba(26,71,49,.06)' }}>
            <span style={thStyle}>Jenis Pakan</span>
            <span style={thStyle}>Tingkat Stok</span>
            <span style={thStyle}>Status</span>
            <span style={{ ...thStyle, textAlign: 'right' }}></span>
          </div>

          {/* Data rows */}
          {data.map(p => {
            const isLow = p.batas_minimum > 0 && p.stok <= p.batas_minimum
            const maxRef = p.batas_minimum > 0 ? p.batas_minimum * 2 : p.stok || 1
            const pct = Math.min(100, Math.round((p.stok / maxRef) * 100))
            const barColor = isLow ? '#d65745' : pct > 60 ? '#2f9e63' : '#c9963a'
            return (
              <div key={p.id}
                style={{ display: 'grid', gridTemplateColumns: '1.6fr 1.5fr 1fr .6fr', gap: 14, padding: '16px 22px', alignItems: 'center', borderBottom: '1px solid rgba(26,71,49,.05)', transition: 'background .15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.025)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                {/* Col 1: nama + min */}
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#16241c' }}>{p.nama}</div>
                  {p.batas_minimum > 0 && (
                    <div style={{ fontSize: 11.5, color: '#9aa39c', marginTop: 2 }}>Min. {p.batas_minimum} {p.satuan}</div>
                  )}
                </div>

                {/* Col 2: stok text + progress bar */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: isLow ? '#c0392b' : '#0f2a1d' }}>
                      {p.stok} {p.satuan}
                    </span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: 'rgba(26,71,49,.1)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, transition: 'width .4s' }} />
                  </div>
                </div>

                {/* Col 3: dot badge */}
                <StockBadge isLow={isLow} />

                {/* Col 4: actions */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => openEdit(p)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#1a4731', background: 'rgba(26,71,49,.07)', border: 'none', padding: '5px 11px', borderRadius: 8, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => setConfirmDelete(p.id)}
                    style={{ fontSize: 12, fontWeight: 700, color: '#c0392b', background: 'rgba(214,87,69,.08)', border: 'none', padding: '5px 11px', borderRadius: 8, cursor: 'pointer' }}>
                    Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
