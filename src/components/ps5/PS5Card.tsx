'use client'

import React, { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { useUISound } from '@/hooks/useUISound'

export interface PS5CardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: React.ReactNode
  className?: string
  glowColor?: 'blue' | 'gold' | 'purple' | 'white'
  enableSound?: boolean
  selected?: boolean
  interactive?: boolean
}

export const PS5Card = forwardRef<HTMLDivElement, PS5CardProps>(({
  children,
  className = '',
  glowColor = 'blue',
  enableSound = true,
  selected = false,
  interactive = true,
  onMouseEnter,
  onClick,
  ...props
}, ref) => {
  const { playMove, playSelect } = useUISound()

  const glowStyles = {
    blue: 'hover:border-blue-400/80 hover:shadow-[0_0_25px_rgba(59,130,246,0.35)] focus-visible:shadow-[0_0_30px_rgba(59,130,246,0.5)]',
    gold: 'hover:border-yellow-400/80 hover:shadow-[0_0_25px_rgba(234,179,8,0.35)] focus-visible:shadow-[0_0_30px_rgba(234,179,8,0.5)]',
    purple: 'hover:border-purple-400/80 hover:shadow-[0_0_25px_rgba(168,85,247,0.35)] focus-visible:shadow-[0_0_30px_rgba(168,85,247,0.5)]',
    white: 'hover:border-white/80 hover:shadow-[0_0_25px_rgba(255,255,255,0.35)] focus-visible:shadow-[0_0_30px_rgba(255,255,255,0.5)]',
  }

  const selectedStyles = {
    blue: 'border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.45)] ring-2 ring-blue-500/50',
    gold: 'border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.45)] ring-2 ring-yellow-500/50',
    purple: 'border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.45)] ring-2 ring-purple-500/50',
    white: 'border-white shadow-[0_0_30px_rgba(255,255,255,0.45)] ring-2 ring-white/50',
  }

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (enableSound && interactive) {
      playMove()
    }
    onMouseEnter?.(e)
  }

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (enableSound && interactive) {
      playSelect()
    }
    onClick?.(e)
  }

  return (
    <motion.div
      ref={ref}
      tabIndex={interactive ? 0 : undefined}
      whileHover={interactive ? { y: -4, scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          if (enableSound) playSelect()
          // @ts-expect-error synthetically trigger click
          onClick?.(e)
        }
      }}
      className={`
        relative overflow-hidden rounded-2xl
        bg-[#111218]/85 backdrop-blur-md
        border border-white/10
        transition-colors duration-200
        outline-none
        ${interactive ? 'cursor-pointer ' + glowStyles[glowColor] : ''}
        ${selected ? selectedStyles[glowColor] : ''}
        ${className}
      `}
      {...props}
    >
      {/* Sutil brillo superior de estilo PS5 Glass */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      {children}
    </motion.div>
  )
})

PS5Card.displayName = 'PS5Card'
