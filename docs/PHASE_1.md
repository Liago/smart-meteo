# Fase 1: Setup & Backend Core - Todo List

Questo documento traccia i progressi dettagliati della Fase 1.

## Stato Attività

### Setup Iniziale
- [x] Inizializzare repository Git (Smart Meteo Monorepo)
- [x] Creare struttura cartelle (`/backend`, `/frontend-web`, `/frontend-ios`)
- [ ] Configurare Supabase (Creazione Progetto + Tabelle iniziali)
- [ ] Configurare Netlify (Link al repo, Environment per Functions)

### Sviluppo Backend (Node.js)
- [x] Setup progetto Node.js in `/backend` (o `/functions` per Netlify)
- [x] Implementare Connector: **Tomorrow.io**
- [x] Implementare Connector: **Meteomatics**
- [x] Implementare Connector: **OpenWeatherMap**
- [x] Implementare Connector: **WeatherAPI**
- [x] Implementare Connector: **AccuWeather**
- [x] Creare funzione "Smart Engine V1" (Aggregazione media pesata)
- [x] Creare Endpoint API Unico (`GET /api/forecast?lat=...&lon=...`)

### Database
- [x] Definire Schema Supabase `sources`
- [x] Definire Schema Supabase `raw_forecasts`
- [ ] Popolare DB con API Keys (encrypt o env vars)

## Problemi Incontrati & Soluzioni
*(Aggiungi qui eventuali blocchi o bug risolti durante lo sviluppo)*

- **Problema**: [Descrizione del problema]
  **Soluzione**: [Come è stato risolto]
