'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface Detection {
  label: string
  confidence: number
  bbox: { x1: number; y1: number; x2: number; y2: number }
}

interface MutuResult {
  skor: number
  kondisi: 'A' | 'B' | 'C'
  keterangan: string
  rekomendasi: string
}

interface AIResultCardProps {
  count: number
  detections: Detection[]
  mutu: MutuResult | null
  aiMode: 'server' | 'on_device'
  loading?: boolean
}

const gradeColor: Record<string, string> = {
  A: 'bg-green-100 text-green-800',
  B: 'bg-amber-100 text-amber-800',
  C: 'bg-red-100 text-red-800',
}

export function AIResultCard({ count, detections, mutu, aiMode, loading = false }: AIResultCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-stone-500 text-sm animate-pulse">
          Menganalisis gambar...
        </CardContent>
      </Card>
    )
  }

  const labelCounts = detections.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] ?? 0) + 1
    return acc
  }, {})

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          Hasil Saksi AI
          <Badge variant="outline" className="text-xs font-normal">
            {aiMode === 'server' ? '☁ Server' : '\u{1F4F1} On-Device'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold text-amber-700">{count}</span>
          <span className="text-stone-500 text-sm">ekor terdeteksi</span>
        </div>
        {detections.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {Object.entries(labelCounts).map(([label, n]) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}: {n}
              </Badge>
            ))}
          </div>
        )}
        {mutu && (
          <div className="border rounded-lg p-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-sm font-semibold ${gradeColor[mutu.kondisi]}`}>
                Grade {mutu.kondisi}
              </span>
              <span className="text-stone-600 text-sm">Skor {mutu.skor}/100</span>
            </div>
            <p className="text-stone-700 text-sm">{mutu.keterangan}</p>
            <p className="text-stone-500 text-xs">{mutu.rekomendasi}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export type { Detection, MutuResult, AIResultCardProps }
