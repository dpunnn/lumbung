import { NextResponse } from 'next/server'

export type AnomalyInput = {
  nama: string
  jumlah_flag: number
  jenis: 'simpanan_dispute' | 'simpanan_claim' | 'hapus_finansial' | 'ubah_nominal' | 'pembatalan_luar_jam'
  kejadian: { waktu: string; tabel: string; aksi: string; detail?: string }[]
  simpanan_disputed?: number
  simpanan_claimed?: number
  luar_jam_count?: number
  total_aksi?: number
  rasio_luar_jam?: number
}

export type AnomalyAnalysis = {
  ringkasan: string
  apa_yang_harus_dicek: string[]
  severity: 'rendah' | 'sedang' | 'tinggi'
  sumber: 'ai' | 'template'
}

function templateAnalysis(input: AnomalyInput): AnomalyAnalysis {
  const isHigh = input.jumlah_flag >= 3 || (input.simpanan_disputed ?? 0) >= 2 || (input.simpanan_claimed ?? 0) >= 2
  const severity: AnomalyAnalysis['severity'] = isHigh ? 'tinggi' : input.jumlah_flag >= 2 ? 'sedang' : 'rendah'

  if (input.jenis === 'simpanan_dispute') {
    const n = input.simpanan_disputed ?? input.jumlah_flag
    return {
      ringkasan: `${n} anggota melaporkan nominal setoran yang dicatat di sistem TIDAK SAMA dengan uang yang mereka serahkan. Ini adalah indikator langsung manipulasi nominal — kasir bisa mencatat lebih kecil dari yang diterima, mengambil selisihnya.`,
      apa_yang_harus_dicek: [
        'Minta kwitansi atau bukti tertulis dari anggota yang melapor',
        'Bandingkan nominal di buku kas fisik vs yang tercatat di sistem',
        'Cek siapa kasir yang bertugas di tanggal-tanggal tersebut',
        'Periksa apakah laporan ini berulang dari kasir yang sama',
        'Hitung total selisih yang dilaporkan — jika jutaan rupiah, eskalasi ke ketua',
      ],
      severity,
      sumber: 'template',
    }
  }

  if (input.jenis === 'simpanan_claim') {
    const n = input.simpanan_claimed ?? input.jumlah_flag
    return {
      ringkasan: `${n} anggota menyatakan sudah menyerahkan uang ke kasir, tapi tidak ada pencatatan apapun di sistem. Jika benar, uang sudah diterima kasir tapi TIDAK masuk ke kas koperasi — ini adalah penggelapan langsung.`,
      apa_yang_harus_dicek: [
        'Konfirmasi ulang ke anggota: tanggal, nominal, kasir yang bertugas',
        'Periksa buku kas fisik untuk tanggal yang disebutkan',
        'Cek saldo kas koperasi apakah sesuai dengan total setoran tercatat',
        'Tanya kasir yang bertugas: apakah ingat menerima uang tersebut',
        'Jika nominal besar atau ada pola berulang, laporkan ke pengawas koperasi',
      ],
      severity,
      sumber: 'template',
    }
  }

  if (input.jenis === 'hapus_finansial') {
    return {
      ringkasan: `${input.nama} menghapus ${input.jumlah_flag} record dari data finansial koperasi. Penghapusan data simpanan, pinjaman, atau angsuran hampir tidak pernah dibenarkan — ini bisa digunakan untuk menghilangkan bukti transaksi atau mempersulit audit.`,
      apa_yang_harus_dicek: [
        'Identifikasi record mana yang dihapus dari audit log',
        'Bandingkan dengan buku kas fisik — apakah record tersebut memang ada',
        'Tanyakan alasan penghapusan kepada yang bersangkutan secara tertulis',
        'Hubungkan dengan transaksi lain di periode yang sama',
        'Pertimbangkan restore data jika ada backup database',
      ],
      severity: 'tinggi',
      sumber: 'template',
    }
  }

  if (input.jenis === 'ubah_nominal') {
    return {
      ringkasan: `${input.nama} mengubah nominal/jumlah pada ${input.jumlah_flag} record finansial yang sudah tersimpan. Perubahan nominal setelah konfirmasi sangat mencurigakan — bisa digunakan untuk memperkecil utang, memperbesar simpanan palsu, atau menyesuaikan angka agar cocok dengan uang yang diambil.`,
      apa_yang_harus_dicek: [
        'Lihat nilai lama vs nilai baru di audit log untuk setiap perubahan',
        'Verifikasi ke anggota yang bersangkutan apakah ada perubahan yang sah',
        'Cek apakah ada otorisasi dari ketua/pengawas untuk perubahan tersebut',
        'Hitung total dampak finansial dari semua perubahan nominal',
        'Tinjau apakah pola ini terjadi menjelang laporan keuangan periodik',
      ],
      severity: 'tinggi',
      sumber: 'template',
    }
  }

  // pembatalan_luar_jam
  const rasio = input.rasio_luar_jam ?? 0
  const luarJam = input.luar_jam_count ?? input.jumlah_flag
  const total = input.total_aksi ?? input.jumlah_flag
  const sevLuarJam: AnomalyAnalysis['severity'] = rasio >= 80 || total >= 6 ? 'tinggi' : 'sedang'
  return {
    ringkasan: `${input.nama} melakukan ${total} pembatalan/penghapusan transaksi, ${luarJam} di antaranya (${rasio}%) terjadi di luar jam kerja resmi koperasi. Pembatalan setelah jam tutup sulit diawasi secara real-time — ini adalah celah yang sering dimanfaatkan untuk menghapus transaksi setelah kasir tutup, lalu menyimpan uangnya.`,
    apa_yang_harus_dicek: [
      `Cek ${luarJam} pembatalan luar jam: cocokkan dengan buku kas fisik hari yang sama`,
      'Tanyakan alasan pembatalan kepada yang bersangkutan secara tertulis untuk setiap kejadian',
      'Verifikasi ke anggota yang transaksinya dibatalkan — apakah mereka tahu dan setuju',
      'Periksa apakah ada pola hari tertentu (misal: akhir bulan, hari gajian)',
      'Bandingkan total kas fisik dengan total transaksi yang tercatat di sistem',
    ],
    severity: sevLuarJam,
    sumber: 'template',
  }
}

const SYSTEM_PROMPT = `Kamu adalah auditor kepatuhan koperasi simpan pinjam pedesaan Indonesia.

KONTEKS FRAUD KOPERASI YANG UMUM:
- Kasir mencatat nominal lebih kecil dari yang diterima, mengambil selisih (simpanan_dispute)
- Kasir menerima uang tapi tidak mencatat sama sekali, uang masuk kantong (simpanan_claim)
- Menghapus record finansial untuk menghilangkan jejak transaksi (hapus_finansial)
- Mengubah nominal setelah transaksi dikonfirmasi untuk menyesuaikan angka yang sudah diambil (ubah_nominal)
- Membatalkan/menghapus transaksi setelah jam tutup kasir resmi saat pengawasan minimal (pembatalan_luar_jam)

TUGAS KAMU:
Analisis anomali berikut dan jelaskan:
1. MENGAPA ini mencurigakan dalam konteks koperasi (bukan hanya "ini tidak biasa" tapi RISIKO KONKRET-nya apa)
2. Langkah investigasi yang SPESIFIK dan actionable untuk pengawas koperasi

ATURAN:
- Bahasa Indonesia sederhana, bisa dipahami non-teknis
- Jangan menuduh seseorang bersalah — fokus pada verifikasi
- Ringkasan maks 3 kalimat, checklist maks 5 item
- Balas HANYA dengan JSON valid tanpa markdown fence:
{"ringkasan": "...", "apa_yang_harus_dicek": ["..."], "severity": "rendah|sedang|tinggi"}`

export async function POST(req: Request) {
  const input = (await req.json()) as AnomalyInput
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(templateAnalysis(input))
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: `Anomali terdeteksi di koperasi:\n${JSON.stringify(input, null, 2)}`,
        }],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const json = await res.json()
    const text = json.content?.find((b: any) => b.type === 'text')?.text ?? ''

    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}')
    return NextResponse.json({
      ringkasan: parsed.ringkasan ?? templateAnalysis(input).ringkasan,
      apa_yang_harus_dicek: parsed.apa_yang_harus_dicek ?? templateAnalysis(input).apa_yang_harus_dicek,
      severity: parsed.severity ?? templateAnalysis(input).severity,
      sumber: 'ai',
    } as AnomalyAnalysis)
  } catch {
    return NextResponse.json({ ...templateAnalysis(input), sumber: 'template' })
  }
}
