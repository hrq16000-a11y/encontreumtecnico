-- EUT referral spotlight: a bounded, public-ID-only derived ranking signal.
-- No monetary commissions, no names, emails, phone numbers or invitee IDs exposed.
BEGIN;
CREATE INDEX IF NOT EXISTS eut_technician_referrals_inviter_idx
  ON public.eut_technician_referrals(inviter_user_id);

CREATE OR REPLACE FUNCTION public.eut_public_referral_highlights(
  _technician_ids uuid[]
)
RETURNS TABLE (technician_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  -- Input IDs are already public and approved; repeat the guard server-side.
  -- Anonymous callers may learn ONLY which approved public IDs qualify.
  SELECT inviter.id AS technician_id
  FROM public.technicians AS inviter
  JOIN public.eut_technician_referrals AS attribution
    ON attribution.inviter_user_id = inviter.user_id
  JOIN public.technicians AS invited
    ON invited.user_id = attribution.invited_user_id
      AND invited.status = 'aprovado'::public.approval_status
  WHERE cardinality(_technician_ids) BETWEEN 1 AND 200
    AND inviter.id = ANY(_technician_ids)
    AND inviter.status = 'aprovado'::public.approval_status
    AND attribution.inviter_user_id <> attribution.invited_user_id
  GROUP BY inviter.id
  HAVING count(DISTINCT invited.id) >= 2;
$$;

REVOKE ALL ON FUNCTION public.eut_public_referral_highlights(uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.eut_public_referral_highlights(uuid[])
  TO anon, authenticated;
COMMIT;
