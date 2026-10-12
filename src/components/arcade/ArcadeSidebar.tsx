'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Gamepad2,
  Ghost,
  Swords,
  Skull,
  Brain,
  HelpCircle,
  Dices,
  Sparkles,
  ArrowLeft,
  Database,
  Film,
  Music,
  MessageSquare,
  Coins,
} from 'lucide-react';
import { OnlinePlayers } from '@/components/libres/OnlinePlayers';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const ARCADE_ITEMS: NavItem[] = [
  {
    name: 'Arcade Hub',
    href: '/arcade',
    icon: <Gamepad2 className="w-4 h-4" />,
  },
  {
    name: 'Juegos Libres',
    href: '/arcade/libres',
    icon: <Sparkles className="w-4 h-4 text-[#ff4d7a]" />,
    badge: '8 JUEGOS',
  },
  {
    name: 'La Culebrita (Snake)',
    href: '/arcade/snake',
    icon: <Ghost className="w-4 h-4 text-emerald-400" />,
  },
  {
    name: 'Tres en Raya (1v1)',
    href: '/arcade/tictactoe',
    icon: <Swords className="w-4 h-4 text-cyan-400" />,
  },
  {
    name: 'Five Nights (FNAF)',
    href: '/arcade/fnaf',
    icon: <Skull className="w-4 h-4 text-rose-500" />,
  },
  {
    name: 'Trivia del Grupo',
    href: '/arcade/trivia',
    icon: <Brain className="w-4 h-4 text-amber-400" />,
  },
  {
    name: '¿Quién dijo eso?',
    href: '/arcade/adivina',
    icon: <HelpCircle className="w-4 h-4 text-orange-400" />,
  },
  {
    name: 'Ruleta del Destino',
    href: '/arcade/ruleta',
    icon: <Dices className="w-4 h-4 text-purple-400" />,
  },
  {
    name: 'Aportar a la BD',
    href: '/arcade/aportar',
    icon: <Database className="w-4 h-4 text-blue-400" />,
  },
];

const PLATFORM_ITEMS: NavItem[] = [
  {
    name: 'Casino & Apuestas',
    href: '/apuestas',
    icon: <Coins className="w-4 h-4 text-amber-400" />,
  },
  {
    name: 'Chat & Salón',
    href: '/chat',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    name: 'WatchParty Cine',
    href: '/watchparty',
    icon: <Film className="w-4 h-4" />,
  },
  {
    name: 'Jukebox Música',
    href: '/musica',
    icon: <Music className="w-4 h-4" />,
  },
];

export function ArcadeSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full lg:w-64 flex flex-col gap-5 shrink-0">
      {/* Panel principal de navegación */}
      <div className="flex flex-col bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[20px] p-4 shadow-2xl">
        {/* Brand Header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff4d7a] to-[#7c3aed] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,77,122,0.5)] shrink-0">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black text-white tracking-wider flex items-center gap-1.5 truncate">
              <span>ZONA</span>
              <span className="text-[#ff4d7a]">ARCADE</span>
            </h1>
            <p className="text-[10px] text-[#b7a3ad] font-semibold uppercase tracking-wider truncate">
              Ariel y sus amigos
            </p>
          </div>
        </div>

        {/* Sección: Juegos Arcade */}
        <div className="mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#b7a3ad]/70 px-2.5 mb-1.5 block">
            Juegos Arcade
          </span>
          <nav className="flex flex-col gap-1">
            {ARCADE_ITEMS.map((item) => {
              const isActive =
                item.href === '/arcade'
                  ? pathname === '/arcade'
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer select-none ${
                    isActive
                      ? 'bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white shadow-[0_0_18px_rgba(255,77,122,0.4)] scale-[1.02]'
                      : 'text-[#b7a3ad] hover:text-[#f5eef2] hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {item.icon}
                    <span className="truncate">{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-white/20 text-white shrink-0 ml-1">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sección: Otras Zonas */}
        <div className="pt-2 border-t border-white/5 mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#b7a3ad]/70 px-2.5 mb-1.5 block">
            Otras Zonas
          </span>
          <nav className="flex flex-col gap-1">
            {PLATFORM_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-semibold text-xs text-[#b7a3ad] hover:text-[#f5eef2] hover:bg-white/[0.06] transition-all"
              >
                {item.icon}
                <span className="truncate">{item.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Botón Volver al Dashboard */}
        <div className="pt-3 border-t border-white/10">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-xl font-semibold text-xs text-[#b7a3ad] hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Dashboard</span>
          </Link>
        </div>
      </div>

      {/* Widget Presencia Jugadores */}
      <OnlinePlayers />
    </aside>
  );
}
