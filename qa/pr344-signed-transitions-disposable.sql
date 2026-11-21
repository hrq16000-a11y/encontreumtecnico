-- PR #344 / S3: ONLY fresh, unlinked Supabase on runner loopback.
-- Not a migration; NEVER execute against the official EUT project.
BEGIN;
CREATE TABLE public.pr344_signed_s3_leases (
  tab_hash text PRIMARY KEY CHECK (tab_hash ~ '^[0-9a-f]{64}$'),
  state text NOT NULL CHECK (state IN ('active','revoked')),
  issued_at timestamptz NOT NULL,
  hard_expires_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  last_beat_at timestamptz NOT NULL,
  purge_after timestamptz NOT NULL,
  CHECK (hard_expires_at = issued_at + interval '900 seconds'),
  CHECK (expires_at <= hard_expires_at),
  CHECK (purge_after >= hard_expires_at + interval '120 seconds')
);
CREATE INDEX pr344_signed_s3_expiry ON public.pr344_signed_s3_leases (expires_at)
  WHERE state = 'active';
CREATE INDEX pr344_signed_s3_purge ON public.pr344_signed_s3_leases (purge_after);
ALTER TABLE public.pr344_signed_s3_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pr344_signed_s3_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pr344_signed_s3_leases TO service_role;

-- The caller is the QA-only server adapter. It has ALREADY verified
-- the HMAC/absolute expiry; never expose this RPC to browsers.
CREATE FUNCTION public.pr344_signed_s3_apply(
  _op text,
  _tab_hash text,
  _issued_at timestamptz,
  _hard_expires_at timestamptz,
  _at timestamptz
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_state text;
  v_expires timestamptz;
  v_rows integer;
BEGIN
  IF _op NOT IN ('start','beat','leave')
    OR _tab_hash IS NULL OR _tab_hash !~ '^[0-9a-f]{64}$'
    OR _at IS NULL OR _issued_at IS NULL OR _hard_expires_at IS NULL
    OR _hard_expires_at <> _issued_at + interval '900 seconds' THEN
    RAISE EXCEPTION 'invalid QA transition' USING ERRCODE='22023';
  END IF;
  -- No transaction can revive an already expired absolute capability.
  IF _at >= _hard_expires_at THEN RETURN 'gone'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pr344-signed-s3:' || _tab_hash, 0)
  );

  IF _op = 'start' THEN
    SELECT l.state, l.expires_at INTO v_state, v_expires
      FROM public.pr344_signed_s3_leases AS l
     WHERE l.tab_hash = _tab_hash FOR UPDATE;
    IF FOUND THEN
      IF v_state = 'active' AND v_expires > _at THEN RETURN 'ok'; END IF;
      RETURN 'gone';
    END IF;
    INSERT INTO public.pr344_signed_s3_leases
      (tab_hash,state,issued_at,hard_expires_at,expires_at,last_beat_at,purge_after)
    VALUES (_tab_hash,'active',_issued_at,_hard_expires_at,
      pg_catalog.least(_at + interval '75 seconds', _hard_expires_at),
      _at,_hard_expires_at + interval '120 seconds');
    RETURN 'ok';
  END IF;

  IF _op = 'beat' THEN
    UPDATE public.pr344_signed_s3_leases
       SET expires_at = pg_catalog.least(_at + interval '75 seconds', _hard_expires_at),
           last_beat_at = _at
     WHERE tab_hash = _tab_hash AND state = 'active'
       AND issued_at = _issued_at AND hard_expires_at = _hard_expires_at
       AND expires_at > _at AND last_beat_at <= _at - interval '15 seconds';
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows > 0 THEN RETURN 'ok'; END IF;
    IF EXISTS (
      SELECT 1 FROM public.pr344_signed_s3_leases
       WHERE tab_hash = _tab_hash AND state = 'active'
         AND issued_at = _issued_at AND hard_expires_at = _hard_expires_at
         AND expires_at > _at
    ) THEN RETURN 'rate'; END IF;
    RETURN 'gone';
  END IF;

  -- A leave arriving BEFORE start still creates a monotonic tombstone.
  INSERT INTO public.pr344_signed_s3_leases AS l
    (tab_hash,state,issued_at,hard_expires_at,expires_at,last_beat_at,purge_after)
  VALUES (_tab_hash,'revoked',_issued_at,_hard_expires_at,
    pg_catalog.least(_at,_hard_expires_at),_at,
    pg_catalog.greatest(_hard_expires_at + interval '120 seconds',
                       _at + interval '120 seconds'))
  ON CONFLICT (tab_hash) DO UPDATE
    SET state = 'revoked',
        expires_at = pg_catalog.least(l.expires_at,excluded.expires_at),
        purge_after = pg_catalog.greatest(l.purge_after,excluded.purge_after)
    WHERE l.issued_at = excluded.issued_at
      AND l.hard_expires_at = excluded.hard_expires_at;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN 'gone'; END IF;
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION public.pr344_signed_s3_apply(
  text,text,timestamptz,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.pr344_signed_s3_apply(
  text,text,timestamptz,timestamptz,timestamptz) TO service_role;
COMMIT;
NOTIFY pgrst, 'reload schema';
