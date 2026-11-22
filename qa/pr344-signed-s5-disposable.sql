-- PR #344 S5 — NEVER apply to official EUT. Only fresh, unlinked localhost
-- Supabase runner. Synthetic shared budgets plus minimal signed start leases.
BEGIN;
CREATE TABLE public.pr344_signed_s5_budgets (
  bucket_hash text PRIMARY KEY CHECK (bucket_hash ~ '^[0-9a-f]{64}$'),
  used integer NOT NULL CHECK (used BETWEEN 1 AND 5),
  purge_after timestamptz NOT NULL
);
ALTER TABLE public.pr344_signed_s5_budgets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_signed_s5_budgets FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_signed_s5_budgets TO service_role;

CREATE TABLE public.pr344_signed_s5_leases (
  tab_hash text PRIMARY KEY CHECK (tab_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('active','revoked')),
  issued_at timestamptz NOT NULL,
  hard_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  purge_after timestamptz NOT NULL,
  CHECK (hard_expires_at = issued_at + interval '900 seconds'),
  CHECK (expires_at <= hard_expires_at),
  CHECK (purge_after >= hard_expires_at + interval '120 seconds')
);
ALTER TABLE public.pr344_signed_s5_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_signed_s5_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_signed_s5_leases TO service_role;

-- Called ONLY from trusted synthetic server adapter with a verified HMAC
-- capability and a server-derived HMAC network/time bucket. Inputs are NOT
-- routed through browser-facing RPCs; EXECUTE restricted to service_role.
CREATE FUNCTION public.pr344_signed_s5_apply(
  _op text,
  _bucket_hash text,
  _tab_hash text,
  _issued_at timestamptz,
  _hard_expires_at timestamptz,
  _at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
  v_used integer;
  v_state text;
  v_expires timestamptz;
BEGIN
  IF _op NOT IN ('issue','start') OR
     _bucket_hash IS NULL OR _bucket_hash !~ '^[0-9a-f]{64}$' OR
     _at IS NULL THEN
    RAISE EXCEPTION 'bad isolated S5 operation' USING ERRCODE = '22023';
  END IF;

  IF _op = 'start' THEN
    IF _tab_hash IS NULL OR _tab_hash !~ '^[0-9a-f]{64}$' OR
       _issued_at IS NULL OR _hard_expires_at IS NULL OR
       _hard_expires_at <> _issued_at + interval '900 seconds' OR
       _at >= _hard_expires_at THEN
      RAISE EXCEPTION 'invalid signed start' USING ERRCODE = '22023';
    END IF;
    -- Lock tab FIRST. Repeated active start is a no-op even when network
    -- budget already exhausted; all hosts serialize the same tab hash.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('pr344-s5-tab:' || _tab_hash, 0)
    );
    SELECT l.state,l.expires_at INTO v_state,v_expires
      FROM public.pr344_signed_s5_leases AS l
      WHERE l.tab_hash = _tab_hash FOR UPDATE;
    IF FOUND THEN
      IF v_state = 'active' AND v_expires > _at THEN RETURN 'ok'; END IF;
      RETURN 'gone'; -- neither expired nor revoked epoch can restart
    END IF;
  ELSE
    IF _tab_hash IS NOT NULL OR _issued_at IS NOT NULL OR
       _hard_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'unexpected issue payload' USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Shared bucket lock across independently instantiated HTTP servers;
  -- a read-then-update counter in app memory is forbidden here.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pr344-s5-bucket:' || _bucket_hash, 0)
  );
  INSERT INTO public.pr344_signed_s5_budgets AS b
    (bucket_hash,used,purge_after)
  VALUES (_bucket_hash,1,_at + interval '2 minutes')
  ON CONFLICT (bucket_hash) DO UPDATE
    SET used = b.used + 1
    WHERE b.used < 5
  RETURNING used INTO v_used;
  IF v_used IS NULL THEN RETURN 'rate'; END IF;

  IF _op = 'start' THEN
    INSERT INTO public.pr344_signed_s5_leases
      (tab_hash,state,issued_at,hard_expires_at,expires_at,purge_after)
    VALUES (_tab_hash,'active',_issued_at,_hard_expires_at,
      least(_at + interval '75 seconds',_hard_expires_at),
      _hard_expires_at + interval '120 seconds');
  END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.pr344_signed_s5_apply(
  text,text,text,timestamptz,timestamptz,timestamptz
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pr344_signed_s5_apply(
  text,text,text,timestamptz,timestamptz,timestamptz
) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
