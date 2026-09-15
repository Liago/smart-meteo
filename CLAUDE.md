# CLAUDE.md - Smart Meteo

## Project Overview

Smart Meteo is a full-stack weather forecasting app that aggregates data from multiple weather API providers into a unified "smart" forecast. It has three platforms: a Node.js/Express backend API, a Next.js web frontend, and a native SwiftUI iOS app.

## Architecture

```
smart-meteo/
├── backend/                    # Express API (TypeScript, deployed on Netlify Functions)
│   ├── connectors/             # 9 forecast providers + alerts, marine, air quality, ensemble
│   │   ├── weatherkit.ts       # Apple WeatherKit (weight: 1.2) - JWT auth, alerts, forecastNextHour, snow
│   │   ├── tomorrow.ts         # Tomorrow.io (weight: 1.2)
│   │   ├── openmeteo.ts        # Open-Meteo: best_match (1.1) + 5 models as separate sources
│   │   ├── accuweather.ts      # AccuWeather (weight: 1.1)
│   │   ├── openweathermap.ts   # OpenWeatherMap (weight: 1.0) + One Call alerts
│   │   ├── weatherapi.ts       # WeatherAPI (weight: 1.0) - only AQI source, + alerts
│   │   ├── worldweatheronline.ts # WWO (weight: 1.0) - only thunder-probability source
│   │   ├── meteostat.ts        # Meteostat (weight: 0) - observations only, used as ground truth
│   │   ├── weatherstack.ts     # WeatherStack (weight: 0 - disabled, free plan is HTTP-only)
│   │   ├── openmeteoEnsemble.ts # Ensemble members -> temperature p10/p50/p90 band
│   │   ├── openmeteoMarine.ts  # Waves + sea temperature; self-excludes inland
│   │   ├── openmeteoAirQuality.ts # European AQI, pollutants and CAMS pollen
│   │   │                          # (openmeteo.ts also carries snow depth,
│   │   │                          #  snowfall, freezing level and soil temp)
│   │   └── meteoalarm.ts       # MeteoAlarm/EUMETNET - alerts only; in engine, poller and /active
│   ├── engine/
│   │   └── smartEngine.ts      # Weighted aggregation + cache (schema_version 16)
│   ├── middleware/
│   │   └── auth.ts             # Supabase Bearer token auth
│   ├── routes/
│   │   ├── sources.ts          # /api/sources
│   │   ├── accuracy.ts         # /api/accuracy, /api/accuracy/recompute
│   │   └── alerts.ts           # /api/alerts/* (subscribe, active, poll, health, rules)
│   ├── services/
│   │   ├── supabase.ts         # Supabase client
│   │   ├── apns.ts             # Apple push notifications
│   │   ├── alertProcessor.ts   # Alert -> subscription matching, push, delivery log
│   │   ├── alertPoller.ts      # Background alert polling by subscription cluster
│   │   ├── ruleProcessor.ts    # Personal threshold rules -> push (claim-then-send)
│   │   ├── observations.ts     # Ground truth: observed temperatures (ERA5 archive, Meteostat)
│   │   └── accuracy.ts         # Source MAE vs OBSERVED data -> dynamic weights
│   ├── utils/
│   │   ├── formatter.ts        # Data normalization (UnifiedForecast)
│   │   ├── moon.ts             # Moon phase calculations
│   │   ├── precipitation.ts    # mm aggregation (wet-fraction gate)
│   │   ├── wind.ts             # Circular mean for direction, max for gusts
│   │   ├── consensus.ts        # Source agreement -> confidence score
│   │   ├── snow.ts             # Snow line, snow phase, frost risk
│   │   ├── storm.ts            # CAPE + lifted index -> 0-100 storm risk
│   │   ├── garden.ts           # Soil moisture + ET0 -> irrigation advice
│   │   ├── solar.ts            # Irradiance -> PV specific yield (kWh/kWp)
│   │   ├── sky.ts              # Cloud layers -> sunset quality, stargazing
│   │   ├── sea.ts              # Wave height -> Italian sea-state wording
│   │   ├── activities.ts       # Lifestyle scores: running, cycling, laundry
│   │   ├── alertRules.ts       # Personal threshold metrics + pure evaluation
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
│   │   ├── PollenPanel.tsx      # Pollen species, daily peak
│   │   ├── SnowPanel.tsx        # Snow line vs altitude, snow depth, frost
│   │   ├── GardenPanel.tsx      # Soil moisture, water balance, sowing window
│   │   ├── SolarPanel.tsx       # PV yield per day, plant size in localStorage
│   │   ├── SkyPanel.tsx         # Sunset quality + stargazing outlook
│   │   ├── SeaPanel.tsx         # Water temperature, waves, sea state
│   │   ├── ActivitiesPanel.tsx  # "Buona giornata per…" lifestyle scores
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
│   ├── __tests__/              # 16 Jest suites (api, components, weather-utils,
│   │                           #  air-quality, narrative, hourly-detail,
│   │                           #  next-hour, pollen, snow, storm, garden,
│   │                           #  solar, sky, sea, activities)
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
│               ├── DesignSystem/
│               │   ├── AppColors.swift          # Color(hex:) + legacy gradients
│               │   ├── WeatherTheme.swift       # Condition themes, Duet tokens, WeatherSymbol
│               │   ├── Units.swift              # °C/°F, km-h/m-s/mph/kn, mm/in + formatting
│               │   └── SmoothCurve.swift        # Shared Path interpolation
│               ├── Common/
│               │   ├── DynamicBackground.swift   # Weather-aware backgrounds
│               │   ├── GlassContainer.swift      # Glassmorphism container
│               │   ├── LoadingView.swift
│               │   ├── ViewState.swift
│               │   └── WeatherChartView.swift    # Chart rendering
│               ├── Features/
│               │   ├── Dashboard/
│               │   │   ├── DashboardView.swift       # Main dashboard (redesign shell)
│               │   │   ├── DashboardHeroView.swift   # Header, alert pill, both heroes
│               │   │   ├── CollapsibleSection.swift  # Section + white sheet + divider
│               │   │   ├── HourlySparklineView.swift # Scrubbable hourly curve
│               │   │   ├── DailyRowsView.swift       # 7 rows with shared-scale range bar
│               │   │   ├── ForYouCard.swift          # Card model + builder from the response
│               │   │   ├── ForYouSectionView.swift   # "Per te" grid + prefs
│               │   │   ├── SourcesSectionView.swift  # Consensus badge + source chips
│               │   │   ├── DashboardViewModel.swift  # Dashboard MVVM VM
│               │   │   ├── CurrentWeatherView.swift  # Current conditions
│               │   │   ├── HourlyForecastView.swift  # Hourly graph + timeline
│               │   │   ├── DailyForecastView.swift   # Daily forecast + WMO icons
│               │   │   ├── SunWindCard.swift         # Sun arc, wind, pressure
│               │   │   ├── SourcesIndicatorView.swift # Sources + consensus index
│               │   │   ├── PollenPanelView.swift     # Pollen species, daily peak
│               │   │   ├── SnowPanelView.swift       # Snow line, depth, frost
│               │   │   ├── GardenPanelView.swift     # Irrigation advice, sowing
│               │   │   ├── SolarPanelView.swift      # PV yield, plant size in @AppStorage
│               │   │   ├── SkyPanelView.swift        # Sunset quality + stargazing
│               │   │   ├── SeaPanelView.swift        # Water temperature, waves, sea state
│               │   │   ├── ActivitiesPanelView.swift # "Buona giornata per…" scores
│               │   │   └── NextHourPrecipitationView.swift # Minute-by-minute nowcast
│               │   ├── Login/LoginView.swift
│               │   ├── Search/SearchView.swift
│               │   └── Settings/
│               │       ├── SettingsKit.swift        # Shared page/card/row building blocks
│               │       ├── SettingsView.swift
│               │       ├── GeneralSettingsView.swift # Real unit pickers
│               │       ├── SourcesView.swift         # Toggle weather sources
│               │       ├── FavoritesView.swift       # Saved locations
│               │       ├── AlertRulesView.swift      # Personal threshold rules
│               │       ├── ForYouSettingsView.swift  # Toggle + reorder the "Per te" cards
│               │       └── SidebarView.swift
│               └── Onboarding/SplashView.swift
│
├── netlify/
│   └── functions/
│       └── api.ts              # serverless-http wrapper for Express
├── supabase/
│   └── migrations/             # 24 migration files (001-024)
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
- `OPENMETEO_ENSEMBLE` (optional): ensemble model for the uncertainty band (default `icon_eu`), or `off` to drop the band
- Open-Meteo Air Quality needs no key either: it supplies the European AQI, the pollutants and the CAMS pollen species
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
- `GET /api/alerts/rules/metrics` - Registry of thresholdable metrics (id, label, unit, allowed comparators)
- `POST /api/alerts/rules/list` - A device's personal threshold rules (device token in the body, not the query string)
- `POST /api/alerts/rules` / `PATCH /api/alerts/rules/:id` / `DELETE /api/alerts/rules/:id` - Rule CRUD, each gated on the device token

## Testing

- Web tests are in `frontend-web/__tests__/` (15 suites: api, components, weather-utils,
  air-quality, narrative, hourly-detail, forecast-details, next-hour, pollen, snow, storm,
  garden, solar, sky, sea, activities), `npm test` from the repo root. `hourly-detail` pins the clock with fake
  timers: since the day strip drops past days, a suite with dates hardcoded in the past would
  have started failing on a calendar date rather than on a code change
- Framework: Jest 30 + React Testing Library + ts-jest, jsdom environment
- Backend tests: `cd backend && npm test` - **602 tests in 28 suites** (Jest + ts-jest,
  node environment). `__tests__/utils/` for the pure aggregation functions,
  `__tests__/connectors/` for the 9 providers (axios-mock-adapter, fixtures as builders
  in `__tests__/fixtures/providers.ts`), `__tests__/engine/` for the aggregation with
  Supabase and connectors mocked, `__tests__/routes/` for the HTTP contract via supertest
- `windUnits.test.ts` checks the m/s convention across **all** connectors at once: a
  per-connector test would not catch a unit mismatch, since each one is self-consistent
- `cd backend && npm run typecheck` for `tsc --noEmit` (covers the tests too)
- E2E: `cd frontend-web && npm run test:e2e` - 50 scenarios × 2 viewports (Playwright).
  The backend API is never contacted: every scenario starts from a known response built
  in `e2e/fixtures/api.ts`. Set `CHROMIUM_PATH` where Playwright browsers cannot be
  downloaded. `e2e/` is excluded from Jest
- iOS tests live in `frontend-ios/smart-meteo/smart-meteoTests/` (XCTest, 7 files: forecast
  decoding, hourly window, sky, sea, solar, activities + garden, units). They need a **Unit Testing
  Bundle target created once in Xcode**, named to match the folder so the synchronized group
  picks the files up — see that folder's `README.md`. The pbxproj was deliberately not hand-edited
  here: inventing UUIDs across eight plist sections with no Xcode to verify can leave the project
  unopenable. The decoding suite is the important one — a wrong snake_case key compiles fine and
  silently nils a field, which is how `solar`, `sky`, `sea` and `activities` were arriving and
  being thrown away.
- The Lighthouse audit is **blocked in this environment**, not merely
  pending: `next build` fails because `next/font` cannot reach `fonts.googleapis.com`. Dev mode
  falls back to a system font, so the E2E suite still runs - it is only the production build that
  is impossible. Both tracked in `docs/TODO_TESTING.md`

## Key Patterns

- **Weather connectors** implement a common interface in `backend/connectors/` - each normalizes provider-specific data into a unified `UnifiedForecast` format defined in `backend/types.ts` and `backend/utils/formatter.ts`
- **Smart engine** (`backend/engine/smartEngine.ts`) fetches from up to 9 sources in parallel, aggregates using weighted averaging, and caches results for 30 minutes
- **Cache invalidation by shape**: `FORECAST_SCHEMA_VERSION` is stored inside `full_data`; a cached row with a different version is ignored and regenerated. Bump it whenever response fields are added or renamed. It is exported so the engine tests read it rather than copying the number
- **Open-Meteo multi-model**: Open-Meteo is a free frontend over national weather services' models, not a model of its own. It is queried **one model at a time** (`&models=`), so ICON-D2, ICON-EU, ECMWF IFS, Météo-France and GFS enter the aggregation as five independent sources (`open-meteo:icon_d2` …), giving more statistical diversity than several commercial providers that rebrand the same GFS/ECMWF. The models **replace** the `open-meteo` (`best_match`) source rather than joining it: `best_match` is a blend of the same models, so using both would double-count. Switch off with `OPENMETEO_MODELS=off`, or narrow it with a comma-separated list of model ids
- **Source weights** range from 0 (Weatherstack, disabled) through 0.8 (Meteostat) to 1.2 (Tomorrow.io, WeatherKit, ICON-D2), stored in the `SOURCE_WEIGHTS` constant (model weights live next to each model in `connectors/openmeteo.ts`), then scaled at runtime by `1 / (1 + MAE)` from the `source_accuracy` table
- **The MAE is measured against observations**, not against the consensus of the other sources. Until Phase 6C it was the deviation from the aggregate, which rewarded conformity and penalised a source that was right while the others were wrong. `services/observations.ts` gets the observed temperatures from Open-Meteo Archive (ERA5, free, no key) with Meteostat as a fallback; each comparison is a row in `accuracy_samples`, and the MAE is **recomputed** over a 30-day sliding window instead of being updated as a never-decaying cumulative average. A source needs 20 samples before its MAE moves its weight
- **What is verified is the nowcast**, not the +24h horizon: `raw_forecasts` stores each source's *current* values, not its forecast per horizon. Extending it needs a schema change - see `docs/GAP_ANALYSIS_2026-09.md` §3.4
- **Meteostat is not a forecast source**: it reports observations, sometimes hours old, and they used to land in the average of the *current* temperature. It now has weight 0 and serves as ground truth for the accuracy job
- **Air quality has two sources now**: WeatherAPI (EPA index 1-6 and pollutants) and Open-Meteo Air Quality (European AQI, same pollutants, plus pollen). They are merged rather than chosen between - while WeatherAPI was the only one, an outage left the dashboard with no AQI at all. WeatherAPI keeps precedence on each pollutant: those are the values users have seen for months, and the two sources do not use the same unit for carbon monoxide
- **Pollen thresholds are per species** (`connectors/openmeteoAirQuality.ts`): 30 grains/m³ of grass is a heavy day for an allergy sufferer, the same 30 of olive is nothing. A single threshold would mislabel half the species. The panel shows the **daily peak**, not the current hour: people decide in the morning whether to go out. Pollen is modelled in Europe only - outside it the fields come back null and the block is omitted rather than shown as zero
- **The snow line is not the freezing level**: a snowflake keeps falling past the 0 °C isotherm, cooling the air around it, and reaches the ground 200-400 m lower — `backend/utils/snow.ts` subtracts 300 m, the conventional value for moderate precipitation. The number is only useful **next to the location's own altitude**, which Open-Meteo declares as `elevation` alongside the forecast: "snow line 900 m, you are at 1800 m" is an answer, "freezing level 1500 m" is a bulletin reading. Within 150 m of the line the phase is reported as sleet rather than guessed
- **Frost is judged on the ground when the data is there**: frost forms on the surface, not at the 2 m where stations measure — `soil_temperature_0cm` uses the physical threshold (0 °C), the 2 m fallback a compensated one (+3 °C, because on clear nights the surface radiates and stays 3-4 degrees below the air). The block declares which one it used, and both clients write it out
- **The storm risk is an index, not raw CAPE**: "1800 J/kg" means nothing to a reader, a 0-100 scale with four named bands does — but the CAPE stays in the caption, so whoever can read it has the number and nobody has to trust a unitless score. `backend/utils/storm.ts` averages CAPE and lifted index (the same instability measured two ways), then damps by convective inhibition down to a **floor of 0.3, never to zero**: the cap breaks (afternoon heating, orographic lift, a passing front), and calling 3000 J/kg under a lid "no risk" is the kind of forecast that hurts someone in the mountains. The index is computed **once, on the already-averaged fields** — the function is non-linear, so averaging per-source indices instead gives a different number
- **Apple gives snow in millimetres of depth**, not centimetres and not water equivalent: `snowfallAmount` and `snowfallIntensity` are lengths, so `connectors/weatherkit.ts` divides by ten. Without it 40 mm would have surfaced as "40 cm" — an order of magnitude on a number people use to decide whether to fit snow chains. An absent field stays `null` rather than becoming zero, or WeatherKit's 1.2 weight would dilute the snow the other models forecast
- **Thunder probability is a second chart section, not an ingredient**: the convective indices say how much energy is there, WWO's `chanceofthunder` how likely it is to discharge — two questions, two sources, and merging them into one number loses one of them
- **Personal threshold rules are evaluated on the aggregated forecast**, the same one the app shows: evaluating on a raw source would produce notifications announcing 12 mm while the screen shows 3 — neither wrong, just two different sources, which is worse. The threshold is stored in the unit the user typed (km/h for wind, not m/s) and `backend/utils/alertRules.ts` converts on read. Millimetres **sum** over the window rather than taking the max, because "more than 10 mm tomorrow" is a total
- **A rule belongs to the device, not the subscription**: `/alerts/subscribe` rewrites the subscription row on every significant move and cleans up leftovers, so a CASCADE foreign key would take the rules with it — the same incident migration 021 fixed for dedup. The dedup signature is `rule + day of the trigger`: the poller runs every 15 minutes, so without it four notifications an hour, and keyed on the rule id alone tonight's frost would mute tomorrow's. Rules live in their own table because `weather_alerts`' cooldown is per severity, where an AQI rule would silence a frost rule for six hours
- **Rain outranks everything in the irrigation advice** (`backend/utils/garden.ts`): with 5 mm or more expected in the window the answer is "don't water", even on very dry soil — that is precisely the case a user gets wrong alone, looking at dry earth and reaching for the watering can without knowing a storm is three hours out. The advice always shows its own reason ("the soil loses 4.8 mm more than it receives"): advice without a reason is an oracle, and nobody trusts an oracle about their garden
- **Soil moisture thresholds depend on soil type and the API does not declare it**: field capacity runs ~0.15 m³/m³ for sand and ~0.40 for clay, so the thresholds are a loam's and the raw number is always shown next to the verdict — as percent of volume, because "25% vol." reads and "0.25 m³/m³" does not. Note the **two** soil temperatures: `soil_temperature_0cm` is the surface, where frost forms; `soil_temperature_0_to_7cm` is the root zone, which decides whether a seed germinates
- **`weightedMean` takes a precision argument**: it rounded to one decimal, which on volumetric soil moisture turned 0.25 into 0.3 and 0.06 into 0.1 — from "very dry" to merely "dry". Quantities living between 0 and 1 pass their own `decimals`
- **The PV backend returns specific yield (kWh/kWp), never kWh**: plant size is the user's datum, lives in `localStorage` and never reaches the server — if it did, the 30-minute forecast cache would fragment per user instead of serving everyone at that location. For the same reason **tilt and azimuth are constants of the query, not preferences**: 30° facing south is the typical Italian domestic array, the error on a different roof is a few percent, and the shared cache is worth more. The transposition onto the panel plane is done by Open-Meteo (`global_tilted_irradiance`), not by us — deriving it from DNI/DHI would be unvalidatable astronomy code whose errors stay silent. There is an explicit fallback to the horizontal plane, and **which plane was actually used travels to the user**, because a tilted array out-produces a horizontal estimate in winter
- **The coastline test is the source itself** (`connectors/openmeteoMarine.ts`): the wave model only covers grid points at sea, so inland the endpoint errors or returns all-null series and the connector returns `null` — no coastline dataset, no distance threshold, and more accurate than any threshold we would have picked. The check is on the **data, not the HTTP code**: some inland points answer 200 with null series, and without that guard a "calm sea, 0 m" panel would appear in the middle of the plain. Wave height is rendered as an Italian sea-state word ("mosso"), because "1.3 m" reads as small and is the sea that capsizes a pedalo. Tides are **declared absent** rather than quietly missing: they live on WeatherAPI's `marine.json`, outside our free plan
- **Total cloud cover cannot describe a sunset — altitude can** (`backend/utils/sky.ts`): a memorable sunset needs *high* cloud (cirrus, lit from below once the sun is down) plus a clear horizon for that light to arrive. A clear sky and an overcast one both give an ordinary sunset, for opposite reasons, and one coverage number confuses them. The score is a **product** of canvas (high cloud, peaking at ~50%) and light (how clear the low/mid sky is), never a sum: a sum would award a cloudless sky half marks just for having no low cloud. Low cloud blocks more than mid — it sits between the sun and the viewer at the horizon. The moon **penalises stargazing without zeroing it** (planets and bright stars survive a full moon; faint objects do not), and where total cover is missing it is the **max** of the layers, not their sum — three layers at 40% are not 120% overcast
- **The garden block is NOT omitted when all is calm**, unlike the snow one. Not an inconsistency: the snow panel would have been *empty* — no depth, no snowfall, no frost — for eight months a year, whereas "no need to water" is a full answer, and the one someone with a garden goes looking for in the evening
- **The snow block is omitted when there is nothing to say**: no snow on the ground, no snowfall expected, no frost risk and ordinary rain → no block, so it isn't an empty panel for eight months of the year
- **Weighted everywhere**: `utils/aggregate.ts` (`weightedMean`, `weightedVote`) is shared by the current, daily and hourly levels. Until Phase 6C the daily and hourly levels used a plain arithmetic mean and ignored `SOURCE_WEIGHTS` entirely — Meteostat (0.8, past observations) counted as much as WeatherKit (1.2) on the 7-day forecast and the hourly curve
- **A lifestyle score is the worst factor, never the mean** (`backend/utils/activities.ts`): a day that is perfect on temperature, wind and air but pours with rain is not half a good day to run — a mean would return 60 and hide the single factor you actually give up over, so the score is the **minimum** of its factors and the panel names that factor next to the number ("65, limita il vento" tells you whether to postpone or change route; "65" alone tells you nothing). The limiting factor is only named **below 80**, or an ordinary good day would read as having a problem. These indices are computed rather than bought: AccuWeather sells them ready-made, but each index is its **own** call on a 50-call/day plan of which `connectors/accuweather.ts` already spends 3 per cache miss (~16 servable forecasts a day), so three indices would have halved the forecasts to buy three numbers — and a bought index cannot say *why*. Within the window precipitation probability and wind take the **max** (one hour at 90% among eleven clear ones is still an outing to postpone) while millimetres **sum**; the window never straddles two days, so in the evening it rolls to tomorrow as a whole and the response declares which day it scored
- **The hourly detail opens on today and never offers a past day**: `hourly` can start the evening before — sources in UTC, restated in the location's local hour, hand back a few hours of the previous day — so the day strip filters to `>= today` on both clients, and the entry point passes today's key rather than `hourly.first`, which was opening the sheet on a forecast the day had already disproved. The trim matters twice over: the `slice(0, 7)` was also eating a future day to make room for a past one. On today the default hour is **now**; on any other day it is the peak hour of the metric, which is what makes that day worth looking at
- **`daily` can start yesterday too, and every consumer must pick by date, never by position**: the same UTC-vs-local bucketing that makes `hourly` start the evening before puts a stale day at the head of `daily`. Four places got it wrong in four different ways, and none of them looks wrong on screen because a plausible row is still a row. iOS's «Prossimi giorni» showed yesterday as its first line and, because of the `prefix(7)`, **also dropped the last useful day** to make room for it — the trim costs twice, exactly as it did on the hourly strip. Worse, the dashboard hero took `daily.first` for its max/min, so the largest numbers on the screen were yesterday's. Both widgets had the same `first`/`prefix` pair. The web's `daily.slice(1)` skipped index 0 assuming it was today: when `daily` opened with yesterday it skipped yesterday and left **today**, which that panel must not show because `CurrentWeather` already covers it in full. The fix everywhere is a date comparison — `DailyRowsView.upcoming`/`.today` in the app, `WidgetDateFormatters.upcoming`/`.today` in the widget target (duplicated because a widget is a separate module and cannot see app code), and a `filter(d => d.date > today)` on the web. `solar.days` needs none of it: `buildSolarOutlook` already windows on `h.time >= fromTime` and drops partial days
- **Alerts on the forecast response ride the same call as the forecast**: WeatherKit and WeatherAPI return alerts inside their forecast response, so a connector that returns `null` (its own error contract) drops its alerts with it, and a source **disabled in `/api/sources` is never fetched at all** — disabling WeatherKit as a forecast source also silences its alerts. The engine now also calls **MeteoAlarm** directly, alongside OpenWeatherMap, in a `Promise.allSettled` that cannot fail the forecast: in Italy MeteoAlarm is the civil-protection feed, so it is normal for it to be the *only* source with a warning on a given day — and while it was missing from the engine, exactly those days produced a forecast response with `alerts: []` while `/api/alerts/active` had two. Both paths now query the same four sources. On a cache hit the engine deliberately **re-fetches alerts live** rather than serving the cached ones: a forecast is good for thirty minutes, an alert issued ten minutes ago is not. All of this is covered by the `allerte` block in the engine suite — until then every mock returned `alerts: []`, so the whole path could break without a single test noticing, and a failure there looks exactly like a calm day
- **An optional field from one source must never take down the whole response**: WeatherKit omits `forecastNextHour.summary[].endTime` on the last segment to mean «until the end of the window» — and when the hour is uniform, which is the common case, the last segment is also the only one. The backend propagated it as `undefined`, which simply vanishes from JSON, while iOS declared `let endTime: String`: the `keyNotFound` error rose all the way to `ForecastResponse`, so the dashboard showed a decoding error **instead of the forecast** — a whole screen lost to a cosmetic field nobody reads. Three changes, in increasing order of generality: the field is optional on all three platforms; the connector **omits the key** rather than emitting `undefined`, so the type stops promising a string that is not there; and `ForecastNextHour` decodes **leniently** (`try?` on both arrays), because the block comes from one source out of nine and is already optional — a missing panel is a degradation, an error screen in place of the forecast is a failure. The iOS decoding suite had missed it because its fixture used `"summary": []`: an empty array decodes no elements, hence no fields, hence no error — a fixture that avoids the difficult shape proves nothing. `summary` itself is read by neither client: both derive the headline from the minutes, which say *when* the rain starts and stops
- **Units are the user's choice, but thresholds are not** (`UI/DesignSystem/Units.swift`): the °C/°F, wind-speed and precipitation pickers used to be bound to `.constant(...)` — they moved and changed nothing, so they were replaced by three rows that merely *declared* the units. They are now real: `UnitPrefs` persists the choice in `UserDefaults` (like the PV plant size, and for the same reason — in the request it would fragment the forecast cache per user) and every place that writes a number goes through `Units`. The rule that holds it together is **classify on the canonical, display on the converted**: `WindScale`'s Beaufort bands stay in km/h, `PrecipIntensity`'s stay in mm/h, `tempColor` stays in °C, and `DailyRowsView`'s −5…34 °C bar scale stays in Celsius because it is geometry, not a label — otherwise 0.3 in of rain (a downpour) would be coloured like 0.3 mm (a drizzle), and 20 kn would read as «breeze». Chart axes convert both ways: `valueOf` returns the display unit and `colorOf` converts back. A temperature **difference** does not carry the +32 offset, which is why `convertDelta` exists. Two deliberate exceptions: **personal alert rules** keep the unit the user typed, because the threshold lives on the server and the poller compares it as-is — following the picker would silently reread a 50 km/h rule as 50 kn — and there the unit is written next to every number; and the hourly axis steps at 5° in Celsius, 10° in Fahrenheit, or the axis fills with lines. The static formatters read `UnitPrefs.shared` without being able to observe it, so every view that writes a number declares `@ObservedObject private var units = UnitPrefs.shared`
- **The four settings screens share one set of building blocks** (`UI/Features/Settings/SettingsKit.swift`): `SettingsPage`, `SettingsCard`, `SettingsRow`/`SettingsRowContent`, `SettingsInfoRow`, `SettingsSeparator`, `SettingsEmptyState`. They were private methods of `GeneralSettingsView` while the sidebar, the sources list and the favourites each had their own look — system lists, white cards at three different radii, SF Pro next to the redesign's serif. The system navigation bar was already shared, so only the content needed moving. Two things changed rather than being restyled: the favourites' swipe-to-delete went with the `List`, so removal lives in a context menu and now calls `AppState.removeFavorite(at:)` — the old swipe only dropped the row from the array, so the location came back at the next login because Supabase still had it; and the sidebar's hardcoded version strings now read the bundle, like the settings screen's. **Login joined them** (2026-09-15): it was the last screen on the old language — midnight-blue gradient, dark glass fields, a system-blue button — and the only screen in the app written **in English**, which is a defect rather than a style. Beyond the restyle: the button was doing nothing on an empty field (the `guard` returned in silence, which reads as a network fault), so it is now disabled; the email is trimmed, because a trailing space pasted from a password manager makes Supabase answer «invalid credentials» while the password is correct — the most misleading error there is; that message and «email not confirmed» are translated, everything else is shown verbatim rather than flattened into a generic «something went wrong»; and the sidebar's «Accedi o registrati» lost its second half, because `AuthService` has `signIn` and `signOut` and no `signUp`
- **The iOS dashboard is themed by the weather, and everything optional is opt-in** (`ios Redisign/README.md`): page, hero, ink and accent come from `WeatherTheme.of(condition)`, so a rainy day does not wear the same cream as a sunny one — colour is the first information to arrive, before the number. Below one hero sit four collapsible sections (Ora per ora, Prossimi giorni, Per te, Fonti dati) in a single white sheet. The seven contextual panels became **cards inside "Per te" that the user switches on**, persisted in `UserDefaults` like the PV plant size and for the same reason. The rule is still double: a card shows only if the user wants it **and** the backend sent the block, so the sea still disappears inland and the snow in summer. Card text reuses the original panels' static helpers rather than restating it — two screens describing the same datum in two wordings are worse than one screen. Two hero variants ship (`HeroVariant`, switchable in settings) because the handoff offered both and they differ only in the hero: "Foglio" gives the temperature the whole stage, "Tessere" trades some of it for wind, UV, nowcast and sunset at a glance
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
- 24 migrations in `supabase/migrations/` (001-024): extensions, tables, RLS policies, indexes, triggers, source seeds, `full_data` cache column, source accuracy, WeatherKit, push notifications, alert enhancement, delivery log, alert location, per-device dedup, Open-Meteo model sources, accuracy samples, personal alert rules
- The next free migration number is **025**
- Main tables: `sources`, `locations`, `raw_forecasts`, `smart_forecasts`, `profiles`, `source_accuracy`, `accuracy_samples`, `alert_subscriptions`, `weather_alerts`, `alert_delivery_log`, `alert_rules`, `alert_rule_hits`
- `upsert_location` utility function for location management
- Automatic `updated_at` triggers on all tables

## Key Data Types

```typescript
// Frontend types (frontend-web/lib/types.ts)
ForecastCurrent    // temperature, feels_like, humidity, wind (speed/direction/gust/label), precipitation_prob, dew_point, aqi, pressure, condition
DailyForecast      // date, temp_max/min, precipitation_prob, condition_code/text, snowfall_cm
HourlyForecast     // time, temp, precipitation_prob, condition_code/text, feels_like, humidity, wind_*, uv_index, precipitation_mm, temp_p10/temp_p90 (ensemble band), snowfall_cm, snow_depth_cm, freezing_level, soil_temperature, soil_temperature_root, soil_moisture, evapotranspiration, solar_irradiance, sunshine_duration, cloud_cover, cloud_cover_low/mid/high, cape, lifted_index, storm_index, thunder_prob
AlertRule          // id, metric, comparator ('above'|'below'), threshold, horizon_hours, enabled
AstronomyData      // sunrise, sunset, moon_phase
WeatherAlert (iOS)  // + event, headline, providerSource — sent by the backend, decoded since 2026-09-15
ForecastResponse   // location, generated_at, utc_offset_seconds, sources_used, current, confidence, daily[], hourly[], astronomy, alerts[], pollen[], snow, garden, solar, sky, sea, activities, forecastNextHour
ActivitiesOutlook  // date, from, to, activities[{id ('running'|'cycling'|'laundry'), label, score, limiting}]
SeaOutlook         // sea_temperature, wave_height, wave_direction, wave_period, swell_height, state, max_wave_24h, max_wave_at
SkyOutlook         // sunset/sunrise {at, score, level}, stargazing {score, level, cloud_cover, moon_illumination}
SolarOutlook       // plane ('tilted'|'horizontal'), tilt_deg, azimuth_deg, performance_ratio, days[{date, kwh_per_kwp, sunshine_hours, peak_w}]
GardenOutlook      // soil_moisture, moisture_level, soil_temperature, evapotranspiration_mm, rain_mm, water_balance_mm, advice, sowing_ok
SnowOutlook        // elevation, snow_line, phase ('snow'|'sleet'|'rain'), snow_depth_cm, snowfall_cm, frost
FrostOutlook       // level ('none'|'possible'|'likely'|'severe'), min_temp, at, source ('soil'|'air')
WeatherSource      // id, name, weight, active, description, lastError, lastResponseMs
WeatherCondition   // 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown'
```

## Recent Implementations

- **Yesterday removed from the week** (2026-09-15, iOS + web + widgets): reported from a screenshot showing «Lun» above «Oggi» on a Tuesday. One root cause, four wrong consumers of `daily`, each failing differently and none of them visibly — including the dashboard hero, whose max/min came from `daily.first` and so showed **yesterday's** figures in the biggest type on the screen. Now everything picks by date: new `DailyWindowTests` on iOS next to the hourly-window ones (same bug, other array) and a new `forecast-details` suite on the web, which had no coverage at all for that panel.
- **Units, for real** (2026-09-15, iOS): the three unit rows became working pickers, and the four sidebar screens were brought onto the settings screen's language. Doing the first meant touching every place the app writes a temperature, a wind speed or a millimetre — about twenty sites across the dashboard, the hourly detail, the seven panels and the narrative engine — all now routed through `Units`, with the thresholds deliberately left in their canonical units. Two bugs surfaced on the way: `WeatherDescriptionEngine` was comparing **m/s against km/h thresholds**, so the day summary only mentioned wind above 43 km/h, called a gale «moderate» and printed gusts divided by 3.6 with «km/h» next to them; and the favourites' swipe-to-delete never told the backend. A new `UnitsTests` suite covers the conversions and, more importantly, that the bands do **not** follow the reading unit.
- **iOS redesign closed** (2026-09-15): the last two pieces. A **Temperatura** metric joins the hourly registry — drawn as a line with the **ensemble uncertainty band** (`temp_p10`/`temp_p90`) instead of bars, because temperature is a continuum and one bar per hour suggests nothing exists between 14:00 and 15:00; the percentiles enter the Y domain like gusts do, or the band would be clipped exactly where it is widest. The detail sheet opens on the metric you came from: temperature from the hourly curve, millimetres from a rain cell. And the settings' Generali card was restyled **and cleaned of three controls that did nothing**: the °C/°F picker, the wind-unit picker and the "Email Alerts" toggle were all bound to `.constant(...)` — they moved and changed nothing, which is worse than not offering them, and no line of code in the app supports Fahrenheit. Replaced by the units *declared* (real information) plus links to what is actually configurable; version and build now come from the bundle rather than two hardcoded strings that go stale on the first build.
- **iOS redesign, secondary screens** (2026-09-15): hourly detail, locations and alerts restyled onto the same language — themed page, serif title, back button, white sheet. Three things the handoff had not accounted for were kept or fixed rather than dropped: the hourly detail's **metric picker** (six metrics with their own registry and tests) survives as the serif title, because a fixed title would have deleted a shipped feature for a layout; **Località now shows the favourites first** and the search field second, since nine times out of ten the magnifier is used to return to a place already saved — before, favourites lived in a different screen entirely; and the Swift `WeatherAlert` gained `event`, `headline` and `providerSource`, which the backend had always sent and iOS threw away, so alert cards can show the event name instead of falling back to a paragraph-long bulletin. Favourite rows deliberately show **no temperature**, unlike the mockup: it would need one request per favourite, and inventing it is worse than omitting it.
- **iOS redesign** (2026-09-14, from the `ios Redisign/` handoff): thirteen equally-weighted stacked panels became one condition-themed hero plus four collapsible sections. New design system (`WeatherTheme.swift`: five condition themes, `Duet` tokens, `WeatherSymbol` — the WMO→SF Symbol map that had been copy-pasted into four views). New dashboard components, a "Per te" card system with its own settings screen, and `Path.smoothCurve` shared by the sparkline, the hourly detail and the ensemble band. **One deliberate departure from the handoff**: its "Foglio" variant drops the minute-by-minute nowcast entirely, so it was restored as a single accent line in the hero — "Pioggia fra 12 minuti" is the most urgent thing this app knows, and losing it to a layout choice would be a regression wearing a redesign's clothes. The old panel views stay in the repo: their static helpers are the source of the cards' wording, and `SolarPanelView`'s are covered by tests.
- **iOS parity closed** (2026-09-14): `SolarPanelView`, `SkyPanelView`, `SeaPanelView` and `ActivitiesPanelView` bring the four web-only features to iOS, and the Swift models now decode `solar`, `sky`, `sea` and `activities` — the data was arriving and being thrown away. PV plant size lives in `@AppStorage`, mirroring the web's `localStorage`, for the same reason: in the request it would fragment the forecast cache per user. Two asymmetries remain, both deliberate: personal threshold alerts are iOS-only (the web has no push) and the air-quality detail panel is web-only.
- **Lifestyle indices** (backend + web): "buona giornata per…" for running, cycling and hanging out the laundry, from the aggregated hourly data we already have — `backend/utils/activities.ts` scores comfort, dryness, wind, UV, humidity and the European AQI over the next daylight window, and `ActivitiesPanel.tsx` / `ActivitiesPanelView.swift` render bar, score and limiting factor. Two of my own design errors were caught by the tests: `dryAirScore` was `100 - humidity`, which scored an ordinary 50% humidity day as mediocre, and the drying-wind floor was low enough that calm air came out as the *limiting* factor of a fine dry day — wind is a bonus for laundry, not a requirement, and `dryingTempScore` was added so the panel doesn't say "stendi pure" at 3 °C. ~~Web only~~ — on iOS since 2026-09-14.
- **Sea state** (backend + web): a new `connectors/openmeteoMarine.ts` against Open-Meteo Marine for waves, swell and water temperature, turned into a `sea` block by `utils/sea.ts` and rendered by `SeaPanel.tsx` / `SeaPanelView.swift`. The connector **self-excludes inland**, so no coastline test was needed. ~~Web only~~ — on iOS since 2026-09-14.
- **Sunset quality and stargazing** (backend + web): `cloud_cover_low/mid/high` plus hourly total cover from the Open-Meteo call we already made, combined with the moon illumination already in hand. `backend/utils/sky.ts` derives a `sky` block, rendered by `SkyPanel.tsx` / `SkyPanelView.swift`, whose headline goes to whichever of the two indices is the more remarkable. ~~Web only~~ — on iOS since 2026-09-14.
- **Photovoltaic yield** (backend + web): `global_tilted_irradiance` (with constant `tilt`/`azimuth` query params), `shortwave_radiation` as fallback and `sunshine_duration`, turned into a per-day specific yield in kWh/kWp by `backend/utils/solar.ts`. `SolarPanel.tsx` / `SolarPanelView.swift` multiply by the plant size the user stores locally (`localStorage` on web, `@AppStorage` on iOS). ~~Web only~~ — on iOS since 2026-09-14, with the plant size in `@AppStorage`.
- **Garden and soil** (backend + web + iOS): `soil_moisture_0_to_7cm`, `et0_fao_evapotranspiration`, `soil_temperature_0_to_7cm` and `vapour_pressure_deficit` from the Open-Meteo call we already made, turned into a `garden` block that answers "do I need to water tonight?" and "is the soil warm enough to sow?". Rendered by `GardenPanel.tsx` / `GardenPanelView.swift`.
- **iOS parity, three declared debts closed** (6E): `SourcesIndicatorView.swift` brings the sources list and the consensus index to iOS (declared open since Phase 6A — iOS showed neither), `PollenPanelView.swift` the pollen panel, and `HourlyForecastView`'s chart finally draws the ensemble band (declared open since 6C; the Swift model did not even carry `temp_p10`/`temp_p90`). The band interpolates at the sunrise/sunset markers, includes the percentiles in the Y scale, and stops where the ensemble's coverage does. **Nothing Swift is compiled here**: there is no Swift toolchain in this environment and the project still has no iOS tests, so every Swift change is verified by inspection and confirmed by the user's next Xcode build. That loop has already caught one class of error a reader would not: an extra `CodingKeys` case with no matching property silently breaks `Codable` synthesis, so the repo carries no orphan cases — check both directions (a case without a property, and a `let` without a case) before touching a model. The second class is the `@ViewBuilder` body: it accepts expressions and `let` declarations, but a bare assignment evaluates to `()` and the compiler reports it as «Type '()' cannot conform to 'View'», pointing at the enclosing function rather than the line — so any accumulation (`x += …`) belongs in a plain helper that returns a value, never in the view body (`HourlyDetailView.axisCompanions`). The third is the missing `import Combine`: `@Published` resolves through SwiftUI alone, but the synthesis of `objectWillChange` does not, so a class declaring `ObservableObject` without it fails as «does not conform to protocol» — reported at the point of use, not at the declaration. Every file in the repo that declares one imports Combine; check that before adding another.
- **Personal threshold alerts** (backend + iOS): seven metrics — min, max, gusts, rain, snow, storm index, European AQI — with a threshold and horizon the user picks. Migration **024** (`alert_rules`, `alert_rule_hits`), four endpoints under `/api/alerts/rules`, evaluation hooked into the 15-minute poller already in production, and an "Avvisi personali" screen on iOS. **iOS only:** rules hang off an APNs device token and the web has no push, so a web screen would configure alerts that never arrive — it needs the still-open Web Push decision.
- **Storm risk index** (backend + web + iOS): `cape`, `lifted_index` and `convective_inhibition` from the Open-Meteo call we already made, plus WWO's `chanceofthunder`, which was in the response and nobody read. `backend/utils/storm.ts` turns them into a 0-100 `storm_index` on each hourly slot; the new "Temporali" entry in the metric registry (`lib/metrics.ts` / `MetricScale.swift`) draws it with a second section for the thunder probability. Until now the storm risk could only be inferred from `condition_code`, which is a snapshot rather than a measurement. **Limit:** the risk is thermodynamic only — wind shear and storm relative helicity, which separate an isolated cell from an organised one, are not on the Open-Meteo forecast endpoint.
- **Snow line, snow depth and frost risk** (backend + web + iOS): `freezing_level_height`, `snowfall`, `snow_depth` and `soil_temperature_0cm` hourly, `snowfall_sum` daily, plus the grid point's `elevation` — again from the call we already made. `backend/utils/snow.ts` derives a `snow` block, rendered by `SnowPanel.tsx` / `SnowPanelView.swift`, which the backend omits entirely when there is nothing to report.
- **Minute-by-minute nowcast** (backend + web + iOS): WeatherKit's `forecastNextHour` was already propagated by the engine but no client read it. `NextHourPrecipitation.tsx` / `NextHourPrecipitationView.swift` derive the headline from the minutes themselves ("inizia fra 12 minuti", "smette fra 20"), not from WeatherKit's `summary`, and require 3 consecutive dry minutes before announcing the rain has stopped. Dry hour renders as a single line, no chart.
- **Source confidence** (backend + web): `backend/utils/consensus.ts` computes a weighted standard deviation across sources on temperature and precipitation probability, shrunk toward 50 by `n / (n + 2)` because two agreeing sources are not nine. Exposed as `confidence` on the response and finally written to `smart_forecasts.confidence_score`, which had been null since migration 005. Shown in `SourcesIndicator` with the coldest-to-warmest range. **Web only for now**: iOS has no sources panel to host it.
- **Current precipitation intensity**: `precipitation_intensity` (mm/h now) was extracted by five connectors and never aggregated. It now reuses the wet-fraction gate of the forecast mm, so one isolated source cannot invent ongoing rain.
- **Moon data on web**: `moonrise`, `moonset` and `moon_illumination` were on the wire and displayed only by iOS. Now in `SunWindCard`, with a fallback parser because the providers disagree on the time format.

- **Air quality detail (web)**: parity with the iOS "Qualità dell'aria" panel. `frontend-web/lib/air-quality.ts` is the port of `Models/WeatherDescriptionEngine.swift` — EPA 1-6 category scale (`getAqiScale`, returning both a fill colour and a Tailwind text class), the `POLLUTANTS` registry with WHO 2021 thresholds, and `generateAirQualityDescription`. `AirQualityPanel.tsx` renders the description plus the 3×2 pollutant grid inside the shared `ui/Modal`, opened from an info button on the flipped AQI tile of `CurrentWeather`. Web AQI labels now match iOS (`Buona / Moderata / …`). **No backend change**: `current.air_quality` was already on the wire — only WeatherAPI supplies it, so all of this is gated on its presence.
- **Hourly detail metric picker** (backend + web + iOS): the precipitation detail modal is now a generic hourly-metric view. The title is a dropdown selecting between temperature (a line with the ensemble band), precipitation, storms, wind, humidity, apparent temperature and UV index. What each metric draws lives in a registry — `frontend-web/lib/metrics.ts` and `UI/DesignSystem/MetricScale.swift` — so the view (`HourlyDetail.tsx` / `HourlyDetailView.swift`) is metric-agnostic and adding one means adding a registry entry. Backend gained `feels_like`, `wind_direction` and `wind_gust` on `HourlyForecast`. `backend/utils/wind.ts` aggregates direction with a **circular** mean (350° and 10° average to 0°, not 180°) and gusts with a **max** rather than a mean; the circular mean is reused at the `current` level too. Schema version bumped to 3.
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
