import Dexie, { type Table } from 'dexie'

export interface OutboxItem {
  id?: number
  tabel: string
  aksi: 'INSERT' | 'UPDATE' | 'DELETE'
  row_id: string
  payload: Record<string, unknown>
  synced_at: string | null
  retry_count: number
  created_at: string
}

export interface TernakLocal {
  id: string
  koperasi_id: string
  kode: string
  jenis: string
  umur_bulan: number | null
  status: string
  nilai_estimasi: number
  vaksin_terakhir: string | null
  terverifikasi: boolean
  synced: boolean
  created_at: string
}

class LumbungDB extends Dexie {
  outbox!: Table<OutboxItem>
  ternak!: Table<TernakLocal>

  constructor() {
    super('lumbung')
    this.version(1).stores({
      outbox: '++id, tabel, synced_at, created_at',
      ternak: 'id, koperasi_id, status, synced',
    })
  }
}

export const db = new LumbungDB()

export async function pendingCount() {
  return db.outbox.filter(item => item.synced_at === null).count()
}

export async function addToOutbox(
  tabel: string,
  aksi: OutboxItem['aksi'],
  row_id: string,
  payload: Record<string, unknown>
) {
  await db.outbox.add({
    tabel, aksi, row_id, payload,
    synced_at: null,
    retry_count: 0,
    created_at: new Date().toISOString(),
  })
}
