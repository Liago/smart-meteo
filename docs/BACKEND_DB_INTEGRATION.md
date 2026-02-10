# Backend DB Integration: Caching & Audit

## Objective
Enable Supabase integration for the Smart Engine to support:
1.  **Caching**: Serve recent `smart_forecasts` to reduce API costs and latency.
2.  **Audit**: Archive raw API responses in `raw_forecasts` for debugging and future AI training.
3.  **Config**: Load active sources and weights from the `sources` table.

## Workflow

### 1. Request Handling with Caching
When `GET /api/forecast?lat=...&lon=...` is called:

1.  **Resolve Location**:
    -   Call `upsert_location(lat, lon)` RPC.
    -   Get `location_id` (UUID).

2.  **Check Cache (`smart_forecasts`)**:
    -   Query `smart_forecasts` for this `location_id`.
    -   Filter: `generated_at > NOW() - 30 minutes`.
    -   **HIT**: Return cached JSON immediately.
    -   **MISS**: Proceed to step 3.

### 2. Live Fetch & Aggregation
If cache miss:

1.  **Load Sources**:
    -   Fetch active sources from DB (`SELECT * FROM sources WHERE active = true`).
    -   (Fallback to hardcoded list if DB fails).

2.  **Fetch External APIs**:
    -   Call all providers in parallel (existing `Promise.allSettled` logic).

3.  **Archive Raw Data (`raw_forecasts`)**:
    -   For each successful response, insert a row into `raw_forecasts`.
    -   Fields: `source_id`, `location_id`, `fetched_at`, `raw_data` (JSON), `temp`, `humidity`, etc.

4.  **Aggregate**:
    -   Run Smart Engine logic (weighted averages).

5.  **Save Result (`smart_forecasts`)**:
    -   Insert new row into `smart_forecasts`.
    -   Fields: `location_id`, `generated_at`, `temperature`, `condition`, `sources_used`, etc.

6.  **Return**:
    -   Send aggregated JSON to frontend.

## Database Schema Reference

### `sources`
| Column | Type | Description |
|---|---|---|
| `id` | text | PK, e.g. 'tomorrow.io' |
| `active` | boolean | Is enabled? |
| `weight` | numeric | Weight for aggregation |

### `raw_forecasts`
| Column | Type | Description |
|---|---|---|
| `id` | uuid | PK |
| `source_id` | text | FK to sources |
| `location_id` | uuid | FK to locations |
| `raw_data` | jsonb | Full JSON response |
| `temp`, `humidity`... | numeric | Normalized values |

### `smart_forecasts`
| Column | Type | Description |
|---|---|---|
| `id` | uuid | PK |
| `location_id` | uuid | FK to locations |
| `generated_at` | timestamptz | Creation time |
| `temperature`... | numeric | Aggregated values |
| `sources_used` | text[] | Array of source IDs |

## Implementation Steps

1.  **Supabase Client**: Ensure `backend` has a Supabase client (using `supabase-js`).
2.  **DTOs**: Define TypeScript interfaces for DB rows.
3.  **Service Layer**:
    -   `LocationService.upsert(lat, lon)`
    -   `ForecastService.findRecent(locationId)`
    -   `ForecastService.saveSmart(data)`
    -   `ForecastService.saveRaw(data)`
    -   `SourceService.getActive()`
4.  **Engine Update**: Modify `smartEngine.ts` to orchestrate the new flow.
