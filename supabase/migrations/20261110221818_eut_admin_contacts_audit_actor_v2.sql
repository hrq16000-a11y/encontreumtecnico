do $block$
declare v_old text; v_new text;
begin
 select pg_get_functiondef('public.eut_admin_contacts_dashboard(text,text,integer)'::regprocedure) into v_old;
 v_new:=replace(v_old,
  'select action,subject_user_id,phone_last4,reference_id,reason,created_at',
  'select actor_id,action,subject_user_id,phone_last4,reference_id,reason,created_at'
 );
 if v_new <> v_old then execute v_new; end if;
end;
$block$;