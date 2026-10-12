'use client'

import { useRef, useState, useCallback, UIEvent } from 'react'

export function useStickyScroll<T extends HTMLElement = HTMLDivElement>() {
  const containerRef = useRef<T | null>(null)
  const isAtBottomRef = useRef<boolean>(true)
  const [unreadBelow, setUnreadBelow] = useState<number>(0)

  const onScroll = useCallback((e?: UIEvent<T>) => {
    const el = e?.currentTarget || containerRef.current
    if (!el) return
    const threshold = 80
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distanceToBottom < threshold
    isAtBottomRef.current = atBottom
    if (atBottom) {
      setUnreadBelow(0)
    }
  }, [])

  const scrollToBottom = useCallback((smooth = true) => {
    const el = containerRef.current
    if (!el) return
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    })
    isAtBottomRef.current = true
    setUnreadBelow(0)
  }, [])

  const handleNewMessage = useCallback(
    (isMine: boolean) => {
      if (isMine || isAtBottomRef.current) {
        // Si el mensaje es mío o ya estoy abajo, hacer scroll automático suave
        setTimeout(() => scrollToBottom(true), 50)
      } else {
        // Si el usuario está leyendo arriba, incrementar contador de nuevos mensajes
        setUnreadBelow((prev) => prev + 1)
      }
    },
    [scrollToBottom]
  )

  return {
    containerRef,
    isAtBottomRef,
    unreadBelow,
    onScroll,
    scrollToBottom,
    handleNewMessage,
  }
}
