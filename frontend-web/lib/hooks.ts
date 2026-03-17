import useSWR from 'swr';
import { getForecast, getSources, getActiveAlerts } from './api';
import type { ForecastResponse, SourcesResponse, WeatherAlert } from './types';

export function useForecast(lat: number | null, lon: number | null) {
  return useSWR<ForecastResponse>(
    lat !== null && lon !== null ? ['forecast', lat, lon] : null,
    ([, lat, lon]: [string, number, number]) => getForecast(lat, lon),
    {
      refreshInterval: 300_000, // 5 min
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );
}

export function useSources() {
  return useSWR<SourcesResponse>(
    'sources',
    () => getSources(),
    {
      revalidateOnFocus: false,
    }
  );
}

export function useAlerts(lat: number | null, lon: number | null) {
  return useSWR<{ alerts: WeatherAlert[] }>(
    lat !== null && lon !== null ? ['alerts', lat, lon] : null,
    ([, lat, lon]: [string, number, number]) => getActiveAlerts(lat, lon),
    {
      refreshInterval: 180_000, // 3 min
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );
}
