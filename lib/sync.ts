import { supabase } from './supabase'
import { db } from './db'

export async function flushOutbox(): Promise<number> {
  const pending = await db.outbox.filter(item => item.synced_at === null).toArray()

  let synced = 0

  for (const item of pending) {
    try {
      if (item.aksi === 'INSERT') {
        const { error } = await supabase.from(item.tabel).insert(item.payload)
        if (error) throw error
      } else if (item.aksi === 'UPDATE') {
        const { row_id, ...rest } = item.payload
        const { error } = await supabase.from(item.tabel).update(rest).eq('id', row_id as string)
        if (error) throw error
      } else if (item.aksi === 'DELETE') {
        const { error } = await supabase.from(item.tabel).delete().eq('id', item.row_id)
        if (error) throw error
      }

      await db.outbox.update(item.id!, { synced_at: new Date().toISOString() })
      synced++
    } catch {
      await db.outbox.update(item.id!, { retry_count: (item.retry_count ?? 0) + 1 })
    }
  }

  return synced
}
