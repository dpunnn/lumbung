'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

export function CameraCapture({ onCapture, disabled = false }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [active, setActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 1280, height: 720 },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setActive(true)
      setPreview(null)
    } catch {
      alert('Izin kamera ditolak atau tidak tersedia')
    }
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setPreview(url)
        stopCamera()
        onCapture(file)
      },
      'image/jpeg',
      0.92,
    )
  }, [onCapture, stopCamera])

  return (
    <Card className="w-full">
      <CardContent className="p-4 flex flex-col gap-3">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Hasil foto" className="w-full rounded-lg object-cover max-h-64" />
        ) : (
          <video
            ref={videoRef}
            className={`w-full rounded-lg bg-stone-900 max-h-64 object-cover ${!active ? 'hidden' : ''}`}
            autoPlay
            playsInline
            muted
          />
        )}
        {!active && !preview && (
          <div className="w-full h-40 rounded-lg bg-stone-100 flex items-center justify-center text-stone-400 text-sm">
            Kamera belum aktif
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          {!active && !preview && (
            <Button onClick={startCamera} disabled={disabled} className="flex-1 bg-amber-600 hover:bg-amber-700">
              Buka Kamera
            </Button>
          )}
          {active && (
            <>
              <Button onClick={capture} className="flex-1 bg-amber-600 hover:bg-amber-700">
                Ambil Foto
              </Button>
              <Button variant="outline" onClick={stopCamera}>
                Tutup
              </Button>
            </>
          )}
          {preview && (
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null)
                void startCamera()
              }}
              className="flex-1"
            >
              Foto Ulang
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
