-- ============================================================
-- Dashboard App — Supabase Migration
-- Run this in the Supabase SQL Editor to set up the user_data table
-- ============================================================

-- Create the user_data table (if not exists)
create table if not exists public.user_data (
  user_id uuid references auth.users not null,
  data jsonb,
  updated_at timestamptz default now(),
  constraint user_data_pkey primary key (user_id)
);

-- Enable Row Level Security
alter table public.user_data enable row level security;

-- Drop existing policies to be safe (ignore errors if they don't exist)
drop policy if exists "Users can insert their own data" on public.user_data;
drop policy if exists "Users can update their own data" on public.user_data;
drop policy if exists "Users can read their own data" on public.user_data;

-- Policy: Users can only insert their own row
create policy "Users can insert their own data"
on public.user_data for insert
with check (auth.uid() = user_id);

-- Policy: Users can only update their own row (needed for upsert)
create policy "Users can update their own data"
on public.user_data for update
using (auth.uid() = user_id);

-- Policy: Users can only read their own row
create policy "Users can read their own data"
on public.user_data for select
using (auth.uid() = user_id);
