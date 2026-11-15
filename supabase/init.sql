-- =============================================================================
-- Enlace — Rede de Adoção de Animais
-- Script idempotente para Supabase (PostgreSQL + RLS + Storage + Triggers)
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Perfis de usuário (vinculados a auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  contact_info text not null default '',
  bio text not null default '',
  avatar_url text,
  role text not null default 'USER' check (role in ('USER', 'ADMIN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Anúncios de animais (Aggregate Root)
create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  species text not null,
  size text not null,
  approximate_age text not null,
  sex text not null,
  characteristics text not null default '',
  behavior text not null default '',
  special_care text not null default '',
  adoption_status text not null default 'AVAILABLE' check (adoption_status in ('AVAILABLE', 'ADOPTED')),
  neighborhood text not null default '',
  city text not null default '',
  region text not null default '',
  latitude_approx double precision not null default 0,
  longitude_approx double precision not null default 0,
  hidden boolean not null default false,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_animals_updated_id on public.animals (updated_at asc, id asc);
create index if not exists idx_animals_owner on public.animals (owner_id);

-- 3. Fotos de animais (máx. 4 por anúncio no domínio)
create table if not exists public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals(id) on delete cascade,
  storage_path text not null default '',
  public_or_signed_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_animal_photos_animal on public.animal_photos (animal_id, sort_order);

-- 4. Tombstones para propagação delta de exclusões e ocultações (OFF-06 / OFF-08)
create table if not exists public.animal_tombstones (
  animal_id uuid primary key,
  reason text not null check (reason in ('DELETED', 'HIDDEN')),
  deleted_at timestamptz not null default now()
);

create index if not exists idx_animal_tombstones_deleted on public.animal_tombstones (deleted_at asc, animal_id asc);

-- 5. Favoritos por usuário (RF14, RF15)
create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, animal_id)
);

-- 6. Manifestações de interesse na adoção + trilha de 4 etapas (RF16, Decisão 18)
create table if not exists public.adoption_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  message text not null default '',
  contact_info text not null default '',
  status text not null default 'ENVIADA' check (status in ('PENDING', 'ENVIADA', 'EM_ANALISE', 'VISITA_COMBINADA', 'CONCLUIDA', 'RECUSADA')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_interests_animal on public.adoption_interests (animal_id);
create index if not exists idx_interests_user on public.adoption_interests (user_id);

-- 7. Triggers de relógio do servidor e tombstones
create or replace function public.set_server_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists trg_animals_updated_at on public.animals;
create trigger trg_animals_updated_at
before insert or update on public.animals
for each row execute function public.set_server_updated_at();

create or replace function public.sync_animal_tombstones()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'DELETE') then
    insert into public.animal_tombstones (animal_id, reason, deleted_at)
    values (old.id, 'DELETED', clock_timestamp())
    on conflict (animal_id) do update
      set reason = 'DELETED', deleted_at = excluded.deleted_at;
    return old;
  elsif (tg_op = 'UPDATE') then
    if (new.hidden = true and old.hidden = false) then
      insert into public.animal_tombstones (animal_id, reason, deleted_at)
      values (new.id, 'HIDDEN', clock_timestamp())
      on conflict (animal_id) do update
        set reason = 'HIDDEN', deleted_at = excluded.deleted_at;
    elsif (new.hidden = false and old.hidden = true) then
      delete from public.animal_tombstones where animal_id = new.id;
    end if;
    return new;
  elsif (tg_op = 'INSERT') then
    delete from public.animal_tombstones where animal_id = new.id;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_animals_tombstones on public.animals;
create trigger trg_animals_tombstones
after insert or update or delete on public.animals
for each row execute function public.sync_animal_tombstones();

-- 8. Políticas RLS (DAT-05 / §15.1)
alter table public.profiles enable row level security;
alter table public.animals enable row level security;
alter table public.animal_photos enable row level security;
alter table public.animal_tombstones enable row level security;
alter table public.favorites enable row level security;
alter table public.adoption_interests enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public" on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "animals_select_visible_or_own" on public.animals;
create policy "animals_select_visible_or_own" on public.animals for select
using (
  hidden = false
  or auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
);

drop policy if exists "animals_insert_own" on public.animals;
create policy "animals_insert_own" on public.animals for insert
with check (auth.uid() = owner_id);

drop policy if exists "animals_update_own_or_admin" on public.animals;
create policy "animals_update_own_or_admin" on public.animals for update
using (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
);

drop policy if exists "animals_delete_own_or_admin" on public.animals;
create policy "animals_delete_own_or_admin" on public.animals for delete
using (
  auth.uid() = owner_id
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN')
);

drop policy if exists "animal_photos_select_public" on public.animal_photos;
create policy "animal_photos_select_public" on public.animal_photos for select using (true);

drop policy if exists "animal_photos_write_owner" on public.animal_photos;
create policy "animal_photos_write_owner" on public.animal_photos for all
using (
  exists (select 1 from public.animals a where a.id = animal_photos.animal_id and a.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.animals a where a.id = animal_photos.animal_id and a.owner_id = auth.uid())
);

drop policy if exists "tombstones_select_public" on public.animal_tombstones;
create policy "tombstones_select_public" on public.animal_tombstones for select using (true);

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "interests_select_own_or_owner" on public.adoption_interests;
create policy "interests_select_own_or_owner" on public.adoption_interests for select
using (
  auth.uid() = user_id
  or exists (select 1 from public.animals a where a.id = adoption_interests.animal_id and a.owner_id = auth.uid())
);

drop policy if exists "interests_insert_own" on public.adoption_interests;
create policy "interests_insert_own" on public.adoption_interests for insert
with check (auth.uid() = user_id);

drop policy if exists "interests_update_own_or_owner" on public.adoption_interests;
create policy "interests_update_own_or_owner" on public.adoption_interests for update
using (
  auth.uid() = user_id
  or exists (select 1 from public.animals a where a.id = adoption_interests.animal_id and a.owner_id = auth.uid())
);

-- 9. Bucket de fotos no Supabase Storage (DAT-06)
insert into storage.buckets (id, name, public)
values ('animal-photos', 'animal-photos', true)
on conflict (id) do update set public = true;
