'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface DualApprovalProps {
  jumlah: number
  komoditas: string
  mutu: string
  skor: number
  onApprove: (kasirPin: string) => Promise<void>
  onReject: () => void
  loading?: boolean
}

export function DualApproval({ jumlah, komoditas, mutu, skor, onApprove, onReject, loading }: DualApprovalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN minimal 4 digit')
      return
    }
    setError(null)
    try {
      await onApprove(pin)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan')
    }
  }

  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-amber-900">Konfirmasi Setoran</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div>
            <span className="text-stone-500">Jumlah</span>
            <p className="font-semibold">{jumlah} ekor</p>
          </div>
          <div>
            <span className="text-stone-500">Komoditas</span>
            <p className="font-semibold capitalize">{komoditas}</p>
          </div>
          <div>
            <span className="text-stone-500">Mutu</span>
            <p className="font-semibold">
              Grade {mutu} ({skor}/100)
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-stone-700">PIN Kasir (tanda tangan digital)</label>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={8}
            placeholder="Masukkan PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          {error && <p className="text-red-600 text-xs">{error}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading || pin.length < 4}
            className="flex-1 bg-amber-600 hover:bg-amber-700"
          >
            {loading ? 'Menyimpan...' : 'Terima & Terbitkan Struk'}
          </Button>
          <Button variant="outline" onClick={onReject} disabled={loading}>
            Batalkan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
