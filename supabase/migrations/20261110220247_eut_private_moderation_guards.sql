-- Copia versionada da migracao aplicada no projeto EUT em 2026-11-10.
-- IMPORTANTE: nenhum numero, email ou identidade de pessoa bloqueada vai ao repositorio.
-- Valores privados ficam apenas em eut_moderation no banco.
create schema if not exists eut_moderation;
revoke all on schema eut_moderation from public, anon, authenticated;

create table if not exists eut_moderation.blocked_phones (
  phone_digits text primary key
    check (phone_digits ~ '^55[1-9]{2}[2-9][0-9]{7,8}$'),
  added_at timestamptz not null default now(),
  reason_internal text not null default 'restricao administrativa'
);
create table if not exists eut_moderation.blocked_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  reason_internal text not null default 'restricao administrativa'
);
revoke all on all tables in schema eut_moderation from public, anon, authenticated;
alter table eut_moderation.blocked_phones enable row level security;
alter table eut_moderation.blocked_accounts enable row level security;

create or replace function eut_moderation.reject_restricted_phone()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $body$
begin
  if exists (select 1 from eut_moderation.blocked_accounts a where a.user_id = new.user_id)
    or exists (select 1 from eut_moderation.blocked_phones b
      where b.phone_digits = regexp_replace(coalesce(new.phone_e164,''),'[^0-9]','','g'))
  then
    raise exception 'Não foi possível concluir seu cadastro. Consulte o suporte.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$body$;

create or replace function eut_moderation.reject_restricted_publication()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $body$
begin
  if new.status = 'aprovado'::public.approval_status then
    if exists (select 1 from eut_moderation.blocked_accounts a where a.user_id=new.user_id)
      or exists (select 1 from public.eut_technician_private_contacts c
        join eut_moderation.blocked_phones b
          on b.phone_digits=regexp_replace(coalesce(c.phone_e164,''),'[^0-9]','','g')
        where c.user_id=new.user_id)
    then
      raise exception 'Não foi possível concluir seu cadastro. Consulte o suporte.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$body$;
revoke all on function eut_moderation.reject_restricted_phone() from public, anon, authenticated;
revoke all on function eut_moderation.reject_restricted_publication() from public, anon, authenticated;
drop trigger if exists eut_restrict_private_contact on public.eut_technician_private_contacts;
create trigger eut_restrict_private_contact
before insert or update of phone_e164, allow_paid_contact on public.eut_technician_private_contacts
for each row execute function eut_moderation.reject_restricted_phone();
drop trigger if exists eut_restrict_technician_publication on public.technicians;
create trigger eut_restrict_technician_publication
before insert or update of status, user_id on public.technicians
for each row execute function eut_moderation.reject_restricted_publication();
