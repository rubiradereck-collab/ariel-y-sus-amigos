'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Users, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ArcadeLayout } from '@/components/arcade/ArcadeLayout';
import { createClient } from '@/lib/supabase/client';
import { TttBoard } from '@/components/arcade/TttBoard';
import { TttGame } from '@/types/entrega3';

export default function TicTacToePvPGamePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400 font-bold">
          Cargando partida...
        </div>
      }
    >
      <TicTacToePvPContent />
    </Suspense>
  );
}

function TicTacToePvPContent() {
  const params = useParams();
  const gameId = (params?.id as string) || '';

  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [game, setGame] = useState<TttGame | null>(null);
  const [moving, setMoving] = useState<boolean>(false);

  // Obtener usuario actual
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, [supabase]);

  // Cargar estado de la partida
  const fetchGame = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ttt_games')
        .select('*')
        .eq('id', gameId)
        .single();
      if (!error && data) {
        setGame(data as TttGame);
      }
    } catch {
      // Ignorar
    }
  }, [supabase, gameId]);

  useEffect(() => {
    void fetchGame();

    // Suscribirse a cambios Realtime en esta partida
    const channel = supabase
      .channel(`ttt-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ttt_games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          if (payload.new) {
            setGame(payload.new as TttGame);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, gameId, fetchGame]);

  const handleCellClick = async (cellIndex: number) => {
    if (moving || !game || game.status !== 'playing') return;
    if (game.turn_user !== userId) {
      toast.info('Es el turno de tu oponente');
      return;
    }

    setMoving(true);
    try {
      const { data, error } = await supabase.rpc('ttt_move', {
        p_id: gameId,
        p_pos: cellIndex + 1,
      });
      if (error) {
        toast.error(`Movimiento inválido: ${error.message}`);
      } else if (data) {
        setGame(data as TttGame);
      }
    } catch {
      toast.error('Error al realizar jugada');
    } finally {
      setMoving(false);
    }
  };

  const isHost = userId && game && game.host_id === userId;
  const isGuest = userId && game && game.guest_id === userId;
  const mySymbol = isHost ? 'X' : isGuest ? 'O' : undefined;
  const isMyTurn = game && game.turn_user === userId && game.status === 'playing';

  return (
    <ArcadeLayout>
      <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
        {/* Barra superior */}
        <div className="flex items-center justify-between bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-xl">
          <Link
            href="/arcade/tictactoe"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-xs font-bold text-zinc-300 hover:text-white border border-white/10 transition-all"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Lobby
          </Link>
          <span className="text-xs text-zinc-400 font-mono">
            SALA #{gameId.slice(0, 8)}
          </span>
        </div>

        {/* Título */}
        <div className="text-center py-2">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            PARTIDA 1V1 EN TIEMPO REAL
          </h1>
        </div>

        {game && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-6 shadow-2xl backdrop-blur-xl">
            {/* Estado de la Partida */}
            {game.status === 'waiting' && (
              <div className="py-8 text-center space-y-3">
                <div className="mx-auto flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-300">
                  <Users className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-black text-white">Esperando a tu oponente…</h2>
                <p className="text-xs text-zinc-400">
                  Comparte el enlace de esta sala con tu amigo para que se una a jugar.
                </p>
              </div>
            )}

            {game.status === 'playing' && (
              <div className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-sm font-black text-indigo-300">
                    X
                  </span>
                  <span className="text-xs font-bold text-white">
                    {isHost ? 'Tú (Host)' : 'Rival (Host)'}
                  </span>
                </div>

                <div className="rounded-full bg-cyan-500/20 px-3.5 py-1 text-xs font-black text-cyan-300">
                  {isMyTurn ? '👉 Tu Turno' : '⏳ Turno del Rival'}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {isGuest ? 'Tú (Rival)' : 'Rival'}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-sm font-black text-cyan-400">
                    O
                  </span>
                </div>
              </div>
            )}

            {game.status === 'finished' && (
              <div className="mb-6 rounded-2xl border-2 border-yellow-500/40 bg-yellow-500/10 p-5 text-center">
                <h3 className="text-xl font-black uppercase text-yellow-300">
                  {game.is_draw
                    ? '🤝 ¡EMPATE / TABLAS!'
                    : game.winner === userId
                      ? '🎉 ¡VICTORIA!'
                      : '💀 DERROTA'}
                </h3>
                <div className="mt-3">
                  <Link
                    href="/arcade/tictactoe"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" /> Volver al Lobby
                  </Link>
                </div>
              </div>
            )}

            {/* Tablero */}
            <TttBoard
              board={game.board}
              onCellClick={handleCellClick}
              disabled={game.status !== 'playing' || !isMyTurn || moving}
              mySymbol={mySymbol}
            />
          </div>
        )}
      </div>
    </ArcadeLayout>
  );
}
