import {
  getConditionLabel,
  getConditionIcon,
  windDegreesToDirection,
  conditionGradients,
  getPrecipIntensity,
  formatPrecipMm,
  formatHourRange,
} from '@/lib/weather-utils';

describe('Weather Utils', () => {
  describe('getConditionLabel', () => {
    it('should return correct Italian labels for conditions', () => {
      expect(getConditionLabel('clear')).toBe('Sereno');
      expect(getConditionLabel('cloudy')).toBe('Nuvoloso');
      expect(getConditionLabel('rain')).toBe('Pioggia');
      expect(getConditionLabel('snow')).toBe('Neve');
      expect(getConditionLabel('storm')).toBe('Temporale');
      expect(getConditionLabel('fog')).toBe('Nebbia');
    });

    it('should return fallback for unknown conditions', () => {
      expect(getConditionLabel('unknown')).toBe('N/D');
      expect(getConditionLabel('nonexistent')).toBe('N/D');
    });
  });

  describe('getConditionIcon', () => {
    it('should return icons for each condition', () => {
      expect(getConditionIcon('clear')).toBeTruthy();
      expect(getConditionIcon('rain')).toBeTruthy();
      expect(getConditionIcon('snow')).toBeTruthy();
    });

    it('should return fallback icon for unknown', () => {
      expect(getConditionIcon('nonexistent')).toBe(getConditionIcon('unknown'));
    });
  });

  describe('windDegreesToDirection', () => {
    it('should convert degrees to cardinal directions', () => {
      expect(windDegreesToDirection(0)).toBe('N');
      expect(windDegreesToDirection(90)).toBe('E');
      expect(windDegreesToDirection(180)).toBe('S');
      expect(windDegreesToDirection(270)).toBe('O');
      expect(windDegreesToDirection(45)).toBe('NE');
      expect(windDegreesToDirection(135)).toBe('SE');
      expect(windDegreesToDirection(225)).toBe('SO');
      expect(windDegreesToDirection(315)).toBe('NO');
    });

    it('should handle null input', () => {
      expect(windDegreesToDirection(null)).toBe('N/D');
    });

    it('should handle 360 degrees as North', () => {
      expect(windDegreesToDirection(360)).toBe('N');
    });
  });

  describe('conditionGradients', () => {
    it('should have gradients for all conditions', () => {
      const conditions = ['clear', 'cloudy', 'rain', 'snow', 'storm', 'fog', 'unknown'];
      conditions.forEach(c => {
        expect(conditionGradients[c as keyof typeof conditionGradients]).toBeTruthy();
      });
    });
  });

  describe('getPrecipIntensity', () => {
    it('should classify mm at the band boundaries', () => {
      // Soglie NWS: debole 0.1, moderata 2.5, forte 7.6 mm/h
      expect(getPrecipIntensity(0).level).toBe('none');
      expect(getPrecipIntensity(0.05).level).toBe('none');
      expect(getPrecipIntensity(0.1).level).toBe('light');
      expect(getPrecipIntensity(2.4).level).toBe('light');
      expect(getPrecipIntensity(2.5).level).toBe('moderate');
      expect(getPrecipIntensity(7.5).level).toBe('moderate');
      expect(getPrecipIntensity(7.6).level).toBe('heavy');
      expect(getPrecipIntensity(20).level).toBe('heavy');
    });

    it('should treat missing data as none', () => {
      expect(getPrecipIntensity(null).level).toBe('none');
      expect(getPrecipIntensity(undefined).level).toBe('none');
      expect(getPrecipIntensity(NaN).level).toBe('none');
    });

    it('should return Italian labels and a colour', () => {
      expect(getPrecipIntensity(1).label).toBe('Debole');
      expect(getPrecipIntensity(5).label).toBe('Moderata');
      expect(getPrecipIntensity(10).label).toBe('Forte');
      expect(getPrecipIntensity(1).color).toBeTruthy();
    });
  });

  describe('formatPrecipMm', () => {
    it('should format with one decimal in Italian', () => {
      expect(formatPrecipMm(0.5)).toBe('0,5 mm');
      expect(formatPrecipMm(12)).toBe('12,0 mm');
    });

    it('should show a dash when data is missing', () => {
      expect(formatPrecipMm(null)).toBe('—');
      expect(formatPrecipMm(undefined)).toBe('—');
    });
  });

  describe('formatHourRange', () => {
    it('should build the hour range from the ISO string', () => {
      expect(formatHourRange('2026-08-04T17:00')).toBe('17:00 - 18:00');
      expect(formatHourRange('2026-08-04T00:00:00')).toBe('00:00 - 01:00');
    });

    it('should wrap around at midnight', () => {
      expect(formatHourRange('2026-08-04T23:00')).toBe('23:00 - 00:00');
    });

    it('should not shift the hour into the browser timezone', () => {
      // I timestamp del backend sono già in ora locale della località:
      // passarli da Date li sposterebbe nel fuso del browser.
      expect(formatHourRange('2026-08-04T17:00:00Z')).toBe('17:00 - 18:00');
    });
  });
});
