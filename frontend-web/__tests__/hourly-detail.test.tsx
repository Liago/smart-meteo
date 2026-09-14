import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HourlyDetail from '@/components/HourlyDetail';
import Modal from '@/components/ui/Modal';
import MetricSelect from '@/components/ui/MetricSelect';
import type { HourlyForecast, DailyForecast } from '@/lib/types';
import { METRICS, METRIC_ORDER, type MetricId } from '@/lib/metrics';

jest.mock('framer-motion');

/**
 * Orologio fisso alla vigilia delle fixture (3 agosto 2026).
 *
 * Serve da quando la strip dei giorni scarta il passato: senza, queste prove
 * avrebbero smesso di funzionare il 5 agosto 2026, e nel frattempo passavano
 * solo perché nessuna asserzione dipendeva da «oggi». Una suite che dipende
 * dalla data in cui gira non è una suite.
 *
 * È la *vigilia*, non il primo giorno: così 4, 5 e 6 agosto restano tutti
 * futuri e l'ora di default è quella di picco della metrica, che è quello che
 * questi test verificano. Il ramo «oggi», dove invece vince l'ora corrente, ha
 * il suo blocco in fondo con il proprio orologio.
 */
const VIGILIA = new Date('2026-08-03T09:00:00');

beforeAll(() => {
  jest.useFakeTimers({
    now: VIGILIA,
    // I timer veri servono a userEvent e al debounce di React: qui si finge
    // solo l'orologio.
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'nextTick',
      'performance',
    ],
  });
});

afterAll(() => {
  jest.useRealTimers();
});

/** Costruisce le 24 ore di un giorno, con i campi opzionali per ora. */
function buildDay(
  date: string,
  overrides: Record<number, Partial<HourlyForecast>> = {},
  defaults: Partial<HourlyForecast> = {}
): HourlyForecast[] {
  return Array.from({ length: 24 }, (_, h) => ({
    time: `${date}T${String(h).padStart(2, '0')}:00`,
    temp: 20,
    precipitation_prob: 10,
    condition_code: '61',
    condition_text: 'Pioggia debole',
    ...defaults,
    ...overrides[h],
  }));
}

const DAILY: DailyForecast[] = ['2026-08-04', '2026-08-05', '2026-08-06'].map(date => ({
  date,
  temp_max: 28,
  temp_min: 18,
  precipitation_prob: 30,
  condition_code: '61',
  condition_text: 'Pioggia debole',
}));

/** La metrica di default è quella dei due entry point, sulla pioggia. */
function renderDetail(props: {
  hourly: HourlyForecast[];
  daily?: DailyForecast[];
  initialDate?: string;
  metric?: MetricId;
}) {
  const { metric = 'precipitation', ...rest } = props;
  return render(<HourlyDetail {...rest} metric={metric} />);
}

describe('HourlyDetail — struttura comune', () => {
  it('renders the selected date in long Italian form', () => {
    renderDetail({ hourly: buildDay('2026-08-04'), initialDate: '2026-08-04' });
    expect(screen.getByText('Martedì 4 agosto 2026')).toBeInTheDocument();
  });

  it('renders one button per day and switches the date on click', async () => {
    const user = userEvent.setup();
    const hourly = [...buildDay('2026-08-04'), ...buildDay('2026-08-05')];
    renderDetail({ hourly, daily: DAILY, initialDate: '2026-08-04' });

    // 3 giorni dal daily, ma solo 2 hanno righe orarie
    const dayButtons = screen.getAllByRole('button');
    expect(dayButtons).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /5/ }));
    expect(screen.getByText('Mercoledì 5 agosto 2026')).toBeInTheDocument();
  });

  it('disables days that have no hourly rows', () => {
    renderDetail({ hourly: buildDay('2026-08-04'), daily: DAILY, initialDate: '2026-08-04' });
    // 2026-08-06 non ha ore: il suo bottone non deve essere cliccabile
    const buttons = screen.getAllByRole('button');
    const disabled = buttons.filter(b => (b as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(2);
  });

  it('falls back to the first covered day when initialDate has no hours', () => {
    renderDetail({ hourly: buildDay('2026-08-04'), daily: DAILY, initialDate: '2026-08-09' });
    expect(screen.getByText('Martedì 4 agosto 2026')).toBeInTheDocument();
  });

  it('moves the selected hour with the arrow keys', async () => {
    const user = userEvent.setup();
    const hourly = buildDay('2026-08-04', { 15: { precipitation_mm: 3.2 } }, { precipitation_mm: 0 });
    renderDetail({ hourly, initialDate: '2026-08-04' });

    // L'ora di default è la più piovosa (15:00)
    expect(screen.getAllByText('15:00 - 16:00').length).toBeGreaterThan(0);

    const slider = screen.getAllByRole('slider')[0];
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByText('16:00 - 17:00').length).toBeGreaterThan(0);

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getAllByText('14:00 - 15:00').length).toBeGreaterThan(0);
  });
});

describe('HourlyDetail — precipitazioni', () => {
  it('shows both charts when mm data is present', () => {
    const hourly = buildDay('2026-08-04', { 15: { precipitation_mm: 3.2 } }, { precipitation_mm: 0 });
    renderDetail({ hourly, initialDate: '2026-08-04' });

    expect(screen.getByRole('img', { name: /millimetri/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /probabilità/i })).toBeInTheDocument();
  });

  it('hides the mm chart and explains why when no source provided mm', () => {
    // Il backend omette del tutto la chiave: cache vecchia o fonti senza mm.
    renderDetail({ hourly: buildDay('2026-08-04'), initialDate: '2026-08-04' });

    expect(screen.queryByRole('img', { name: /millimetri/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Quantità in mm non disponibile per questa località/i)
    ).toBeInTheDocument();
    // La probabilità resta: il modale è comunque utile.
    expect(screen.getByRole('img', { name: /probabilità/i })).toBeInTheDocument();
  });

  it('reassures the user on a dry day instead of showing an empty chart', () => {
    const hourly = buildDay('2026-08-04', {}, { precipitation_mm: 0, precipitation_prob: 0 });
    renderDetail({ hourly, initialDate: '2026-08-04' });

    expect(screen.getByText('Nessuna precipitazione prevista')).toBeInTheDocument();
    // Il grafico c'è comunque, così si vede che il dato è stato caricato.
    expect(screen.getByRole('img', { name: /millimetri/i })).toBeInTheDocument();
  });
});

describe('HourlyDetail — le altre metriche', () => {
  it('shows wind speed in km/h with direction and gust in the caption', () => {
    // 10 m/s = 36 km/h, raffica 15 m/s = 54 km/h, 315° = NO
    const hourly = buildDay(
      '2026-08-04',
      { 15: { wind_speed: 10, wind_gust: 15, wind_direction: 315 } },
      { wind_speed: 2, wind_gust: 3, wind_direction: 90 }
    );
    renderDetail({ hourly, initialDate: '2026-08-04', metric: 'wind' });

    // L'ora di default è la più ventosa
    expect(screen.getByText('36 km/h')).toBeInTheDocument();
    expect(screen.getByText(/Da NO/)).toBeInTheDocument();
    expect(screen.getByText(/raffiche 54 km\/h/)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /vento/i })).toBeInTheDocument();
  });

  it('shows humidity as a percentage', () => {
    const hourly = buildDay('2026-08-04', { 15: { humidity: 82 } }, { humidity: 55 });
    renderDetail({ hourly, initialDate: '2026-08-04', metric: 'humidity' });

    expect(screen.getByText('82%')).toBeInTheDocument();
    expect(screen.getByText('Umidità relativa')).toBeInTheDocument();
  });

  it('shows the apparent temperature next to the real one', () => {
    const hourly = buildDay('2026-08-04', { 15: { feels_like: 31 } }, { feels_like: 19, temp: 20 });
    renderDetail({ hourly, initialDate: '2026-08-04', metric: 'feels_like' });

    expect(screen.getByText('31°')).toBeInTheDocument();
    expect(screen.getByText(/Reale 20°/)).toBeInTheDocument();
  });

  it('shows the UV index with its WHO level', () => {
    const hourly = buildDay('2026-08-04', { 13: { uv_index: 9 } }, { uv_index: 1 });
    renderDetail({ hourly, initialDate: '2026-08-04', metric: 'uv' });

    expect(screen.getByText('9')).toBeInTheDocument();
    // Non un match parziale: "Molto alto" è anche l'etichetta di una fascia del grafico.
    expect(screen.getByText('Indice UV · Molto alto')).toBeInTheDocument();
  });

  it('explains the gap instead of drawing an empty chart when a metric is missing', () => {
    // Nessuna delle fonti ha fornito il vento per questa località.
    renderDetail({ hourly: buildDay('2026-08-04'), initialDate: '2026-08-04', metric: 'wind' });

    expect(screen.queryByRole('img', { name: /vento/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Dati del vento non disponibili per questa località/i)
    ).toBeInTheDocument();
  });

  it('keeps the selected day when the metric changes', async () => {
    const user = userEvent.setup();
    const hourly = [
      ...buildDay('2026-08-04', {}, { humidity: 50 }),
      ...buildDay('2026-08-05', {}, { humidity: 70 }),
    ];
    const { rerender } = render(
      <HourlyDetail hourly={hourly} daily={DAILY} initialDate="2026-08-04" metric="precipitation" />
    );

    await user.click(screen.getByRole('button', { name: /5/ }));
    expect(screen.getByText('Mercoledì 5 agosto 2026')).toBeInTheDocument();

    rerender(
      <HourlyDetail hourly={hourly} daily={DAILY} initialDate="2026-08-04" metric="humidity" />
    );
    expect(screen.getByText('Mercoledì 5 agosto 2026')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });
});

describe('HourlyDetail — il passato non è una previsione', () => {
  // Segnalato dallo screenshot su iOS: aprendo il dettaglio, il primo chip
  // della strip era *ieri*, e il grafico si apriva lì. L'array `hourly` può
  // cominciare dalla sera prima — le fonti in UTC, riportate nell'ora locale
  // della località, consegnano qualche ora del giorno precedente.
  const IERI = '2026-08-03';
  const OGGI = '2026-08-04';
  const DOMANI = '2026-08-05';

  beforeEach(() => {
    jest.setSystemTime(new Date(`${OGGI}T09:00:00`));
  });

  afterEach(() => {
    jest.setSystemTime(VIGILIA);
  });

  /** I chip della strip, nell'ordine in cui compaiono. */
  function chipDelleGiornate(): string[] {
    return screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /\d/.test(t));
  }

  it('non offre ieri nella strip, anche se ci sono ore di ieri', () => {
    const hourly = [...buildDay(IERI), ...buildDay(OGGI), ...buildDay(DOMANI)];
    renderDetail({ hourly, initialDate: OGGI });

    const chip = chipDelleGiornate();
    expect(chip).toHaveLength(2);
    expect(chip[0]).toContain('4');
    expect(chip.some((t) => t.includes('3'))).toBe(false);
  });

  it('apre su oggi anche se gli viene chiesto un giorno passato', () => {
    // È esattamente il caso della segnalazione: il chiamante passava la data
    // della prima riga oraria, che era di ieri.
    const hourly = [...buildDay(IERI), ...buildDay(OGGI)];
    renderDetail({ hourly, initialDate: IERI });

    expect(screen.getByText('Martedì 4 agosto 2026')).toBeInTheDocument();
  });

  it('su oggi mostra l ora corrente, non quella di picco', () => {
    // Il contrario del ramo verificato sopra: se il giorno è oggi, l'ora che
    // interessa è adesso, non la più piovosa della giornata.
    const hourly = buildDay(OGGI, { 9: { humidity: 41 }, 15: { humidity: 99 } }, { humidity: 55 });
    renderDetail({ hourly, initialDate: OGGI, metric: 'humidity' });

    expect(screen.getByText('41%')).toBeInTheDocument();
  });

  it('se oggi non è coperto ripiega sul primo giorno futuro, mai su ieri', () => {
    const hourly = [...buildDay(IERI), ...buildDay(DOMANI)];
    renderDetail({ hourly, daily: DAILY, initialDate: IERI });

    expect(screen.getByText('Mercoledì 5 agosto 2026')).toBeInTheDocument();
  });
});

describe('MetricSelect', () => {
  it('mostra tutte le metriche del registry, senza voci orfane', () => {
    // Aggiungere una voce a METRIC_ORDER senza la sua MetricSpec (o viceversa)
    // romperebbe la dropdown a runtime e non alla compilazione.
    expect(new Set(METRIC_ORDER).size).toBe(METRIC_ORDER.length);
    for (const id of METRIC_ORDER) {
      expect(METRICS[id]).toBeDefined();
      expect(METRICS[id].sections.length).toBeGreaterThan(0);
    }
    expect(Object.keys(METRICS).sort()).toEqual([...METRIC_ORDER].sort());
  });

  it('shows the current metric and opens the listbox on click', async () => {
    const user = userEvent.setup();
    render(<MetricSelect value="precipitation" onChange={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /Precipitazioni/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    // Il conteggio si legge dal registry invece di essere ricopiato: una
    // metrica in più non deve far fallire un test che non la riguarda.
    expect(within(listbox).getAllByRole('option')).toHaveLength(METRIC_ORDER.length);
  });

  it('reports the picked metric and closes', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<MetricSelect value="precipitation" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /Precipitazioni/ }));
    await user.click(screen.getByRole('option', { name: 'Vento' }));

    expect(onChange).toHaveBeenCalledWith('wind');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('marks the current metric as selected', async () => {
    const user = userEvent.setup();
    render(<MetricSelect value="uv" onChange={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /Indice UV/ }));
    expect(screen.getByRole('option', { name: 'Indice UV' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('navigates and picks with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<MetricSelect value="precipitation" onChange={onChange} />);

    // La seconda voce del registry, qualunque essa sia: il test verifica la
    // navigazione da tastiera, non l'ordine della dropdown.
    const seconda = METRIC_ORDER[1]!;

    screen.getByRole('button', { name: /Precipitazioni/ }).focus();
    await user.keyboard('{ArrowDown}');   // apre evidenziando la voce corrente
    await user.keyboard('{ArrowDown}');   // → voce successiva
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith(seconda);
  });

  it('closes on Escape without letting the dialog behind it close too', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(
      <Modal isOpen onClose={onClose} title={<MetricSelect value="wind" onChange={jest.fn()} />}>
        <p>contenuto</p>
      </Modal>
    );

    await user.click(screen.getByRole('button', { name: /Vento/ }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    // Con la dropdown chiusa, Escape torna a chiudere il modale.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Modal', () => {
  const renderModal = (onClose = jest.fn()) => {
    const utils = render(
      <Modal isOpen onClose={onClose} title="Precipitazioni">
        <p>contenuto</p>
      </Modal>
    );
    return { ...utils, onClose };
  };

  it('renders as an accessible dialog labelled by its title', () => {
    renderModal();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('Precipitazioni')).toBeInTheDocument();
    // Il titolo resta un heading anche se non è più un <h2>.
    expect(within(dialog).getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal isOpen={false} onClose={jest.fn()} title="Precipitazioni">
        <p>contenuto</p>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on the X button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.click(screen.getByRole('button', { name: 'Chiudi' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = renderModal();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
