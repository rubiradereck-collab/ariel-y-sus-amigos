-- =====================================================================
-- ENTREGA 2 · MURO (no leídos, importantes, prefs) + MÚSICA (playlists, cola justa)
-- Idempotente. Ejecutar COMPLETO en el SQL Editor, DESPUÉS de ENTREGA_1_FIXES.sql.
-- Guardar/pegar como UTF-8.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. MURO · "no leídos desde tu última visita"
--    Tabla privada: el cliente NO la toca directo, solo vía RPC.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wall_reads (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wall_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wall_reads FROM authenticated, anon;

-- Devuelve {count, last_seen_at, first_visit}. En la 1ª visita count = 0 (no inundar con todo el historial).
CREATE OR REPLACE FUNCTION public.wall_unread()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_seen timestamptz; v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT last_seen_at INTO v_seen FROM public.wall_reads WHERE user_id = v_uid;
  IF v_seen IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'last_seen_at', NULL, 'first_visit', true);
  END IF;
  SELECT count(*) INTO v_count FROM public.posts WHERE created_at > v_seen AND author_id <> v_uid;
  RETURN jsonb_build_object('count', v_count, 'last_seen_at', v_seen, 'first_visit', false);
END $$;

CREATE OR REPLACE FUNCTION public.wall_mark_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.wall_reads (user_id, last_seen_at) VALUES (auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now();
END $$;

REVOKE ALL ON FUNCTION public.wall_unread(), public.wall_mark_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wall_unread(), public.wall_mark_seen() TO authenticated;

-- ---------------------------------------------------------------------
-- B. MURO · publicaciones "importantes" (para el correo) + preferencias
-- ---------------------------------------------------------------------
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS is_important boolean NOT NULL DEFAULT false;

-- Anti-spam: máx. 3 posts importantes por autor cada 24 h; el 4º se publica como normal (sin error).
CREATE OR REPLACE FUNCTION public.posts_limit_important()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_important AND (
       SELECT count(*) FROM public.posts
        WHERE author_id = NEW.author_id AND is_important AND created_at > now() - interval '24 hours'
     ) >= 3 THEN
    NEW.is_important := false;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_posts_limit_important ON public.posts;
CREATE TRIGGER trg_posts_limit_important BEFORE INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_limit_important();

CREATE TABLE IF NOT EXISTS public.notification_prefs (
  user_id         uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  email_important boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prefs propias lectura" ON public.notification_prefs;
DROP POLICY IF EXISTS "prefs propias alta"    ON public.notification_prefs;
DROP POLICY IF EXISTS "prefs propias cambio"  ON public.notification_prefs;
CREATE POLICY "prefs propias lectura" ON public.notification_prefs FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "prefs propias alta"    ON public.notification_prefs FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "prefs propias cambio"  ON public.notification_prefs FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE ON public.notification_prefs TO authenticated;

-- ---------------------------------------------------------------------
-- C. MÚSICA · cola con orden JUSTO (round-robin por usuario)
--    Con importación de playlists, una persona podría monopolizar la cola.
--    Orden: 1ª canción de cada usuario, luego 2ª de cada uno...; entre usuarios,
--    primero quien lleva más tiempo sin sonar.
-- ---------------------------------------------------------------------
ALTER TABLE public.music_queue DROP CONSTRAINT IF EXISTS music_queue_kind_check;
ALTER TABLE public.music_queue
  ADD CONSTRAINT music_queue_kind_check CHECK (kind IN ('youtube', 'audio', 'soundcloud'));

CREATE OR REPLACE VIEW public.music_queue_ranked WITH (security_invoker = true) AS
SELECT q.id, q.added_by, q.created_at,
       row_number() OVER (PARTITION BY q.added_by ORDER BY q.created_at) AS rn,
       (SELECT max(d.started_at) FROM public.music_queue d
         WHERE d.added_by = q.added_by AND d.status IN ('playing', 'done')) AS last_played
  FROM public.music_queue q
 WHERE q.status = 'queued';
GRANT SELECT ON public.music_queue_ranked TO authenticated;

-- Misma firma y mismo JSON que antes, solo cambia el ORDER BY.
CREATE OR REPLACE FUNCTION public.music_state()
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object(
    'server_now', (extract(epoch FROM clock_timestamp()) * 1000)::bigint,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id, 'title', q.title, 'url', q.url, 'kind', q.kind,
          'video_id', q.video_id, 'thumb', q.thumb, 'added_by', q.added_by,
          'added_name', coalesce(p.nickname, p.username), 'status', q.status,
          'started_at_ms', (extract(epoch FROM q.started_at) * 1000)::bigint,
          'votes', (SELECT count(*) FROM public.music_skip_votes v WHERE v.queue_id = q.id),
          'my_vote', EXISTS (SELECT 1 FROM public.music_skip_votes v WHERE v.queue_id = q.id AND v.user_id = auth.uid())
        )
        ORDER BY CASE q.status WHEN 'playing' THEN 0 ELSE 1 END,
                 r.rn, r.last_played NULLS FIRST, q.created_at
      )
      FROM public.music_queue q
      LEFT JOIN public.music_queue_ranked r ON r.id = q.id
      LEFT JOIN public.profiles p ON p.id = q.added_by
      WHERE q.status IN ('playing', 'queued')
    ), '[]'::jsonb)
  );
$$;

CREATE OR REPLACE FUNCTION public.music_advance(p_expected uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));

  UPDATE public.music_queue SET status = 'done' WHERE id = p_expected AND status = 'playing';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', true, 'advanced', false); END IF;

  UPDATE public.music_queue SET status = 'playing', started_at = clock_timestamp()
   WHERE id = (SELECT id FROM public.music_queue_ranked
                ORDER BY rn, last_played NULLS FIRST, created_at LIMIT 1);
  RETURN jsonb_build_object('ok', true, 'advanced', true);
END $$;

-- ---------------------------------------------------------------------
-- D. MÚSICA · alta MASIVA (playlists de YouTube) y borrado propio
--    Máx. 50 canciones por llamada y 50 en cola por usuario.
--    Las canciones inválidas se omiten (no abortan la importación).
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.music_add_many(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n int; v_pending int; v_has_playing boolean; v_base timestamptz;
  v_item jsonb; v_ord int := 0; v_added int := 0; v_skipped int := 0;
  v_kind text; v_url text; v_vid text; v_thumb text; v_title text; v_id uuid;
  v_ids uuid[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN RAISE EXCEPTION 'invalid_items'; END IF;
  v_n := jsonb_array_length(p_items);
  IF v_n = 0 OR v_n > 50 THEN RAISE EXCEPTION 'invalid_items'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext('music_queue'));
  SELECT count(*) INTO v_pending FROM public.music_queue WHERE added_by = v_uid AND status = 'queued';
  IF v_pending + v_n > 50 THEN RAISE EXCEPTION 'queue_limit'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.music_queue WHERE status = 'playing') INTO v_has_playing;
  v_base := clock_timestamp();

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_ord   := v_ord + 1;
    v_kind  := v_item->>'kind';
    v_url   := v_item->>'url';
    v_vid   := v_item->>'video_id';
    v_thumb := v_item->>'thumb';
    v_title := left(coalesce(nullif(trim(v_item->>'title'), ''), 'Sin título'), 120);

    IF v_kind NOT IN ('youtube', 'audio', 'soundcloud')
       OR v_url IS NULL OR v_url !~* '^https://' OR length(v_url) > 500
       OR (v_kind = 'youtube' AND (v_vid IS NULL OR v_vid !~ '^[A-Za-z0-9_-]{11}$')) THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF v_thumb IS NOT NULL AND (v_thumb !~* '^https://' OR length(v_thumb) > 300) THEN v_thumb := NULL; END IF;

    -- created_at escalonado 1 ms: now() es igual dentro de una transacción y rompería el orden de la playlist
    INSERT INTO public.music_queue (added_by, title, url, kind, video_id, thumb, status, started_at, created_at)
    VALUES (v_uid, v_title, v_url, v_kind, v_vid, v_thumb,
            CASE WHEN v_has_playing THEN 'queued' ELSE 'playing' END,
            CASE WHEN v_has_playing THEN NULL ELSE clock_timestamp() END,
            v_base + v_ord * interval '1 millisecond')
    RETURNING id INTO v_id;

    v_has_playing := true;
    v_added := v_added + 1;
    v_ids := v_ids || v_id;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'added', v_added, 'skipped', v_skipped, 'ids', to_jsonb(v_ids));
END $$;

-- music_add (1 canción) pasa a delegar en music_add_many; el límite sube de 5 a 50.
CREATE OR REPLACE FUNCTION public.music_add(
  p_title text, p_url text, p_kind text, p_video_id text, p_thumb text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_kind NOT IN ('youtube', 'audio', 'soundcloud') THEN RAISE EXCEPTION 'invalid_kind'; END IF;
  IF p_url IS NULL OR p_url !~* '^https://' OR length(p_url) > 500 THEN RAISE EXCEPTION 'invalid_url'; END IF;
  IF p_kind = 'youtube' AND (p_video_id IS NULL OR p_video_id !~ '^[A-Za-z0-9_-]{11}$') THEN
    RAISE EXCEPTION 'invalid_video';
  END IF;
  r := public.music_add_many(jsonb_build_array(jsonb_build_object(
         'title', p_title, 'url', p_url, 'kind', p_kind, 'video_id', p_video_id, 'thumb', p_thumb)));
  RETURN jsonb_build_object('ok', true, 'id', r->'ids'->>0);
END $$;

-- Quitar MIS canciones en cola (deshacer / limpiar una playlist importada por error).
CREATE OR REPLACE FUNCTION public.music_remove(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.music_queue SET status = 'done'
   WHERE id = p_id AND added_by = auth.uid() AND status = 'queued';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'removed', v_rows = 1);
END $$;

CREATE OR REPLACE FUNCTION public.music_clear_mine()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.music_queue SET status = 'done' WHERE added_by = auth.uid() AND status = 'queued';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'removed', v_rows);
END $$;

REVOKE ALL ON FUNCTION public.music_add_many(jsonb), public.music_remove(uuid), public.music_clear_mine()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.music_add_many(jsonb), public.music_remove(uuid), public.music_clear_mine(),
  public.music_add(text, text, text, text, text), public.music_advance(uuid), public.music_state()
  TO authenticated;

-- ---------------------------------------------------------------------
-- E. STORAGE · bucket opcional "music-tracks" (botón "Compartir al Jukebox"
--    sube un mp3 local y lo encola como kind='audio'). Mismo patrón {uid}/archivo.
--    OJO: el plan gratis de Supabase tiene 1 GB de Storage en total.
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('music-tracks', 'music-tracks', true, 20971520,
   ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/aac','audio/ogg'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE b text := 'music-tracks';
BEGIN
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' lectura');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' subida');
  EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', b || ' borrado');
  EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT USING (bucket_id = %L)', b || ' lectura', b);
  EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$, b || ' subida', b);
  EXECUTE format($f$CREATE POLICY %I ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)$f$, b || ' borrado', b);
END $$;
