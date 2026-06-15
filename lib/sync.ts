import api from './api'
import { db } from './db'

// Flush outbox IndexedDB ke Gateway Go (bukan lagi Supabase langsung).
export async function flushOutbox(): Promise<number> {
  const pending = await db.outbox.filter((item) => item.synced_at === null).toArray()

  let synced = 0

  for (const item of pending) {
    try {
      const base = `/api/${item.tabel}`
      if (item.aksi === 'INSERT') {
        await api.post(base, item.payload)
      } else if (item.aksi === 'UPDATE') {
        const { row_id: _row_id, ...rest } = item.payload
        void _row_id
        await api.patch(`${base}/${item.row_id}`, rest)
      } else if (item.aksi === 'DELETE') {
        await api.delete(`${base}/${item.row_id}`)
      }

      await db.outbox.update(item.id!, { synced_at: new Date().toISOString() })
      synced++
    } catch {
      await db.outbox.update(item.id!, { retry_count: (item.retry_count ?? 0) + 1 })
    }
  }

  return synced
}
