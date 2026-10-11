'use client';

import { useCallback, useEffect, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export interface UserStats {
  user_id: string;
  coins: number;
  xp_total: number;
  level: number;
  xp_boost_until: string | null;
  xp_boost_mult: number;
  total_wagered: number;
  biggest_win: number;
}

/**
 * Saldo, XP y nivel del usuario actual, actualizados al instante vía Realtime.
 * Pasa tu cliente de Supabase del navegador (el mismo que ya usas en el proyecto).
 */
export function useUserStats(supabase: SupabaseClient) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (data) setStats(data as UserStats);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!auth.user) {
        setLoading(false);
        return;
      }
      const uid = auth.user.id;

      const { data } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (cancelled) return;
      if (data) setStats(data as UserStats);
      setLoading(false);

      channel = supabase
        .channel(`user_stats:${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_stats', filter: `user_id=eq.${uid}` },
          (payload) => {
            if (payload.new && 'coins' in payload.new) {
              setStats(payload.new as UserStats);
            }
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { stats, loading, refresh };
}

const RPC_ERRORS: Record<string, string> = {
  insufficient_funds: 'No tienes monedas suficientes.',
  already_owned: 'Ya tienes este artículo.',
  price_changed: 'El precio cambió, recarga la tienda.',
  item_not_found: 'Ese artículo ya no está disponible.',
  not_authenticated: 'Tu sesión expiró, vuelve a iniciar sesión.',
  invalid_bet: 'Apuesta inválida (mín. 10, máx. 100.000).',
  round_in_progress: 'Ya tienes una ronda en curso.',
  no_active_round: 'No hay ronda activa.',
};

export function rpcErrorMessage(message: string): string {
  const key = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return key ? RPC_ERRORS[key] : 'Ocurrió un error inesperado.';
}

export type BuyResult =
  | { ok: true; balance: number; itemId: string }
  | { ok: false; error: string };

/** Compra atómica: el servidor valida precio, saldo y duplicados. */
export async function buyShopItem(
  supabase: SupabaseClient,
  itemId: string,
  price: number
): Promise<BuyResult> {
  const { data, error } = await supabase.rpc('buy_shop_item', {
    p_item_id: itemId,
    p_price: price,
  });
  if (error) return { ok: false, error: rpcErrorMessage(error.message) };
  const res = data as { balance: number; item_id: string };
  return { ok: true, balance: res.balance, itemId: res.item_id };
}

export interface PlinkoResult {
  ok: true;
  path: number[]; // 8 valores 0 (izq) / 1 (der): la bola debe seguir esta trayectoria
  bin: number;
  multiplier: number;
  payout: number;
  balance: number;
}

export async function plinkoDrop(
  supabase: SupabaseClient,
  bet: number,
  risk: 'low' | 'medium' | 'high'
): Promise<PlinkoResult | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('plinko_drop', { p_bet: bet, p_risk: risk });
  if (error) return { ok: false, error: rpcErrorMessage(error.message) };
  return data as PlinkoResult;
}
