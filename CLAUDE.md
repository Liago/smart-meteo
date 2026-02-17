# CLAUDE.md - Smart Meteo

## Project Overview

Smart Meteo is a full-stack weather forecasting app that aggregates data from multiple weather API providers into a unified "smart" forecast. It has three platforms: a Node.js/Express backend API, a Next.js web frontend, and a native SwiftUI iOS app.

## Architecture

```
smart-meteo/
├── backend/                    # Express API (TypeScript, deployed on Netlify Functions)
│   ├── connectors/             # 8 weather API integrations
│   │   ├── tomorrow.ts         # Tomorrow.io (weight: 1.2)
│   │   ├── openmeteo.ts        # Open-Meteo (weight: 1.1)
│   │   ├── openweathermap.ts   # OpenWeatherMap (weight: 1.0)
│   │   ├── accuweather.ts      # AccuWeather (weight: 1.1)
│   │   ├── weatherapi.ts       # WeatherAPI (weight: 1.0)
│   │   ├── weatherstack.ts     # WeatherStack (weight: 0.9)
│   │   ├── meteostat.ts        # Meteostat (weight: 0.8)
│   │   └── worldweatheronline.ts # WWO (weight: 1.0)
│   ├── engine/
│   │   └── smartEngine.ts      # Weighted aggregation from multiple sources
│   ├── middleware/
│   │   └── auth.ts             # Supabase Bearer token auth
│   ├── routes/
│   │   └── sources.ts          # /api/sources, /api/forecast, /api/health
│   ├── services/
│   │   └── supabase.ts         # Supabase client
│   ├── utils/
│   │   ├── formatter.ts        # Data normalization (UnifiedForecast)
│   │   └── moon.ts             # Moon phase calculations
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
- Weather API keys: `TOMORROW_API_KEY`, `OPENWEATHER_API_KEY`, `WEATHERAPI_KEY`, `ACCUWEATHER_API_KEY`, `METEOMATICS_USER`, `METEOMATICS_PASSWORD`

**Frontend Web** (`frontend-web/.env.local` - see `frontend-web/.env.example`):
- `NEXT_PUBLIC_API_URL` (backend URL, `http://localhost:3000` for dev)

## API Endpoints

- `GET /api/forecast?lat=<lat>&lon=<lon>` - Smart aggregated forecast
- `GET /api/sources` - List weather sources with status/weights
- `PATCH /api/sources/:id` - Enable/disable a weather source
- `GET /api/health` - Backend health check

## Testing

- Tests are in `frontend-web/__tests__/` (3 suites: api, components, weather-utils)
- Framework: Jest 30 + React Testing Library + ts-jest
- Environment: jsdom
- Backend has no automated tests
- iOS has no automated tests

## Key Patterns

- **Weather connectors** implement a common interface in `backend/connectors/` - each normalizes provider-specific data into a unified `UnifiedForecast` format defined in `backend/types.ts` and `backend/utils/formatter.ts`
- **Smart engine** (`backend/engine/smartEngine.ts`) fetches from up to 8 sources in parallel, aggregates using weighted averaging, and caches results
- **Source weights** range from 0.8 (Meteostat) to 1.2 (Tomorrow.io), stored in `SOURCE_WEIGHTS` constant
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
- 12 migrations in `supabase/migrations/` (extensions, tables, RLS policies, indexes, triggers, seeds, utility functions)
- Main tables: `sources`, `locations`, `raw_forecasts`, `smart_forecasts`, `profiles`
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

- **Sun & Wind card** (web + iOS): semi-circle sun arc showing sunrise/sunset position, wind speed/direction with turbine animation, barometric pressure display
- **7-day forecast details** (web): expandable daily cards with hourly drill-down per day
- **WMO weather code mapping** (iOS): proper icon display in DailyForecastView based on WMO codes
- **Hourly forecast alignment** (iOS): graph start time aligned with current hour
- **Wind unit conversion** (iOS): correct m/s to km/h conversion and rain percentage formatting
- **Dynamic backgrounds** (web + iOS): weather-aware animated backgrounds with particle effects
- **Favorite locations sync**: Supabase REST API integration for real-time favorites sync, prevention of name overwriting by coordinates
- **Improved readability**: white text for weather detail values, better label contrast
