'use client'

import React, { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUISound } from '@/hooks/useUISound'
import { toast } from 'sonner'

interface TrophyPayload {
  id: string
  title: string
  description: string
  grade: 'bronze' | 'silver' | 'gold' | 'platinum'
  xp_reward: number
}

const GRADE_ICONS: Record<string, { emoji: string; color: string; label: string; ring: string }> = {
  bronze: { emoji: '🥉', color: 'from-amber-700 to-amber-900', label: 'BRONCE', ring: 'ring-amber-600/50' },
  silver: { emoji: '🥈', color: 'from-slate-300 to-slate-500', label: 'PLATA', ring: 'ring-slate-300/50' },
  gold: { emoji: '🥇', color: 'from-yellow-400 to-amber-600', label: 'ORO', ring: 'ring-yellow-400/50' },
  platinum: { emoji: '💎', color: 'from-cyan-300 via-blue-400 to-indigo-500', label: 'PLATINO', ring: 'ring-cyan-400/70' }
}

export function useTrophyToasts() {
  const { playTrophyUnlock } = useUISound()

  useEffect(() => {
    const supabase = createClient()
    let isSubscribed = true

    const showTrophyToast = (trophy: TrophyPayload) => {
      const gradeInfo = GRADE_ICONS[trophy.grade] || GRADE_ICONS.bronze
      playTrophyUnlock()

      toast.custom(() => (
        <div className={`
          flex items-center gap-3.5 p-3.5 px-4 rounded-2xl
          bg-[#0d0f17]/95 backdrop-blur-xl border border-white/20
          shadow-[0_10px_35px_rgba(0,0,0,0.8)] ${gradeInfo.ring} ring-1
          text-white min-w-[320px] max-w-[420px]
          animate-in slide-in-from-top-4 duration-300
        `}>
          {/* Trophy Grade Badge */}
          <div className={`
            w-11 h-11 rounded-xl bg-gradient-to-br ${gradeInfo.color}
            flex items-center justify-center text-xl flex-shrink-0
            shadow-[0_0_15px_rgba(255,255,255,0.2)]
          `}>
            {gradeInfo.emoji}
          </div>

          {/* Trophy Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-white/50">
                ¡Trofeo Desbloqueado! · {gradeInfo.label}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/20 text-yellow-300 border border-yellow-400/30">
                +{trophy.xp_reward} XP
              </span>
            </div>
            <h4 className="font-semibold text-sm text-white truncate leading-tight mt-0.5">
              {trophy.title}
            </h4>
            <p className="text-xs text-white/70 truncate mt-0.5">
              {trophy.description}
            </p>
          </div>
        </div>
      ), {
        duration: 5000,
        position: 'top-center'
      })
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !isSubscribed) return

      const channel = supabase
        .channel(`trophies:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'user_achievements',
            filter: `user_id=eq.${user.id}`
          },
          async (payload) => {
            const achId = (payload.new as { achievement_id: string }).achievement_id
            const { data: ach } = await supabase
              .from('achievements')
              .select('*')
              .eq('id', achId)
              .single()

            if (ach) {
              showTrophyToast({
                id: ach.id,
                title: ach.title,
                description: ach.description,
                grade: ach.grade || 'bronze',
                xp_reward: ach.xp_reward || 50
              })
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })

    return () => {
      isSubscribed = false
    }
  }, [playTrophyUnlock])
}
