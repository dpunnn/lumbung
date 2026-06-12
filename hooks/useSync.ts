'use client'

import { useEffect } from 'react'
import { flushOutbox } from '@/lib/sync'

export function useSync(onSynced?: (count: number) => void) {
  useEffect(() => {
    async function handleOnline() {
      const count = await flushOutbox()
      if (count > 0) onSynced?.(count)
    }

    window.addEventListener('online', handleOnline)
    // Coba sync saat pertama load (kalau baru online lagi)
    if (navigator.onLine) handleOnline()

    return () => window.removeEventListener('online', handleOnline)
  }, [onSynced])
}
