# Fase 1: Setup & Backend Core - Todo List

Questo documento traccia i progressi dettagliati della Fase 1.

## Stato Attività

### Setup Iniziale
- [ ] Inizializzare repository Git (Smart Meteo Monorepo)
- [ ] Creare struttura cartelle (`/backend`, `/frontend-web`, `/frontend-ios`)
- [ ] Configurare Supabase (Creazione Progetto + Tabelle iniziali)
- [ ] Configurare Netlify (Link al repo, Environment per Functions)

### Sviluppo Backend (Node.js)
- [ ] Setup progetto Node.js in `/backend` (o `/functions` per Netlify)
- [ ] Implementare Connector: **Tomorrow.io**
- [ ] Implementare Connector: **Meteomatics**
- [ ] Implementare Connector: **OpenWeatherMap**
- [ ] Implementare Connector: **WeatherAPI**
- [ ] Implementare Connector: **AccuWeather**
- [ ] Creare funzione "Smart Engine V1" (Aggregazione media pesata)
- [ ] Creare Endpoint API Unico (`GET /api/forecast?lat=...&lon=...`)

### Database
- [ ] Definire Schema Supabase `sources`
- [ ] Definire Schema Supabase `raw_forecasts`
- [ ] Popolare DB con API Keys (encrypt o env vars)

## Problemi Incontrati & Soluzioni
*(Aggiungi qui eventuali blocchi o bug risolti durante lo sviluppo)*

- **Problema**: [Descrizione del problema]
  **Soluzione**: [Come è stato risolto]
