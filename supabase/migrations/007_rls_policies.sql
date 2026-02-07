-- Migration 007: Row Level Security (RLS) policies
-- Definisce chi puo leggere/scrivere ogni tabella.

-- ============================================================
-- SOURCES: leggibili da tutti, scrivibili solo da service_role
-- ============================================================
alter table sources enable row level security;

-- Tutti possono leggere le fonti (servono al frontend per /sources)
create policy "sources_read_all"
  on sources for select
  using (true);

-- Solo il backend (service_role) puo modificare le fonti
create policy "sources_write_service"
  on sources for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- LOCATIONS: leggibili da tutti, inseribili da utenti autenticati
-- ============================================================
alter table locations enable row level security;

create policy "locations_read_all"
  on locations for select
  using (true);

create policy "locations_insert_authenticated"
  on locations for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'service_role');

create policy "locations_update_service"
  on locations for update
  using (auth.role() = 'service_role');

-- ============================================================
-- RAW_FORECASTS: solo service_role (dati interni)
-- ============================================================
alter table raw_forecasts enable row level security;

create policy "raw_forecasts_service_only"
  on raw_forecasts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- SMART_FORECASTS: leggibili da tutti, scrivibili da service_role
-- ============================================================
alter table smart_forecasts enable row level security;

create policy "smart_forecasts_read_all"
  on smart_forecasts for select
  using (true);

create policy "smart_forecasts_write_service"
  on smart_forecasts for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- PROFILES: ogni utente vede/modifica solo il proprio profilo
-- ============================================================
alter table profiles enable row level security;

create policy "profiles_read_own"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
