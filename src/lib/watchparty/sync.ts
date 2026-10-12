import { WpState } from '@/types/entrega3'

export async function measureClockOffset(
  rpcServerTime: () => Promise<number>
): Promise<number> {
  const samples: number[] = []

  for (let i = 0; i < 3; i++) {
    const t0 = Date.now()
    try {
      const serverMs = await rpcServerTime()
      const t1 = Date.now()
      const rtt = t1 - t0
      const offset = serverMs - (t0 + rtt / 2)
      samples.push(offset)
    } catch {
      samples.push(0)
    }
  }

  samples.sort((a, b) => a - b)
  return samples[Math.floor(samples.length / 2)] || 0
}

export function calculateTargetPosition(state: WpState, serverNowMs: number): number {
  if (!state.is_playing) {
    return state.position_sec
  }
  const updatedMs = new Date(state.updated_at).getTime()
  const elapsedSec = Math.max(0, (serverNowMs - updatedMs) / 1000)
  return Math.max(0, state.position_sec + elapsedSec)
}

export function computeDriftAction(
  localSec: number,
  expectedSec: number
): { action: 'none' | 'rate' | 'seek'; rate?: number; diff: number } {
  const drift = localSec - expectedSec
  const absDrift = Math.abs(drift)

  if (absDrift > 1.2) {
    return { action: 'seek', diff: drift }
  }
  if (absDrift > 0.3) {
    return {
      action: 'rate',
      rate: drift > 0 ? 0.95 : 1.05,
      diff: drift,
    }
  }
  return { action: 'none', diff: drift }
}
