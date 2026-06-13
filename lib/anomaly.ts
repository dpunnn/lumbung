import { supabase } from './supabase'

export type AnomalyKasir = {
  user_id: string
  nama: string
  jumlah_flag: number
  jenis: 'simpanan_dispute' | 'simpanan_claim' | 'hapus_finansial' | 'ubah_nominal' | 'pembatalan_luar_jam'
  deskripsi: string
  kejadian: { waktu: string; tabel: string; aksi: string; detail?: string }[]
  simpanan_disputed?: number
  simpanan_claimed?: number
  luar_jam_count?: number
  total_aksi?: number
  rasio_luar_jam?: number
  status_investigasi: 'belum_ditinjau' | 'sedang_ditinjau' | 'selesai'
}

// Jam kerja resmi koperasi: 07:00 – 18:00 WIB (UTC+7)
function isLuarJamKerja(ts: string): boolean {
  const jamWIB = (new Date(ts).getUTCHours() + 7) % 24
  return jamWIB < 7 || jamWIB >= 18
}

function labelWaktu(ts: string): string {
  return new Date(ts).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export async function getAnomalyKasir(): Promise<AnomalyKasir[]> {
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const [{ data: simpananIssues }, { data: deleteLogs }, { data: updateLogs }] = await Promise.all([
    // Simpanan yang disputed atau claimed
    supabase
      .from('simpanan')
      .select('id, jumlah, status, tanggal, keterangan, disputed_note')
      .in('status', ['disputed', 'claimed'])
      .gte('tanggal', since.toISOString().split('T')[0]),

    // DELETE pada tabel finansial
    supabase
      .from('audit_log')
      .select('*, profiles(nama)')
      .eq('aksi', 'DELETE')
      .in('tabel_nama', ['simpanan', 'pinjaman', 'angsuran'])
      .gte('dilakukan_pada', since.toISOString()),

    // UPDATE pada field jumlah/nominal
    supabase
      .from('audit_log')
      .select('*, profiles(nama)')
      .eq('aksi', 'UPDATE')
      .in('tabel_nama', ['simpanan', 'pinjaman', 'angsuran'])
      .gte('dilakukan_pada', since.toISOString()),
  ])

  const results: AnomalyKasir[] = []

  // Pola 1: Sengketa setoran — anggota bilang nominal salah
  const disputed = (simpananIssues ?? []).filter(s => s.status === 'disputed')
  if (disputed.length >= 1) {
    results.push({
      user_id: 'simpanan_dispute',
      nama: 'Sengketa Nominal Setoran',
      jumlah_flag: disputed.length,
      jenis: 'simpanan_dispute',
      deskripsi: `${disputed.length} anggota melaporkan nominal yang dicatat tidak sesuai dengan uang yang mereka serahkan.`,
      kejadian: disputed.map(s => ({
        waktu: s.tanggal,
        tabel: 'simpanan',
        aksi: 'DISPUTE',
        detail: s.disputed_note ?? undefined,
      })),
      simpanan_disputed: disputed.length,
      status_investigasi: 'belum_ditinjau',
    })
  }

  // Pola 2: Klaim tidak tercatat — anggota bayar tapi tidak ada record
  const claimed = (simpananIssues ?? []).filter(s => s.status === 'claimed')
  if (claimed.length >= 1) {
    results.push({
      user_id: 'simpanan_claim',
      nama: 'Setoran Tidak Dicatat',
      jumlah_flag: claimed.length,
      jenis: 'simpanan_claim',
      deskripsi: `${claimed.length} anggota mengklaim sudah menyerahkan uang ke kasir tapi tidak ada pencatatan di sistem.`,
      kejadian: claimed.map(s => ({
        waktu: s.tanggal,
        tabel: 'simpanan',
        aksi: 'CLAIM',
        detail: s.keterangan ?? undefined,
      })),
      simpanan_claimed: claimed.length,
      status_investigasi: 'belum_ditinjau',
    })
  }

  // Pola 3: Hapus data finansial — DELETE di simpanan/pinjaman/angsuran
  if ((deleteLogs ?? []).length > 0) {
    const byUser = new Map<string, any[]>()
    for (const log of deleteLogs ?? []) {
      if (!log.dilakukan_oleh) continue
      if (!byUser.has(log.dilakukan_oleh)) byUser.set(log.dilakukan_oleh, [])
      byUser.get(log.dilakukan_oleh)!.push(log)
    }
    for (const [userId, logs] of byUser) {
      results.push({
        user_id: `delete_${userId}`,
        nama: (logs[0].profiles as any)?.nama ?? 'Unknown',
        jumlah_flag: logs.length,
        jenis: 'hapus_finansial',
        deskripsi: `Menghapus ${logs.length} record dari tabel finansial (${[...new Set(logs.map((l: any) => l.tabel_nama))].join(', ')}).`,
        kejadian: logs.map((l: any) => ({
          waktu: l.dilakukan_pada,
          tabel: l.tabel_nama,
          aksi: 'DELETE',
        })),
        status_investigasi: 'belum_ditinjau',
      })
    }
  }

  // Pola 4: Ubah nominal — UPDATE jumlah setelah konfirmasi
  const nominalUpdates = (updateLogs ?? []).filter((l: any) => {
    const baru = l.nilai_baru as Record<string, unknown> | null
    return baru && ('jumlah' in baru || 'jumlah_pokok' in baru || 'angsuran_per_bulan' in baru)
  })
  if (nominalUpdates.length > 0) {
    const byUser = new Map<string, any[]>()
    for (const log of nominalUpdates) {
      if (!log.dilakukan_oleh) continue
      if (!byUser.has(log.dilakukan_oleh)) byUser.set(log.dilakukan_oleh, [])
      byUser.get(log.dilakukan_oleh)!.push(log)
    }
    for (const [userId, logs] of byUser) {
      results.push({
        user_id: `nominal_${userId}`,
        nama: (logs[0].profiles as any)?.nama ?? 'Unknown',
        jumlah_flag: logs.length,
        jenis: 'ubah_nominal',
        deskripsi: `Mengubah nominal/jumlah pada ${logs.length} record finansial setelah data tersimpan.`,
        kejadian: logs.map((l: any) => ({
          waktu: l.dilakukan_pada,
          tabel: l.tabel_nama,
          aksi: 'UPDATE',
          detail: l.nilai_baru ? `jumlah baru: ${JSON.stringify(l.nilai_baru)}` : undefined,
        })),
        status_investigasi: 'belum_ditinjau',
      })
    }
  }

  // Pola 5: Pembatalan luar jam kerja — DELETE + UPDATE status batal setelah 18:00 atau sebelum 07:00 WIB
  const cancelLogs = [
    ...(deleteLogs ?? []),
    ...(updateLogs ?? []).filter((l: any) => {
      const baru = l.nilai_baru as Record<string, unknown> | null
      if (!baru) return false
      const s = baru.status
      return typeof s === 'string' && ['batal', 'dibatalkan', 'cancelled', 'rejected'].includes(s)
    }),
  ]

  if (cancelLogs.length > 0) {
    const byUser = new Map<string, any[]>()
    for (const log of cancelLogs) {
      if (!log.dilakukan_oleh) continue
      if (!byUser.has(log.dilakukan_oleh)) byUser.set(log.dilakukan_oleh, [])
      byUser.get(log.dilakukan_oleh)!.push(log)
    }

    for (const [userId, logs] of byUser) {
      const total = logs.length
      const luarJam = logs.filter((l: any) => isLuarJamKerja(l.dilakukan_pada))
      if (total < 3 || luarJam.length < 2) continue

      const rasio = luarJam.length / total
      if (rasio < 0.5) continue

      results.push({
        user_id: `luar_jam_${userId}`,
        nama: (logs[0].profiles as any)?.nama ?? 'Unknown',
        jumlah_flag: luarJam.length,
        jenis: 'pembatalan_luar_jam',
        deskripsi: `Melakukan ${total} pembatalan/penghapusan dalam 30 hari, ${luarJam.length} di antaranya (${Math.round(rasio * 100)}%) terjadi di luar jam kerja resmi (sebelum 07:00 atau setelah 18:00 WIB).`,
        kejadian: logs
          .sort((a: any, b: any) => new Date(b.dilakukan_pada).getTime() - new Date(a.dilakukan_pada).getTime())
          .map((l: any) => ({
            waktu: l.dilakukan_pada,
            tabel: l.tabel_nama,
            aksi: l.aksi,
            detail: isLuarJamKerja(l.dilakukan_pada)
              ? `[LUAR JAM] ${labelWaktu(l.dilakukan_pada)}`
              : labelWaktu(l.dilakukan_pada),
          })),
        luar_jam_count: luarJam.length,
        total_aksi: total,
        rasio_luar_jam: Math.round(rasio * 100),
        status_investigasi: 'belum_ditinjau',
      })
    }
  }

  return results.sort((a, b) => b.jumlah_flag - a.jumlah_flag)
}
