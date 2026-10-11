// Efectos de sonido sintetizados con Web Audio (cero archivos, cero peso).
// El AudioContext se crea tras el primer gesto del usuario (política de autoplay).
let ctx: AudioContext | null = null
let muted = false
if (typeof window !== 'undefined') muted = localStorage.getItem('sfx-muted') === '1'

function ac(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slideTo?: number) {
  const c = ac(); if (!c) return
  const t = c.currentTime + delay
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05)
}

function noise(dur: number, vol = 0.3, lowpass = 800) {
  const c = ac(); if (!c) return
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const src = c.createBufferSource(); src.buffer = buf
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass
  const g = c.createGain(); g.gain.value = vol
  src.connect(f).connect(g).connect(c.destination); src.start()
}

export const sfx = {
  isMuted: () => muted,
  setMuted(m: boolean) { muted = m; if (typeof window !== 'undefined') localStorage.setItem('sfx-muted', m ? '1' : '0') },
  click: () => tone(520, 0.06, 'square', 0.06),
  tick: () => tone(900, 0.03, 'triangle', 0.05),
  reelTick: () => tone(180 + Math.random() * 120, 0.05, 'square', 0.04),
  coin() { tone(988, 0.08, 'square', 0.08); tone(1319, 0.18, 'square', 0.08, 0.07) },
  win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, i * 0.09)) },
  bigWin() {
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.1, i * 0.08))
    for (let i = 0; i < 8; i++) tone(1200 + Math.random() * 1500, 0.08, 'square', 0.05, 0.5 + i * 0.07)
  },
  lose() { tone(330, 0.35, 'sawtooth', 0.12, 0, 90) },
  boom() { noise(0.7, 0.5, 600); tone(110, 0.5, 'sawtooth', 0.2, 0, 35) },
  whoosh() { tone(200, 0.4, 'sine', 0.08, 0, 1200) },
  spin(ms: number, onDone?: () => void) {
    const n = Math.floor(ms / 70)
    for (let i = 0; i < n; i++) setTimeout(() => this.reelTick(), i * 70)
    if (onDone) setTimeout(onDone, ms)
  },
  bite() { tone(660, 0.1, 'square', 0.12); tone(880, 0.14, 'square', 0.12, 0.1) },
  mine() { noise(0.12, 0.35, 1800); tone(140, 0.12, 'square', 0.1, 0, 70) },
  craft() { tone(300, 0.08, 'square', 0.1); tone(300, 0.08, 'square', 0.1, 0.12); tone(600, 0.2, 'triangle', 0.12, 0.24) },
}
