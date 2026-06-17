'use client'

import { useEffect, useState } from 'react'
import { Lock, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import api from '@/lib/api'

type AtasRow = {
  koperasi_id: string
  nama: string
  jumlah_anggota: number
  total_simpanan: number
  jumlah_ternak: number
  pct_sehat: number
  pinjaman_aktif: number
  skor: number
}

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const thStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 800, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa39c',
  padding: '13px 16px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
}

function Badge({ skor }: { skor: number }) {
  const base: React.CSSProperties = { padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }
  if (skor >= 75) return <span style={{ ...base, background: 'rgba(47,158,99,.14)', color: '#1d7a4d', border: '1px solid rgba(47,158,99,.3)' }}>Sehat</span>
  if (skor >= 50) return <span style={{ ...base, background: 'rgba(201,150,58,.14)', color: '#8a6420', border: '1px solid rgba(201,150,58,.3)' }}>Cukup</span>
  return <span style={{ ...base, background: 'rgba(214,87,69,.12)', color: '#c0392b', border: '1px solid rgba(214,87,69,.28)' }}>Perhatian</span>
}

export default function AtlasPage() {
  const [data, setData] = useState<AtasRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<keyof AtasRow>('skor')
  const [sortAsc, setSortAsc] = useState(false)

  useEffect(() => {
    // Coba endpoint agregat dulu; jika gagal fallback ke loadManual
    api.get<AtasRow[]>('/api/koperasi/atlas').catch(() => null).then(rows => {
      if (rows && rows.length > 0) {
        setData(rows)
        setLoading(false)
      } else {
        loadManual()
      }
    })
  }, [])

  async function loadManual() {
    // TODO: endpoint agregat lintas koperasi belum tersedia — susun dari data per koperasi
    const kops = await api.get<{ id: string; nama: string }[]>('/api/koperasi').catch(() => [] as { id: string; nama: string }[])
    if (!kops.length) { setLoading(false); return }

    const rows: AtasRow[] = await Promise.all(kops.map(async k => {
      const [anggotaArr, simpanan, ternak, pinjamanArr] = await Promise.all([
        api.get<{ id: string }[]>(`/api/anggota?koperasi_id=${k.id}`).catch(() => []),
        api.get<{ jumlah: number }[]>(`/api/simpanan?koperasi_id=${k.id}&status=confirmed`).catch(() => []),
        api.get<{ status: string }[]>(`/api/stok/ternak?koperasi_id=${k.id}`).catch(() => []),
        api.get<{ id: string }[]>(`/api/pinjaman?koperasi_id=${k.id}&status=aktif`).catch(() => []),
      ])
      const anggota = anggotaArr.length
      const totalSimpanan = simpanan.reduce((s, r) => s + (r.jumlah ?? 0), 0)
      const sehat = ternak.filter(t => t.status === 'sehat').length
      const pctSehat = ternak.length ? Math.round((sehat / ternak.length) * 100) : 0
      const skor = Math.min(100, Math.round(
        0.35 * Math.min(1, totalSimpanan / 10_000_000) * 100 +
        0.35 * pctSehat +
        0.3 * Math.min(1, anggota / 20) * 100
      ))
      return { koperasi_id: k.id, nama: k.nama, jumlah_anggota: anggota, total_simpanan: totalSimpanan, jumlah_ternak: ternak.length, pct_sehat: pctSehat, pinjaman_aktif: pinjamanArr.length, skor }
    }))
    setData(rows)
    setLoading(false)
  }

  function handleSort(key: keyof AtasRow) {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey]; const vb = b[sortKey]
    if (typeof va === 'number' && typeof vb === 'number') return sortAsc ? va - vb : vb - va
    return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
  })

  const totalSimpanan = data.reduce((s, r) => s + r.total_simpanan, 0)
  const avgSkor = data.length ? Math.round(data.reduce((s, r) => s + r.skor, 0) / data.length) : 0

  function SortIcon({ k }: { k: keyof AtasRow }) {
    if (sortKey !== k) return <ArrowUpDown size={12} style={{ display: 'inline', marginLeft: 5, color: '#9aa39c', verticalAlign: 'middle' }} />
    return sortAsc
      ? <ArrowUp size={12} style={{ display: 'inline', marginLeft: 5, color: '#c9963a', verticalAlign: 'middle' }} />
      : <ArrowDown size={12} style={{ display: 'inline', marginLeft: 5, color: '#c9963a', verticalAlign: 'middle' }} />
  }

  const scoreColor = (s: number) => s >= 75 ? '#1d7a4d' : s >= 50 ? '#8a6420' : '#c0392b'

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Lumbung Atlas</h1>
        <p style={{ fontSize: 13.5, color: '#6a766e' }}>Ringkasan agregat semua koperasi — Dinas Koperasi Kabupaten</p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 14, padding: '12px 16px', color: '#3b82f6', fontSize: 12.5, marginBottom: 18 }}>
        <Lock size={14} style={{ flexShrink: 0 }} />
        <span>Data agregat — identitas dan transaksi individual anggota terjaga. Hanya ringkasan per koperasi yang ditampilkan.</span>
      </div>

      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 18 }}>
          {[
            { label: 'Koperasi Binaan', value: data.length, color: '#0f2a1d' },
            { label: 'Total Simpanan Platform', value: `Rp ${(totalSimpanan / 1_000_000).toFixed(1)}jt`, color: '#1d7a4d' },
            { label: 'Rata-rata Skor', value: avgSkor, color: avgSkor >= 75 ? '#1d7a4d' : avgSkor >= 50 ? '#8a6420' : '#c0392b' },
          ].map(s => (
            <div key={s.label} style={{ ...glass, borderRadius: 20, padding: 18 }}>
              <p style={{ fontSize: 12.5, color: '#7a857d', marginBottom: 6 }}>{s.label}</p>
              <p style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: '-.02em' }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div style={{ ...glass, borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(26,71,49,.08)' }}>
                  {[
                    { key: 'nama', label: 'Koperasi' },
                    { key: 'jumlah_anggota', label: 'Anggota' },
                    { key: 'total_simpanan', label: 'Total Simpanan' },
                    { key: 'jumlah_ternak', label: 'Ternak' },
                    { key: 'pct_sehat', label: '% Sehat' },
                    { key: 'pinjaman_aktif', label: 'Pinjaman Aktif' },
                    { key: 'skor', label: 'Skor' },
                  ].map(col => (
                    <th key={col.key} style={thStyle} onClick={() => handleSort(col.key as keyof AtasRow)}>
                      {col.label} <SortIcon k={col.key as keyof AtasRow} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(row => (
                  <tr key={row.koperasi_id}
                    style={{ borderBottom: '1px solid rgba(26,71,49,.05)', transition: 'background .15s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(26,71,49,.03)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                    <td style={{ padding: '13px 16px', color: '#0f2a1d', fontWeight: 700 }}>{row.nama}</td>
                    <td style={{ padding: '13px 16px', color: '#46544b' }}>{row.jumlah_anggota}</td>
                    <td style={{ padding: '13px 16px', color: '#46544b' }}>Rp {(row.total_simpanan / 1_000_000).toFixed(1)}jt</td>
                    <td style={{ padding: '13px 16px', color: '#46544b' }}>{row.jumlah_ternak}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 64, height: 7, borderRadius: 999, background: 'rgba(26,71,49,.08)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 999, background: '#2f9e63', width: `${row.pct_sehat}%` }} />
                        </div>
                        <span style={{ color: '#46544b', fontSize: 12 }}>{row.pct_sehat}%</span>
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', color: '#46544b' }}>{row.pinjaman_aktif}</td>
                    <td style={{ padding: '13px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, color: scoreColor(row.skor) }}>{row.skor}</span>
                        <Badge skor={row.skor} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div style={{ ...glass, borderRadius: 20, padding: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#0f2a1d', marginBottom: 16 }}>Perbandingan Total Simpanan</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[...data].sort((a, b) => b.total_simpanan - a.total_simpanan).map(row => {
              const max = Math.max(...data.map(r => r.total_simpanan))
              const pct = max > 0 ? (row.total_simpanan / max) * 100 : 0
              return (
                <div key={row.koperasi_id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#7a857d', width: 128, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.nama}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 999, background: 'rgba(26,71,49,.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: '#c9963a', width: `${pct}%`, transition: 'width .7s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, color: '#46544b', fontWeight: 700, width: 80, textAlign: 'right' }}>Rp {(row.total_simpanan / 1_000_000).toFixed(1)}jt</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
