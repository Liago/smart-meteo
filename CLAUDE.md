# CLAUDE.md - Smart Meteo

## Project Overview

Smart Meteo is a full-stack weather forecasting app that aggregates data from multiple weather API providers into a unified "smart" forecast. It has three platforms: a Node.js/Express backend API, a Next.js web frontend, and a native SwiftUI iOS app.

## Architecture

```
smart-meteo/
├── backend/                    # Express API (TypeScript, deployed on Netlify Functions)
│   ├── connectors/             # 9 forecast providers + 1 alerts-only source
│   │   ├── weatherkit.ts       # Apple WeatherKit (weight: 1.2) - JWT auth, alerts, forecastNextHour
│   │   ├── tomorrow.ts         # Tomorrow.io (weight: 1.2)
│   │   ├── openmeteo.ts        # Open-Meteo: best_match (1.1) + 5 models as separate sources
│   │   ├── accuweather.ts      # AccuWeather (weight: 1.1)
│   │   ├── openweathermap.ts   # OpenWeatherMap (weight: 1.0) + One Call alerts
│   │   ├── weatherapi.ts       # WeatherAPI (weight: 1.0) - only AQI source, + alerts
│   │   ├── worldweatheronline.ts # WWO (weight: 1.0)
│   │   ├── meteostat.ts        # Meteostat (weight: 0) - observations only, used as ground truth
│   │   ├── weatherstack.ts     # WeatherStack (weight: 0 - disabled, free plan is HTTP-only)
│   │   └── meteoalarm.ts       # MeteoAlarm/EUMETNET - weather alerts only, no forecast
│   ├── engine/
│   │   └── smartEngine.ts      # Weighted aggregation + cache (schema_version 4)
│   ├── middleware/
│   │   └── auth.ts             # Supabase Bearer token auth
│   ├── routes/
│   │   ├── sources.ts          # /api/sources
│   │   ├── accuracy.ts         # /api/accuracy, /api/accuracy/recompute
│   │   └── alerts.ts           # /api/alerts/* (subscribe, active, poll, health)
│   ├── services/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── apns.ts             # Apple push notifications
│   │   ├── alertProcessor.ts   # Alert -> subscription matching, push, delivery log
│   │   ├── alertPoller.ts      # Background alert polling by subscription cluster
│   │   ├── observations.ts     # Ground truth: observed temperatures (ERA5 archive, Meteostat)
│   │   └── accuracy.ts         # Source MAE vs OBSERVED data -> dynamic weights
│   ├── utils/
│   │   ├── formatter.ts        # Data normalization (UnifiedForecast)
│   │   ├── moon.ts             # Moon phase calculations
│   │   ├── precipitation.ts    # mm aggregation (wet-fraction gate)
│   │   ├── wind.ts             # Circular mean for direction, max for gusts
│   │   ├── consensus.ts        # Source agreement -> confidence score
│   │   └── alertGeo.ts         # Italian regions, alert relevance + dedup
│   ├── scripts/                # verify*.ts - pure-function checks run by npm test
│   ├── app.ts                  # Express app setup (CORS, routes)
│   ├── server.ts               # Dev server entry point
│   └── types.ts                # TypeScript interfaces
│
├── frontend-web/               # Next.js 16 + React 19 (deployed on Vercel)
│   ├── app/
│   │   ├── page.tsx            # Dashboard (main page)
│   │   ├── layout.tsx          # Root layout
│   │   ├── globals.css         # Global Tailwind styles
│   │   ├── login/page.tsx      # Login page
│   │   ├── sources/page.tsx    # Weather sources management
│   │   └── auth/callback/route.ts  # OAuth callback handler
│   ├── components/
│   │   ├── CurrentWeather.tsx   # Current conditions + AQI
│   │   ├── NextHourPrecipitation.tsx # Minute-by-minute nowcast (WeatherKit)
│   │   ├── WeatherAlerts.tsx    # Alert banners + header badge
│   │   ├── DayNarrative.tsx     # Discursive day summary by time band
│   │   ├── AirQualitySummary.tsx / AirQualityPanel.tsx # AQI tile + pollutant modal
│   │   ├── HourlyDetail.tsx     # Hourly metric modal (precip/wind/humidity/UV/...)
│   │   ├── WeatherEffects.tsx   # Particle layers for the dynamic background
│   │   ├── ui/Modal.tsx, ui/MetricSelect.tsx # Shared primitives
│   │   ├── HourlyForecast.tsx   # 12h timeline with astronomy events
│   │   ├── ForecastDetails.tsx  # 7-day forecast with hourly drill-down
│   │   ├── SunWindCard.tsx      # Sun arc, wind turbines, pressure
│   │   ├── DynamicBackground.tsx # Animated weather backgrounds (rain/snow/storm)
│   │   ├── WeatherIcon.tsx      # SVG weather condition icons
│   │   ├── SearchBar.tsx        # Location search + saved/home locations
│   │   ├── SourcesIndicator.tsx # Active sources display
│   │   ├── AuthButton.tsx       # Login/logout
│   │   ├── SkeletonLoader.tsx   # Loading placeholders
│   │   └── ErrorFallback.tsx    # Error display
│   ├── lib/
│   │   ├── api.ts              # API client (getForecast, getSources, toggleSource, getHealth)
│   │   ├── types.ts            # TypeScript interfaces (ForecastResponse, WeatherSource, etc.)
│   │   ├── hooks.ts            # SWR hooks (useForecast, useSources)
│   │   ├── useLocations.ts     # Location management (localStorage + Supabase sync)
│   │   ├── weather-utils.ts    # Condition labels/icons/gradients, WMO code mapping
│   │   └── supabase/
│   │       ├── client.ts       # Browser Supabase client
│   │       ├── server.ts       # SSR Supabase client
│   │       ├── middleware.ts   # Auth session refresh
│   │       └── locations.ts    # Location CRUD (Supabase)
│   ├── __tests__/
│   │   ├── api.test.ts         # API client tests
│   │   ├── components.test.tsx # Component rendering tests
│   │   └── weather-utils.test.ts # Utility tests
│   ├── middleware.ts           # Next.js middleware (Supabase session)
│   └── vercel.json             # Vercel deployment config
│
├── frontend-ios/               # SwiftUI native iOS app
│   └── smart-meteo/
│       └── smart-meteo/
│           ├── App/
│           │   ├── SmartMeteoApp.swift     # App entry point
│           │   └── ContentView.swift       # Root view
│           ├── Models/
│           │   ├── Forecast.swift          # Decodable forecast models
│           │   └── WeatherSource.swift     # Source models
│           ├── Services/
│           │   ├── WeatherService.swift    # Weather data fetching
│           │   ├── LocationService.swift   # Location management
│           │   └── AuthService.swift       # Authentication
│           ├── Core/
│           │   ├── Config/AppConfig.swift  # App configuration
│           │   ├── Location/LocationManager.swift  # Device GPS
│           │   ├── Network/APIService.swift        # HTTP client
│           │   ├── Networking/SupabaseClient.swift  # Supabase integration
│           │   └── State/AppState.swift    # Global state management
│           └── UI/
│               ├── DesignSystem/AppColors.swift  # Color palette & theming
│               ├── Common/
│               │   ├── DynamicBackground.swift   # Weather-aware backgrounds
│               │   ├── GlassContainer.swift      # Glassmorphism container
│               │   ├── LoadingView.swift
│               │   ├── ViewState.swift
│               │   └── WeatherChartView.swift    # Chart rendering
│               ├── Features/
│               │   ├── Dashboard/
│               │   │   ├── DashboardView.swift       # Main dashboard
│               │   │   ├── DashboardViewModel.swift  # Dashboard MVVM VM
│               │   │   ├── CurrentWeatherView.swift  # Current conditions
│               │   │   ├── HourlyForecastView.swift  # Hourly graph + timeline
│               │   │   ├── DailyForecastView.swift   # Daily forecast + WMO icons
│               │   │   └── SunWindCard.swift         # Sun arc, wind, pressure
│               │   ├── Login/LoginView.swift
│               │   ├── Search/SearchView.swift
│               │   └── Settings/
│               │       ├── SettingsView.swift
│               │       ├── GeneralSettingsView.swift
│               │       ├── SourcesView.swift         # Toggle weather sources
│               │       ├── FavoritesView.swift       # Saved locations
│               │       └── SidebarView.swift
│               └── Onboarding/SplashView.swift
│
├── netlify/
│   └── functions/
│       └── api.ts              # serverless-http wrapper for Express
├── supabase/
│   └── migrations/             # 12 migration files (001-012)
└── docs/                       # Implementation plans (PHASE_1-3, BACKEND_DB_INTEGRATION)
```

## Tech Stack

- **Backend:** Node.js, Express 5, TypeScript, Supabase (PostgreSQL with RLS)
- **Frontend Web:** Next.js 16.1.6, React 19.2.3, Tailwind CSS v4, SWR, Framer Motion, Lucide React icons
- **Frontend iOS:** SwiftUI, MVVM architecture, Glassmorphism UI
- **Auth:** Supabase Auth (SSR via @supabase/ssr, Bearer token on API)
- **Deployment:** Netlify (backend API as serverless functions), Vercel (web frontend)
- **Package Manager:** npm

## Development Commands

```bash
# Install all dependencies
npm run install:all

# Run backend dev server (port 3000)
npm run dev:backend

# Run frontend web dev server
npm run dev:frontend

# Run frontend tests
npm test

# Run tests in watch mode
cd frontend-web && npm run test:watch

# Lint frontend
cd frontend-web && npm run lint

# Build frontend
cd frontend-web && npm run build
```

## Environment Variables

**Backend** (`backend/.env` - see `backend/.env.example`):
- `PORT`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL` (CORS origin)
- Weather API keys: `TOMORROW_API_KEY`, `OPENWEATHER_API_KEY`, `WEATHERAPI_KEY`, `ACCUWEATHER_API_KEY`, `METEOSTAT_KEY`, `WORLDWEATHER_KEY`, `WEATHERSTACK_KEY` (unused: source disabled)
- Apple WeatherKit (JWT): `APPLE_TEAM_ID`, `APPLE_SERVICE_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`
- Push notifications (APNs): `APNS_TEAM_ID`, `APNS_KEY_ID`, `APNS_PRIVATE_KEY`, `APNS_BUNDLE_ID`, `APNS_PRODUCTION`
- Scheduled alert polling: `CRON_SECRET` (guards `POST /api/alerts/poll`; without it the endpoint answers 503 rather than staying open)
- `OPENMETEO_MODELS` (optional): comma-separated model ids to narrow the Open-Meteo models, or `off` to fall back to the single `best_match` source
- Open-Meteo needs no key. There is **no** Meteomatics connector: it was in the
  original plan (`docs/IMPLEMENTATION_PLAN.md`) but was replaced by Open-Meteo,
  so `METEOMATICS_*` in `.env.example` is dead configuration.

**Frontend Web** (`frontend-web/.env.local` - see `frontend-web/.env.example`):
- `NEXT_PUBLIC_API_URL` (backend URL, `http://localhost:3000` for dev)

## API Endpoints

- `GET /api/forecast?lat=<lat>&lon=<lon>` - Smart aggregated forecast
- `GET /api/sources` - List weather sources with status/weights
- `PATCH /api/sources/:id` - Enable/disable a weather source (auth required)
- `GET /api/health` - Backend health check
- `POST /api/alerts/subscribe` / `POST /api/alerts/unsubscribe` - Device push registration
- `GET /api/alerts/active?lat=&lon=` - Active alerts for an area
- `POST /api/alerts/poll` - Alert polling, guarded by the `X-Cron-Secret` header
- `GET /api/accuracy` - Per-source MAE against observed temperatures, sample count, window and resulting weight multiplier (public read)
- `POST /api/accuracy/recompute` - Daily verification job, guarded by `X-Cron-Secret`
- `GET /api/alerts/health` - APNs status, subscription count, 24h delivery stats
- `POST /api/alerts/test-push` - Manual push test

## Testing

- Web tests are in `frontend-web/__tests__/` (7 suites: api, components, weather-utils,
  air-quality, narrative, hourly-detail, next-hour), `npm test` from the repo root
- Framework: Jest 30 + React Testing Library + ts-jest, jsdom environment
- Backend tests: `cd backend && npm test` - **229 tests in 11 suites** (Jest + ts-jest,
  node environment). `__tests__/utils/` for the pure aggregation functions,
  `__tests__/connectors/` for the 9 providers (axios-mock-adapter, fixtures as builders
  in `__tests__/fixtures/providers.ts`), `__tests__/engine/` for the aggregation with
  Supabase and connectors mocked, `__tests__/routes/` for the HTTP contract via supertest
- `windUnits.test.ts` checks the m/s convention across **all** connectors at once: a
  per-connector test would not catch a unit mismatch, since each one is self-consistent
- `cd backend && npm run typecheck` for `tsc --noEmit` (covers the tests too)
- E2E: `cd frontend-web && npm run test:e2e` - 25 scenarios × 2 viewports (Playwright).
  The backend API is never contacted: every scenario starts from a known response built
  in `e2e/fixtures/api.ts`. Set `CHROMIUM_PATH` where Playwright browsers cannot be
  downloaded. `e2e/` is excluded from Jest
- iOS has no automated tests; no Lighthouse audit yet - both in `docs/TODO_TESTING.md`

## Key Patterns

- **Weather connectors** implement a common interface in `backend/connectors/` - each normalizes provider-specific data into a unified `UnifiedForecast` format defined in `backend/types.ts` and `backend/utils/formatter.ts`
- **Smart engine** (`backend/engine/smartEngine.ts`) fetches from up to 9 sources in parallel, aggregates using weighted averaging, and caches results for 30 minutes
- **Cache invalidation by shape**: `FORECAST_SCHEMA_VERSION` is stored inside `full_data`; a cached row with a different version is ignored and regenerated. Bump it whenever response fields are added or renamed
- **Open-Meteo multi-model**: Open-Meteo is a free frontend over national weather services' models, not a model of its own. It is queried **one model at a time** (`&models=`), so ICON-D2, ICON-EU, ECMWF IFS, Météo-France and GFS enter the aggregation as five independent sources (`open-meteo:icon_d2` …), giving more statistical diversity than several commercial providers that rebrand the same GFS/ECMWF. The models **replace** the `open-meteo` (`best_match`) source rather than joining it: `best_match` is a blend of the same models, so using both would double-count. Switch off with `OPENMETEO_MODELS=off`, or narrow it with a comma-separated list of model ids
- **Source weights** range from 0 (Weatherstack, disabled) through 0.8 (Meteostat) to 1.2 (Tomorrow.io, WeatherKit, ICON-D2), stored in the `SOURCE_WEIGHTS` constant (model weights live next to each model in `connectors/openmeteo.ts`), then scaled at runtime by `1 / (1 + MAE)` from the `source_accuracy` table
- **The MAE is measured against observations**, not against the consensus of the other sources. Until Phase 6C it was the deviation from the aggregate, which rewarded conformity and penalised a source that was right while the others were wrong. `services/observations.ts` gets the observed temperatures from Open-Meteo Archive (ERA5, free, no key) with Meteostat as a fallback; each comparison is a row in `accuracy_samples`, and the MAE is **recomputed** over a 30-day sliding window instead of being updated as a never-decaying cumulative average. A source needs 20 samples before its MAE moves its weight
- **What is verified is the nowcast**, not the +24h horizon: `raw_forecasts` stores each source's *current* values, not its forecast per horizon. Extending it needs a schema change - see `docs/GAP_ANALYSIS_2026-09.md` §3.4
- **Meteostat is not a forecast source**: it reports observations, sometimes hours old, and they used to land in the average of the *current* temperature. It now has weight 0 and serves as ground truth for the accuracy job
- **Weighted everywhere**: `utils/aggregate.ts` (`weightedMean`, `weightedVote`) is shared by the current, daily and hourly levels. Until Phase 6C the daily and hourly levels used a plain arithmetic mean and ignored `SOURCE_WEIGHTS` entirely — Meteostat (0.8, past observations) counted as much as WeatherKit (1.2) on the 7-day forecast and the hourly curve
- **Aggregation rules that are not a plain mean** live in `backend/utils/`: circular mean for wind direction, max for gusts, wet-fraction-gated mean for mm, weighted standard deviation for the confidence score. All pure functions with their own test suites
- **Supabase RLS** is enabled on all database tables for row-level security
- **SWR** is used for client-side data fetching with 5-minute refresh intervals
- **Location management** uses localStorage for guests with automatic Supabase sync on login
- **iOS app** uses MVVM with `DashboardViewModel`, a design system in `UI/DesignSystem/` (AppColors), and glassmorphism UI containers
- **WMO weather codes** are mapped to Italian labels and icons in both web (`weather-utils.ts`) and iOS (`DailyForecastView.swift`)
- **Dynamic backgrounds** animate weather conditions (rain particles, snow, storm effects) on both web and iOS

## Code Style

- TypeScript strict mode in both backend and frontend
- ESLint with Next.js core web vitals rules for frontend
- Tailwind CSS v4 for styling (utility-first, glassmorphism patterns)
- Italian comments and labels throughout (the project language context is Italian)
- Framer Motion for web animations, SwiftUI animations for iOS

## Database

- Supabase (PostgreSQL) with schema in `backend/supabase_schema.sql`
- 23 migrations in `supabase/migrations/` (001-023): extensions, tables, RLS policies, indexes, triggers, source seeds, `full_data` cache column, source accuracy, WeatherKit, push notifications, alert enhancement, delivery log, alert location, per-device dedup, Open-Meteo model sources, accuracy samples
- The next free migration number is **024**
- Main tables: `sources`, `locations`, `raw_forecasts`, `smart_forecasts`, `profiles`, `source_accuracy`, `accuracy_samples`, `alert_subscriptions`, `weather_alerts`, `alert_delivery_log`
- `upsert_location` utility function for location management
- Automatic `updated_at` triggers on all tables

## Key Data Types

```typescript
// Frontend types (frontend-web/lib/types.ts)
ForecastCurrent    // temperature, feels_like, humidity, wind (speed/direction/gust/label), precipitation_prob, dew_point, aqi, pressure, condition
DailyForecast      // date, temp_max/min, precipitation_prob, condition_code/text
HourlyForecast     // time, temp, precipitation_prob, condition_code/text
AstronomyData      // sunrise, sunset, moon_phase
ForecastResponse   // location, generated_at, sources_used, current, daily[], hourly[], astronomy
WeatherSource      // id, name, weight, active, description, lastError, lastResponseMs
WeatherCondition   // 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown'
```

## Recent Implementations

- **Minute-by-minute nowcast** (backend + web + iOS): WeatherKit's `forecastNextHour` was already propagated by the engine but no client read it. `NextHourPrecipitation.tsx` / `NextHourPrecipitationView.swift` derive the headline from the minutes themselves ("inizia fra 12 minuti", "smette fra 20"), not from WeatherKit's `summary`, and require 3 consecutive dry minutes before announcing the rain has stopped. Dry hour renders as a single line, no chart.
- **Source confidence** (backend + web): `backend/utils/consensus.ts` computes a weighted standard deviation across sources on temperature and precipitation probability, shrunk toward 50 by `n / (n + 2)` because two agreeing sources are not nine. Exposed as `confidence` on the response and finally written to `smart_forecasts.confidence_score`, which had been null since migration 005. Shown in `SourcesIndicator` with the coldest-to-warmest range. **Web only for now**: iOS has no sources panel to host it.
- **Current precipitation intensity**: `precipitation_intensity` (mm/h now) was extracted by five connectors and never aggregated. It now reuses the wet-fraction gate of the forecast mm, so one isolated source cannot invent ongoing rain.
- **Moon data on web**: `moonrise`, `moonset` and `moon_illumination` were on the wire and displayed only by iOS. Now in `SunWindCard`, with a fallback parser because the providers disagree on the time format.

- **Air quality detail (web)**: parity with the iOS "Qualità dell'aria" panel. `frontend-web/lib/air-quality.ts` is the port of `Models/WeatherDescriptionEngine.swift` — EPA 1-6 category scale (`getAqiScale`, returning both a fill colour and a Tailwind text class), the `POLLUTANTS` registry with WHO 2021 thresholds, and `generateAirQualityDescription`. `AirQualityPanel.tsx` renders the description plus the 3×2 pollutant grid inside the shared `ui/Modal`, opened from an info button on the flipped AQI tile of `CurrentWeather`. Web AQI labels now match iOS (`Buona / Moderata / …`). **No backend change**: `current.air_quality` was already on the wire — only WeatherAPI supplies it, so all of this is gated on its presence.
- **Hourly detail metric picker** (backend + web + iOS): the precipitation detail modal is now a generic hourly-metric view. The title is a dropdown selecting between precipitation, wind, humidity, apparent temperature and UV index. What each metric draws lives in a registry — `frontend-web/lib/metrics.ts` and `UI/DesignSystem/MetricScale.swift` — so the view (`HourlyDetail.tsx` / `HourlyDetailView.swift`) is metric-agnostic and adding one means adding a registry entry. Backend gained `feels_like`, `wind_direction` and `wind_gust` on `HourlyForecast`. `backend/utils/wind.ts` aggregates direction with a **circular** mean (350° and 10° average to 0°, not 180°) and gusts with a **max** rather than a mean; the circular mean is reused at the `current` level too. Schema version bumped to 3.
- **Precipitation amount (mm)** (backend + web + iOS): `precipitation_mm` on hourly and daily forecasts, aggregated in `backend/utils/precipitation.ts` with a wet-fraction-gated weighted mean. Tap/click an hour or a daily rain cell to open a detail view with a day strip, an mm bar chart with Light/Moderate/Heavy bands, and a probability chart. Intensity thresholds (NWS: 0.1 / 2.5 / 7.6 mm/h) live in `frontend-web/lib/weather-utils.ts` and `UI/DesignSystem/PrecipitationScale.swift`. OpenWeatherMap contributes only to the daily total — its slots are 3-hour sums, not hourly accumulations.
- **Hourly timezone bucketing fix** (backend): `smartEngine` used to key hourly slots by truncating the timestamp string, treating tomorrow.io's and WeatherKit's UTC times as local. Now offset-bearing timestamps are converted using `utc_offset_seconds` from Open-Meteo.
- **Sun & Wind card** (web + iOS): semi-circle sun arc showing sunrise/sunset position, wind speed/direction with turbine animation, barometric pressure display
- **7-day forecast details** (web): expandable daily cards with hourly drill-down per day
- **WMO weather code mapping** (iOS): proper icon display in DailyForecastView based on WMO codes
- **Hourly forecast alignment** (iOS): graph start time aligned with current hour
- **Wind unit conversion** (iOS): correct m/s to km/h conversion and rain percentage formatting
- **Dynamic backgrounds** (web + iOS): weather-aware animated backgrounds with particle effects
- **Favorite locations sync**: Supabase REST API integration for real-time favorites sync, prevention of name overwriting by coordinates
- **Improved readability**: white text for weather detail values, better label contrast
