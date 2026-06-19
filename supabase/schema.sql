-- ============================================================
-- RUSHES — Schéma Supabase
-- À exécuter une seule fois dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- Table principale des vidéos
create table if not exists public.videos (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  platform      text not null,
  title         text not null,
  hashtags      text not null default '',
  notes         text not null default '',
  status        text not null default 'planned' check (status in ('planned', 'published')),

  -- Planification
  scheduled_date  text,
  scheduled_time  text,

  -- Publication
  published_date  text,
  published_time  text,

  -- Métriques
  duration_seconds  integer not null default 0,
  views             integer not null default 0,
  likes             integer not null default 0,
  comments          integer not null default 0,
  shares            integer not null default 0,
  saves             integer not null default 0,
  new_followers     integer not null default 0,
  avg_watch_time    numeric not null default 0,
  completion_rate   numeric not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Déclencher la mise à jour de updated_at automatiquement
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists videos_updated_at on public.videos;
create trigger videos_updated_at
  before update on public.videos
  for each row execute function public.set_updated_at();

-- Table pour le cache de l'analyse IA (une ligne par utilisateur)
create table if not exists public.ai_analyses (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  result        jsonb not null,
  video_count   integer not null,
  generated_at  timestamptz not null default now()
);

-- Row Level Security — chaque utilisateur ne voit que ses données
alter table public.videos enable row level security;
alter table public.ai_analyses enable row level security;

drop policy if exists "videos_owner_policy" on public.videos;
create policy "videos_owner_policy" on public.videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "ai_analyses_owner_policy" on public.ai_analyses;
create policy "ai_analyses_owner_policy" on public.ai_analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
