-- Migration 006: Tabella profiles
-- Profili utente sincronizzati con Supabase Auth.
-- Ogni riga e collegata a un utente auth.users.

create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  preferences jsonb not null default '{}'::jsonb,  -- unita (C/F), tema, lingua, ecc.
  favorite_locations uuid[] default '{}',           -- array di location_id preferite
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'Profili utente sincronizzati con Supabase Auth';
comment on column profiles.preferences is 'Preferenze JSON: unita (celsius/fahrenheit), tema, lingua';
comment on column profiles.favorite_locations is 'Array UUID delle localita preferite';

-- Trigger: crea automaticamente un profilo quando un utente si registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
