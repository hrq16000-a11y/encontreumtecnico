CREATE OR REPLACE FUNCTION public.choose_account_type(_role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'auth', 'public', 'eut_migration'
AS $function$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_legacy_type text;
  v_prior_link uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if _role not in ('tecnico'::public.app_role,'cliente'::public.app_role) then
    raise exception 'invalid account type';
  end if;

  -- A real, confirmed Supabase identity is required; metadata supplied by
  -- the registering user is never accepted as identity or role evidence.
  select lower(btrim(u.email)) into v_email
  from auth.users u
  where u.id=v_user and u.email is not null and u.email_confirmed_at is not null
    and exists (
      select 1 from auth.identities i
      where i.user_id=u.id and i.provider in ('email','google')
        and lower(btrim(coalesce(i.identity_data->>'email','')))=lower(btrim(u.email))
        and (i.provider <> 'google'
             or coalesce(i.identity_data->>'email_verified','true') <> 'false')
    );
  if v_email is null then raise exception 'verified identity required'; end if;

  -- A former WordPress owner may not accidentally become the wrong type.
  -- The private staging queue is the only source of the original role.
  select q.intended_type, q.linked_auth_user_id
    into v_legacy_type,v_prior_link
  from eut_migration.account_activation_queue q
  join eut_migration.legacy_accounts a
    on a.source_key=q.source_key and a.wp_user_id=q.wp_user_id
  where lower(btrim(a.wp_email))=v_email
  limit 1;

  if v_legacy_type='admin_manual' then
    raise exception 'legacy administrator requires dedicated recovery';
  end if;
  -- O papel histórico é somente referência para recuperação;
  -- selecionar novo tipo não transfere automaticamente conta antiga.
  if v_prior_link is not null and v_prior_link<>v_user then
    raise exception 'imported account is associated with another identity';
  end if;

  -- Prevent dual technician/customer roles or changing an admin role through
  -- a public sign-in form. Repeated selection of the same role is idempotent.
  if exists (
    select 1 from public.user_roles r
    where r.user_id=v_user and r.role<>_role
  ) then
    raise exception 'account type has already been selected';
  end if;
  insert into public.user_roles(user_id,role)
  values (v_user,_role)
  on conflict (user_id,role) do nothing;
end;
$function$
;
-- O tipo novo permanece autorizado no servidor, sem importar categorias antigas.
