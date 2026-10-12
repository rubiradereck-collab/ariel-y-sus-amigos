'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { Trophy, Coins, RotateCcw, Play, Sparkles } from 'lucide-react'
import { SupabaseClient } from '@supabase/supabase-js'
import { DPad } from './DPad'

interface SnakeGameProps {
  supabase: SupabaseClient
  onScoreSubmitted?: () => void
}

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
type Point = { x: number; y: number }

const GRID_SIZE = 20

export function SnakeGame({ supabase, onScoreSubmitted }: SnakeGameProps) {
  const [snake, setSnake] = useState<Point[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ])
  const [food, setFood] = useState<Point>({ x: 5, y: 5 })
  const [score, setScore] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [gameOver, setGameOver] = useState<boolean>(false)
  const [reward, setReward] = useState<{ coins: number; xp: number; daily_left: number } | null>(null)

  const dirRef = useRef<Direction>('UP')
  const dirQueueRef = useRef<Direction[]>([])
  const startTimeRef = useRef<number>(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const getRandomFood = useCallback((currentSnake: Point[]): Point => {
    let p: Point
    while (true) {
      p = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      }
      if (!currentSnake.some((s) => s.x === p.x && s.y === p.y)) {
        return p
      }
    }
  }, [])

  const startGame = () => {
    const initialSnake: Point[] = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ]
    setSnake(initialSnake)
    dirRef.current = 'UP'
    dirQueueRef.current = []
    setFood(getRandomFood(initialSnake))
    setScore(0)
    setReward(null)
    setGameOver(false)
    setIsPlaying(true)
    startTimeRef.current = performance.now()
  }

  const handleDirection = useCallback((nextDir: Direction) => {
    const lastDir = dirQueueRef.current[dirQueueRef.current.length - 1] || dirRef.current
    // Evitar giro de 180° opuesto
    if (
      (nextDir === 'UP' && lastDir === 'DOWN') ||
      (nextDir === 'DOWN' && lastDir === 'UP') ||
      (nextDir === 'LEFT' && lastDir === 'RIGHT') ||
      (nextDir === 'RIGHT' && lastDir === 'LEFT')
    ) {
      return
    }
    if (dirQueueRef.current.length < 2) {
      dirQueueRef.current.push(nextDir)
    }
  }, [])

  // Captura de teclado (Flechas y WASD)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        e.preventDefault()
        handleDirection('UP')
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        e.preventDefault()
        handleDirection('DOWN')
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        e.preventDefault()
        handleDirection('LEFT')
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        e.preventDefault()
        handleDirection('RIGHT')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDirection])

  // Captura táctil de deslizamiento (Swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    if (Math.max(absX, absY) > 24) {
      if (absX > absY) {
        handleDirection(dx > 0 ? 'RIGHT' : 'LEFT')
      } else {
        handleDirection(dy > 0 ? 'DOWN' : 'UP')
      }
    }
    touchStartRef.current = null
  }

  // Finalizar juego y enviar puntaje seguro
  const endGame = useCallback(
    async (finalScore: number) => {
      setIsPlaying(false)
      setGameOver(true)
      const durationMs = Math.max(1000, Math.round(performance.now() - startTimeRef.current))

      try {
        const { data, error } = await supabase.rpc('arcade_submit_score', {
          p_game: 'snake',
          p_score: finalScore,
          p_duration_ms: durationMs,
        })
        if (!error && data) {
          const res = data as { coins: number; xp: number; daily_left: number }
          setReward(res)
          onScoreSubmitted?.()
          if (res.coins > 0 || res.xp > 0) {
            toast.success(`🎮 Recompensa: +${res.coins} monedas y +${res.xp} XP`)
          }
        }
      } catch {
        // En caso de fallo de red
      }
    },
    [supabase, onScoreSubmitted]
  )

  // Bucle principal del juego (Tick rate acelerado cada 5 puntos)
  useEffect(() => {
    if (!isPlaying) return

    const tickMs = Math.max(60, 150 - Math.floor(score / 5) * 8)
    const interval = setInterval(() => {
      setSnake((prev) => {
        if (dirQueueRef.current.length > 0) {
          dirRef.current = dirQueueRef.current.shift()!
        }
        const currentDir = dirRef.current
        const head = prev[0]
        const nextHead: Point = {
          x: head.x + (currentDir === 'RIGHT' ? 1 : currentDir === 'LEFT' ? -1 : 0),
          y: head.y + (currentDir === 'DOWN' ? 1 : currentDir === 'UP' ? -1 : 0),
        }

        // Colisión con paredes
        if (
          nextHead.x < 0 ||
          nextHead.x >= GRID_SIZE ||
          nextHead.y < 0 ||
          nextHead.y >= GRID_SIZE
        ) {
          void endGame(score)
          return prev
        }

        // Colisión con el propio cuerpo
        if (prev.some((s) => s.x === nextHead.x && s.y === nextHead.y)) {
          void endGame(score)
          return prev
        }

        const newSnake = [nextHead, ...prev]

        // Comer manzana
        if (nextHead.x === food.x && nextHead.y === food.y) {
          setScore((s) => s + 1)
          setFood(getRandomFood(newSnake))
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, tickMs)

    return () => clearInterval(interval)
  }, [isPlaying, food, score, endGame, getRandomFood])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Marcador Superior */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-400" />
          <span className="text-sm font-bold text-zinc-300">Puntuación:</span>
          <span className="text-2xl font-black text-yellow-300">{score}</span>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Velocidad: {Math.max(60, 150 - Math.floor(score / 5) * 8)}ms</span>
        </div>
      </div>

      {/* Tablero de Juego */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-3xl border-4 border-emerald-600/50 bg-gradient-to-b from-zinc-950 to-black shadow-2xl"
      >
        <div className="grid h-full w-full grid-cols-20 grid-rows-20 gap-px bg-zinc-900/40 p-2">
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE
            const y = Math.floor(i / GRID_SIZE)
            const isHead = snake[0].x === x && snake[0].y === y
            const isBody = !isHead && snake.some((s) => s.x === x && s.y === y)
            const isFood = food.x === x && food.y === y

            return (
              <div
                key={i}
                className={`rounded-sm transition-colors duration-75 ${
                  isHead
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : isBody
                      ? 'bg-emerald-600/80'
                      : isFood
                        ? 'animate-pulse bg-red-500 shadow-[0_0_10px_#ef4444]'
                        : 'bg-transparent'
                }`}
              />
            )
          })}
        </div>

        {/* Pantalla de Inicio / Fin */}
        <AnimatePresence>
          {!isPlaying && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 p-6 text-center backdrop-blur-sm"
            >
              {gameOver ? (
                <div className="space-y-4">
                  <h2 className="text-3xl font-black uppercase tracking-wider text-red-500 drop-shadow">
                    ¡Fin del Juego!
                  </h2>
                  <p className="text-sm font-bold text-zinc-300">
                    Puntuación final: <span className="text-xl font-black text-yellow-300">{score}</span>
                  </p>
                  {reward && (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs font-bold text-yellow-200">
                      <div>+{reward.coins} monedas • +{reward.xp} XP</div>
                      <div className="mt-1 opacity-70">Tope diario restante: {reward.daily_left} monedas</div>
                    </div>
                  )}
                  <button
                    onClick={startGame}
                    className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-3 font-black uppercase tracking-wider text-white shadow-xl transition hover:from-emerald-400 hover:to-teal-400"
                  >
                    <RotateCcw className="h-5 w-5" /> Jugar de nuevo
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-3xl font-black uppercase tracking-wider text-emerald-400 drop-shadow">
                    SNAKE ARCADE
                  </h2>
                  <p className="text-xs text-zinc-300">
                    Come manzanas rojas para crecer y sumar puntos. Evita chocar contra las paredes y tu cola.
                  </p>
                  <button
                    onClick={startGame}
                    className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-black uppercase tracking-wider text-white shadow-xl transition hover:from-emerald-400 hover:to-teal-400"
                  >
                    <Play className="h-5 w-5 fill-current" /> Comenzar
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Móvil D-Pad */}
      <div className="sm:hidden">
        <DPad onDirection={handleDirection} disabled={!isPlaying} />
      </div>
    </div>
  )
}
