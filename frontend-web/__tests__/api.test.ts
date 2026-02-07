import { getForecast, getSources, toggleSource, getHealth } from '@/lib/api';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

describe('API Client', () => {
  describe('getForecast', () => {
    it('should fetch forecast data for given coordinates', async () => {
      const mockResponse = {
        location: { lat: 45.46, lon: 9.19 },
        generated_at: '2026-01-01T00:00:00Z',
        sources_used: ['tomorrow.io', 'openweathermap'],
        current: {
          temperature: 15.2,
          feels_like: 14.0,
          humidity: 65,
          wind_speed: 3.5,
          precipitation_prob: 10,
          condition: 'clear',
          condition_text: 'CLEAR',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await getForecast(45.46, 9.19);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/forecast?lat=45.46&lon=9.19'),
        undefined
      );
    });

    it('should throw on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Missing lat/lon parameters' }),
      });

      await expect(getForecast(0, 0)).rejects.toThrow('Missing lat/lon parameters');
    });
  });

  describe('getSources', () => {
    it('should fetch list of weather sources', async () => {
      const mockSources = {
        sources: [
          { id: 'tomorrow.io', name: 'Tomorrow.io', weight: 1.2, active: true, description: 'test', lastError: null, lastResponseMs: null },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSources,
      });

      const result = await getSources();
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].id).toBe('tomorrow.io');
    });
  });

  describe('toggleSource', () => {
    it('should toggle source active state', async () => {
      const mockSource = {
        source: { id: 'tomorrow.io', name: 'Tomorrow.io', weight: 1.2, active: false, description: 'test', lastError: null, lastResponseMs: null },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSource,
      });

      const result = await toggleSource('tomorrow.io', false);
      expect(result.source.active).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sources/tomorrow.io'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ active: false }),
        })
      );
    });
  });

  describe('getHealth', () => {
    it('should return health status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', timestamp: '2026-01-01T00:00:00Z' }),
      });

      const result = await getHealth();
      expect(result.status).toBe('ok');
    });
  });
});
