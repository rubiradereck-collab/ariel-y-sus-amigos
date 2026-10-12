'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gamepad2,
  Dices,
  Ghost,
  MessageSquare,
  Film,
  Music,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { OnlinePlayers } from './OnlinePlayers';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: 'Juegos Libres',
    href: '/arcade/libres',
    icon: <Gamepad2 className="w-5 h-5" />,
    badge: 'NUEVO',
  },
  {
    name: 'Casino & Apuestas',
    href: '/apuestas',
    icon: <Dices className="w-5 h-5" />,
  },
  {
    name: 'Arcade Retro',
    href: '/arcade',
    icon: <Ghost className="w-5 h-5" />,
  },
  {
    name: 'Chat & Salón',
    href: '/chat',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    name: 'WatchParty Cine',
    href: '/watchparty',
    icon: <Film className="w-5 h-5" />,
  },
  {
    name: 'Jukebox Música',
    href: '/musica',
    icon: <Music className="w-5 h-5" />,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full lg:w-64 flex flex-col gap-6 shrink-0">
      {/* Panel principal de navegación */}
      <div className="flex flex-col bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] p-5 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-5 border-b border-white/10 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff4d7a] to-[#7c3aed] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,77,122,0.5)]">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-black text-white tracking-wider flex items-center gap-1.5">
              <span>ARCADE</span>
              <span className="text-[#ff4d7a]">LIBRE</span>
            </h1>
            <p className="text-[10px] text-[#b7a3ad] font-semibold uppercase tracking-wider">
              Ariel y sus amigos
            </p>
          </div>
        </div>

        {/* Links */}
        <nav className="flex flex-col gap-1.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white shadow-[0_0_20px_rgba(255,77,122,0.4)] scale-[1.02]'
                    : 'text-[#b7a3ad] hover:text-[#f5eef2] hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-sm">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Botón Volver al Portal */}
        <div className="pt-4 mt-4 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-semibold text-xs text-[#b7a3ad] hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Widget Presencia Jugadores */}
      <OnlinePlayers />

      {/* Tarjeta de anuncio o tip libre */}
      <div className="hidden lg:flex flex-col gap-2 p-4 bg-gradient-to-br from-purple-900/20 to-pink-900/20 border border-white/10 rounded-[20px] text-xs">
        <div className="flex items-center gap-1.5 text-[#ff8aa6] font-bold">
          <Sparkles className="w-4 h-4" />
          <span>100% Juegos Libres</span>
        </div>
        <p className="text-[11px] text-[#b7a3ad] leading-relaxed">
          Sin descargas, sin apuestas y sin anuncios. Juega al instante con tus amigos.
        </p>
      </div>
    </aside>
  );
}
