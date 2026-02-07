import useSWR from 'swr';
import { getForecast, getSources } from './api';
import type { ForecastResponse, SourcesResponse } from './types';

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
