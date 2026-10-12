'use client'

import { useCallback, useRef } from 'react'

/**
 * Hook para sintetizar sonidos de interfaz estilo PlayStation 5
 * utilizando Web Audio API sin requerir la descarga de archivos pesados.
 */
export function useUISound() {
  const audioCtxRef = useRef<AudioContext | null>(null)

  const getAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx()
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {})
    }
    return audioCtxRef.current
  }, [])

  // Sonido de navegación/hover (sutil blip PS5)
  const playMove = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(680, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04)

      gain.gain.setValueAtTime(0.04, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    } catch {
      // Ignorar si el usuario aún no interactuó con el DOM
    }
  }, [getAudioContext])

  // Sonido de confirmación / click (chime nítido PS5)
  const playSelect = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'triangle'

      osc1.frequency.setValueAtTime(880, now)
      osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.08)

      osc2.frequency.setValueAtTime(1760, now)
      osc2.frequency.exponentialRampToValueAtTime(2093, now + 0.08)

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.13)
      osc2.stop(now + 0.13)
    } catch {
      // Ignorar
    }
  }, [getAudioContext])

  // Sonido de retroceso / cerrar modal
  const playBack = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.08)

      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.09)
    } catch {
      // Ignorar
    }
  }, [getAudioContext])

  // Sonido glorioso de Trofeo Desbloqueado (arpegio cristalino PS5)
  const playTrophyUnlock = useCallback(() => {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const notes = [587.33, 880, 1174.66, 1760] // D5, A5, D6, A6
      const now = ctx.currentTime

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const noteStart = now + idx * 0.08

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, noteStart)

        gain.gain.setValueAtTime(0.12, noteStart)
        gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.45)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(noteStart)
        osc.stop(noteStart + 0.48)
      })
    } catch {
      // Ignorar
    }
  }, [getAudioContext])

  return {
    playMove,
    playSelect,
    playBack,
    playTrophyUnlock
  }
}
