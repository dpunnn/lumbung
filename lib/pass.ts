import { supabase } from './supabase'

export type PassFields = {
  jumlah_ternak?: number
  rasio_ternak_sehat?: number
  nilai_aset_ternak?: number
  total_simpanan?: number
  pinjaman_aktif?: number
  rasio_cicilan_lancar?: number
  jumlah_anggota?: number
  timestamp: string
}

export type ConsentMap = {
  ternak: boolean
  simpanan: boolean
  pinjaman: boolean
}

export async function buildFields(koperasiId: string, consent: ConsentMap): Promise<PassFields> {
  const fields: PassFields = { timestamp: new Date().toISOString() }

  const [{ data: ternak }, { data: simpanan }, { data: pinjaman }, { data: anggota }] =
    await Promise.all([
      supabase.from('ternak').select('status, nilai_estimasi, terverifikasi').eq('koperasi_id', koperasiId),
      supabase.from('simpanan').select('jumlah').eq('koperasi_id', koperasiId),
      supabase.from('pinjaman').select('status').eq('koperasi_id', koperasiId),
      supabase.from('anggota').select('id').eq('koperasi_id', koperasiId),
    ])

  fields.jumlah_anggota = anggota?.length ?? 0

  if (consent.ternak && ternak) {
    const hidup = ternak.filter(t => t.status !== 'mati')
    const sehat = ternak.filter(t => t.status === 'sehat')
    fields.jumlah_ternak = hidup.length
    fields.rasio_ternak_sehat = hidup.length > 0 ? Math.round((sehat.length / hidup.length) * 100) : 0
    fields.nilai_aset_ternak = ternak
      .filter(t => t.terverifikasi && t.status !== 'mati')
      .reduce((s, t) => s + (t.nilai_estimasi ?? 0), 0)
  }

  if (consent.simpanan && simpanan) {
    fields.total_simpanan = simpanan.reduce((s, r) => s + (r.jumlah ?? 0), 0)
  }

  if (consent.pinjaman && pinjaman) {
    const total = pinjaman.length
    const macet = pinjaman.filter(p => p.status === 'macet').length
    fields.pinjaman_aktif = pinjaman.filter(p => p.status === 'aktif').length
    fields.rasio_cicilan_lancar = total > 0 ? Math.round(((total - macet) / total) * 100) : 100
  }

  return fields
}

export async function hashFields(fields: PassFields): Promise<string> {
  const text = JSON.stringify(fields)
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export function hitungSkor(fields: PassFields): number {
  // Jalur A: ada riwayat pinjaman
  if (fields.rasio_cicilan_lancar !== undefined) {
    const ternak = (fields.rasio_ternak_sehat ?? 100) / 100
    const cicilan = (fields.rasio_cicilan_lancar) / 100
    const simpanan = fields.total_simpanan ? Math.min(fields.total_simpanan / 10_000_000, 1) : 0
    return Math.round((0.4 * ternak + 0.4 * cicilan + 0.2 * simpanan) * 100)
  }
  // Jalur B: first-time borrower
  const aset = fields.nilai_aset_ternak ? Math.min(fields.nilai_aset_ternak / 5_000_000, 1) : 0
  return Math.round(0.5 * aset * 100)
}
