-- Migration 003: Tabella locations
-- Localita cercate dagli utenti o monitorate dal sistema.

create table locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,                           -- nome visualizzato (es: 'Milano, Lombardia')
  latitude numeric(9,6) not null,               -- latitudine con 6 decimali (~11cm precisione)
  longitude numeric(9,6) not null,              -- longitudine con 6 decimali
  country text,                                 -- codice paese (es: 'IT')
  timezone text,                                -- timezone IANA (es: 'Europe/Rome')
  search_count integer not null default 0,      -- quante volte e stata cercata
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(latitude, longitude)
);

comment on table locations is 'Localita cercate dagli utenti o monitorate dal sistema';
comment on column locations.search_count is 'Contatore ricerche, utile per suggerimenti e analytics';
