'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users } from 'lucide-react';

interface PlayerPresence {
  id: string;
  username: string;
  avatar_url?: string;
  game?: string;
  status: 'online' | 'playing' | 'idle';
}

const DEFAULT_MEMBERS: PlayerPresence[] = [
  { id: '1', username: 'Ariel', status: 'online', game: 'Laberinto Neón' },
  { id: '2', username: 'Dereck', status: 'playing', game: 'Conecta 4' },
  { id: '3', username: 'Mateo', status: 'online' },
];

export function OnlinePlayers() {
  const [players, setPlayers] = useState<PlayerPresence[]>(DEFAULT_MEMBERS);
  const [onlineCount, setOnlineCount] = useState<number>(3);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('presence:global', {
      config: { presence: { key: 'online-users' } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const activeUsers: PlayerPresence[] = [];

        Object.keys(state).forEach((key) => {
          const presences = state[key] as unknown as { user?: { id: string; username: string; avatar_url?: string } }[];
          presences.forEach((p, idx) => {
            if (p.user) {
              activeUsers.push({
                id: p.user.id || `${key}-${idx}`,
                username: p.user.username || 'Amigo',
                avatar_url: p.user.avatar_url,
                status: 'online',
              });
            }
          });
        });

        if (activeUsers.length > 0) {
          setPlayers(activeUsers);
          setOnlineCount(activeUsers.length);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 p-4 bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[20px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Jugadores En Línea
          </h4>
        </div>
        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {onlineCount}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
        {players.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="relative w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-sm">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt={p.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  p.username.charAt(0).toUpperCase()
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black" />
              </div>

              <div className="min-w-0">
                <span className="text-xs font-semibold text-white truncate block">
                  {p.username}
                </span>
                {p.game ? (
                  <span className="text-[10px] text-cyan-400 truncate block font-medium">
                    🎮 {p.game}
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400/80 block">
                    Conectado
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
