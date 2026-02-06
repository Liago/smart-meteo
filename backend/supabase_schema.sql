-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SOURCES TABLE
-- Stores configuration and API keys for weather providers
create table sources (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique, -- e.g., 'tomorrow', 'meteomatics'
  api_key text not null, -- Encrypted or stored securely (RLS recommended)
  base_weight numeric default 1.0, -- Default reliability weight (0.0 to 1.0+)
  is_active boolean default true,
  config jsonb default '{}'::jsonb, -- Extra config like base_url, rate_limits
  created_at timestamp with time zone default now()
);

-- 2. LOCATIONS TABLE
-- Places tracked by users or system
create table locations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  latitude numeric not null,
  longitude numeric not null,
  timezone text,
  created_at timestamp with time zone default now(),
  unique(latitude, longitude)
);

-- 3. RAW FORECASTS TABLE
-- Stores raw JSON responses from each provider for auditing/history/AI training
create table raw_forecasts (
  id uuid primary key default uuid_generate_v4(),
  source_id uuid references sources(id),
  location_id uuid references locations(id),
  forecast_time timestamp with time zone not null, -- When the forecast applies to
  fetched_at timestamp with time zone default now(),
  raw_data jsonb not null, -- The full JSON response
  processed boolean default false
);

-- 4. SMART FORECASTS TABLE
-- The final aggregated result served to the frontend
create table smart_forecasts (
  id uuid primary key default uuid_generate_v4(),
  location_id uuid references locations(id),
  forecast_time timestamp with time zone not null,
  generated_at timestamp with time zone default now(),
  
  -- Core Aggregated Metrics
  temperature numeric,
  feels_like numeric,
  humidity numeric,
  wind_speed numeric,
  wind_direction numeric,
  precipitation_probability numeric,
  precipitation_intensity numeric,
  condition_code text, -- e.g., 'clear', 'rain', 'cloudy' (normalized)
  condition_text text,
  uv_index numeric,
  visibility numeric,
  
  -- Metadata
  contributing_sources jsonb, -- List of sources used and their weights in this calc
  confidence_score numeric -- Calculated reliability score
);

-- 5. USERS PROFILE (Synced with Supabase Auth)
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  preferences jsonb default '{}'::jsonb, -- Unit prefs (C/F), saved locations IDs
  updated_at timestamp with time zone
);

-- SECURITY POLICIES (RLS)
alter table sources enable row level security;
alter table locations enable row level security;
alter table raw_forecasts enable row level security;
alter table smart_forecasts enable row level security;
alter table profiles enable row level security;

-- Only service_role can read/write sources/raw_forecasts usually
-- Public/Authenticated users can read smart_forecasts and locations
