'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';
import { DEFAULT_GAMES } from '@/lib/libres/queries';
import {
  Gamepad2,
  Sparkles,
  Ghost,
  Swords,
  Skull,
  Brain,
  HelpCircle,
  Dices,
  Database,
  Play,
  Flame,
  Users,
  Search,
} from 'lucide-react';

interface ArcadeGame {
  id: string;
  title: string;
  category: 'libres' | 'competitivo' | 'retro' | 'comunidad';
  categoryLabel: string;
  description: string;
  href: string;
  cover: string;
  badge?: string;
  players: string;
  accentColor: string;
  isHot?: boolean;
}

const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'libres',
    title: 'Juegos Libres (Colección Friv)',
    category: 'libres',
    categoryLabel: 'Minijuegos',
    description: '8 minijuegos neón instantáneos en HTML5: 2048, Pong, Conecta 4, Buscaminas, Sudoku, Laberinto y más.',
    href: '/arcade/libres',
    cover: '/games/laberinto-neon-cover.svg',
    badge: '8 EN 1',
    players: 'Solo & 2P',
    accentColor: 'from-[#ff4d7a] to-[#a855f7]',
    isHot: true,
  },
  {
    id: 'snake',
    title: 'La Culebrita (Snake)',
    category: 'retro',
    categoryLabel: 'Retro Arcade',
    description: 'Come manzanas láser, esquiva tu cola y bate el récord grupal para ganar monedas y XP.',
    href: '/arcade/snake',
    cover: 'https://images.unsplash.com/photo-1628277613967-6abca504d0ac?q=80&w=1200&auto=format&fit=crop',
    badge: 'LEADERBOARD',
    players: 'Solo Arcade',
    accentColor: 'from-emerald-500 to-teal-700',
    isHot: true,
  },
  {
    id: 'tictactoe',
    title: 'Tres en Raya (1v1 & Bot)',
    category: 'competitivo',
    categoryLabel: 'Competitivo',
    description: 'Enfrenta a la IA Minimax invicta o crea una sala en tiempo real para retar a tus amigos del grupo.',
    href: '/arcade/tictactoe',
    cover: 'https://images.unsplash.com/photo-1668901382969-8c73e450a1f5?q=80&w=1200&auto=format&fit=crop',
    badge: 'MULTIJUGADOR',
    players: '1v1 / vs Bot',
    accentColor: 'from-cyan-500 to-blue-700',
    isHot: true,
  },
  {
    id: 'fnaf',
    title: 'Five Nights at Arcade',
    category: 'retro',
    categoryLabel: 'Supervivencia',
    description: 'Sobrevive la noche vigilando las puertas de seguridad y administrando tu energía eléctrica.',
    href: '/arcade/fnaf',
    cover: 'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?q=80&w=1200&auto=format&fit=crop',
    badge: 'SURVIVAL',
    players: 'Solo Survival',
    accentColor: 'from-rose-600 to-red-950',
    isHot: false,
  },
  {
    id: 'trivia',
    title: 'Trivia del Grupo',
    category: 'competitivo',
    categoryLabel: 'Trivia & Retos',
    description: 'Demuestra cuánto conoces al grupo y a sus integrantes en este desafío con preguntas reales.',
    href: '/arcade/trivia',
    cover: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?q=80&w=1200&auto=format&fit=crop',
    badge: 'PREGUNTAS',
    players: 'Competitivo',
    accentColor: 'from-amber-500 to-orange-700',
    isHot: false,
  },
  {
    id: 'adivina',
    title: '¿Quién dijo eso?',
    category: 'comunidad',
    categoryLabel: 'Comunidad',
    description: 'El museo de frases fuera de contexto del grupo. Adivina qué amigo dijo cada frase célebre.',
    href: '/arcade/adivina',
    cover: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=1200&auto=format&fit=crop',
    badge: 'FRASES',
    players: 'Multijugador',
    accentColor: 'from-orange-500 to-pink-700',
    isHot: false,
  },
  {
    id: 'ruleta',
    title: 'Ruleta del Destino',
    category: 'retro',
    categoryLabel: 'Aleatorio',
    description: 'Decide equipos, castigos, retos o turnos girando la ruleta con los nombres de todos los amigos.',
    href: '/arcade/ruleta',
    cover: 'https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=1200&auto=format&fit=crop',
    badge: 'RULETA',
    players: '1-6 Jugadores',
    accentColor: 'from-purple-600 to-indigo-950',
    isHot: false,
  },
];

type CategoryFilter = 'todos' | 'libres' | 'competitivo' | 'retro' | 'comunidad';

const CATEGORIES: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'todos', label: 'Todos los Juegos', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'libres', label: 'Minijuegos Libres (8)', icon: <Sparkles className="w-4 h-4 text-[#ff4d7a]" /> },
  { id: 'competitivo', label: 'Competitivos & 1v1', icon: <Swords className="w-4 h-4 text-cyan-400" /> },
  { id: 'retro', label: 'Retro & Supervivencia', icon: <Ghost className="w-4 h-4 text-emerald-400" /> },
  { id: 'comunidad', label: 'Comunidad & Retos', icon: <Users className="w-4 h-4 text-amber-400" /> },
];

export default function ArcadeMainPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrado de juegos
  const filteredGames = useMemo(() => {
    return ARCADE_GAMES.filter((game) => {
      if (selectedCategory !== 'todos' && game.category !== selectedCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = game.title.toLowerCase().includes(q);
        const matchesDesc = game.description.toLowerCase().includes(q);
        const matchesCat = game.categoryLabel.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesCat) return false;
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <ArcadeLayout searchQuery={searchQuery} onSearchChange={setSearchQuery}>
      {/* Hero Banner Destacado estilo Gamer Dashboard */}
      <div className="relative w-full rounded-[24px] overflow-hidden border border-white/10 bg-black/40 shadow-2xl backdrop-blur-md group">
        <div className="relative h-[260px] sm:h-[320px] md:h-[360px] w-full overflow-hidden">
          <Image
            src="/games/laberinto-neon-cover.svg"
            alt="Arcade Ariel y sus amigos"
            fill
            priority
            sizes="100vw"
            className="object-cover group-hover:scale-105 transition-transform duration-700"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#14070f] via-[#14070f]/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#14070f] via-[#14070f]/40 to-transparent" />

          <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end max-w-2xl z-10">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-[#ff4d7a] to-[#7c3aed] text-white shadow-[0_0_15px_rgba(255,77,122,0.5)]">
                <Flame className="w-3.5 h-3.5 fill-white" />
                <span>Zona Gamer Oficial</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/10 text-white/80 border border-white/10 backdrop-blur-md">
                15+ Minijuegos
              </span>
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-2 drop-shadow-md">
              ARCADE & MINIJUEGOS
            </h1>

            <p className="text-xs sm:text-sm text-[#f5eef2]/80 line-clamp-2 max-w-xl mb-4 sm:mb-6 leading-relaxed">
              Juegos libres estilo Friv sin descargas, duelos de Tres en Raya 1v1 con IA, tabla de clasificación en Snake, desafíos de supervivencia y retos del grupo.
            </p>

            <div className="flex items-center gap-3">
              <Link
                href="/arcade/libres"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm font-extrabold uppercase tracking-wider text-white bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] hover:brightness-110 shadow-[0_0_25px_rgba(255,77,122,0.6)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Explorar Juegos Libres</span>
              </Link>
              <Link
                href="/arcade/snake"
                className="inline-flex items-center gap-2 px-4 py-3 rounded-full text-xs font-bold text-[#b7a3ad] hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 transition-colors"
              >
                <span>Jugar Snake</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Chips de Categorías */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#ff4d7a] to-[#e8365d] text-white shadow-[0_0_15px_rgba(255,77,122,0.4)] scale-[1.02]'
                  : 'bg-white/[0.05] hover:bg-white/[0.1] text-[#b7a3ad] hover:text-[#f5eef2] border border-white/5 hover:border-white/10'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Grid Principal de Juegos Arcade */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGames.map((game) => (
          <Link
            key={game.id}
            href={game.href}
            className="group flex flex-col bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-[#ff4d7a]/50 rounded-[22px] overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_12px_32px_rgba(255,77,122,0.2)]"
          >
            {/* Imagen de Portada */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
              <Image
                src={game.cover}
                alt={game.title}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform duration-500"
                unoptimized={game.cover.endsWith('.svg')}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#14070f] via-transparent to-black/30 pointer-events-none" />

              {/* Badges superiores */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-white/20 bg-black/60 backdrop-blur-md text-white">
                  {game.categoryLabel}
                </span>
                {game.badge && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-[#ff4d7a] to-[#7c3aed] text-white shadow-md">
                    {game.badge}
                  </span>
                )}
              </div>

              <div className="absolute top-3 right-3 z-10 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 backdrop-blur-md border border-white/15 text-white/90">
                {game.players}
              </div>

              {/* Overlay Hover Jugar */}
              <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#ff4d7a] to-[#e8365d] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,77,122,0.8)] transform scale-90 group-hover:scale-100 transition-transform">
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-col flex-1 p-5 justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-[#ff8aa6] transition-colors truncate">
                  {game.title}
                </h3>
                <p className="text-xs text-[#b7a3ad] line-clamp-2 mt-1 leading-relaxed">
                  {game.description}
                </p>
              </div>

              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-[#b7a3ad] font-semibold text-[11px]">
                  {game.category === 'libres' ? '⚡ 8 Minijuegos integrados' : '🕹️ Juego nativo'}
                </span>
                <span className="font-extrabold text-[#ff4d7a] group-hover:text-[#ff8aa6] transition-colors flex items-center gap-1">
                  <span>JUGAR</span>
                  <span>→</span>
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Fila Especial: Catálogo Rápido de Juegos Libres */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#ff4d7a]" />
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              Colección Rápida de Minijuegos Libres
            </h2>
          </div>
          <Link
            href="/arcade/libres"
            className="text-xs font-bold text-[#ff4d7a] hover:text-[#ff8aa6] transition-colors flex items-center gap-1"
          >
            <span>Ver todos los 8 juegos</span>
            <span>→</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {DEFAULT_GAMES.map((game) => (
            <Link
              key={game.slug}
              href={`/arcade/libres/${game.slug}`}
              className="group flex flex-col items-center bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-[#ff4d7a]/50 rounded-2xl p-2.5 transition-all text-center"
            >
              <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-black/40 mb-2">
                <Image
                  src={game.cover_url}
                  alt={game.title}
                  fill
                  sizes="120px"
                  className="object-cover group-hover:scale-110 transition-transform"
                  unoptimized={game.cover_url.endsWith('.svg')}
                />
              </div>
              <span className="text-[11px] font-bold text-white group-hover:text-[#ff8aa6] truncate w-full">
                {game.title}
              </span>
              <span className="text-[9px] text-[#b7a3ad] uppercase font-semibold">
                {game.category}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* Banner de Aporte Comunitario */}
      <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 sm:p-8 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-4 text-left">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
            <Database className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-black text-white">
              Base de Datos Comunitaria
            </h3>
            <p className="text-xs sm:text-sm text-[#b7a3ad] mt-1">
              ¿Tienes una frase icónica de un amigo o una pregunta de trivia? Añádela directamente a la base de datos de los minijuegos.
            </p>
          </div>
        </div>

        <Link
          href="/arcade/aportar"
          className="px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 shadow-lg shadow-blue-500/20 whitespace-nowrap shrink-0 transition-all cursor-pointer"
        >
          Aportar Frases & Preguntas
        </Link>
      </div>
    </ArcadeLayout>
  );
}
