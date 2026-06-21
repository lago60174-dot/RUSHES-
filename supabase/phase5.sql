-- ============================================================
-- RUSHES — Phase 5 : Multi-plateforme + sync auto
-- À exécuter dans l'éditeur SQL Supabase après phase4.sql
-- ============================================================

-- Liste des cibles (plateforme + compte) utilisées pour une publication
-- multi-réseaux en une seule fois, ex: [{"platform":"tiktok","accountId":"..."}, ...]
alter table public.videos
  add column if not exists zernio_targets jsonb not null default '[]'::jsonb;
