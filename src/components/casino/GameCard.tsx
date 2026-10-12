'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Star, Play } from 'lucide-react'
import { GameDef } from '@/lib/casino/catalog'

export function GameCard({
  game,
  isFavorite,
  onToggleFavorite,
  onLaunch,
}: {
  game: GameDef
  isFavorite: boolean
  onToggleFavorite: (slug: string) => void
  onLaunch?: (game: GameDef) => void
}) {
  const [imageError, setImageError] = useState(false)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onToggleFavorite(game.slug)
  }

  const content = (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.15)] bg-[#1b1b1d] p-2 shadow-lg transition-all duration-300 hover:border-[#d4af37]/60 hover:shadow-[0_8px_24px_rgba(212,175,55,0.22)] cursor-pointer"
    >
      {/* Contenedor de Miniatura 16:10 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-gradient-to-br from-zinc-900 to-black">
        {/* Imagen WebP con fallback procedural */}
        {!imageError ? (
          <Image
            src={game.cover}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            loading="lazy"
            onError={() => setImageError(true)}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          /* Portada procedural de lujo con estilo Neón Dorado y Dark Metal */
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_center,#27272a_0%,#09090b_85%)] p-4 text-center">
            {/* Patrón de fondo geométrico */}
            <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#d4af37_1px,transparent_1px),linear-gradient(to_bottom,#d4af37_1px,transparent_1px)] bg-[size:16px_16px]" />
            <span className="text-3xl sm:text-4xl filter drop-shadow-[0_0_12px_rgba(212,175,55,0.4)] transition-transform duration-300 group-hover:scale-110">
              {game.emoji}
            </span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#d4af37] font-bold opacity-80">
              {game.category}
            </span>
          </div>
        )}

        {/* Overlay degradado para legibilidad */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-60 transition-opacity duration-300 group-hover:opacity-30" />

        {/* Badge Superior (NUEVO, HOT, x1000) */}
        {game.badge && (
          <div className="absolute left-2 top-2 z-10">
            <span
              className={`rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-black shadow-md ${
                game.badge === 'HOT'
                  ? 'bg-gradient-to-r from-amber-400 to-red-500 text-white'
                  : game.badge === 'x1000'
                  ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white'
                  : 'bg-gradient-to-r from-[#d4af37] to-amber-300'
              }`}
            >
              {game.badge}
            </span>
          </div>
        )}

        {/* Overlay hover con botón de Jugar */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.8)] transition-transform group-hover:scale-110">
            <Play className="h-4 w-4 fill-black ml-0.5" />
          </div>
        </div>
      </div>

      {/* Pie de Tarjeta */}
      <div className="mt-2.5 flex items-center justify-between px-1.5 pb-0.5">
        <div className="min-w-0 flex-1 pr-2">
          <h4 className="truncate text-xs sm:text-sm font-bold text-white transition-colors group-hover:text-[#d4af37]">
            {game.title}
          </h4>
          <span className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {game.category}
          </span>
        </div>

        {/* Estrella de Favorito */}
        <button
          onClick={handleFavoriteClick}
          aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent transition hover:border-[rgba(212,175,55,0.3)] hover:bg-black/40 active:scale-90"
        >
          <Star
            className={`h-4 w-4 transition-colors ${
              isFavorite
                ? 'fill-[#d4af37] text-[#d4af37] filter drop-shadow-[0_0_6px_rgba(212,175,55,0.6)]'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
          />
        </button>
      </div>
    </motion.div>
  )

  if (onLaunch) {
    return <div onClick={() => onLaunch(game)}>{content}</div>
  }

  return <Link href={game.route}>{content}</Link>
}
