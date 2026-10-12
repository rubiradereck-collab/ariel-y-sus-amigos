'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'

interface WallUnreadState {
  count: number
  lastSeenAt: string | null   // se CONSERVA tras markSeen() para poder resaltar los posts nuevos
  firstVisit: boolean
  ready: boolean
  init: () => void
  refresh: () => Promise<void>
  markSeen: () => Promise<void>
}

let started = false

export const useWallUnread = create<WallUnreadState>((set, get) => ({
  count: 0,
  lastSeenAt: null,
  firstVisit: false,
  ready: false,
  async refresh() {
    try {
      const { data, error } = await createClient().rpc('wall_unread')
      if (error || !data) return
      set({
        count: typeof data.count === 'number' ? data.count : 0,
        lastSeenAt: data.last_seen_at ?? null,
        firstVisit: !!data.first_visit,
        ready: true,
      })
    } catch {
      // Ignorar si no hay sesión
    }
  },
  async markSeen() {
    try {
      await createClient().rpc('wall_mark_seen')
      set({ count: 0, firstVisit: false })
    } catch {
      // Ignorar
    }
  },
  init() {
    if (started || typeof window === 'undefined') return
    started = true
    const sb = createClient()
    void get().refresh()
    sb.auth.onAuthStateChange((_e, s) => {
      if (s) void get().refresh()
      else set({ count: 0, ready: false })
    })
    sb.channel('wall-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        const watching = window.location.pathname.startsWith('/muro') && document.visibilityState === 'visible'
        void (watching ? get().markSeen() : get().refresh())
      })
      .subscribe()
  },
}))
