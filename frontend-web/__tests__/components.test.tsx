import { render, screen } from '@testing-library/react';
import CurrentWeather from '@/components/CurrentWeather';
import SourcesIndicator from '@/components/SourcesIndicator';
import ErrorFallback from '@/components/ErrorFallback';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { ForecastCurrent } from '@/lib/types';

// Mock framer-motion to avoid animation issues in tests (see __mocks__/framer-motion.tsx)
jest.mock('framer-motion');

const mockForecastData: ForecastCurrent = {
  temperature: 22.5,
  feels_like: 21.0,
  humidity: 55,
  wind_speed: 4.2,
  wind_direction: 180,
  wind_direction_label: 'S',
  wind_gust: 7.5,
  precipitation_prob: 15,
  dew_point: 12.8,
  aqi: 2,
  pressure: 1013,
  condition: 'clear',
  condition_text: 'CLEAR',
  uv_index: 5,
  visibility: 10,
  cloud_cover: 20,
  air_quality: null,
};

describe('CurrentWeather', () => {
  it('should render temperature', () => {
    render(
      <CurrentWeather data={mockForecastData} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    expect(screen.getByText('23')).toBeInTheDocument(); // Math.round(22.5) = 23
  });

  it('should render location name', () => {
    render(
      <CurrentWeather data={mockForecastData} locationName="Roma" sourcesCount={3} isDay={true} />
    );
    expect(screen.getByText('Roma')).toBeInTheDocument();
  });

  it('should render sources count', () => {
    render(
      <CurrentWeather data={mockForecastData} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    expect(screen.getByText(/Aggregato da 5 fonti/)).toBeInTheDocument();
  });

  it('should render condition label', () => {
    render(
      <CurrentWeather data={mockForecastData} locationName="Milano" sourcesCount={3} isDay={true} />
    );
    expect(screen.getByText('Sereno')).toBeInTheDocument();
  });
});

describe('SourcesIndicator', () => {
  it('should render source badges', () => {
    render(<SourcesIndicator sources={['tomorrow.io', 'openweathermap']} />);
    expect(screen.getByText('Tomorrow.io')).toBeInTheDocument();
    expect(screen.getByText('OpenWeather')).toBeInTheDocument();
  });

  it('should render nothing for empty sources', () => {
    const { container } = render(<SourcesIndicator sources={[]} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('ErrorFallback', () => {
  it('should display error message', () => {
    render(<ErrorFallback message="Connessione fallita" />);
    expect(screen.getByText('Connessione fallita')).toBeInTheDocument();
    expect(screen.getByText('Errore')).toBeInTheDocument();
  });

  it('should show retry button when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<ErrorFallback message="Errore" onRetry={onRetry} />);
    expect(screen.getByText('Riprova')).toBeInTheDocument();
  });

  it('should not show retry button when onRetry is not provided', () => {
    render(<ErrorFallback message="Errore" />);
    expect(screen.queryByText('Riprova')).not.toBeInTheDocument();
  });
});

describe('SkeletonLoader', () => {
  it('should render skeleton elements', () => {
    const { container } = render(<SkeletonLoader />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
