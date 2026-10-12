'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  PS5Sounds,
  isAudioMuted,
  setAudioMuted,
  toggleAudioMute,
} from '@/lib/audio'

/**
 * Hook para reproducir sonidos de interfaz PS5 a través del gestor singleton.
 */
export function useUISound() {
  const [muted, setMutedState] = useState(false)

  useEffect(() => {
    setMutedState(isAudioMuted())

    const handleMuteChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>
      setMutedState(customEvent.detail)
    }

    window.addEventListener('ps5_sound_mute_changed', handleMuteChange)
    return () => {
      window.removeEventListener('ps5_sound_mute_changed', handleMuteChange)
    }
  }, [])

  const playMove = useCallback(() => {
    PS5Sounds.playMove()
  }, [])

  const playSelect = useCallback(() => {
    PS5Sounds.playSelect()
  }, [])

  const playBack = useCallback(() => {
    PS5Sounds.playBack()
  }, [])

  const playTrophyUnlock = useCallback(() => {
    PS5Sounds.playTrophyUnlock()
  }, [])

  const toggleMute = useCallback(() => {
    const next = toggleAudioMute()
    setMutedState(next)
    return next
  }, [])

  const setMuted = useCallback((isMute: boolean) => {
    setAudioMuted(isMute)
    setMutedState(isMute)
  }, [])

  return {
    muted,
    setMuted,
    toggleMute,
    playMove,
    playSelect,
    playBack,
    playTrophyUnlock,
  }
}
