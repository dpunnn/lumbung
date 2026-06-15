import Link from 'next/link'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface Product {
  id: string
  slug: string
  nama: string
  deskripsi: string
  harga: number
  stok: number
  kategori: string
  foto_url: string | null
  aktif: boolean
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const hargaFormatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(product.harga)

  return (
    <Link href={`/produk/${product.slug}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <div className="relative h-48 w-full bg-stone-100 rounded-t-lg overflow-hidden">
          {product.foto_url ? (
            <Image src={product.foto_url} alt={product.nama} fill className="object-cover" />
          ) : (
            <div className="h-full flex items-center justify-center text-stone-300 text-4xl">{'\u{1F33E}'}</div>
          )}
          {product.stok === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white text-sm font-medium">Stok Habis</span>
            </div>
          )}
        </div>
        <CardContent className="p-3 flex flex-col gap-1">
          <Badge variant="secondary" className="w-fit text-xs capitalize">
            {product.kategori}
          </Badge>
          <h3 className="font-semibold text-stone-900 line-clamp-2 text-sm">{product.nama}</h3>
          <p className="text-stone-500 text-xs line-clamp-2">{product.deskripsi}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="font-bold text-amber-700">{hargaFormatted}</span>
            <span className="text-xs text-stone-400">Stok: {product.stok}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
