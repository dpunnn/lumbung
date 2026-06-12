import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { narasiTemplate, type RingkasanLens } from '@/lib/narasi'

export async function POST(req: Request) {
  const data = (await req.json()) as RingkasanLens
  const apiKey = process.env.ANTHROPIC_API_KEY

  // Tanpa key → langsung pakai template lokal (tetap berfungsi, offline-friendly)
  if (!apiKey) {
    return NextResponse.json({ narasi: narasiTemplate(data), sumber: 'template' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5',
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
    })

    const blok = msg.content.find((b) => b.type === 'text')
    const narasi = blok && blok.type === 'text' ? blok.text : narasiTemplate(data)
    return NextResponse.json({ narasi, sumber: 'haiku' })
  } catch {
    // API gagal (kuota/offline/key salah) → tetap jalan pakai template
    return NextResponse.json({ narasi: narasiTemplate(data), sumber: 'template' })
  }
}

