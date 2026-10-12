'use client'

import { X, Reply } from 'lucide-react'

interface ReplyBarProps {
  replyingTo: {
    id: string
    content: string
    profiles?: { nickname?: string }
  } | null
  onCancel: () => void
}

export function ReplyBar({ replyingTo, onCancel }: ReplyBarProps) {
  if (!replyingTo) return null

  return (
    <div className="flex items-center justify-between rounded-xl border border-fuchsia-500/30 bg-fuchsia-950/40 px-3.5 py-2 text-xs text-fuchsia-200 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150">
      <div className="flex items-center gap-2 overflow-hidden">
        <Reply className="h-4 w-4 shrink-0 text-fuchsia-400" />
        <span className="shrink-0 font-bold text-fuchsia-300">
          Respondiendo a @{replyingTo.profiles?.nickname || 'Usuario'}:
        </span>
        <span className="truncate italic text-zinc-300">
          &ldquo;{replyingTo.content}&rdquo;
        </span>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancelar respuesta"
        className="cursor-pointer ml-2 rounded-lg p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
