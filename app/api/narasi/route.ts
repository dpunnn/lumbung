import { NextResponse } from 'next/server'
import { narasiTemplate, type RingkasanLens } from '@/lib/narasi'

export async function POST(req: Request) {
  const data = (await req.json()) as RingkasanLens
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json({ narasi: narasiTemplate(data), sumber: 'template' })
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system:
          'Kamu asisten koperasi desa. Ubah angka menjadi SATU paragraf bahasa Indonesia ' +
          'yang sederhana, hangat, dan mudah dipahami pengurus dengan literasi digital rendah. ' +
          'Maksimal 4 kalimat, tanpa jargon. Tekankan hal yang perlu ditindaklanjuti. ' +
          'Hanya bahas data yang tersedia di JSON — jangan menyebut modul atau angka yang tidak ada.',
        messages: [
          {
            role: 'user',
            content: `Data koperasi bulan ini (JSON):\n${JSON.stringify(data)}\n\nTuliskan ringkasannya.`,
          },
        ],
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}`)

    const json = await res.json()
    const blok = json.content?.find((b: { type: string }) => b.type === 'text')
    const narasi = blok?.text ?? narasiTemplate(data)
    return NextResponse.json({ narasi, sumber: 'haiku' })
  } catch {
    return NextResponse.json({ narasi: narasiTemplate(data), sumber: 'template' })
  }
}
