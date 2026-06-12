export type Ternak = {
  id: string
  koperasi_id: string
  kode: string
  jenis: string
  umur_bulan: number | null
  status: 'sehat' | 'pantau' | 'sakit' | 'mati'
  vaksin_terakhir: string | null
  nilai_estimasi: number
  foto_url: string | null
  jumlah_klaim: number
  jumlah_terverifikasi: number
  terverifikasi: boolean
  tanggal_mati: string | null
  dicatat_mati_oleh: string | null
  created_at: string
}

export type Pakan = {
  id: string
  koperasi_id: string
  nama: string
  stok: number
  satuan: string
  batas_minimum: number
  updated_at: string
}

export type Anggota = {
  id: string
  koperasi_id: string
  nama: string
  no_hp: string | null
  ktp_hash: string | null
  id_penjamin: string | null
  nama_penjamin: string | null
  limit_level: number
  limit_rupiah: number
  bergabung_at: string
}

export type Pinjaman = {
  id: string
  koperasi_id: string
  anggota_id: string
  jumlah_pokok: number
  tenor_bulan: number
  tanggal_mulai: string
  angsuran_per_bulan: number
  status: 'aktif' | 'lunas' | 'macet'
  created_at: string
  anggota?: Pick<Anggota, 'nama'>
}

export type Angsuran = {
  id: string
  pinjaman_id: string
  bulan_ke: number
  tanggal_jatuh_tempo: string
  tanggal_bayar: string | null
  jumlah_bayar: number | null
  status: 'pending' | 'lunas' | 'terlambat'
}

export type Profile = {
  id: string
  koperasi_id: string
  role: 'pengurus' | 'kasir' | 'pemodal' | 'pemkab' | 'pengawas'
  nama: string
  created_at: string
}
