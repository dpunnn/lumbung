export interface RingkasanLens {
  koperasi: string
  fokusUsaha: string
  simpananBulanIni: number
  ternak?: { sehat: number; pantau: number; sakit: number; mati: number; total: number }
  pakanMenipis: string[]
  angsuran: { tepatWaktu: number; terlambat: number; total: number }
  modul: { simpanPinjam: boolean; ternak: boolean; pakan: boolean }
}

const rb = (n: number) =>
  n >= 1_000_000 ? `Rp${(n / 1_000_000).toFixed(1)} juta` : `Rp${(n / 1_000).toFixed(0)} ribu`

/** Fallback tanpa AI: rangkai kalimat HANYA dari modul yang dimiliki koperasi. */
export function narasiTemplate(d: RingkasanLens): string {
  const bagian: string[] = []

  if (d.modul.simpanPinjam) {
    bagian.push(`Bulan ini simpanan anggota tercatat ${rb(d.simpananBulanIni)}.`)
    if (d.angsuran.total > 0) {
      bagian.push(
        d.angsuran.terlambat > 0
          ? `${d.angsuran.terlambat} dari ${d.angsuran.total} angsuran terlambat dan perlu ditagih.`
          : `Seluruh ${d.angsuran.total} angsuran berjalan lancar.`,
      )
    }
  }

  if (d.modul.ternak && d.ternak) {
    const t = d.ternak
    bagian.push(
      t.sakit + t.pantau > 0
        ? `Ada ${t.sakit} ternak sakit dan ${t.pantau} perlu dipantau dari total ${t.total} ekor.`
        : `Seluruh ${t.total} ternak dalam kondisi sehat.`,
    )
  }

  if (d.modul.pakan && d.pakanMenipis.length)
    bagian.push(`Stok ${d.pakanMenipis.join(', ')} menipis — perlu segera dibeli ulang.`)

  if (bagian.length === 0)
    return `Belum ada data operasional untuk ${d.koperasi} (${d.fokusUsaha}). ` +
      `Modul untuk jenis usaha ini belum tersedia di sistem.`

  return bagian.join(' ')
}
