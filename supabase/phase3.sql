-- ============================================================
-- RUSHES — Phase 3 : Intégration Zernio
-- À exécuter dans l'éditeur SQL Supabase après schema.sql
-- ============================================================

-- Colonnes Zernio sur la table videos
alter table public.videos
  add column if not exists zernio_post_id   text,
  add column if not exists zernio_account_id text,
  add column if not exists video_url         text,
  add column if not exists zernio_synced_at  timestamptz;

-- Table de configuration utilisateur (profile_id Zernio, etc.)
create table if not exists public.settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists "settings_owner_policy" on public.settings;
create policy "settings_owner_policy" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
