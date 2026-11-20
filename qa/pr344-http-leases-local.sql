-- PR #344: ONLY a fresh disposable Supabase localhost in GitHub Actions.
-- NEVER run on official EUT, even for inspection. Synthetic schema prefix.
BEGIN;

CREATE TABLE public.pr344_http_synthetic_roles (
  user_id uuid PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin','tecnico'))
);
ALTER TABLE public.pr344_http_synthetic_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_http_synthetic_roles FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_http_synthetic_roles TO service_role;

CREATE TABLE public.pr344_http_synthetic_leases (
  tab_hash text PRIMARY KEY CHECK (tab_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('active','revoked')),
  expires_at timestamptz NOT NULL,
  purge_after timestamptz NOT NULL,
  last_beat_at timestamptz NOT NULL
);
CREATE INDEX pr344_http_leases_active_expiry
  ON public.pr344_http_synthetic_leases (expires_at) WHERE state = 'active';
CREATE INDEX pr344_http_leases_purge
  ON public.pr344_http_synthetic_leases (purge_after);
ALTER TABLE public.pr344_http_synthetic_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_http_synthetic_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_http_synthetic_leases TO service_role;

-- Anonymous public requests are throttled by a *server-hashed* ephemeral
-- network/time bucket, not by raw IP persisted in the presence table.
CREATE TABLE public.pr344_http_synthetic_budgets (
  bucket_hash text PRIMARY KEY CHECK (bucket_hash ~ '^[0-9a-f]{64}$'),
  used integer NOT NULL CHECK (used BETWEEN 1 AND 5),
  purge_after timestamptz NOT NULL
);
ALTER TABLE public.pr344_http_synthetic_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_http_synthetic_budgets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_http_synthetic_budgets TO service_role;

-- All transitions run in the SAME Postgres transaction. SECURITY INVOKER
-- and EXECUTE ONLY for service_role; not a public SECURITY DEFINER escape.
CREATE FUNCTION public.pr344_http_synthetic_apply(
  _op text, _tab_hash text, _bucket_hash text, _at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_used integer;
  v_rows integer;
BEGIN
  IF _at IS NULL OR _tab_hash !~ '^[0-9a-f]{64}$'
    OR _op NOT IN ('start','beat','leave') THEN
    RAISE EXCEPTION 'invalid synthetic lease transition' USING ERRCODE = '22023';
  END IF;

  IF _op = 'start' THEN
    IF _bucket_hash IS NULL OR _bucket_hash !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION 'invalid synthetic budget' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.pr344_http_synthetic_budgets AS b (bucket_hash, used, purge_after)
    VALUES (_bucket_hash, 1, _at + interval '2 minutes')
    ON CONFLICT (bucket_hash) DO UPDATE
      SET used = b.used + 1
      WHERE b.used < 5
    RETURNING used INTO v_used;
    IF v_used IS NULL THEN RETURN 'rate'; END IF;

    INSERT INTO public.pr344_http_synthetic_leases AS l
      (tab_hash, state, expires_at, purge_after, last_beat_at)
    VALUES (_tab_hash, 'active', _at + interval '75 seconds',
            _at + interval '75 seconds', _at)
    ON CONFLICT (tab_hash) DO UPDATE
      SET expires_at = greatest(l.expires_at, excluded.expires_at),
          purge_after = greatest(l.purge_after, excluded.purge_after)
      WHERE l.state = 'active' AND l.expires_at > _at;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN RETURN 'gone'; END IF;
    RETURN 'ok';
  END IF;

  IF _op = 'beat' THEN
    UPDATE public.pr344_http_synthetic_leases
       SET expires_at = _at + interval '75 seconds',
           purge_after = _at + interval '75 seconds',
           last_beat_at = _at
     WHERE tab_hash = _tab_hash
       AND state = 'active'
       AND expires_at > _at
       AND last_beat_at <= _at - interval '15 seconds';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN RETURN 'ok'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.pr344_http_synthetic_leases
       WHERE tab_hash = _tab_hash AND state = 'active' AND expires_at > _at
    ) THEN RETURN 'rate'; END IF;
    RETURN 'gone';
  END IF;

  -- A leave that arrives BEFORE start still writes a tombstone. Late start
  -- or beat may NOT revive it. A fresh consent epoch uses a new tabToken.
  INSERT INTO public.pr344_http_synthetic_leases AS l
    (tab_hash, state, expires_at, purge_after, last_beat_at)
  VALUES (_tab_hash, 'revoked', _at,
          _at + interval '120 seconds', _at)
  ON CONFLICT (tab_hash) DO UPDATE
    SET state = 'revoked',
        expires_at = least(l.expires_at, excluded.expires_at),
        purge_after = greatest(l.purge_after, excluded.purge_after);
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.pr344_http_synthetic_apply(text,text,text,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pr344_http_synthetic_apply(text,text,text,timestamptz)
  TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
