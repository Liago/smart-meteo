import { render, screen } from '@testing-library/react';
import ForecastDetails from '@/components/ForecastDetails';
import type { ForecastCurrent, DailyForecast } from '@/lib/types';

jest.mock('framer-motion');

/**
 * Il riquadro dei prossimi giorni non deve mostrare né ieri né oggi.
 *
 * Ieri perché è una previsione che i fatti hanno già smentito; oggi perché
 * sta già, per esteso, in `CurrentWeather` — e due riquadri che raccontano lo
 * stesso giorno in due modi diversi fanno dubitare di entrambi.
 *
 * Lo `slice(1)` di prima faceva la cosa giusta **solo** quando `daily` apriva
 * con oggi. Quando apre con ieri — le fonti ragionano in UTC, il primo
 * cassetto del giorno locale cade il giorno prima — saltava ieri e lasciava
 * oggi: un errore che non si vede guardando lo schermo, perché una riga
 * plausibile c'è comunque.
 */

/** Orologio fisso: una suite che dipende dal giorno in cui gira non è una suite. */
const OGGI = new Date('2026-08-04T10:00:00');

beforeAll(() => {
  jest.useFakeTimers({
    now: OGGI,
    doNotFake: [
      'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
      'setImmediate', 'clearImmediate', 'queueMicrotask',
      'requestAnimationFrame', 'cancelAnimationFrame', 'nextTick', 'performance',
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

/*
  Completo invece che con un cast: `as ForecastCurrent` su un oggetto parziale
  passa i test e fallisce il typecheck, e soprattutto non verificherebbe più
  niente il giorno in cui l'interfaccia cambia — che e' l'unica ragione per cui
  un tipo in una fixture serve.
*/
const current: ForecastCurrent = {
  temperature: 24,
  feels_like: 25,
  humidity: 55,
  wind_speed: 3,
  wind_direction: 180,
  wind_direction_label: 'S',
  wind_gust: 6,
  precipitation_prob: 10,
  precipitation_intensity: 0,
  dew_point: 14,
  aqi: null,
  pressure: 1013,
  condition: 'clear',
  condition_text: 'Sereno',
  uv_index: 5,
  visibility: 24,
  cloud_cover: 10,
  air_quality: null,
};

function giorno(date: string, overrides: Partial<DailyForecast> = {}): DailyForecast {
  return {
    date,
    temp_max: 28,
    temp_min: 17,
    precipitation_prob: 20,
    condition_code: '0',
    condition_text: 'Sereno',
    ...overrides,
  };
}

/**
 * Le etichette dei giorni: «mer 5», «gio 6»…
 *
 * Ogni riga ha due pulsanti — l'apertura del giorno e la cella pioggia —
 * quindi contarli tutti conterebbe il doppio. Qui si filtra su chi comincia
 * con l'etichetta della data, che è il pulsante della riga.
 */
function righe(): string[] {
  return screen
    .queryAllByRole('button')
    .map(b => b.textContent ?? '')
    .filter(t => /^[a-z]{3} \d{1,2}/.test(t));
}

describe('prossimi giorni', () => {
  it('scarta ieri e oggi quando il backend apre da ieri', () => {
    render(
      <ForecastDetails
        data={current}
        daily={[
          giorno('2026-08-03'), // ieri
          giorno('2026-08-04'), // oggi
          giorno('2026-08-05'),
          giorno('2026-08-06'),
        ]}
      />
    );

    const testo = document.body.textContent ?? '';
    // 3 agosto è una lunedì, 4 un martedì: cerco i numeri di giorno, che sono
    // l'unica parte dell'etichetta che non dipende dalla locale del runner.
    expect(testo).not.toContain('lun 3');
    expect(testo).not.toContain('mar 4');
    expect(testo).toContain('5');
    expect(testo).toContain('6');
    expect(righe()).toHaveLength(2);
  });

  it('scarta oggi anche quando il backend apre da oggi', () => {
    render(
      <ForecastDetails
        data={current}
        daily={[giorno('2026-08-04'), giorno('2026-08-05')]}
      />
    );

    expect(righe()).toHaveLength(1);
  });

  it('non taglia un giorno futuro per far posto a uno passato', () => {
    // Otto giorni a partire da ieri: senza il filtro per data, lo `slice(1)`
    // ne lasciava sette contando oggi, e l'ultimo utile spariva in coda.
    const settimana = Array.from({ length: 8 }, (_, i) =>
      giorno(`2026-08-${String(3 + i).padStart(2, '0')}`)
    );

    render(<ForecastDetails data={current} daily={settimana} />);

    const testo = document.body.textContent ?? '';
    // Da domani (5) al 10: sei giorni, cioe' il massimo che il riquadro mostra.
    expect(righe()).toHaveLength(6);
    expect(testo).toContain('10');
  });

  it('il titolo dichiara quanti giorni mostra, non quanti vorrebbe', () => {
    render(
      <ForecastDetails
        data={current}
        daily={[giorno('2026-08-04'), giorno('2026-08-05'), giorno('2026-08-06')]}
      />
    );

    expect(screen.getByText('Prossimi 2 giorni')).toBeInTheDocument();
  });

  it('con un solo giorno futuro dice «Domani», non «Prossimi 1 giorni»', () => {
    render(
      <ForecastDetails data={current} daily={[giorno('2026-08-04'), giorno('2026-08-05')]} />
    );

    expect(screen.getByText('Domani')).toBeInTheDocument();
  });

  it('senza giorni futuri il riquadro non compare', () => {
    // Una risposta vecchia in cache: tutti i giorni sono passati. Meglio
    // niente che un riquadro «Prossimi 0 giorni» vuoto.
    const { container } = render(
      <ForecastDetails data={current} daily={[giorno('2026-08-02'), giorno('2026-08-03')]} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
