'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import CurrentWeather from '@/components/CurrentWeather';
import DayNarrative from '@/components/DayNarrative';
import ForecastDetails from '@/components/ForecastDetails';
import HourlyForecast from '@/components/HourlyForecast';
import SunWindCard from '@/components/SunWindCard';
import NextHourPrecipitation from '@/components/NextHourPrecipitation';
import InsightsGrid from '@/components/dashboard/InsightsGrid';
import SourcesIndicator from '@/components/SourcesIndicator';
import SkeletonLoader from '@/components/SkeletonLoader';
import ErrorFallback from '@/components/ErrorFallback';
import AuthButton from '@/components/AuthButton';
import WeatherAlerts, { AlertBadge } from '@/components/WeatherAlerts';
import HourlyDetail from '@/components/HourlyDetail';
import Modal from '@/components/ui/Modal';
import MetricSelect from '@/components/ui/MetricSelect';
import SegmentedTabs from '@/components/ui/SegmentedTabs';
import AppVersion from '@/components/AppVersion';
import type { MetricId } from '@/lib/metrics';
import { availableTabs } from '@/lib/dashboard';
import { useDashboardTab } from '@/lib/useDashboardTab';
import { useForecast, useAlerts } from '@/lib/hooks';
import type { WeatherAlert } from '@/lib/types';
import { useLocations } from '@/lib/useLocations';

/**
 * Altezza dell'intestazione appiccicata in cima.
 *
 * Serve a dare alla barra delle sezioni il suo `top`: senza, si fermerebbe a
 * zero e finirebbe *sotto* l'intestazione, invisibile proprio quando serve. Non
 * è una costante perché l'intestazione va a capo sotto i 1024 px — la ricerca
 * prende una riga tutta sua — e passa da 64 a un centinaio di pixel.
 */
function useHeaderHeight(ref: React.RefObject<HTMLElement | null>): number {
	const [height, setHeight] = useState(64);

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

export default function Home() {
	const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
	const [locationName, setLocationName] = useState('');
	/** Data (YYYY-MM-DD) aperta nel dettaglio orario; null = modale chiuso. */
	const [precipDate, setPrecipDate] = useState<string | null>(null);
	/** Metrica mostrata nel modale. Gli entry point sono sulla pioggia, quindi si parte da lì. */
	const [metric, setMetric] = useState<MetricId>('precipitation');
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
	  Le sezioni dipendono dalla risposta: una località di montagna ha la
	  scheda neve e non quella mare, una senza dati agronomici può non avere
	  affatto «Per te». Memoizzate sull'oggetto della risposta, altrimenti ogni
	  render ne creerebbe una lista nuova e l'effetto che sorveglia la sezione
	  scomparsa girerebbe a vuoto ad ogni battito.
	*/
	const tabs = useMemo(() => (data ? availableTabs(data) : []), [data]);
	const [tab, setTab] = useDashboardTab(tabs);

	return (
		<div className="min-h-screen" style={{ background: 'var(--color-duet-bg)' }}>
			<header
				ref={headerRef}
				className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 lg:h-16 lg:flex-nowrap lg:gap-x-6 lg:px-7 lg:py-0"
				style={{
					background: 'var(--color-material-thick)',
					backdropFilter: 'blur(20px) saturate(180%)',
					WebkitBackdropFilter: 'blur(20px) saturate(180%)',
					borderBottom: '0.5px solid var(--color-duet-border)',
				}}
			>
				<Link href="/" className="order-1 flex shrink-0 items-center gap-2.5">
					<span
						className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] text-white shadow-sm"
						style={{ background: 'var(--color-duet-accent)' }}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
							<path strokeLinecap="round" d="M9 12l1.5 2 2-3" />
						</svg>
					</span>
					<span className="hig-headline tracking-tight" style={{ color: 'var(--color-duet-ink)' }}>Smart Meteo</span>
				</Link>

				{/*
				  Sotto lg la ricerca va a capo su una riga intera (order-3, w-full):
				  a 768px (tablet in modalità "sito desktop" di Safari iPadOS) la riga
				  singola non ha abbastanza spazio per logo + ricerca + azioni.
				  Da lg in su torna in linea fra logo e azioni con una larghezza massima.
				*/}
				<div className="order-3 w-full lg:order-2 lg:w-auto lg:flex-1 lg:max-w-[460px]">
					<SearchBar
						onLocationSelect={handleLocationSelect}
						isLoading={isLoading}
						savedLocations={savedLocations}
						homeLocation={homeLocation}
						onRemoveHome={removeHomeLocation}
						onRemoveSaved={removeSavedLocation}
					/>
				</div>

				<div className="order-2 ml-auto flex items-center gap-1 lg:order-3 lg:ml-0">
					{allAlerts.length > 0 && <AlertBadge count={allAlerts.length} />}

					<button
						onClick={handleToggleHome}
						disabled={!coords}
						className="dt-icon-btn inline-flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40"
						style={{ color: currentIsHome ? 'var(--color-duet-accent)' : 'var(--color-duet-muted)', background: currentIsHome ? 'var(--color-duet-accent-soft)' : 'transparent' }}
						title={currentIsHome ? 'Rimuovi da Home' : 'Imposta come Home'}
					>
						<svg width="19" height="19" viewBox="0 0 24 24" fill={currentIsHome ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
						</svg>
					</button>
					<button
						onClick={handleToggleSave}
						disabled={!coords}
						className="dt-icon-btn inline-flex items-center justify-center w-10 h-10 rounded-full disabled:opacity-40"
						style={{ color: currentIsSaved ? 'var(--color-duet-accent)' : 'var(--color-duet-muted)', background: currentIsSaved ? 'var(--color-duet-accent-soft)' : 'transparent' }}
						title={currentIsSaved ? 'Rimuovi dai preferiti' : 'Salva nei preferiti'}
					>
						<svg width="19" height="19" viewBox="0 0 24 24" fill={currentIsSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
						</svg>
					</button>
					<Link
						href="/sources"
						className="dt-icon-btn inline-flex items-center justify-center w-10 h-10 rounded-full"
						style={{ color: 'var(--color-duet-muted)' }}
						title="Gestione fonti"
					>
						<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
							<path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573-1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</Link>
					<AuthButton />
				</div>
			</header>

			<main className="max-w-[1320px] mx-auto px-4 sm:px-7 py-5 sm:py-7 flex flex-col gap-5">
				{!coords && !data && (
					<div className="glass p-10 text-center" style={{ color: 'var(--color-duet-ink)' }}>
						<div
							className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
							style={{ background: 'var(--color-duet-accent-soft)' }}
						>
							<span className="text-4xl" aria-hidden>{'🌤️'}</span>
						</div>
						<h2 className="hig-title-2 mb-2">Benvenuto su Smart Meteo</h2>
						<p className="hig-subhead max-w-sm mx-auto" style={{ color: 'var(--color-duet-muted)' }}>
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

						  Allerte, condizioni attuali e nowcast al minuto stanno fuori
						  dalle sezioni perché sono la risposta a colpo d'occhio: se
						  piove fra dodici minuti non deve costare un clic saperlo.
						  Tutto il resto — le ore, i giorni, gli approfondimenti, le
						  fonti — è approfondimento e vive nelle sezioni qui sotto.
						*/}
						{allAlerts.length > 0 && <WeatherAlerts alerts={allAlerts} />}

						<div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[1.7fr_1fr]">
							<CurrentWeather
								data={data.current}
								locationName={locationName}
								sourcesCount={data.sources_used.length}
							/>
							<div className="flex flex-col gap-5">
								<NextHourPrecipitation data={data.forecastNextHour} />
								<SunWindCard astronomy={data.astronomy} current={data.current} />
							</div>
						</div>

						{/*
						  BARRA DELLE SEZIONI.

						  Appiccicata sotto l'intestazione, così restare orientati non
						  richiede di risalire la pagina: era il difetto principale della
						  versione precedente, tredici schede in una colonna alta cinque
						  schermate e nessun modo di saltare da una parte all'altra.
						  Il `top` è misurato, non costante: l'intestazione va a capo
						  sotto i 1024 px.
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

								  Il colore è quello opaco della pagina e non il
								  materiale traslucido dell'intestazione: la
								  sfocatura si applica al solo riquadro dell'elemento
								  e non all'ombra, e la giuntura si vedrebbe.
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
							  una sezione loro invece di chiudere la colonna in mezzo a
							  schede che rispondono a una domanda dell'utente.
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
						<p className="text-center text-xs" style={{ color: 'var(--color-duet-faint)' }}>
							Aggiornato: {new Date(data.generated_at).toLocaleString('it-IT')}
							<span className="mx-2" aria-hidden="true">·</span>
							<AppVersion />
						</p>
					</>
				)}
			</main>
		</div>
	);
}
