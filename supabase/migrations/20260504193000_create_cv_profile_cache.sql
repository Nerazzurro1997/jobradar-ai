create extension if not exists pgcrypto;

create table if not exists public.cv_profile_cache (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  cache_version text not null,
  profile jsonb not null,
  document_validation jsonb,
  created_at timestamptz not null default now(),
  unique (file_hash, cache_version)
);

alter table public.cv_profile_cache enable row level security;
