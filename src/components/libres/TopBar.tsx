'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Search, Bell, Coins, User } from 'lucide-react';

interface TopBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function TopBar({ searchQuery, onSearchChange }: TopBarProps) {
  const [username, setUsername] = useState<string>('Ariel');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coins, setCoins] = useState<number>(0);

  useEffect(() => {
    async function loadUserData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Cargar perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', user.id)
        .single();

      if (profile) {
        if (profile.username) setUsername(profile.username);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
      }

      // Cargar monedas
      const { data: stats } = await supabase
        .from('user_stats')
        .select('coins')
        .eq('user_id', user.id)
        .single();

      if (stats && stats.coins !== undefined) {
        setCoins(stats.coins);
      }
    }

    loadUserData();
  }, []);

  return (
    <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] p-4 shadow-xl">
      {/* Buscador */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#b7a3ad]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar minijuego (2048, Pong, Conecta 4...)"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-xs sm:text-sm text-white placeholder-[#b7a3ad] focus:outline-none focus:border-[#ff4d7a] focus:ring-1 focus:ring-[#ff4d7a] transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#b7a3ad] hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* Acciones y Perfil */}
      <div className="flex items-center justify-end gap-3 shrink-0">
        {/* Monedas del usuario */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold text-xs">
          <Coins className="w-4 h-4 text-amber-400" />
          <span>{coins.toLocaleString()}</span>
        </div>

        {/* Campana */}
        <button
          className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[#b7a3ad] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Notificaciones"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* Chip de Perfil */}
        <Link
          href="/profiles"
          className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors"
        >
          <div className="w-7 h-7 rounded-lg overflow-hidden bg-gradient-to-tr from-[#ff4d7a] to-[#7c3aed] flex items-center justify-center text-white text-xs font-bold">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={username}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
          </div>
          <span className="text-xs font-bold text-[#f5eef2] max-w-[100px] truncate hidden sm:inline">
            {username}
          </span>
        </Link>
      </div>
    </header>
  );
}
