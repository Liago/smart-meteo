-- Migration 002: Tabella sources
-- Configurazione delle fonti meteo.
-- L'id e text (es: 'tomorrow.io') per allineamento con il backend.
-- Le API key NON sono salvate qui: sono gestite come env vars su Netlify.

create table sources (
  id text primary key,                          -- es: 'tomorrow.io', 'meteomatics'
  name text not null,                           -- es: 'Tomorrow.io', 'Meteomatics'
  description text not null default '',         -- descrizione della fonte
  weight numeric not null default 1.0,          -- peso per media pesata (0.5 - 2.0)
  active boolean not null default true,         -- abilitata/disabilitata
  config jsonb not null default '{}'::jsonb,    -- configurazione extra (rate_limits, base_url, ecc.)
  last_error text,                              -- ultimo errore riscontrato
  last_response_ms integer,                     -- latenza ultimo fetch (ms)
  last_fetched_at timestamptz,                  -- timestamp ultimo fetch
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constraint: il peso deve essere positivo
alter table sources add constraint sources_weight_positive check (weight > 0);

comment on table sources is 'Fonti meteo configurabili. Le API key sono in env vars, non nel DB.';
comment on column sources.id is 'Identificativo testuale (es: tomorrow.io, openweathermap)';
comment on column sources.weight is 'Peso per la media pesata dello Smart Engine (default 1.0)';
comment on column sources.config is 'Configurazione extra JSON (rate limits, endpoints custom, ecc.)';
