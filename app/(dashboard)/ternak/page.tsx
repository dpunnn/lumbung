'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import api from '@/lib/api'
import { db } from '@/lib/db'
import type { Ternak } from '@/types'
import { Beef, Plus } from 'lucide-react'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,.62)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,.7)',
  boxShadow: '0 10px 26px rgba(26,71,49,.08)',
}

const STATUS_BADGE: Record<string, { pill: React.CSSProperties; dot: React.CSSProperties; label: string }> = {
  sehat:  { pill: { background:'rgba(47,158,99,.14)', color:'#1d7a4d', border:'1px solid rgba(47,158,99,.3)' },  dot: { background:'#2f9e63' }, label:'Sehat' },
  pantau: { pill: { background:'rgba(201,150,58,.14)', color:'#8a6420', border:'1px solid rgba(201,150,58,.3)' }, dot: { background:'#c9963a' }, label:'Pantau' },
  sakit:  { pill: { background:'rgba(214,87,69,.12)', color:'#c0392b', border:'1px solid rgba(214,87,69,.28)' }, dot: { background:'#d65745' }, label:'Sakit' },
  mati:   { pill: { background:'rgba(26,71,49,.07)', color:'#46544b', border:'1px solid rgba(26,71,49,.12)' },   dot: { background:'#7a857d' }, label:'Mati' },
}

const STATUS_COUNT: Record<string, React.CSSProperties> = {
  sehat:  { background:'rgba(47,158,99,.14)', color:'#1d7a4d', border:'1px solid rgba(47,158,99,.3)' },
  pantau: { background:'rgba(201,150,58,.14)', color:'#8a6420', border:'1px solid rgba(201,150,58,.3)' },
  sakit:  { background:'rgba(214,87,69,.12)', color:'#c0392b', border:'1px solid rgba(214,87,69,.28)' },
  mati:   { background:'rgba(26,71,49,.07)', color:'#46544b', border:'1px solid rgba(26,71,49,.12)' },
}

function getAvatarStyle(jenis: string): React.CSSProperties {
  const isSapi = jenis.toLowerCase().startsWith('sapi')
  return {
    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
    background: isSapi ? 'rgba(26,71,49,.1)' : 'rgba(201,150,58,.16)',
    color: isSapi ? '#1a4731' : '#b5791f',
  }
}

function getGlyph(jenis: string): string {
  const j = jenis.toLowerCase()
  if (j.startsWith('sapi')) return '🐄'
  if (j.startsWith('kambing')) return '🐐'
  if (j.startsWith('domba')) return '🐑'
  if (j.startsWith('ayam')) return '🐓'
  return '🐄'
}

export default function TernakPage() {
  const [data, setData] = useState<Ternak[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [rows, localRows] = await Promise.all([
      api.get<Ternak[]>('/api/stok/ternak').catch(() => [] as Ternak[]),
      db.ternak.where('synced').equals(0).toArray(),
    ])
    const serverIds = new Set(rows.map((r: Ternak) => r.id))
    const localOnly = localRows.filter(r => !serverIds.has(r.id))
    setData([...localOnly as unknown as Ternak[], ...rows])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const timer = setInterval(() => load(), 30_000)
    return () => clearInterval(timer)
  }, [load])

  const counts = { sehat: 0, pantau: 0, sakit: 0, mati: 0 }
  data.forEach(t => { if (t.status in counts) counts[t.status as keyof typeof counts]++ })

  return (
    <div style={{ maxWidth: 1024, margin: '0 auto', animation: 'lmbFade .7s cubic-bezier(.2,.7,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 23, fontWeight: 800, color: '#0f2a1d', letterSpacing: '-.02em', marginBottom: 4 }}>Ternak</h1>
          <p style={{ fontSize: 13.5, color: '#6a766e' }}>{data.length} ekor terdaftar</p>
        </div>
        <Link
          href="/ternak/tambah"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(150deg,#1a4731,#0f2a1d)', color: '#fff', border: 'none', fontWeight: 700, fontSize: 13.5, borderRadius: 12, padding: '10px 18px', cursor: 'pointer', textDecoration: 'none' }}
        >
          <Plus size={16} /> Tambah
        </Link>
      </div>

      {/* Status summary pills */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {(['sehat','pantau','sakit','mati'] as const).map(s => (
          <div key={s} style={{ borderRadius: 16, padding: '14px 16px', textAlign: 'center', ...STATUS_COUNT[s] }}>
            <div style={{ fontSize: 24, fontWeight: 800 }}>{counts[s]}</div>
            <div style={{ fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{s}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(26,71,49,.15)', borderTopColor: '#1a4731', animation: 'lmbSpin 0.8s linear infinite' }} />
        </div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 0', color: '#7a857d' }}>
          <Beef size={40} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontSize: 14 }}>
            Belum ada ternak.{' '}
            <Link href="/ternak/tambah" style={{ color: '#1a4731', fontWeight: 700, textDecoration: 'underline' }}>
              Tambah sekarang
            </Link>
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
          {data.map(t => {
            const bdg = STATUS_BADGE[t.status] ?? STATUS_BADGE.mati
            return (
              <div
                key={t.id}
                style={{ padding: 20, borderRadius: 18, ...glass, transition: 'transform .2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)' }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={getAvatarStyle(t.jenis)}>{getGlyph(t.jenis)}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#0f2a1d' }}>{t.kode}</div>
                      <div style={{ fontSize: 12.5, color: '#7a857d' }}>{t.jenis}</div>
                    </div>
                  </div>
                  {/* Dot badge */}
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, padding: '4px 9px', borderRadius: 999, ...bdg.pill }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, ...bdg.dot }} />
                    {bdg.label}
                  </span>
                </div>

                {/* Info 2×2 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(26,71,49,.07)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#9aa39c', fontWeight: 600 }}>Nilai Est.</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2c382f' }}>
                      {t.nilai_estimasi > 0 ? `Rp${(t.nilai_estimasi / 1_000_000).toFixed(1)}jt` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9aa39c', fontWeight: 600 }}>Umur</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2c382f' }}>
                      {t.umur_bulan ? `${t.umur_bulan} bln` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: '#9aa39c', fontWeight: 600 }}>Verifikasi</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.terverifikasi ? '#1d7a4d' : '#9aa39c' }}>
                      {t.terverifikasi ? '✓ AI' : 'Belum'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                    <Link
                      href={`/ternak/${t.id}`}
                      style={{ fontSize: 12.5, fontWeight: 700, color: '#1a4731', textDecoration: 'none' }}
                    >
                      Kartu ternak →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
