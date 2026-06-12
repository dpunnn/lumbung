import { supabase } from './supabase'

export type AnomalyKasir = {
  user_id: string
  nama: string
  jumlah_flag: number
  kejadian: { waktu: string; tabel: string; aksi: string }[]
  status_investigasi: 'belum_ditinjau' | 'sedang_ditinjau' | 'selesai'
}

export async function getAnomalyKasir(): Promise<AnomalyKasir[]> {
  // Ambil transaksi CANCEL/DELETE/UPDATE setelah jam 18:00 dalam 7 hari terakhir
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: logs } = await supabase
    .from('audit_log')
    .select('*, profiles(nama)')
    .in('aksi', ['DELETE', 'CANCEL', 'UPDATE'])
    .gte('dilakukan_pada', since.toISOString())
    .order('dilakukan_pada', { ascending: false })

  if (!logs) return []

  // Filter jam > 18:00 lokal
  const afterHours = logs.filter(l => {
    const jam = new Date(l.dilakukan_pada).getHours()
    return jam >= 18 || jam < 6
  })

  // Group by user
  const byUser = new Map<string, AnomalyKasir>()
  for (const log of afterHours) {
    if (!log.dilakukan_oleh) continue
    if (!byUser.has(log.dilakukan_oleh)) {
      byUser.set(log.dilakukan_oleh, {
        user_id: log.dilakukan_oleh,
        nama: (log.profiles as { nama: string })?.nama ?? 'Unknown',
        jumlah_flag: 0,
        kejadian: [],
        status_investigasi: 'belum_ditinjau',
      })
    }
    const entry = byUser.get(log.dilakukan_oleh)!
    entry.jumlah_flag++
    entry.kejadian.push({
      waktu: log.dilakukan_pada,
      tabel: log.tabel_nama,
      aksi: log.aksi,
    })
  }

  // Hanya return yang > 3 kejadian (threshold anomali)
  return Array.from(byUser.values())
    .filter(u => u.jumlah_flag >= 3)
    .sort((a, b) => b.jumlah_flag - a.jumlah_flag)
}
