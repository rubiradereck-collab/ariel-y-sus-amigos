export const MIN_BET = 10
export const MAX_BET = 100000

export interface Note {
  f: number
  t: number
  d: number
  type?: OscillatorType
  v?: number
}

let audioCtx: AudioContext | null = null

export function playNotes(notes: Note[]): void {
  try {
    if (typeof window === 'undefined') return
    if (!audioCtx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audioCtx = new Ctor()
    }
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()
    const now = ctx.currentTime
    notes.forEach((n) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = n.type ?? 'sine'
      osc.frequency.setValueAtTime(n.f, now + n.t)
      gain.gain.setValueAtTime(0.0001, now + n.t)
      gain.gain.exponentialRampToValueAtTime(n.v ?? 0.16, now + n.t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + n.t)
      osc.stop(now + n.t + n.d + 0.05)
    })
  } catch {
    // El audio es decorativo: si el navegador lo bloquea, el juego sigue funcionando.
  }
}

export const sfx = {
  click: () => playNotes([{ f: 520, t: 0, d: 0.06, type: 'triangle' }]),
  tick: () => playNotes([{ f: 700 + Math.random() * 500, t: 0, d: 0.035, type: 'triangle', v: 0.07 }]),
  launch: () =>
    playNotes([
      { f: 110, t: 0, d: 0.5, type: 'sawtooth', v: 0.08 },
      { f: 220, t: 0.15, d: 0.5, type: 'sawtooth', v: 0.06 },
    ]),
  win: () =>
    playNotes([
      { f: 784, t: 0, d: 0.1, type: 'square', v: 0.1 },
      { f: 988, t: 0.09, d: 0.1, type: 'square', v: 0.1 },
      { f: 1319, t: 0.18, d: 0.18, type: 'square', v: 0.1 },
    ]),
  bigWin: () =>
    playNotes([
      { f: 523, t: 0, d: 0.1, type: 'square', v: 0.1 },
      { f: 659, t: 0.09, d: 0.1, type: 'square', v: 0.1 },
      { f: 784, t: 0.18, d: 0.1, type: 'square', v: 0.1 },
      { f: 1047, t: 0.27, d: 0.12, type: 'square', v: 0.1 },
      { f: 1319, t: 0.4, d: 0.12, type: 'square', v: 0.1 },
      { f: 1568, t: 0.52, d: 0.35, type: 'triangle', v: 0.14 },
    ]),
  lose: () =>
    playNotes([
      { f: 260, t: 0, d: 0.14, type: 'sawtooth', v: 0.1 },
      { f: 196, t: 0.12, d: 0.2, type: 'sawtooth', v: 0.1 },
    ]),
  explode: () =>
    playNotes([
      { f: 160, t: 0, d: 0.25, type: 'sawtooth', v: 0.2 },
      { f: 90, t: 0.1, d: 0.35, type: 'sawtooth', v: 0.2 },
      { f: 50, t: 0.2, d: 0.45, type: 'square', v: 0.2 },
    ]),
}

const RPC_ERRORS: Record<string, string> = {
  insufficient_funds: 'No tienes monedas suficientes.',
  invalid_bet: `Apuesta inválida (mín. ${MIN_BET}, máx. ${MAX_BET.toLocaleString()}).`,
  invalid_risk: 'Nivel de riesgo inválido.',
  round_in_progress: 'Ya tienes una ronda en curso.',
  no_active_round: 'No hay ronda activa.',
  not_authenticated: 'Tu sesión expiró, vuelve a iniciar sesión.',
}

export function rpcError(message: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k))
  return key ? RPC_ERRORS[key] : 'Ocurrió un error inesperado.'
}
