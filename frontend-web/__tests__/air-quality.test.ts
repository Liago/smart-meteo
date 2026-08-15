import { getAqiScale, generateAirQualityDescription, POLLUTANTS } from '@/lib/air-quality';
import type { AirQualityDetail } from '@/lib/types';

/** Costruisce un AirQualityDetail lasciando a null tutto ciò che non serve al caso. */
const aq = (partial: Partial<AirQualityDetail>): AirQualityDetail => ({
  aqi_us_epa: null,
  pm2_5: null,
  pm10: null,
  no2: null,
  o3: null,
  co: null,
  so2: null,
  ...partial,
});

describe('getAqiScale', () => {
  it('maps the six EPA categories', () => {
    const labels = [1, 2, 3, 4, 5, 6].map((i) => getAqiScale(i).label);
    expect(labels).toEqual([
      'Buona',
      'Moderata',
      'Malsana per sensibili',
      'Malsana',
      'Molto malsana',
      'Pericolosa',
    ]);
  });

  it('returns N/D for null, NaN and out-of-range indexes', () => {
    expect(getAqiScale(null).label).toBe('N/D');
    expect(getAqiScale(undefined).label).toBe('N/D');
    expect(getAqiScale(NaN).label).toBe('N/D');
    expect(getAqiScale(0).label).toBe('N/D');
    expect(getAqiScale(7).label).toBe('N/D');
  });

  it('rounds decimal indexes, so the label matches the rounded number on screen', () => {
    expect(getAqiScale(1.4).label).toBe('Buona');
    expect(getAqiScale(1.6).label).toBe('Moderata');
  });

  it('exposes both a fill colour and a Tailwind text class', () => {
    expect(getAqiScale(1)).toEqual({
      label: 'Buona',
      color: '#33B34D',
      className: 'text-green-600',
    });
  });
});

describe('generateAirQualityDescription', () => {
  it('reports every value within range', () => {
    // Gli stessi valori mostrati dal pannello iOS.
    const text = generateAirQualityDescription(
      aq({ aqi_us_epa: 1, pm2_5: 7.8, pm10: 17.7, no2: 0.2, o3: 76.0, co: 111.0, so2: 0.4 })
    );
    expect(text).toBe('Qualità buona. Tutti i valori nella norma.');
  });

  it('names a single pollutant above the high threshold and explains it', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: 3, pm2_5: 40 }));
    expect(text).toBe(
      'Qualità malsana per sensibili. PM2.5 alto. Particolato fine elevato, possibile causa traffico o riscaldamento.'
    );
  });

  it('calls a value between the two thresholds "leggermente elevato"', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: 2, pm10: 50 }));
    expect(text).toContain('PM10 leggermente elevato.');
  });

  it('omits the hint when the overall quality is good', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: 1, pm2_5: 20 }));
    expect(text).toBe('Qualità buona. PM2.5 leggermente elevato.');
  });

  it('omits the hint when the EPA index is unknown, along with the category', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: null, pm2_5: 20 }));
    expect(text).toBe('PM2.5 leggermente elevato.');
  });

  it('joins two pollutants with "e" and downgrades the wording when none is high', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: 2, pm2_5: 20, pm10: 50 }));
    expect(text).toBe(
      'Qualità moderata. PM2.5 e PM10 sopra la media. Particolato fine elevato, possibile causa traffico o riscaldamento.'
    );
  });

  it('lists three or more pollutants and says "elevati" when at least one is high', () => {
    const text = generateAirQualityDescription(
      aq({ aqi_us_epa: 4, pm2_5: 40, pm10: 50, no2: 30 })
    );
    expect(text).toContain('PM2.5, PM10 e NO₂ elevati.');
  });

  it('adds no hint for pollutants that have none', () => {
    const text = generateAirQualityDescription(aq({ aqi_us_epa: 3, co: 12000 }));
    expect(text).toBe('Qualità malsana per sensibili. CO alto.');
  });

  it('ignores missing readings instead of treating them as zero', () => {
    expect(generateAirQualityDescription(aq({ aqi_us_epa: 1 }))).toBe(
      'Qualità buona. Tutti i valori nella norma.'
    );
  });
});

describe('POLLUTANTS', () => {
  it('lists the six pollutants in reading order', () => {
    expect(POLLUTANTS.map((p) => p.label)).toEqual(['PM2.5', 'PM10', 'NO₂', 'O₃', 'CO', 'SO₂']);
  });

  it('keeps the elevated threshold below the high one', () => {
    for (const p of POLLUTANTS) {
      expect(p.elevated).toBeLessThan(p.high);
    }
  });
});
