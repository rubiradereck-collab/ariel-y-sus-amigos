import React, { Suspense } from 'react';
import { GamePlayerView } from '@/components/libres/GamePlayerView';

export function generateStaticParams() {
  return [
    { slug: '2048' },
    { slug: 'buscaminas' },
    { slug: 'pong-neon' },
    { slug: 'memorama' },
    { slug: 'breakout' },
    { slug: 'conecta4' },
    { slug: 'sudoku' },
    { slug: 'laberinto-neon' },
  ];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function GamePlayerLoader({ params }: PageProps) {
  const { slug } = await params;
  return <GamePlayerView slug={slug} />;
}

export default function GameSlugPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-zinc-400 font-bold text-sm">
          Cargando juego...
        </div>
      }
    >
      <GamePlayerLoader params={params} />
    </Suspense>
  );
}
