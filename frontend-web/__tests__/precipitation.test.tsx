import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PrecipitationDetail from '@/components/PrecipitationDetail';
import Modal from '@/components/ui/Modal';
import type { HourlyForecast, DailyForecast } from '@/lib/types';

jest.mock('framer-motion');

/** Costruisce le 24 ore di un giorno, con mm e probabilità opzionali per ora. */
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

describe('PrecipitationDetail', () => {
  it('renders the selected date in long Italian form', () => {
    render(<PrecipitationDetail hourly={buildDay('2026-08-04')} initialDate="2026-08-04" />);
    expect(screen.getByText('Martedì 4 agosto 2026')).toBeInTheDocument();
  });

  it('renders one button per day and switches the date on click', async () => {
    const user = userEvent.setup();
    const hourly = [...buildDay('2026-08-04'), ...buildDay('2026-08-05')];
    render(<PrecipitationDetail hourly={hourly} daily={DAILY} initialDate="2026-08-04" />);

    // 3 giorni dal daily, ma solo 2 hanno righe orarie
    const dayButtons = screen.getAllByRole('button');
    expect(dayButtons).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: /5/ }));
    expect(screen.getByText('Mercoledì 5 agosto 2026')).toBeInTheDocument();
  });

  it('disables days that have no hourly rows', () => {
    render(
      <PrecipitationDetail hourly={buildDay('2026-08-04')} daily={DAILY} initialDate="2026-08-04" />
    );
    // 2026-08-06 non ha ore: il suo bottone non deve essere cliccabile
    const buttons = screen.getAllByRole('button');
    const disabled = buttons.filter(b => (b as HTMLButtonElement).disabled);
    expect(disabled).toHaveLength(2);
  });

  it('shows both charts when mm data is present', () => {
    const hourly = buildDay('2026-08-04', { 15: { precipitation_mm: 3.2 } }, { precipitation_mm: 0 });
    render(<PrecipitationDetail hourly={hourly} initialDate="2026-08-04" />);

    expect(
      screen.getByRole('img', { name: /millimetri/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /probabilità/i })
    ).toBeInTheDocument();
  });

  it('hides the mm chart and explains why when no source provided mm', () => {
    // Il backend omette del tutto la chiave: cache vecchia o fonti senza mm.
    render(<PrecipitationDetail hourly={buildDay('2026-08-04')} initialDate="2026-08-04" />);

    expect(screen.queryByRole('img', { name: /millimetri/i })).not.toBeInTheDocument();
    expect(
      screen.getByText(/Quantità in mm non disponibile per questa località/i)
    ).toBeInTheDocument();
    // La probabilità resta: il modale è comunque utile.
    expect(screen.getByRole('img', { name: /probabilità/i })).toBeInTheDocument();
  });

  it('reassures the user on a dry day instead of showing an empty chart', () => {
    const hourly = buildDay('2026-08-04', {}, { precipitation_mm: 0, precipitation_prob: 0 });
    render(<PrecipitationDetail hourly={hourly} initialDate="2026-08-04" />);

    expect(screen.getByText('Nessuna precipitazione prevista')).toBeInTheDocument();
    // Il grafico c'è comunque, così si vede che il dato è stato caricato.
    expect(screen.getByRole('img', { name: /millimetri/i })).toBeInTheDocument();
  });

  it('falls back to a message when the day has no hourly rows at all', () => {
    render(<PrecipitationDetail hourly={buildDay('2026-08-04')} daily={DAILY} initialDate="2026-08-09" />);
    // initialDate non copribile → ripiega sul primo giorno con dati
    expect(screen.getByText('Martedì 4 agosto 2026')).toBeInTheDocument();
  });

  it('moves the selected hour with the arrow keys', async () => {
    const user = userEvent.setup();
    const hourly = buildDay('2026-08-04', { 15: { precipitation_mm: 3.2 } }, { precipitation_mm: 0 });
    render(<PrecipitationDetail hourly={hourly} initialDate="2026-08-04" />);

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
