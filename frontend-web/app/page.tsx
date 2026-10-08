'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import CurrentWeather from '@/components/CurrentWeather';
import DayNarrative from '@/components/DayNarrative';
import ForecastDetails from '@/components/ForecastDetails';
import HourlyForecast from '@/components/HourlyForecast';
import SunWindCard from '@/components/SunWindCard';
import MoonCard, { formatMoonTime } from '@/components/MoonCard';
import NextHourPrecipitation from '@/components/NextHourPrecipitation';
import InsightsGrid from '@/components/dashboard/InsightsGrid';
import SourcesIndicator from '@/components/SourcesIndicator';
import SkeletonLoader from '@/components/SkeletonLoader';
import ErrorFallback from '@/components/ErrorFallback';
import AuthButton from '@/components/AuthButton';
import WeatherAlerts, { AlertBadge } from '@/components/WeatherAlerts';
import WeatherIllustration from '@/components/WeatherIllustration';
import HourlyDetail from '@/components/HourlyDetail';
import Modal from '@/components/ui/Modal';
import MetricSelect from '@/components/ui/MetricSelect';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import AppVersion from '@/components/AppVersion';
import type { MetricId } from '@/lib/metrics';
import { availableTabs } from '@/lib/dashboard';
import { useDashboardTab } from '@/lib/useDashboardTab';
import { useForecast, useAlerts } from '@/lib/hooks';
import type { AstronomyData, WeatherAlert } from '@/lib/types';
import { useLocations } from '@/lib/useLocations';

/**
 * Altezza dell'intestazione appiccicata in cima.
 *
 * Serve a dare alla barra delle sezioni il suo `top`: senza, si fermerebbe a
 * zero e finirebbe *sotto* l'intestazione, invisibile proprio quando serve. Non
 * è una costante perché l'intestazione ha due righe (azioni e ricerca) la cui
 * altezza dipende dalla larghezza: sotto `sm` l'email sparisce, i bottoni no.
 */
function useHeaderHeight(ref: React.RefObject<HTMLElement | null>): number {
	const [height, setHeight] = useState(112);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		const measure = () => setHeight(el.getBoundingClientRect().height);
		measure();
		// jsdom non implementa ResizeObserver: la misura iniziale basta, e i
		// test non hanno un viewport che cambia.
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(el);
		return () => observer.disconnect();
	}, [ref]);

	return height;
}

/**
 * Giorno o notte adesso, dagli orari di alba e tramonto della risposta.
 * Senza astronomia si ricade sull'ora del browser dentro `CurrentWeather`.
 */
function isDaytime(astronomy?: AstronomyData): boolean | undefined {
	if (!astronomy?.sunrise || !astronomy?.sunset) return undefined;
	const now = Date.now();
	const sunrise = new Date(astronomy.sunrise).getTime();
	const sunset = new Date(astronomy.sunset).getTime();
	if (isNaN(sunrise) || isNaN(sunset)) return undefined;
	return now >= sunrise && now < sunset;
}

/** Le severità che non si nascondono mai dietro il badge. */
const URGENT_SEVERITIES = new Set(['extreme', 'severe']);

export default function Home() {
	const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
	const [locationName, setLocationName] = useState('');
	/** Data (YYYY-MM-DD) aperta nel dettaglio orario; null = modale chiuso. */
	const [precipDate, setPrecipDate] = useState<string | null>(null);
	/** Metrica mostrata nel modale. Gli entry point sono sulla pioggia, quindi si parte da lì. */
	const [metric, setMetric] = useState<MetricId>('precipitation');
	/** Elenco completo delle allerte aperto dal badge dell'intestazione. */
	const [alertsOpen, setAlertsOpen] = useState(false);
	const headerRef = useRef<HTMLElement>(null);
	const headerHeight = useHeaderHeight(headerRef);

	const { data, error, isLoading, mutate } = useForecast(
		coords?.lat ?? null,
		coords?.lon ?? null
	);

	const {
		homeLocation,
		savedLocations,
		saveHomeLocation,
		removeHomeLocation,
		addSavedLocation,
		removeSavedLocation,
		isSaved,
		isHome,
		isLoaded
	} = useLocations();

	// Auto-load home location on startup
	useEffect(() => {
		if (isLoaded && !coords && homeLocation) {
			setCoords({ lat: homeLocation.lat, lon: homeLocation.lon });
			setLocationName(homeLocation.name);
		}
	}, [isLoaded, homeLocation, coords]);

	const handleLocationSelect = (lat: number, lon: number, name: string) => {
		setCoords({ lat, lon });
		setLocationName(name);
	};

	const currentIsHome = coords ? isHome(coords.lat, coords.lon) : false;
	const currentIsSaved = coords ? isSaved(coords.lat, coords.lon) : false;

	const handleToggleHome = () => {
		if (!coords) return;
		if (currentIsHome) {
			removeHomeLocation();
		} else {
			saveHomeLocation({ id: `${coords.lat}-${coords.lon}`, name: locationName, lat: coords.lat, lon: coords.lon });
		}
	};

	const handleToggleSave = () => {
		if (!coords) return;
		if (currentIsSaved) {
			const loc = savedLocations.find(l => l.lat === coords.lat && l.lon === coords.lon);
			if (loc) removeSavedLocation(loc.id);
		} else {
			addSavedLocation({ id: `${coords.lat}-${coords.lon}`, name: locationName, lat: coords.lat, lon: coords.lon });
		}
	};

	// Fetch allerte dal database (indipendente dal forecast)
	const { data: alertsData } = useAlerts(coords?.lat ?? null, coords?.lon ?? null);

	// Merge allerte dal forecast + dal database, deduplicando per id
	const allAlerts: WeatherAlert[] = (() => {
		const merged = new Map<string, WeatherAlert>();
		for (const a of (data?.alerts || [])) merged.set(a.id, a);
		for (const a of (alertsData?.alerts || [])) {
			// Le allerte dal DB hanno un formato diverso, mappiamo
			const dbAlert = a as WeatherAlert & Record<string, unknown>;
			const key = (dbAlert.external_alert_id as string) || dbAlert.id;
			if (!merged.has(key)) {
				merged.set(key, {
					...dbAlert,
					id: key,
					description: (dbAlert.message as string) || dbAlert.description || '',
					effectiveTime: (dbAlert.effective_time as string) || dbAlert.effectiveTime || '',
					expireTime: (dbAlert.expire_time as string) || dbAlert.expireTime || '',
				});
			}
		}
		return Array.from(merged.values()).filter(
			a => !a.expireTime || new Date(a.expireTime) > new Date()
		);
	})();

	/*
	  Le allerte stanno dietro il badge dell'intestazione, come nel design: nove
	  bollettini gialli in cima alla pagina spingerebbero il meteo sotto la
	  piega. Con una eccezione che non si discute: le severe e le estreme si
	  vedono sempre, senza clic — un'allerta arancione per temporali forti è
	  esattamente la cosa che non deve costare un gesto per essere scoperta.
	*/
	const shownAlerts = alertsOpen ? allAlerts : allAlerts.filter(a => URGENT_SEVERITIES.has(a.severity));

	/*
	  Le sezioni dipendono dalla risposta: una località di montagna ha la
	  scheda neve e non quella mare, una senza dati agronomici può non avere
	  affatto «Per te». Memoizzate sull'oggetto della risposta, altrimenti ogni
	  render ne creerebbe una lista nuova e l'effetto che sorveglia la sezione
	  scomparsa girerebbe a vuoto ad ogni battito.
	*/
	const tabs = useMemo(() => (data ? availableTabs(data) : []), [data]);
	const [tab, setTab] = useDashboardTab(tabs);

	// Stessa condizione con cui `MoonCard` decide di comparire: serve qui per
	// non lasciare una colonna vuota accanto a «Sole & Vento».
	const hasMoon = !!data && (
		formatMoonTime(data.astronomy?.moonrise) != null ||
		formatMoonTime(data.astronomy?.moonset) != null ||
		data.astronomy?.moon_illumination != null
	);

	// 36 px sotto `sm`: a 390 px di larghezza logo, badge, tre icone e il
	// bottone di accesso stanno su una riga sola solo così.
	const iconButton = 'dt-icon-btn inline-flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-40 sm:h-10 sm:w-10';

	return (
		<div className="min-h-screen">
			<header
				ref={headerRef}
				className="sticky top-0 z-10 px-4 pb-3 pt-3 sm:px-7"
				style={{
					background: 'var(--color-material-thick)',
					backdropFilter: 'blur(20px) saturate(160%)',
					WebkitBackdropFilter: 'blur(20px) saturate(160%)',
					borderBottom: '1px solid var(--color-duet-border)',
				}}
			>
				<div className="mx-auto flex max-w-[1320px] flex-col gap-3">
					<div className="flex items-center gap-3">
						<Link href="/" className="flex shrink-0 items-center gap-2.5" style={{ color: 'var(--color-duet-ink)' }}>
							<span
								className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] shadow-sm"
								style={{ background: 'linear-gradient(135deg, #60a5fa, #1d4ed8)' }}
							>
								<WeatherIllustration condition="cloudy" isDay className="h-7 w-7" />
							</span>
							{/* Sotto i 420 px il nome lascia il posto alle azioni: il logo resta */}
							<span className="hig-headline tracking-tight max-[420px]:sr-only">Smart Meteo</span>
						</Link>

						<div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
							{allAlerts.length > 0 && (
								<AlertBadge
									count={allAlerts.length}
									expanded={alertsOpen}
									onClick={() => setAlertsOpen(open => !open)}
								/>
							)}

							<button
								onClick={handleToggleHome}
								disabled={!coords}
								className={iconButton}
								style={{
									color: currentIsHome ? 'var(--color-duet-accent-ink)' : 'var(--color-duet-muted)',
									background: currentIsHome ? 'rgba(59, 130, 246, 0.24)' : 'transparent',
								}}
								title={currentIsHome ? 'Rimuovi da Home' : 'Imposta come Home'}
								aria-pressed={currentIsHome}
							>
								<svg width="19" height="19" viewBox="0 0 24 24" fill={currentIsHome ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
									<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5z" />
								</svg>
							</button>
							<button
								onClick={handleToggleSave}
								disabled={!coords}
								className={iconButton}
								style={{
									color: currentIsSaved ? 'var(--color-duet-accent-ink)' : 'var(--color-duet-muted)',
									background: currentIsSaved ? 'rgba(59, 130, 246, 0.24)' : 'transparent',
								}}
								title={currentIsSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
								aria-pressed={currentIsSaved}
							>
								<svg width="19" height="19" viewBox="0 0 24 24" fill={currentIsSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
									<path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
								</svg>
							</button>
							<Link
								href="/sources"
								className={iconButton}
								style={{ color: 'var(--color-duet-muted)' }}
								title="Gestione fonti"
							>
								<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
									<path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
									<path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</Link>
							<span className="ml-1">
								<AuthButton />
							</span>
						</div>
					</div>

					<SearchBar
						onLocationSelect={handleLocationSelect}
						isLoading={isLoading}
						savedLocations={savedLocations}
						homeLocation={homeLocation}
						onRemoveHome={removeHomeLocation}
						onRemoveSaved={removeSavedLocation}
					/>
				</div>
			</header>

			<main className="mx-auto flex max-w-[1320px] flex-col gap-5 px-4 py-5 sm:px-7 sm:py-7">
				{!coords && !data && (
					<div className="glass p-10 text-center" style={{ color: 'var(--color-duet-ink)' }}>
						<div
							className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
							style={{ background: 'linear-gradient(135deg, #60a5fa, #1d4ed8)' }}
						>
							<WeatherIllustration condition="cloudy" isDay className="h-12 w-12" />
						</div>
						<h2 className="hig-title-2 mb-2">Benvenuto su Smart Meteo</h2>
						<p className="hig-subhead mx-auto max-w-sm" style={{ color: 'var(--color-duet-muted)' }}>
							Cerca una località o usa la geolocalizzazione per vedere le previsioni aggregate da 5 fonti meteo professionali.
						</p>
					</div>
				)}

				{isLoading && <SkeletonLoader />}

				{error && (
					<ErrorFallback
						message={error.message || 'Impossibile caricare le previsioni'}
						onRetry={() => mutate()}
					/>
				)}

				{data && !isLoading && (
					<>
						{/*
						  ZONA SEMPRE VISIBILE.

						  Allerte urgenti, condizioni attuali e nowcast al minuto
						  stanno fuori dalle sezioni perché sono la risposta a colpo
						  d'occhio: se piove fra dodici minuti non deve costare un
						  clic saperlo.
						*/}
						{shownAlerts.length > 0 && (
							<div id="dashboard-alerts">
								<WeatherAlerts alerts={shownAlerts} />
							</div>
						)}

						<CurrentWeather
							data={data.current}
							locationName={locationName}
							sourcesCount={data.sources_used.length}
							isDay={isDaytime(data.astronomy)}
						/>

						<NextHourPrecipitation data={data.forecastNextHour} />

						{/*
						  BARRA DELLE SEZIONI.

						  Appiccicata sotto l'intestazione, così restare orientati non
						  richiede di risalire la pagina. Il `top` è misurato, non
						  costante: l'intestazione ha due righe di altezza variabile.
						*/}
						<div
							className="sticky z-[5] py-2"
							style={{
								top: headerHeight,
								/*
								  Lo sfondo deve arrivare ai bordi della finestra, o
								  scorrendo si vedrebbero le schede passare negli
								  spazi laterali: `main` però è centrato e largo al
								  massimo 1320 px. L'ombra piatta estesa oltre il
								  riquadro, ritagliata solo in verticale, allarga il
								  fondo senza toccare il layout — un `100vw`
								  comprenderebbe la barra di scorrimento e
								  aggiungerebbe uno scorrimento orizzontale.
								*/
								background: 'var(--color-duet-bg)',
								boxShadow: '0 0 0 100vmax var(--color-duet-bg)',
								clipPath: 'inset(0 -100vmax)',
							}}
						>
							<SegmentedTabs
								items={tabs}
								value={tab}
								onChange={setTab}
								idPrefix="dashboard"
								aria-label="Sezioni della dashboard"
							/>
						</div>

						<div
							role="tabpanel"
							id={`dashboard-panel-${tab}`}
							aria-labelledby={`dashboard-tab-${tab}`}
							tabIndex={-1}
							className="flex flex-col gap-5"
						>
							{tab === 'oggi' && (
								<>
									<div className={`grid grid-cols-1 gap-5 ${hasMoon ? 'md:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]' : ''}`}>
										<SunWindCard astronomy={data.astronomy} current={data.current} />
										<MoonCard astronomy={data.astronomy} />
									</div>
									<DayNarrative
										current={data.current}
										hourly={data.hourly}
										daily={data.daily}
										astronomy={data.astronomy}
									/>
									{data.hourly && (
										<HourlyForecast
											hourly={data.hourly}
											astronomy={data.astronomy}
											onPrecipitationClick={(isoTime) => setPrecipDate(isoTime.slice(0, 10))}
										/>
									)}
								</>
							)}

							{tab === 'settimana' && (
								<ForecastDetails
									data={data.current}
									daily={data.daily}
									hourly={data.hourly}
									astronomy={data.astronomy}
									onPrecipitationClick={(date) => setPrecipDate(date)}
								/>
							)}

							{tab === 'perte' && <InsightsGrid data={data} />}

							{/*
							  Le fonti contribuenti sono un dato diagnostico — quante
							  fonti, quanto sono d'accordo — non una previsione: hanno
							  una sezione loro.
							*/}
							{tab === 'fonti' && (
								<SourcesIndicator sources={data.sources_used} confidence={data.confidence} />
							)}
						</div>

						{/* Il modale vive in un portal su document.body: la posizione qui è indifferente */}
						<Modal
							isOpen={precipDate !== null}
							onClose={() => {
								setPrecipDate(null);
								setMetric('precipitation');
							}}
							title={<MetricSelect value={metric} onChange={setMetric} />}
						>
							{data.hourly && precipDate && (
								<HourlyDetail
									hourly={data.hourly}
									daily={data.daily}
									initialDate={precipDate}
									metric={metric}
								/>
							)}
						</Modal>

						{/* Timestamp e versione: le due informazioni diagnostiche, insieme */}
						<p className="text-center text-xs" style={{ color: 'var(--color-duet-muted)' }}>
							Aggiornato: {new Date(data.generated_at).toLocaleString('it-IT')}
							{' - '}
							<AppVersion />
						</p>
					</>
				)}
			</main>
		</div>
	);
}
