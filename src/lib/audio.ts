/**
 * Gestor singleton de audio estilo PS5 con Web Audio API.
 * Evita la creación redundante de AudioContext por componente,
 * provee interruptor persistente de silencio y respeta preferencias del usuario.
 */

let globalAudioCtx: AudioContext | null = null
const MUTE_STORAGE_KEY = 'ps5_ui_sound_muted'

export function isAudioMuted(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(MUTE_STORAGE_KEY) === 'true'
}

export function setAudioMuted(muted: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MUTE_STORAGE_KEY, muted ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent('ps5_sound_mute_changed', { detail: muted }))
}

export function toggleAudioMute(): boolean {
  const next = !isAudioMuted()
  setAudioMuted(next)
  return next
}

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (isAudioMuted()) return null

  if (!globalAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx()
    }
  }

  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {})
  }

  return globalAudioCtx
}

// Sonidos sintetizados nativos PS5
export const PS5Sounds = {
  // Sutil blip al navegar / hover
  playMove() {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(680, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04)

      gain.gain.setValueAtTime(0.035, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.045)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.05)
    } catch {
      // Ignorar restricciones de autoplay
    }
  },

  // Chime nítido de confirmación / select
  playSelect() {
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

      gain.gain.setValueAtTime(0.07, now)
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
  },

  // Sonido de retroceso / cancelación
  playBack() {
    try {
      const ctx = getAudioContext()
      if (!ctx) return

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.08)

      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.09)
    } catch {
      // Ignorar
    }
  },

  // Arpegio cristalino de Trofeo PS5 desbloqueado
  playTrophyUnlock() {
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
  },
}
