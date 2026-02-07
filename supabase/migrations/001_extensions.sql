-- Migration 001: Estensioni PostgreSQL
-- Abilita le estensioni necessarie per il progetto

-- UUID generation
create extension if not exists "uuid-ossp";

-- Trigram per ricerca fuzzy su localita (futuro)
create extension if not exists "pg_trgm";
