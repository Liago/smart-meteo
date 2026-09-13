# Fase 1: Setup & Backend Core - Todo List

Questo documento traccia i progressi dettagliati della Fase 1.

## Stato Attività

### Setup Iniziale
- [x] Inizializzare repository Git (Smart Meteo Monorepo)
- [x] Creare struttura cartelle (`/backend`, `/frontend-web`, `/frontend-ios`)
- [x] Configurare Supabase (Creazione Progetto + Tabelle iniziali)
- [x] Configurare Netlify (Link al repo, Environment per Functions)

### Sviluppo Backend (Node.js)
- [x] Setup progetto Node.js in `/backend` (o `/functions` per Netlify)
- [x] Implementare Connector: **Tomorrow.io**
- [ ] ~~Implementare Connector: **Meteomatics**~~ — **mai realizzato.** La spunta era
  errata: `backend/connectors/` non contiene un connettore Meteomatics. Il ruolo di
  fonte europea ad alta risoluzione è stato preso da **Open-Meteo** (gratuita, senza
  chiave), che non figurava nel piano iniziale. Verificato il 2026-09-12.
- [x] Implementare Connector: **OpenWeatherMap**
- [x] Implementare Connector: **WeatherAPI**
- [x] Implementare Connector: **AccuWeather**
- [x] Creare funzione "Smart Engine V1" (Aggregazione media pesata)
- [x] Creare Endpoint API Unico (`GET /api/forecast?lat=...&lon=...`)

### Database
- [x] Definire Schema Supabase `sources`
- [x] Definire Schema Supabase `raw_forecasts`
- [x] Popolare DB con API Keys (encrypt o env vars)

### Connettori effettivamente presenti (verifica 2026-09-12)

Tomorrow.io, Open-Meteo, OpenWeatherMap, WeatherAPI, AccuWeather, World Weather
Online, Meteostat, Weatherstack (disabilitato, peso 0) e Apple WeatherKit, più
MeteoAlarm per le sole allerte: **nove fonti previsionali**, non cinque.

## Problemi Incontrati & Soluzioni

- **Problema**: la checklist dichiarava implementato il connettore Meteomatics.
  **Soluzione**: corretta la spunta. La fonte non è mai stata integrata; il piano
  è stato cambiato in favore di Open-Meteo senza aggiornare il documento.
