-- Migration 009: Funzione updated_at automatica
-- Aggiorna automaticamente il campo updated_at quando una riga viene modificata.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Applica il trigger alle tabelle con updated_at
create trigger set_updated_at_sources
  before update on sources
  for each row execute function public.set_updated_at();

create trigger set_updated_at_locations
  before update on locations
  for each row execute function public.set_updated_at();

create trigger set_updated_at_profiles
  before update on profiles
  for each row execute function public.set_updated_at();
