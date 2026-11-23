-- =============================================================================
-- Enlace — Rede de Adoção de Animais
-- Script idempotente para Supabase (PostgreSQL + RLS + Storage + Triggers)
-- Alinhado 1:1 com as tabelas reais do projeto e com os repositórios do app.
-- =============================================================================

create extension if not exists "pgcrypto";

-- 1. Perfis de usuário (vinculados a auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  user_type text not null default 'USER' check (user_type in ('USER', 'ADMIN')),
  bio text not null default '',
  interests text[] not null default array['Cães', 'Gatos'],
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. Anúncios de animais (Aggregate Root)
create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  species text not null,
  size text not null,
  approximate_age text not null,
  sex text not null,
  description text,
  health_notes text,
  special_care text,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'ADOPTED')),
  neighborhood text not null default '',
  city text not null default '',
  region text not null default 'MG',
  latitude double precision not null default -21.55,
  longitude double precision not null default -45.43,
  moderation_status text not null default 'NONE' check (moderation_status in ('NONE', 'HIDDEN')),
  moderated_at timestamptz,
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
  local_path text,
  remote_url text not null,
  is_main boolean not null default false,
  upload_status text not null default 'SYNCED',
  created_at timestamptz not null default now()
);

create index if not exists idx_animal_photos_animal on public.animal_photos (animal_id, is_main desc);

-- 4. Tombstones para propagação delta de exclusões e ocultações (OFF-06 / OFF-08)
create table if not exists public.animal_tombstones (
  animal_id uuid primary key,
  reason text not null check (reason in ('DELETED', 'HIDDEN')),
  removed_at timestamptz not null default now()
);

create index if not exists idx_animal_tombstones_removed on public.animal_tombstones (removed_at asc, animal_id asc);

-- 5. Favoritos por usuário (RF14, RF15 — chave composta user_id + animal_id)
create table if not exists public.favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, animal_id)
);

-- 6. Manifestações de interesse na adoção + trilha de 4 etapas (RF16, Decisão 18)
create table if not exists public.adoption_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  animal_id uuid not null references public.animals(id) on delete cascade,
  message text not null default '',
  contact_phone text,
  contact_name text,
  contact_email text,
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
    insert into public.animal_tombstones (animal_id, reason, removed_at)
    values (old.id, 'DELETED', clock_timestamp())
    on conflict (animal_id) do update
      set reason = 'DELETED', removed_at = excluded.removed_at;
    return old;
  elsif (tg_op = 'UPDATE') then
    if (new.moderation_status = 'HIDDEN' and coalesce(old.moderation_status, 'NONE') <> 'HIDDEN') then
      insert into public.animal_tombstones (animal_id, reason, removed_at)
      values (new.id, 'HIDDEN', clock_timestamp())
      on conflict (animal_id) do update
        set reason = 'HIDDEN', removed_at = excluded.removed_at;
    elsif (new.moderation_status = 'NONE' and old.moderation_status = 'HIDDEN') then
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

-- 8. Políticas RLS nas tabelas públicas (DAT-05 / §15.1)
alter table public.users enable row level security;
alter table public.animals enable row level security;
alter table public.animal_photos enable row level security;
alter table public.animal_tombstones enable row level security;
alter table public.favorites enable row level security;
alter table public.adoption_interests enable row level security;

drop policy if exists "users_select_public" on public.users;
create policy "users_select_public" on public.users for select using (true);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users for insert with check ((select auth.uid()) = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists "animals_select_visible_or_own" on public.animals;
create policy "animals_select_visible_or_own" on public.animals for select
using (
  moderation_status <> 'HIDDEN'
  or (select auth.uid()) = owner_id
  or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.user_type = 'ADMIN')
);

drop policy if exists "animals_insert_own" on public.animals;
create policy "animals_insert_own" on public.animals for insert
with check ((select auth.uid()) = owner_id);

drop policy if exists "animals_update_own_or_admin" on public.animals;
create policy "animals_update_own_or_admin" on public.animals for update
using (
  (select auth.uid()) = owner_id
  or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.user_type = 'ADMIN')
);

drop policy if exists "animals_delete_own_or_admin" on public.animals;
create policy "animals_delete_own_or_admin" on public.animals for delete
using (
  (select auth.uid()) = owner_id
  or exists (select 1 from public.users u where u.id = (select auth.uid()) and u.user_type = 'ADMIN')
);

drop policy if exists "animal_photos_select_public" on public.animal_photos;
create policy "animal_photos_select_public" on public.animal_photos for select using (true);

drop policy if exists "animal_photos_write_owner" on public.animal_photos;
create policy "animal_photos_write_owner" on public.animal_photos for all
using (
  exists (select 1 from public.animals a where a.id = animal_photos.animal_id and a.owner_id = (select auth.uid()))
)
with check (
  exists (select 1 from public.animals a where a.id = animal_photos.animal_id and a.owner_id = (select auth.uid()))
);

drop policy if exists "tombstones_select_public" on public.animal_tombstones;
create policy "tombstones_select_public" on public.animal_tombstones for select using (true);

drop policy if exists "favorites_own" on public.favorites;
create policy "favorites_own" on public.favorites for all
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "interests_select_own_or_owner" on public.adoption_interests;
create policy "interests_select_own_or_owner" on public.adoption_interests for select
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.animals a where a.id = adoption_interests.animal_id and a.owner_id = (select auth.uid()))
);

drop policy if exists "interests_insert_own" on public.adoption_interests;
create policy "interests_insert_own" on public.adoption_interests for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "interests_update_own_or_owner" on public.adoption_interests;
create policy "interests_update_own_or_owner" on public.adoption_interests for update
using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.animals a where a.id = adoption_interests.animal_id and a.owner_id = (select auth.uid()))
);

drop policy if exists "interests_delete_own" on public.adoption_interests;
create policy "interests_delete_own" on public.adoption_interests for delete
using ((select auth.uid()) = user_id);

-- 9. Bucket de fotos e Policies do Supabase Storage (DAT-06 / SUP-05)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animal-photos', 'animal-photos', true, 5242880, array['image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/webp'];

drop policy if exists "animal_photos_storage_select_public" on storage.objects;
create policy "animal_photos_storage_select_public"
on storage.objects for select
using (bucket_id = 'animal-photos');

drop policy if exists "animal_photos_storage_insert_own" on storage.objects;
create policy "animal_photos_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'animal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "animal_photos_storage_update_own" on storage.objects;
create policy "animal_photos_storage_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'animal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'animal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "animal_photos_storage_delete_own" on storage.objects;
create policy "animal_photos_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'animal-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
