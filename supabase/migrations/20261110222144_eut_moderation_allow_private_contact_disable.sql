-- Permite revogar autorização de contato mesmo quando a conta foi restringida.
-- Continua proibido cadastrar um número bloqueado, alterar o telefone ou voltar a liberar contato.
create or replace function eut_moderation.reject_restricted_phone()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $body$
begin
  if exists(select 1 from eut_moderation.blocked_accounts a where a.user_id=new.user_id)
    or exists(select 1 from eut_moderation.blocked_phones b
      where b.phone_digits=regexp_replace(coalesce(new.phone_e164,''),'[^0-9]','','g'))
  then
    if TG_OP='UPDATE' and new.allow_paid_contact=false
      and new.phone_e164 is not distinct from old.phone_e164
      and new.user_id is not distinct from old.user_id then
      return new;
    end if;
    raise exception 'Não foi possível concluir seu cadastro. Consulte o suporte.'
      using errcode='P0001';
  end if;
  return new;
end;
$body$;
revoke all on function eut_moderation.reject_restricted_phone() from public,anon,authenticated;