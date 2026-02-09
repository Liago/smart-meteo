import type { ForecastResponse, SourcesResponse, WeatherSource } from './types';
import { createClient } from './supabase/client';

// In produzione: NEXT_PUBLIC_API_URL = URL del backend Netlify (es: https://smart-meteo-api.netlify.app)
// In sviluppo: http://localhost:3000 (Express server locale)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
	const supabase = createClient();
	const { data: { session } } = await supabase.auth.getSession();

	const headers = new Headers(options?.headers);
	if (session?.access_token) {
		headers.set('Authorization', `Bearer ${session.access_token}`);
	}

	const res = await fetch(url, {
		...options,
		headers,
	});

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
