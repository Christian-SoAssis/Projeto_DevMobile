-- ============================================================================
-- Enlace — schema inicial do Supabase (Fase 3 / doc §13-§15)
-- Executar no SQL Editor do projeto Supabase (ou via `supabase db push`).
--
-- Segurança (§15.1/§15.3 — defesa em profundidade):
--   * leitura pública SOMENTE de animals visíveis (não moderados);
--   * escrita em animals/fotos somente do proprietário;
--   * favorites/adoption_interests privados (user_id = auth.uid());
--   * moderação somente ADMIN (decisão de produto: e-mail/senha como auth).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensões
-- ----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- users — espelho do perfil (id = auth.users.id)
-- ----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text unique,
  phone text,
  user_type text not null default 'USER'
    check (user_type in ('VISITOR', 'USER', 'RESPONSIBLE', 'INTERESTED', 'ADMIN')),
  created_at timestamptz not null default now()
);

-- Perfil editável (tela Conta). A foto de perfil fica só no aparelho até o Storage (Passo 4).
alter table public.users add column if not exists bio text
  check (bio is null or char_length(bio) <= 300);
alter table public.users add column if not exists interests text[] not null default '{}';

-- ----------------------------------------------------------------------------
-- animals — anúncio (coordenadas APENAS aproximadas — RNF05/RNF06)
-- ----------------------------------------------------------------------------
create table if not exists public.animals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  species text not null,
  size text not null,
  approximate_age text not null,
  sex text not null,
  description text,
  health_notes text,
  special_care text,
  status text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'ADOPTED')),
  neighborhood text not null,
  city text not null,
  region text not null,
  latitude double precision not null,
  longitude double precision not null,
  moderation_status text not null default 'NONE'
    check (moderation_status in ('NONE', 'HIDDEN')),
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);

create index if not exists idx_animals_owner_id on public.animals (owner_id);
create index if not exists idx_animals_status on public.animals (status);
create index if not exists idx_animals_city on public.animals (city);

-- updated_at automático (a `version` é incrementada pelo app — bloqueio
-- otimista doc §14.3: UPDATE com `version` antiga é rejeitado no adapter
-- e pela RLS de dono).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_animals_updated_at on public.animals;
create trigger trg_animals_updated_at
  before update on public.animals
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- animal_photos — metadados de imagem (upload do arquivo = Passo 4)
-- ----------------------------------------------------------------------------
create table if not exists public.animal_photos (
  id uuid primary key default gen_random_uuid(),
  animal_id uuid not null references public.animals (id) on delete cascade,
  local_path text,
  remote_url text,
  is_main boolean not null default false,
  upload_status text not null default 'SYNCED',
  created_at timestamptz not null default now()
);

create index if not exists idx_animal_photos_animal_id on public.animal_photos (animal_id);

-- ----------------------------------------------------------------------------
-- favorites (RF14/RF15) — PRIVATE por usuário (§15.1)
-- ----------------------------------------------------------------------------
create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, animal_id)
);

create index if not exists idx_favorites_user_id on public.favorites (user_id);

-- ----------------------------------------------------------------------------
-- adoption_interests (RF16) — PRIVATE por usuário (§15.1)
-- ----------------------------------------------------------------------------
create table if not exists public.adoption_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  animal_id uuid not null references public.animals (id) on delete cascade,
  message text,
  contact_phone text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (user_id, animal_id)
);

create index if not exists idx_interests_user_id on public.adoption_interests (user_id);
create index if not exists idx_interests_animal_id on public.adoption_interests (animal_id);

-- ----------------------------------------------------------------------------
-- Helpers de RLS
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and user_type = 'ADMIN'
  );
$$;

create or replace function public.is_animal_owner(target_animal_id uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists (
    select 1 from public.animals
    where id = target_animal_id and owner_id = auth.uid()
  );
$$;

-- ============================================================================
-- Row Level Security (documentação §15.1)
-- ============================================================================
alter table public.users            enable row level security;
alter table public.animals          enable row level security;
alter table public.animal_photos    enable row level security;
alter table public.favorites        enable row level security;
alter table public.adoption_interests enable row level security;

-- users: cada usuário vê e mantém o próprio perfil
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (id = auth.uid());
drop policy if exists users_insert_own on public.users;
create policy users_insert_own on public.users
  for insert with check (id = auth.uid());
drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- animals: leitura pública apenas de visíveis (não HIDDEN); dono vê/edita o seu;
-- admin vê tudo e é o único que altera moderation_status (UC20).
drop policy if exists animals_read_public on public.animals;
create policy animals_read_public on public.animals
  for select using (moderation_status <> 'HIDDEN');

drop policy if exists animals_select_owner on public.animals;
create policy animals_select_owner on public.animals
  for select using (owner_id = auth.uid());

drop policy if exists animals_select_admin on public.animals;
create policy animals_select_admin on public.animals
  for select using (public.is_admin());

drop policy if exists animals_insert_owner on public.animals;
create policy animals_insert_owner on public.animals
  for insert with check (owner_id = auth.uid());

drop policy if exists animals_update_owner on public.animals;
create policy animals_update_owner on public.animals
  for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists animals_delete_owner on public.animals;
create policy animals_delete_owner on public.animals
  for delete using (owner_id = auth.uid());

-- animal_photos: leitura pública; escrita apenas do dono do anúncio associado
drop policy if exists photos_read_public on public.animal_photos;
create policy photos_read_public on public.animal_photos
  for select using (true);

drop policy if exists photos_insert_owner on public.animal_photos;
create policy photos_insert_owner on public.animal_photos
  for insert with check (public.is_animal_owner(animal_id));

drop policy if exists photos_update_owner on public.animal_photos;
create policy photos_update_owner on public.animal_photos
  for update using (public.is_animal_owner(animal_id));

drop policy if exists photos_delete_owner on public.animal_photos;
create policy photos_delete_owner on public.animal_photos
  for delete using (public.is_animal_owner(animal_id));

-- favorites: 100% privados (§15.1 — "favoritos e interesses protegidos")
drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- adoption_interests: 100% privados (§15.1)
drop policy if exists interests_owner_all on public.adoption_interests;
create policy interests_owner_all on public.adoption_interests
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================================
-- Cadastro: cria public.users quando nasce um usuário em auth.users.
-- security definer: no signUp ainda não há sessão, e a RLS barraria o insert.
-- user_type é sempre 'USER' — nunca lido do metadata (editável pelo cliente).
-- Promover admin: update public.users set user_type = 'ADMIN' where email = '...';
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, phone, user_type)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'Usuario'),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    'USER'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Storage (Passo 4 — bucket padrão S3): as políticas do bucket "animal-photos"
-- serão documentadas junto com o cliente de upload (src/infrastructure/supabase/storage/).
-- Placeholder mínimo, para não bloquear o deploy do schema:
-- ============================================================================
-- insert into storage.buckets (id, name, public)
-- values ('animal-photos', 'animal-photos', true)
-- on conflict (id) do update set public = true;

-- ============================================================================
-- Anti-escalada de privilégio: a política users_update_own deixa o usuário
-- editar a própria linha, o que incluiria user_type. Só admin (ou o SQL
-- Editor/service, onde auth.uid() é nulo) pode alterar o papel.
-- ============================================================================
create or replace function public.protect_user_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_type is distinct from old.user_type
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Somente administradores podem alterar o papel de um usuário.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_protect_user_type on public.users;
create trigger trg_users_protect_user_type
  before update on public.users
  for each row execute function public.protect_user_type();
