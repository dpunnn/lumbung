'use client'

import { useEffect, useState } from 'react'
import { db } from '@/lib/db'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [pending, setPending] = useState(0)

  async function refreshPending() {
    const count = await db.outbox.filter(item => item.synced_at === null).count()
    setPending(count)
  }

  useEffect(() => {
    setIsOnline(navigator.onLine)
    refreshPending()

    const onOnline = () => { setIsOnline(true); refreshPending() }
    const onOffline = () => setIsOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return { isOnline, pending, refreshPending }
}
