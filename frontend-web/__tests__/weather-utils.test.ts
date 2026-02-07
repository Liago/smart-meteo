import {
  getConditionLabel,
  getConditionIcon,
  windDegreesToDirection,
  conditionGradients,
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
});
