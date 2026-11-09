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
alter table public.users add column if not exists avatar_url text;

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

-- INSERT também (OFF-06, ordem 6): o app envia `updated_at` do aparelho na
-- criação; o pull incremental exige o relógio do SERVIDOR, senão um aparelho
-- com relógio atrasado criaria anúncios que nenhum cursor alcança.
drop trigger if exists trg_animals_updated_at on public.animals;
create trigger trg_animals_updated_at
  before insert or update on public.animals
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

-- adoption_interests: contato do interessado, visível ao responsável pelo anúncio.
alter table public.adoption_interests add column if not exists contact_name text;
alter table public.adoption_interests add column if not exists contact_email text;
-- Trilha de adoção (decisão 18): quando a etapa mudou por último.
alter table public.adoption_interests add column if not exists updated_at timestamptz;

drop policy if exists interests_animal_owner_read on public.adoption_interests;
create policy interests_animal_owner_read on public.adoption_interests
  for select using (public.is_animal_owner(animal_id));

-- Trilha (decisão 18): o responsável pelo ANÚNCIO avança/recusa a etapa
-- (ENVIADA → EM ANÁLISE → VISITA COMBINADA → CONCLUÍDA; RECUSADA = folha).
drop policy if exists interests_animal_owner_update on public.adoption_interests;
create policy interests_animal_owner_update on public.adoption_interests
  for update using (public.is_animal_owner(animal_id));

-- favorites: 100% privados (§15.1 — "favoritos e interesses protegidos")
drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- adoption_interests: 100% privados (§15.1)
drop policy if exists interests_owner_all on public.adoption_interests;
drop policy if exists interests_own_read on public.adoption_interests;
create policy interests_own_read on public.adoption_interests for select using (user_id = auth.uid());
drop policy if exists interests_own_insert on public.adoption_interests;
create policy interests_own_insert on public.adoption_interests for insert with check (user_id = auth.uid() and status in ('PENDING', 'ENVIADA'));
drop policy if exists interests_own_delete on public.adoption_interests;
create policy interests_own_delete on public.adoption_interests for delete using (user_id = auth.uid());

create or replace function public.protect_interest_stage() returns trigger
language plpgsql set search_path = public as $$
declare previous text;
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.animal_id is distinct from old.animal_id
     or new.created_at is distinct from old.created_at or new.contact_name is distinct from old.contact_name
     or new.contact_email is distinct from old.contact_email or new.contact_phone is distinct from old.contact_phone
     or new.message is distinct from old.message then
    raise exception 'Identidade e contato da manifestação não podem ser alterados';
  end if;
  previous := case when old.status = 'PENDING' then 'ENVIADA' else old.status end;
  if new.status is distinct from old.status and not (
    (previous = 'ENVIADA' and new.status in ('EM_ANALISE', 'RECUSADA')) or
    (previous = 'EM_ANALISE' and new.status in ('VISITA_COMBINADA', 'RECUSADA')) or
    (previous = 'VISITA_COMBINADA' and new.status = 'CONCLUIDA')
  ) then raise exception 'Transição de etapa inválida'; end if;
  return new;
end; $$;
drop trigger if exists trg_interest_stage on public.adoption_interests;
create trigger trg_interest_stage before update on public.adoption_interests
for each row execute function public.protect_interest_stage();

-- ============================================================================
-- Pull incremental (OFF-06 — decisão da ordem 6: cursor/delta, não snapshot)
--
-- O app guarda o cursor (updated_at, id) da última linha recebida e pede só
-- o que mudou depois dele (keyset, ordem updated_at,id). `updated_at` é
-- sempre o relógio do SERVIDOR (trigger trg_animals_updated_at) — o relógio
-- do aparelho nunca entra na comparação. Exclusões e ocultações não
-- "chegam" como linha alterada, então viram TOMBSTONES próprios.
-- ============================================================================

-- Delta por keyset: (updated_at, id) indexado.
create index if not exists idx_animals_updated_at_id on public.animals (updated_at, id);

-- Mudança de foto conta como mudança do anúncio (o pull traz as fotos junto).
create or replace function public.touch_animal_from_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.animals
     set updated_at = now()
   where id = coalesce(new.animal_id, old.animal_id);
  return null;
end;
$$;

drop trigger if exists trg_animal_photos_touch_animal on public.animal_photos;
create trigger trg_animal_photos_touch_animal
  after insert or update or delete on public.animal_photos
  for each row execute function public.touch_animal_from_photo();

-- Tombstones: anúncio que SAIU da leitura pública (apagado ou ocultado pela
-- moderação). Só ids e motivo — nenhum dado pessoal; leitura pública.
create table if not exists public.animal_tombstones (
  animal_id uuid primary key,
  reason text not null check (reason in ('DELETED', 'HIDDEN')),
  removed_at timestamptz not null default now()
);

create index if not exists idx_animal_tombstones_removed_at_id
  on public.animal_tombstones (removed_at, animal_id);

alter table public.animal_tombstones enable row level security;

drop policy if exists tombstones_read_public on public.animal_tombstones;
create policy tombstones_read_public on public.animal_tombstones
  for select using (true);
-- Sem política de escrita: só os triggers abaixo (security definer) gravam.

create or replace function public.track_animal_tombstone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.animal_tombstones (animal_id, reason, removed_at)
    values (old.id, 'DELETED', now())
    on conflict (animal_id) do update
      set reason = excluded.reason, removed_at = excluded.removed_at;
    return old;
  end if;

  if tg_op = 'INSERT' then
    -- Recriado (ex.: "manter minha versão" num conflito de anúncio apagado).
    delete from public.animal_tombstones where animal_id = new.id;
    return new;
  end if;

  -- UPDATE: só transições de moderação importam.
  if new.moderation_status = 'HIDDEN' and old.moderation_status is distinct from 'HIDDEN' then
    insert into public.animal_tombstones (animal_id, reason, removed_at)
    values (new.id, 'HIDDEN', now())
    on conflict (animal_id) do update
      set reason = excluded.reason, removed_at = excluded.removed_at;
  elsif new.moderation_status <> 'HIDDEN' and old.moderation_status = 'HIDDEN' then
    -- Reexibido: o tombstone sai e o updated_at novo traz a linha no delta.
    delete from public.animal_tombstones where animal_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_animals_tombstone on public.animals;
create trigger trg_animals_tombstone
  after insert or update or delete on public.animals
  for each row execute function public.track_animal_tombstone();

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
-- Storage (Passo 4): bucket público "animal-photos" (padrão S3 do Supabase).
-- Só aceita WebP (o app converte toda foto antes do envio) até 2 MB.
-- Caminho: {auth.uid()}/{animal_id}/{photo_id}.webp — a 1ª pasta é o dono.
-- Leitura: pública por URL (anúncios são públicos, RF06); sem política de
-- SELECT em storage.objects, então listar objetos pela API continua bloqueado.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('animal-photos', 'animal-photos', true, 2097152, array['image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = 2097152,
      allowed_mime_types = array['image/webp'];

drop policy if exists "animal_photos_insert_own_folder" on storage.objects;
create policy "animal_photos_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "animal_photos_update_own_folder" on storage.objects;
create policy "animal_photos_update_own_folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'animal-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "animal_photos_delete_own_or_admin" on storage.objects;
create policy "animal_photos_delete_own_or_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'animal-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

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
