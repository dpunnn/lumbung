import api from './api'

export interface RiwayatKredit {
  jumlah_koperasi: number
  total_pinjaman: number
  pinjaman_lancar: number
  pinjaman_macet: number
  angsuran_tepat: number
  angsuran_terlambat: number
  ada_tunggakan: boolean
}

export type Rekomendasi = 'SETUJUI' | 'TINJAU' | 'TOLAK'

export interface HasilKelayakan {
  ditemukan: boolean
  skor: number
  rekomendasi: Rekomendasi
  alasan: string[]
  riwayat: RiwayatKredit | null
}

export async function hashNik(nik: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nik.trim()))
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function cekKelayakan(nik: string): Promise<HasilKelayakan> {
  const ktpHash = await hashNik(nik)
  // Riwayat kredit lintas koperasi kini disediakan pass-svc (sebelumnya RPC Supabase cek_riwayat_kredit).
  let r: RiwayatKredit | null = null
  try {
    r = await api.post<RiwayatKredit | null>('/api/pass/riwayat-kredit', { ktp_hash: ktpHash })
  } catch {
    r = null
  }

  if (!r || r.jumlah_koperasi === 0) {
    return {
      ditemukan: false,
      skor: 0,
      rekomendasi: 'TINJAU',
      riwayat: r,
      alasan: [
        'Belum ada riwayat kredit di jaringan koperasi.',
        'Nilai sebagai first-time borrower — butuh agunan terverifikasi atau penjamin (Profil Awal).',
      ],
    }
  }

  const totalAngsuran = r.angsuran_tepat + r.angsuran_terlambat
  const rasioTepat = totalAngsuran > 0 ? r.angsuran_tepat / totalAngsuran : 1
  const skorMacet = r.pinjaman_macet === 0 ? 1 : 0

  const skor = Math.round((0.7 * rasioTepat + 0.3 * skorMacet) * 100)

  const alasan: string[] = [
    `Terdaftar di ${r.jumlah_koperasi} koperasi, total ${r.total_pinjaman} pinjaman.`,
    `${r.angsuran_tepat} cicilan tepat waktu, ${r.angsuran_terlambat} terlambat.`,
  ]
  if (r.pinjaman_macet > 0) alasan.push(`⚠ Ada ${r.pinjaman_macet} pinjaman berstatus macet.`)
  if (r.ada_tunggakan) alasan.push('⚠ Masih ada tunggakan berjalan di koperasi lain.')

  let rekomendasi: Rekomendasi
  if (r.pinjaman_macet > 0 || skor < 50) rekomendasi = 'TOLAK'
  else if (r.ada_tunggakan || skor < 75) rekomendasi = 'TINJAU'
  else rekomendasi = 'SETUJUI'

  return { ditemukan: true, skor, rekomendasi, alasan, riwayat: r }
}
