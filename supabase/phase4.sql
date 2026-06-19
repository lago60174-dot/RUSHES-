-- ============================================================
-- RUSHES — Phase 4 : Pipeline de découpage vidéo
-- À exécuter dans l'éditeur SQL Supabase après phase3.sql
-- ============================================================

-- Table des jobs de traitement vidéo
create table if not exists public.clip_jobs (
  id            text primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  video_path    text not null,          -- chemin dans Supabase Storage (bucket: videos)
  video_name    text not null,          -- nom original du fichier
  status        text not null default 'pending'
                check (status in ('pending','processing','done','error')),
  error         text,
  segments      jsonb,                  -- segments sélectionnés par l'IA
  clips         jsonb,                  -- clips produits [{path, url, caption, hashtags, platform, startTime, endTime, duration}]
  transcript    text,                   -- transcription complète
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.clip_jobs enable row level security;

drop policy if exists "clip_jobs_owner_policy" on public.clip_jobs;
create policy "clip_jobs_owner_policy" on public.clip_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists clip_jobs_updated_at on public.clip_jobs;
create trigger clip_jobs_updated_at
  before update on public.clip_jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- Buckets Supabase Storage
-- À créer manuellement dans Storage > New bucket :
--
-- 1. Bucket "videos"  — privé (RLS activée)
-- 2. Bucket "clips"   — privé (RLS activée)
--
-- Puis exécute les policies ci-dessous :
-- ============================================================

-- Policies pour le bucket "videos"
drop policy if exists "videos_owner_upload" on storage.objects;
create policy "videos_owner_upload" on storage.objects
  for insert with check (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "videos_owner_read" on storage.objects;
create policy "videos_owner_read" on storage.objects
  for select using (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "videos_owner_delete" on storage.objects;
create policy "videos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policies pour le bucket "clips"
drop policy if exists "clips_owner_read" on storage.objects;
create policy "clips_owner_read" on storage.objects
  for select using (
    bucket_id = 'clips' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "clips_service_write" on storage.objects;
create policy "clips_service_write" on storage.objects
  for insert with check (bucket_id = 'clips');
