import type { ForecastResponse, SourcesResponse, WeatherSource } from './types';

// In production (Netlify): empty string = same origin (API served via Netlify Functions)
// In development: http://localhost:3000 (local Express server)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function getForecast(lat: number, lon: number): Promise<ForecastResponse> {
  return fetchJSON<ForecastResponse>(
    `${API_BASE}/api/forecast?lat=${lat}&lon=${lon}`
  );
}

export async function getSources(): Promise<SourcesResponse> {
  return fetchJSON<SourcesResponse>(`${API_BASE}/api/sources`);
}

export async function toggleSource(id: string, active: boolean): Promise<{ source: WeatherSource }> {
  return fetchJSON<{ source: WeatherSource }>(
    `${API_BASE}/api/sources/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    }
  );
}

export async function getHealth(): Promise<{ status: string; timestamp: string }> {
  return fetchJSON(`${API_BASE}/api/health`);
}

// SWR fetcher helpers
export const forecastFetcher = ([, lat, lon]: [string, number, number]) => getForecast(lat, lon);
export const sourcesFetcher = () => getSources();
