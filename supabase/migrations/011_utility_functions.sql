-- Migration 011: Funzioni di utilita per lo Smart Engine
-- Funzioni SQL richiamabili via Supabase RPC o usate internamente.

-- Funzione: trova o crea una localita in base alle coordinate
create or replace function public.upsert_location(
  p_name text,
  p_latitude numeric,
  p_longitude numeric,
  p_country text default null,
  p_timezone text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  -- Cerca localita esistente per coordinate (arrotondamento a 4 decimali ~ 11m)
  select id into v_id
  from locations
  where round(latitude::numeric, 4) = round(p_latitude, 4)
    and round(longitude::numeric, 4) = round(p_longitude, 4);

  if v_id is null then
    insert into locations (name, latitude, longitude, country, timezone, search_count)
    values (p_name, p_latitude, p_longitude, p_country, p_timezone, 1)
    returning id into v_id;
  else
    update locations
    set search_count = search_count + 1,
        name = coalesce(p_name, name)
    where id = v_id;
  end if;

  return v_id;
end;
$$;

comment on function public.upsert_location is 'Trova o crea una localita per coordinate, incrementa il contatore ricerche';

-- Funzione: pulizia dati vecchi (da schedulare con pg_cron o Supabase Edge Functions)
create or replace function public.cleanup_old_forecasts(
  p_days_raw integer default 30,
  p_days_smart integer default 90
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_raw_deleted integer;
  v_smart_deleted integer;
begin
  delete from raw_forecasts
  where fetched_at < now() - make_interval(days => p_days_raw);
  get diagnostics v_raw_deleted = row_count;

  delete from smart_forecasts
  where generated_at < now() - make_interval(days => p_days_smart);
  get diagnostics v_smart_deleted = row_count;

  return jsonb_build_object(
    'raw_deleted', v_raw_deleted,
    'smart_deleted', v_smart_deleted,
    'cleaned_at', now()
  );
end;
$$;

comment on function public.cleanup_old_forecasts is 'Elimina previsioni piu vecchie di N giorni. Default: 30gg raw, 90gg smart.';

-- Funzione: statistiche fonti (per dashboard admin)
create or replace function public.get_sources_stats()
returns table (
  source_id text,
  source_name text,
  total_fetches bigint,
  successful_fetches bigint,
  avg_response_ms numeric,
  error_rate numeric,
  last_fetch timestamptz
)
language sql
stable
security definer
as $$
  select
    s.id as source_id,
    s.name as source_name,
    count(r.id) as total_fetches,
    count(r.id) filter (where r.error is null) as successful_fetches,
    round(avg(r.response_ms) filter (where r.error is null), 0) as avg_response_ms,
    case
      when count(r.id) > 0
      then round(count(r.id) filter (where r.error is not null)::numeric / count(r.id) * 100, 1)
      else 0
    end as error_rate,
    max(r.fetched_at) as last_fetch
  from sources s
  left join raw_forecasts r on r.source_id = s.id
  group by s.id, s.name
  order by s.name;
$$;

comment on function public.get_sources_stats is 'Statistiche per fonte: totale fetch, successi, latenza media, tasso errore';
