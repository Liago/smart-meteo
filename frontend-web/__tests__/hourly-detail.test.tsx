import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HourlyDetail from '@/components/HourlyDetail';
import Modal from '@/components/ui/Modal';
import MetricSelect from '@/components/ui/MetricSelect';
import type { HourlyForecast, DailyForecast } from '@/lib/types';
import type { MetricId } from '@/lib/metrics';

jest.mock('framer-motion');

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

describe('MetricSelect', () => {
  it('shows the current metric and opens the listbox on click', async () => {
    const user = userEvent.setup();
    render(<MetricSelect value="precipitation" onChange={jest.fn()} />);

    const trigger = screen.getByRole('button', { name: /Precipitazioni/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(within(listbox).getAllByRole('option')).toHaveLength(5);
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

    screen.getByRole('button', { name: /Precipitazioni/ }).focus();
    await user.keyboard('{ArrowDown}');   // apre evidenziando la voce corrente
    await user.keyboard('{ArrowDown}');   // → Vento
    await user.keyboard('{Enter}');

    expect(onChange).toHaveBeenCalledWith('wind');
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
