'use client'

import { useState, useEffect, useCallback } from 'react'
import { db, pendingCount, type OutboxItem } from '@/lib/db'
import api from '@/lib/api'

// Kirim satu item outbox ke Gateway sesuai aksinya.
async function pushItem(item: OutboxItem): Promise<void> {
  const base = `/api/${item.tabel}`
  switch (item.aksi) {
    case 'INSERT':
      await api.post(base, item.payload)
      break
    case 'UPDATE':
      await api.patch(`${base}/${item.row_id}`, item.payload)
      break
    case 'DELETE':
      await api.delete(`${base}/${item.row_id}`)
      break
  }
}

export function SyncStatusBar() {
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [, setLastSync] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    try {
      setPending(await pendingCount())
    } catch {
      setPending(0)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = setInterval(() => void refresh(), 10000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    try {
      const items = await db.outbox.filter((i) => i.synced_at === null).toArray()
      for (const item of items) {
        try {
          await pushItem(item)
          if (item.id !== undefined) {
            await db.outbox.update(item.id, { synced_at: new Date().toISOString() })
          }
        } catch {
          // Item gagal — naikkan retry, coba lagi pada sync berikutnya.
          if (item.id !== undefined) {
            await db.outbox.update(item.id, { retry_count: (item.retry_count ?? 0) + 1 })
          }
        }
      }
      setLastSync(new Date())
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [refresh])

  if (pending === 0 && !syncing) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-amber-200 rounded-lg shadow-lg p-3 flex items-center gap-3 text-sm">
      <div className={`w-2 h-2 rounded-full ${syncing ? 'bg-amber-400 animate-pulse' : 'bg-orange-500'}`} />
      <span className="text-stone-700">
        {syncing ? 'Sinkronisasi...' : `${pending} transaksi offline`}
      </span>
      {!syncing && pending > 0 && (
        <button onClick={() => void handleSync()} className="text-amber-700 font-medium hover:underline">
          Kirim
        </button>
      )}
    </div>
  )
}
