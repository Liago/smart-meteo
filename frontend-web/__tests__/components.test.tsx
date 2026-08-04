import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CurrentWeather from '@/components/CurrentWeather';
import DayNarrative from '@/components/DayNarrative';
import SourcesIndicator from '@/components/SourcesIndicator';
import ErrorFallback from '@/components/ErrorFallback';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { DailyForecast, ForecastCurrent, HourlyForecast } from '@/lib/types';

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

describe('CurrentWeather air quality', () => {
  const withAirQuality: ForecastCurrent = {
    ...mockForecastData,
    air_quality: {
      aqi_us_epa: 1,
      pm2_5: 7.8,
      pm10: 17.7,
      no2: 0.2,
      o3: 76.0,
      co: 111.0,
      so2: 0.4,
    },
  };

  // La tile "Precipitaz." mostra la qualità dell'aria sul retro: va girata
  // prima di poter raggiungere il bottone di dettaglio.
  const flipAqiTile = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByText('Precipitaz.'));
  };

  it('labels the AQI value with the same wording as the iOS app', async () => {
    const user = userEvent.setup();
    render(
      <CurrentWeather data={withAirQuality} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    await flipAqiTile(user);
    expect(screen.getByText('Moderata')).toBeInTheDocument(); // aqi: 2
  });

  it('hides the detail button when no source provides air quality', async () => {
    const user = userEvent.setup();
    render(
      <CurrentWeather data={mockForecastData} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    await flipAqiTile(user);
    expect(
      screen.queryByRole('button', { name: /Dettaglio qualità dell'aria/ })
    ).not.toBeInTheDocument();
  });

  it('opens the detail with every pollutant and the generated description', async () => {
    const user = userEvent.setup();
    render(
      <CurrentWeather data={withAirQuality} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    await flipAqiTile(user);
    await user.click(screen.getByRole('button', { name: /Dettaglio qualità dell'aria/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Qualità buona. Tutti i valori nella norma.')).toBeInTheDocument();
    for (const label of ['PM2.5', 'PM10', 'NO₂', 'O₃', 'CO', 'SO₂']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('7.8')).toBeInTheDocument();
    expect(screen.getAllByText('µg/m³')).toHaveLength(6);
    // Il badge usa aqi_us_epa (1), non la media pesata aqi (2).
    expect(screen.getByText('Buona')).toBeInTheDocument();
  });

  it('closes the detail from the close button', async () => {
    const user = userEvent.setup();
    render(
      <CurrentWeather data={withAirQuality} locationName="Milano" sourcesCount={5} isDay={true} />
    );
    await flipAqiTile(user);
    await user.click(screen.getByRole('button', { name: /Dettaglio qualità dell'aria/ }));
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

describe('DayNarrative', () => {
  const buildDay = (date: string, patch: Partial<HourlyForecast> = {}): HourlyForecast[] =>
    Array.from({ length: 24 }, (_, h) => ({
      time: `${date}T${String(h).padStart(2, '0')}:00`,
      temp: 20,
      precipitation_prob: 0,
      condition_code: '0',
      condition_text: 'CLEAR',
      ...patch,
    }));

  const daily: DailyForecast[] = ['2026-08-04', '2026-08-05'].map(date => ({
    date,
    temp_max: 28,
    temp_min: 18,
    precipitation_prob: 20,
    condition_code: '0',
    condition_text: null,
  }));

  const hourly = [...buildDay('2026-08-04'), ...buildDay('2026-08-05')];

  it('should render one row per part of the day', () => {
    render(<DayNarrative current={mockForecastData} hourly={hourly} daily={daily} />);
    expect(screen.getByText('Mattina')).toBeInTheDocument();
    expect(screen.getByText('Pomeriggio')).toBeInTheDocument();
    expect(screen.getByText('Sera')).toBeInTheDocument();
  });

  it('should render the section for tomorrow', () => {
    render(<DayNarrative current={mockForecastData} hourly={hourly} daily={daily} />);
    expect(screen.getByRole('heading', { name: 'Domani' })).toBeInTheDocument();
    expect(screen.getByText('Sereno, 18-28°, temperature stabili.')).toBeInTheDocument();
  });

  it('should render the advice block only when a rule fires', () => {
    render(<DayNarrative current={mockForecastData} hourly={hourly} daily={daily} />);
    expect(screen.queryByRole('heading', { name: 'Consigli' })).not.toBeInTheDocument();

    // 31° reali e 35° percepiti al 62% di umidità: la regola dell'afa scatta.
    const muggy = { ...mockForecastData, temperature: 31, feels_like: 35, humidity: 62 };
    render(<DayNarrative current={muggy} hourly={hourly} daily={daily} />);
    expect(screen.getByRole('heading', { name: 'Consigli' })).toBeInTheDocument();
    expect(
      screen.getByText('Umidità al 62%: la percepita supera la reale di 4°.')
    ).toBeInTheDocument();
  });

  it('should render nothing when the forecast has no hourly data', () => {
    const { container } = render(<DayNarrative current={mockForecastData} daily={daily} />);
    expect(container).toBeEmptyDOMElement();
  });
});
