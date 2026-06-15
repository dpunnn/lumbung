import { revalidateTag, revalidatePath } from 'next/cache'
import { NextRequest, NextResponse } from 'next/server'

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? 'dev-revalidate-secret'

interface RevalidateBody {
  slug?: string
  tag?: string
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret')
  if (secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as RevalidateBody
  const { slug, tag } = body

  if (slug) {
    revalidatePath(`/produk/${slug}`)
    revalidateTag(`produk-${slug}`)
  }
  if (tag) {
    revalidateTag(tag)
  }
  revalidateTag('produk-list')

  return NextResponse.json({ revalidated: true, slug: slug ?? null, tag: tag ?? null })
}
