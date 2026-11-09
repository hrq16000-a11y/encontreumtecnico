create type public.app_role as enum ('admin', 'tecnico', 'cliente');
create type public.approval_status as enum ('pendente', 'aprovado', 'rejeitado');

create or replace function public.update_updated_at_column() returns trigger
language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- Roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Own profile read" on public.profiles for select to authenticated
  using (auth.uid() = id or public.has_role(auth.uid(), 'admin'));
create policy "Own profile update" on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "Own profile insert" on public.profiles for insert to authenticated
  with check (auth.uid() = id);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.update_updated_at_column();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Technician profiles (public only when approved)
create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  display_name text not null,
  specialties text[] not null default '{}',
  city text not null,
  region text,
  bio text,
  status public.approval_status not null default 'pendente',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.technicians to anon;
grant select, insert, update on public.technicians to authenticated;
grant all on public.technicians to service_role;
alter table public.technicians enable row level security;
create policy "Public reads approved" on public.technicians for select to anon, authenticated
  using (status = 'aprovado');
create policy "Owner reads own" on public.technicians for select to authenticated
  using (auth.uid() = user_id);
create policy "Admin reads all" on public.technicians for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Owner creates pending" on public.technicians for insert to authenticated
  with check (auth.uid() = user_id and status = 'pendente');
create policy "Owner edits back to pending" on public.technicians for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and status = 'pendente');
create policy "Admin moderates" on public.technicians for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger technicians_updated before update on public.technicians
  for each row execute function public.update_updated_at_column();

-- Self-service account type (never admin)
create or replace function public.choose_account_type(_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if _role not in ('tecnico', 'cliente') then raise exception 'invalid role'; end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), _role)
  on conflict do nothing;
end; $$;
revoke execute on function public.choose_account_type(public.app_role) from public, anon;
grant execute on function public.choose_account_type(public.app_role) to authenticated;