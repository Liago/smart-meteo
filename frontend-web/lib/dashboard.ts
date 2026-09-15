import type {
	ForecastResponse,
	PollenLevel,
	PollenReading,
	SeaOutlook,
	SkyLevel,
	SkyOutlook,
	SnowOutlook,
	GardenOutlook,
	ActivitiesOutlook,
} from './types';

/**
 * Architettura dell'informazione della dashboard web.
 *
 * Il problema che risolve non è estetico. La pagina impilava tredici schede
 * dello stesso peso visivo in un'unica colonna alta cinque schermate: il
 * meteo di adesso, poi otto approfondimenti di nicchia, poi — in fondo — le
 * ore e i sette giorni, cioè le due cose per cui si apre un'app meteo. Non
 * c'era né una gerarchia né un modo di saltare da una parte all'altra.
 *
 * La riorganizzazione ha due regole:
 *
 * 1. **Quello che vale sempre resta sopra e fuori dalle schede** — allerte,
 *    condizioni attuali, nowcast al minuto. È la risposta a colpo d'occhio e
 *    non deve costare un clic.
 * 2. **Tutto il resto vive in sezioni navigabili**, non impilate. Sono quattro
 *    e rispondono a quattro domande diverse: com'è oggi, com'è la settimana,
 *    che cosa cambia per me, da dove viene il dato.
 *
 * Dentro «Per te» le schede non hanno più un ordine fisso scritto nel JSX. Un
 * ordine fisso è sbagliato per costruzione: a gennaio metteva il mare sopra
 * la gelata, a luglio i pollini sotto il fotovoltaico. Qui ogni scheda
 * dichiara quanto conta *oggi* e la griglia si riordina da sola.
 */

/** Le quattro sezioni della dashboard. */
export type TabId = 'oggi' | 'settimana' | 'perte' | 'fonti';

/** Le schede di approfondimento, che il backend manda solo quando ha senso. */
export type InsightId =
	| 'snow'
	| 'air'
	| 'pollen'
	| 'sea'
	| 'garden'
	| 'activities'
	| 'sky'
	| 'solar';

export interface InsightCard {
	id: InsightId;
	/**
	 * Quanto la scheda merita di stare in cima **oggi**, 0-100.
	 *
	 * Non è la qualità del dato né quanto è bella la giornata: è l'urgenza con
	 * cui chi apre la pagina vuole vederla. Una gelata forte stanotte batte
	 * qualunque tramonto; un mare calmo d'agosto vale meno di un'aria
	 * irrespirabile.
	 */
	relevance: number;
}

/**
 * Ordine di parità: quando due schede pesano uguale decide questo elenco,
 * altrimenti l'ordine dipenderebbe da come `sort` tratta gli ex aequo e
 * cambierebbe fra un render e l'altro.
 *
 * L'ordine è per «quante persone quel dato riguarda»: salute e sicurezza
 * prima, pianificazione dopo, hobby in fondo.
 */
const TIE_BREAK: InsightId[] = [
	'snow',
	'air',
	'pollen',
	'sea',
	'garden',
	'activities',
	'sky',
	'solar',
];

/** Gravità dei pollini, per specie: conta la peggiore della giornata. */
const POLLEN_RELEVANCE: Record<PollenLevel, number> = {
	very_high: 82,
	high: 68,
	moderate: 42,
	low: 16,
	none: 6,
};

/** Fasce dei due indici del cielo (tramonto e stelle). */
const SKY_RELEVANCE: Record<SkyLevel, number> = {
	excellent: 60,
	good: 44,
	fair: 26,
	plain: 12,
};

/**
 * Neve e gelate.
 *
 * Il backend manda il blocco solo quando c'è qualcosa da dire, quindi la sola
 * presenza vale già una rilevanza alta: non esiste il caso «neve tranquilla».
 * Sopra tutto sta la gelata, che è l'unico dato di questa pagina per cui si
 * esce di casa la sera a coprire le piante o si monta una catena.
 */
function snowRelevance(snow: SnowOutlook): number {
	const candidates = [55];

	if (snow.frost.level === 'severe') candidates.push(98);
	else if (snow.frost.level === 'likely') candidates.push(88);
	else if (snow.frost.level === 'possible') candidates.push(70);

	if (snow.snowfall_cm != null && snow.snowfall_cm > 0) candidates.push(85);
	if (snow.snow_depth_cm != null && snow.snow_depth_cm >= 1) candidates.push(60);

	return Math.max(...candidates);
}

/**
 * Qualità dell'aria, sulla scala EPA 1-6 che la tile mostra.
 *
 * Dal livello 4 in su le linee guida sconsigliano l'attività all'aperto ai
 * soggetti sensibili: è il punto in cui la scheda smette di essere un numero
 * e diventa un motivo per cambiare programma.
 */
function airRelevance(aqi: number): number {
	if (aqi >= 5) return 95;
	if (aqi >= 4) return 80;
	if (aqi >= 3) return 55;
	if (aqi >= 2) return 30;
	return 18;
}

function pollenRelevance(pollen: PollenReading[]): number {
	return Math.max(...pollen.map((p) => POLLEN_RELEVANCE[p.daily_level]));
}

/**
 * Mare.
 *
 * Allo stato attuale si somma il peggioramento: un mare calmo adesso che
 * diventa mosso nel pomeriggio è **più** interessante di un mare calmo che
 * resta calmo, ed è esattamente il caso in cui si sbaglia a uscire in barca.
 */
function seaRelevance(sea: SeaOutlook): number {
	const base =
		sea.state === 'rough' ? 78 : sea.state === 'moderate' ? 58 : sea.state === 'slight' ? 34 : 24;

	const worsening =
		sea.max_wave_24h != null &&
		sea.wave_height != null &&
		sea.max_wave_24h >= 1 &&
		sea.max_wave_24h >= sea.wave_height * 1.5;

	return Math.min(90, base + (worsening ? 12 : 0));
}

/**
 * Orto: l'urgenza è quella del consiglio, non dello stato del terreno.
 *
 * Anche il caso tranquillo vale qualcosa. A differenza della neve — dove
 * «niente da segnalare» significa un riquadro vuoto per otto mesi l'anno, e
 * infatti il backend non lo manda — «non serve innaffiare» **è** la risposta
 * che chi ha un orto viene a cercare la sera, e resta quindi sopra alla scheda
 * del fotovoltaico, che risponde a una domanda di pianificazione.
 */
function gardenRelevance(garden: GardenOutlook): number {
	switch (garden.advice) {
		case 'water_now':
			return 62;
		case 'rain_expected':
			return 48;
		case 'water_soon':
			return 36;
		default:
			return 24;
	}
}

/**
 * Indici lifestyle.
 *
 * Contano ai due estremi, non nel mezzo: una giornata ottima per uscire è una
 * notizia, e lo è anche una in cui *niente* funziona. Una giornata mediocre è
 * il caso ordinario e può stare più in basso.
 */
function activitiesRelevance(activities: ActivitiesOutlook): number {
	const best = Math.max(...activities.activities.map((a) => a.score));
	if (best >= 80) return 52;
	if (best <= 40) return 44;
	return 34;
}

function skyRelevance(sky: SkyOutlook): number {
	const levels: SkyLevel[] = [];
	if (sky.sunset) levels.push(sky.sunset.level);
	if (sky.sunrise) levels.push(sky.sunrise.level);
	if (sky.stargazing) levels.push(sky.stargazing.level);
	if (levels.length === 0) return 0;
	return Math.max(...levels.map((l) => SKY_RELEVANCE[l]));
}

/**
 * Fotovoltaico: rilevanza costante e bassa.
 *
 * È l'unica scheda che non risponde a «devo cambiare i piani di oggi» ma a
 * «quanto produrrà l'impianto», una domanda di chi l'impianto ce l'ha e la
 * cerca apposta. Farla salire in cima in una giornata di sole toglierebbe il
 * posto a un dato che riguarda tutti.
 */
const SOLAR_RELEVANCE = 22;

/**
 * Le schede disponibili per questa risposta, dalla più rilevante alla meno.
 *
 * «Disponibile» ha la stessa definizione che i pannelli applicano già da soli
 * (`if (!sea) return null`): la lista serve a ordinarli e a contarli per il
 * badge della sezione, non a cambiare le loro regole di visibilità — se le due
 * definizioni divergessero, il badge direbbe cinque e la griglia ne mostrerebbe
 * quattro.
 */
export function rankInsights(data: ForecastResponse): InsightCard[] {
	const cards: InsightCard[] = [];

	if (data.snow) cards.push({ id: 'snow', relevance: snowRelevance(data.snow) });
	if (data.current.aqi != null)
		cards.push({ id: 'air', relevance: airRelevance(data.current.aqi) });
	if (data.pollen && data.pollen.length > 0)
		cards.push({ id: 'pollen', relevance: pollenRelevance(data.pollen) });
	if (data.sea) cards.push({ id: 'sea', relevance: seaRelevance(data.sea) });
	if (data.garden) cards.push({ id: 'garden', relevance: gardenRelevance(data.garden) });
	if (data.activities && data.activities.activities.length > 0)
		cards.push({ id: 'activities', relevance: activitiesRelevance(data.activities) });
	// `SkyPanel` non si mostra se non ha né un evento solare né la notte: la
	// stessa condizione, qui, è una rilevanza nulla.
	if (data.sky && skyRelevance(data.sky) > 0)
		cards.push({ id: 'sky', relevance: skyRelevance(data.sky) });
	if (data.solar && data.solar.days.length > 0)
		cards.push({ id: 'solar', relevance: SOLAR_RELEVANCE });

	return cards.sort(
		(a, b) => b.relevance - a.relevance || TIE_BREAK.indexOf(a.id) - TIE_BREAK.indexOf(b.id)
	);
}

/**
 * I sette giorni che la sezione «Settimana» può mostrare.
 *
 * Duplica di proposito il filtro di `ForecastDetails`: la sezione va nascosta
 * *prima* di renderizzarne il contenuto, altrimenti resta una linguetta che
 * apre il vuoto. `daily` può aprirsi con ieri — le fonti ragionano in UTC — e
 * si sceglie sempre per data, mai per posizione.
 */
export function upcomingDays(data: ForecastResponse, now = new Date()): number {
	if (!data.daily) return 0;
	const today = now.toLocaleDateString('sv-SE');
	return data.daily.filter((d) => d.date.slice(0, 10) > today).length;
}

export interface TabDescriptor {
	id: TabId;
	label: string;
	/** Mostrato nella linguetta quando c'è qualcosa da contare. */
	count?: number;
}

/**
 * Le sezioni effettivamente disponibili per questa risposta.
 *
 * Una linguetta che apre una sezione vuota è peggio di una linguetta assente:
 * la prima si scopre solo cliccandola. «Oggi» e «Fonti» ci sono sempre, perché
 * ci sono sempre un orario e un elenco di fonti.
 */
export function availableTabs(data: ForecastResponse, now = new Date()): TabDescriptor[] {
	const tabs: TabDescriptor[] = [{ id: 'oggi', label: 'Oggi' }];

	const days = upcomingDays(data, now);
	if (days > 0) tabs.push({ id: 'settimana', label: 'Settimana', count: days });

	const insights = rankInsights(data);
	if (insights.length > 0)
		tabs.push({ id: 'perte', label: 'Per te', count: insights.length });

	tabs.push({ id: 'fonti', label: 'Fonti', count: data.sources_used.length });

	return tabs;
}

/**
 * La sezione da aprire all'arrivo.
 *
 * L'ancora nell'URL vince, così una sezione è condivisibile e sopravvive al
 * ricaricamento; se punta a una sezione che questa località non ha — il mare a
 * Milano — si ricade sulla prima disponibile invece di mostrare il vuoto.
 */
export function resolveTab(hash: string, tabs: TabDescriptor[]): TabId {
	const wanted = hash.replace(/^#/, '');
	const match = tabs.find((t) => t.id === wanted);
	return match ? match.id : tabs[0]!.id;
}
