'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MainLayout } from '@/components/layout/MainLayout';
import { DEFAULT_GAMES } from '@/lib/libres/queries';
import {
  Gamepad2,
  Sparkles,
  Ghost,
  Swords,
  Play,
  Users,
  Search,
  Database,
  Trophy,
} from 'lucide-react';

interface ArcadeGame {
  id: string;
  title: string;
  category: 'libres' | 'competitivo' | 'retro' | 'comunidad';
  categoryLabel: string;
  description: string;
  href: string;
  cover: string;
  badge: string;
  players: string;
}

const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'libres',
    title: 'Juegos Libres (Colección Friv)',
    category: 'libres',
    categoryLabel: 'Minijuegos',
    description: '8 minijuegos instantáneos en HTML5: 2048, Pong, Conecta 4, Buscaminas, Sudoku, Laberinto y más sin descargas.',
    href: '/arcade/libres',
    cover: '/games/laberinto-neon-cover.svg',
    badge: '8 EN 1',
    players: 'Solo & 2P',
  },
  {
    id: 'snake',
    title: 'La Culebrita (Snake)',
    category: 'retro',
    categoryLabel: 'Retro Clásico',
    description: 'Come manzanas láser, esquiva tu cola y bate el récord grupal para ganar monedas y subir en el ranking.',
    href: '/arcade/snake',
    cover: '/games/snake-cover.svg',
    badge: 'RANKING',
    players: 'Solo Arcade',
  },
  {
    id: 'tictactoe',
    title: 'Tres en Raya (1v1 & Bot)',
    category: 'competitivo',
    categoryLabel: 'Duelo 1v1',
    description: 'Enfrenta a la IA Minimax invicta o crea una sala en tiempo real para retar a tus amigos del grupo.',
    href: '/arcade/tictactoe',
    cover: '/games/tictactoe-cover.svg',
    badge: 'ONLINE',
    players: '1v1 / vs Bot',
  },
  {
    id: 'fnaf',
    title: 'Five Nights at Arcade',
    category: 'retro',
    categoryLabel: 'Supervivencia',
    description: 'Sobrevive la noche en la cabina de seguridad cerrando puertas y administrando tu batería hasta las 6 AM.',
    href: '/arcade/fnaf',
    cover: '/games/fnaf-cover.svg',
    badge: 'SURVIVAL',
    players: 'Solo Survival',
  },
  {
    id: 'trivia',
    title: 'Trivia del Grupo',
    category: 'competitivo',
    categoryLabel: 'Trivia & Retos',
    description: 'Demuestra cuánto conoces anécdotas, gustos y secretos de los integrantes del grupo con preguntas reales.',
    href: '/arcade/trivia',
    cover: '/games/trivia-cover.svg',
    badge: 'XP EXTRA',
    players: 'Competitivo',
  },
  {
    id: 'adivina',
    title: '¿Quién dijo eso?',
    category: 'comunidad',
    categoryLabel: 'Comunidad',
    description: 'El museo de frases fuera de contexto del grupo. Adivina qué amigo dijo cada frase mítica.',
    href: '/arcade/adivina',
    cover: '/games/adivina-cover.svg',
    badge: 'FRASES',
    players: 'Multijugador',
  },
  {
    id: 'ruleta',
    title: 'Ruleta del Destino',
    category: 'retro',
    categoryLabel: 'Aleatorio',
    description: 'Decide equipos, retos, turnos o sacrificios girando la ruleta con los nombres de todos los panas.',
    href: '/arcade/ruleta',
    cover: '/games/ruleta-cover.svg',
    badge: 'SUERTE',
    players: '1-6 Jugadores',
  },
];

type CategoryFilter = 'todos' | 'libres' | 'competitivo' | 'retro' | 'comunidad';

const CATEGORIES: { id: CategoryFilter; label: string; icon: React.ReactNode }[] = [
  { id: 'todos', label: 'Todos los Juegos', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'libres', label: 'Juegos Libres (8)', icon: <Sparkles className="w-4 h-4 text-cyan-400" /> },
  { id: 'competitivo', label: 'Competitivos 1v1', icon: <Swords className="w-4 h-4 text-sky-400" /> },
  { id: 'retro', label: 'Retro Clásicos', icon: <Ghost className="w-4 h-4 text-emerald-400" /> },
  { id: 'comunidad', label: 'Comunidad & Retos', icon: <Users className="w-4 h-4 text-amber-400" /> },
];

export default function ArcadeMainPage() {
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('todos');
  const [searchQuery, setSearchQuery] = useState('');

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
    <MainLayout>
      <div className="w-full min-h-screen px-4 sm:px-8 pt-6 pb-28 max-w-7xl mx-auto flex flex-col gap-8 text-white">
        
        {/* Header PS5 con buscador integrado */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-extrabold uppercase tracking-widest">
                PlayStation Hub
              </span>
              <span className="text-zinc-500 text-xs font-semibold">15+ Experiencias</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white mt-1">
              ARCADE ZONE
            </h1>
            <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-xl">
              Minijuegos casuales, duelos 1v1 y desafíos de habilidad integrados en la consola.
            </p>
          </div>

          {/* Buscador de consola */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar juego..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Hero Banner Panorámico estilo PS5 Tile */}
        <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-zinc-950/80 shadow-2xl group">
          <div className="relative h-[240px] sm:h-[300px] md:h-[340px] w-full">
            <Image
              src="/games/laberinto-neon-cover.svg"
              alt="Arcade Juegos Libres"
              fill
              priority
              sizes="100vw"
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent" />

            <div className="absolute inset-0 p-6 sm:p-10 flex flex-col justify-end max-w-2xl z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 text-white backdrop-blur-md">
                  Destacado
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  8 Minijuegos Libres
                </span>
              </div>

              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight uppercase mb-2">
                COLECCIÓN DE JUEGOS LIBRES
              </h2>

              <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 max-w-lg mb-5 leading-relaxed">
                Juega al instante 2048, Pong, Conecta 4, Buscaminas, Sudoku, Rompeladrillos y más directamente en tu navegador, sin descargas ni anuncios.
              </p>

              <div className="flex items-center gap-3">
                <Link
                  href="/arcade/libres"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-xs font-black uppercase tracking-wider text-black bg-white hover:bg-zinc-200 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>Jugar Ahora</span>
                </Link>
                <Link
                  href="/arcade/snake"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-white/10 transition-colors"
                >
                  <span>Probar Snake</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Categorías estilo Filtros de Consola */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
                  isActive
                    ? 'bg-white text-black shadow-lg shadow-white/10 scale-[1.02]'
                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grid Principal de Tarjetas PS5 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGames.map((game) => (
            <Link
              key={game.id}
              href={game.href}
              className="group flex flex-col bg-zinc-900/50 hover:bg-zinc-900/90 border border-white/10 hover:border-white/30 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
            >
              {/* Carátula Local 16:10 */}
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/60">
                <Image
                  src={game.cover}
                  alt={game.title}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-black/30 pointer-events-none" />

                {/* Badges de Consola */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-white/15 bg-black/70 backdrop-blur-md text-zinc-200">
                    {game.categoryLabel}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white/20 text-white backdrop-blur-md">
                    {game.badge}
                  </span>
                </div>

                <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 border border-white/10 text-zinc-300">
                  {game.players}
                </div>

                {/* Hover Play Button */}
                <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-black ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Info de la Tarjeta */}
              <div className="flex flex-col flex-1 p-5 justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                    {game.title}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                  <span className="text-zinc-500 text-[11px] font-semibold">
                    {game.category === 'libres' ? '⚡ 8 Minijuegos' : '🕹️ Juego nativo'}
                  </span>
                  <span className="font-bold text-white group-hover:text-cyan-400 transition-colors flex items-center gap-1">
                    <span>Jugar</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Shelf de Juegos Libres (Fila Rápida estilo Consola) */}
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h2 className="text-lg font-black text-white uppercase tracking-wide">
                Minijuegos Libres Integrados (Friv)
              </h2>
            </div>
            <Link
              href="/arcade/libres"
              className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1"
            >
              <span>Ver catálogo completo</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {DEFAULT_GAMES.map((game) => (
              <Link
                key={game.slug}
                href={`/arcade/libres/${game.slug}`}
                className="group flex flex-col items-center bg-zinc-900/50 hover:bg-zinc-800/80 border border-white/5 hover:border-white/20 rounded-xl p-2.5 transition-all text-center"
              >
                <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-black/60 mb-2">
                  <Image
                    src={game.cover_url}
                    alt={game.title}
                    fill
                    sizes="120px"
                    className="object-cover group-hover:scale-105 transition-transform"
                    unoptimized
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-200 group-hover:text-white truncate w-full">
                  {game.title}
                </span>
                <span className="text-[9px] text-zinc-500 uppercase font-semibold">
                  {game.category}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Banner de Base de Datos Comunitaria */}
        <div className="bg-zinc-900/60 border border-white/10 p-6 sm:p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                Base de Datos Comunitaria
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Añade frases célebres de los amigos o preguntas de trivia para que salgan en los minijuegos.
              </p>
            </div>
          </div>

          <Link
            href="/arcade/aportar"
            className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-blue-600 hover:bg-blue-500 shadow-md whitespace-nowrap shrink-0 transition-all cursor-pointer"
          >
            Aportar Frases & Trivia
          </Link>
        </div>

      </div>
    </MainLayout>
  );
}
