import { WeatherAlert } from '../types';

/**
 * Filtro geografico condiviso per le allerte meteo.
 *
 * Diversi provider (in particolare WeatherAPI, ma anche WeatherKit) restituiscono
 * le allerte a livello NAZIONALE per qualsiasi coordinata richiesta: chiedendo le
 * allerte per Bormio si ricevono anche quelle di Sicilia, Molise o Umbria.
 * Questo modulo è l'unico punto di verità per rispondere alla domanda
 * "questa allerta riguarda davvero questo punto?".
 */

export interface RegionMatch {
	id: string;
	name: string;
}

interface RegionDef {
	name: string;
	/** Varianti di nome usate dai vari provider (italiano, inglese, con/senza trattini) */
	aliases: string[];
	/** Bounding box approssimativo [latMin, latMax, lonMin, lonMax] */
	bbox: [number, number, number, number];
}

/**
 * Regioni italiane indicizzate per EMMA_ID (il codice area usato da MeteoAlarm/EUMETNET,
 * riportato anche da WeatherKit nel campo areaId).
 */
export const ITALY_REGIONS: Record<string, RegionDef> = {
	'IT001': { name: 'Piemonte', aliases: ['piemonte', 'piedmont'], bbox: [44.1, 46.5, 6.6, 9.2] },
	'IT002': { name: "Valle d'Aosta", aliases: ["valle d'aosta", "val d'aosta", 'aosta valley', "vallee d'aoste"], bbox: [45.5, 46.0, 6.8, 7.9] },
	'IT003': { name: 'Lombardia', aliases: ['lombardia', 'lombardy'], bbox: [45.0, 46.6, 8.5, 11.4] },
	'IT004': { name: 'Trentino-Alto Adige', aliases: ['trentino alto adige', 'trentino', 'alto adige', 'sudtirol', 'south tyrol', 'provincia di trento', 'provincia di bolzano'], bbox: [45.7, 47.1, 10.4, 12.5] },
	'IT005': { name: 'Veneto', aliases: ['veneto'], bbox: [44.8, 46.7, 10.6, 13.1] },
	'IT006': { name: 'Friuli Venezia Giulia', aliases: ['friuli venezia giulia', 'friuli'], bbox: [45.6, 46.6, 12.3, 13.9] },
	'IT007': { name: 'Liguria', aliases: ['liguria'], bbox: [43.8, 44.7, 7.5, 10.1] },
	'IT008': { name: 'Emilia e Romagna', aliases: ['emilia e romagna', 'emilia romagna', 'emilia', 'romagna'], bbox: [43.7, 45.1, 9.2, 12.8] },
	'IT009': { name: 'Toscana', aliases: ['toscana', 'tuscany'], bbox: [42.2, 44.5, 9.7, 12.4] },
	'IT010': { name: 'Umbria', aliases: ['umbria'], bbox: [42.4, 43.6, 12.1, 13.3] },
	'IT011': { name: 'Marche', aliases: ['marche'], bbox: [42.7, 43.9, 12.1, 13.9] },
	'IT012': { name: 'Lazio', aliases: ['lazio', 'latium'], bbox: [41.2, 42.9, 11.4, 14.0] },
	'IT013': { name: 'Abruzzo', aliases: ['abruzzo'], bbox: [41.7, 42.9, 13.0, 14.8] },
	'IT014': { name: 'Molise', aliases: ['molise'], bbox: [41.4, 41.9, 14.1, 15.2] },
	'IT015': { name: 'Campania', aliases: ['campania'], bbox: [40.0, 41.5, 13.8, 15.8] },
	'IT016': { name: 'Puglia', aliases: ['puglia', 'apulia'], bbox: [39.8, 42.0, 15.0, 18.5] },
	'IT017': { name: 'Basilicata', aliases: ['basilicata'], bbox: [39.9, 41.1, 15.3, 16.9] },
	'IT018': { name: 'Calabria', aliases: ['calabria'], bbox: [37.9, 39.9, 15.6, 17.1] },
	'IT019': { name: 'Sardegna', aliases: ['sardegna', 'sardinia'], bbox: [38.8, 41.3, 8.1, 9.8] },
	'IT020': { name: 'Sicilia', aliases: ['sicilia', 'sicily'], bbox: [36.6, 38.3, 12.4, 15.7] },
};

/**
 * Determina il codice paese ISO Alpha-2 dalle coordinate.
 * Lookup semplificata per i paesi europei principali, con fallback a 'IT'.
 */
export function getCountryCode(lat: number, lon: number): string {
	if (lat >= 35.5 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) return 'IT';
	if (lat >= 41.3 && lat <= 51.1 && lon >= -5.1 && lon <= 9.6) return 'FR';
	if (lat >= 47.3 && lat <= 55.1 && lon >= 5.9 && lon <= 15.0) return 'DE';
	if (lat >= 36.0 && lat <= 43.8 && lon >= -9.5 && lon <= 3.3) return 'ES';
	if (lat >= 45.8 && lat <= 47.8 && lon >= 5.9 && lon <= 10.5) return 'CH';
	if (lat >= 46.4 && lat <= 49.0 && lon >= 9.5 && lon <= 17.2) return 'AT';
	if (lat >= 49.5 && lat <= 61.0 && lon >= -8.2 && lon <= 1.8) return 'GB';
	// Fallback: Italia (target principale dell'app)
	return 'IT';
}

/**
 * Verifica se un punto (lat, lon) è dentro il bounding box di una regione.
 */
export function isInBbox(lat: number, lon: number, bbox: [number, number, number, number]): boolean {
	return lat >= bbox[0] && lat <= bbox[1] && lon >= bbox[2] && lon <= bbox[3];
}

/**
 * Normalizza un testo per il confronto: minuscolo, senza accenti,
 * punteggiatura convertita in spazi. "Emilia-Romagna" → " emilia romagna ".
 * Il padding con spazi permette il match su confini di parola.
 */
function normalize(text: string): string {
	return ` ${text
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9']+/g, ' ')
		.trim()} `;
}

/**
 * Cerca i nomi di regione presenti in un testo libero (match su parole intere).
 */
function findRegionsInText(text: string | undefined): RegionMatch[] {
	if (!text) return [];
	const haystack = normalize(text);
	const found: RegionMatch[] = [];

	for (const [id, region] of Object.entries(ITALY_REGIONS)) {
		if (found.some(r => r.id === id)) continue;
		for (const alias of region.aliases) {
			if (haystack.includes(normalize(alias))) {
				found.push({ id, name: region.name });
				break;
			}
		}
	}

	return found;
}

/**
 * Regioni il cui bounding box contiene il punto.
 * I bbox sono approssimati e possono sovrapporsi: vengono restituite tutte
 * le regioni compatibili, così da non scartare mai un'allerta legittima.
 */
export function getRegionsForPoint(lat: number, lon: number): RegionMatch[] {
	const regions: RegionMatch[] = [];
	for (const [id, region] of Object.entries(ITALY_REGIONS)) {
		if (isInBbox(lat, lon, region.bbox)) regions.push({ id, name: region.name });
	}
	return regions;
}

/**
 * Determina a quali regioni si riferisce un'allerta, con precedenza:
 * il dato strutturato vince sempre sul testo libero.
 *
 * 1. `areaId` che corrisponde a un EMMA_ID noto (es. "IT003")
 * 2. `areaName` (può essere una lista separata da virgole: WeatherAPI usa `areas`)
 * 3. scansione di `headline` + `description`
 *
 * `resolved: false` significa "area non determinabile" (es. allerte OpenWeatherMap,
 * che non hanno alcun campo geografico).
 */
export function getRegionsForAlert(alert: Partial<WeatherAlert>): { regions: RegionMatch[]; resolved: boolean } {
	// 1. EMMA_ID esplicito
	const areaId = (alert.areaId || '').trim().toUpperCase();
	if (areaId && ITALY_REGIONS[areaId]) {
		return { regions: [{ id: areaId, name: ITALY_REGIONS[areaId]!.name }], resolved: true };
	}

	// 2. Nome dell'area dichiarato dal provider
	const fromAreaName = findRegionsInText(alert.areaName);
	if (fromAreaName.length > 0) return { regions: fromAreaName, resolved: true };

	// 3. Testo libero (headline + descrizione)
	const fromText = findRegionsInText(`${alert.headline || ''} ${alert.event || ''} ${alert.description || ''}`);
	if (fromText.length > 0) return { regions: fromText, resolved: true };

	return { regions: [], resolved: false };
}

/**
 * Verifica se un'allerta è pertinente per un punto geografico.
 *
 * Regole (in ordine):
 * - punto fuori dalle regioni mappate (estero) → sempre pertinente, non abbiamo
 *   la mappa delle aree per quel paese e non vogliamo silenziare allerte vere;
 * - `countryCode` dell'allerta diverso da quello del punto → non pertinente;
 * - area dell'allerta non determinabile → pertinente (il provider è stato
 *   interrogato per coordinate, l'allerta è presumibilmente puntuale);
 * - altrimenti → pertinente solo se le regioni coincidono.
 */
export function isAlertRelevantForPoint(alert: Partial<WeatherAlert>, lat: number, lon: number): boolean {
	const localRegions = getRegionsForPoint(lat, lon);
	if (localRegions.length === 0) return true;

	const alertCountry = (alert.countryCode || '').trim().toUpperCase();
	if (alertCountry && alertCountry !== getCountryCode(lat, lon)) return false;

	const { regions, resolved } = getRegionsForAlert(alert);
	if (!resolved) return true;

	return regions.some(r => localRegions.some(local => local.id === r.id));
}

/**
 * Filtra un elenco di allerte tenendo solo quelle pertinenti per il punto,
 * loggando cosa viene scartato (utile per diagnosticare sui log di produzione).
 */
export function filterAlertsForPoint(alerts: WeatherAlert[], lat: number, lon: number): WeatherAlert[] {
	const kept: WeatherAlert[] = [];
	const dropped: string[] = [];

	for (const alert of alerts) {
		if (isAlertRelevantForPoint(alert, lat, lon)) {
			kept.push(alert);
		} else {
			dropped.push(`${alert.areaName || alert.areaId || 'area?'}/${alert.event || alert.headline || alert.id}`);
		}
	}

	if (dropped.length > 0) {
		console.log(`[AlertGeo] Scartate ${dropped.length}/${alerts.length} allerte non pertinenti per ${lat},${lon}: ${dropped.join(', ')}`);
	}

	return kept;
}

/**
 * Determina la regione di un'area MeteoAlarm rispetto a un punto.
 * Usata dal connettore MeteoAlarm per filtrare le entry del feed nazionale.
 * Restituisce null se l'area non riguarda il punto.
 */
export function matchAreaToPoint(areaId: string, areaDesc: string, lat: number, lon: number): RegionMatch | null {
	const localRegions = getRegionsForPoint(lat, lon);
	if (localRegions.length === 0) return null;

	const { regions, resolved } = getRegionsForAlert({ areaId, areaName: areaDesc });
	if (!resolved) return null;

	return regions.find(r => localRegions.some(local => local.id === r.id)) || null;
}

/**
 * Deduplicazione allerte multi-source.
 * Allerte simili (stesso evento, finestra temporale ±2h) vengono unificate
 * mantenendo la versione con severity più alta.
 */
export function deduplicateAlerts(alerts: WeatherAlert[]): WeatherAlert[] {
	if (alerts.length <= 1) return alerts;

	const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
	const deduplicated: WeatherAlert[] = [];
	const severityRank: Record<string, number> = { minor: 1, moderate: 2, severe: 3, extreme: 4 };

	for (const alert of alerts) {
		const existingIdx = deduplicated.findIndex(existing => {
			// Check evento simile (normalizzato)
			const eventA = (existing.event || existing.description || '').toLowerCase();
			const eventB = (alert.event || alert.description || '').toLowerCase();
			const eventSimilar = eventA.includes(eventB.slice(0, 10)) || eventB.includes(eventA.slice(0, 10))
				|| (existing.headline || '').toLowerCase().includes((alert.event || '').toLowerCase())
				|| (alert.headline || '').toLowerCase().includes((existing.event || '').toLowerCase());

			// Check finestra temporale simile (±2 ore)
			const timeA = new Date(existing.effectiveTime).getTime();
			const timeB = new Date(alert.effectiveTime).getTime();
			const timeSimilar = Math.abs(timeA - timeB) < TWO_HOURS_MS;

			return eventSimilar && timeSimilar;
		});

		if (existingIdx >= 0) {
			// Mantieni la versione con severity più alta
			const existing = deduplicated[existingIdx]!;
			const existingSev = severityRank[existing.severity] || 2;
			const newSev = severityRank[alert.severity] || 2;
			if (newSev > existingSev) {
				deduplicated[existingIdx] = alert;
			}
		} else {
			deduplicated.push(alert);
		}
	}

	return deduplicated;
}

/**
 * Pipeline unica di aggregazione allerte usata da smart engine, route e poller:
 * scarta le scadute → filtra per area geografica → deduplica multi-source.
 */
export function aggregateAlerts(alerts: WeatherAlert[], lat: number, lon: number): WeatherAlert[] {
	const now = new Date();
	const active = alerts.filter(a => !a.expireTime || new Date(a.expireTime) > now);
	const relevant = filterAlertsForPoint(active, lat, lon);
	return deduplicateAlerts(relevant);
}
