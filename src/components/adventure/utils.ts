'use client'

import { useCallback, useRef, useState } from 'react'
import type { AdvProps } from './shared'

const MESSAGES: Record<string, string> = {
  not_authenticated: 'Tu sesión expiró, vuelve a iniciar sesión.',
  zone_not_found: 'Esa zona no existe.',
  level_too_low: 'Tu nivel es muy bajo para esta zona.',
  no_pickaxe: 'Equipa un pico primero.',
  pickaxe_too_weak: 'Tu pico es demasiado débil para esta zona.',
  no_rod: 'Equipa una caña primero.',
  rod_too_weak: 'Tu caña es demasiado débil para esta zona.',
  cooldown: 'Todavía se está enfriando, espera un momento.',
  bag_full: 'Tu mochila está llena. Vende algo primero.',
  no_item: 'No tienes ese objeto.',
  invalid_bait: 'Carnada inválida.',
  empty_zone: 'Esta zona no tiene botín configurado.',
  no_session: 'La sesión de pesca expiró. Lanza de nuevo.',
  already_hooked: 'Ya enganchaste este pez.',
  not_hooked: 'Primero tienes que enganchar el pez.',
  too_soon: 'La pelea todavía no termina.',
  invalid_score: 'Puntuación inválida.',
}

export function advError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k))
  return key ? MESSAGES[key] : msg
}

/** Ejecuta una acción async con bloqueo síncrono (no permite doble clic) y errores traducidos. */
export function useAction(notify: AdvProps['notify']) {
  const [busy, setBusy] = useState<boolean>(false)
  const lock = useRef<boolean>(false)

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (lock.current) return
      lock.current = true
      setBusy(true)
      try {
        await fn()
      } catch (e) {
        notify(advError(e), 'err')
      } finally {
        lock.current = false
        setBusy(false)
      }
    },
    [notify]
  )

  return { busy, run }
}
