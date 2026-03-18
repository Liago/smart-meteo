import { XMLParser } from 'fast-xml-parser';
import { WeatherAlert } from '../types';

/**
 * Connettore MeteoAlarm (EUMETNET) — fonte ufficiale delle allerte meteo europee.
 * Usa il feed Atom/CAP pubblico (CC BY 4.0), nessuna autenticazione richiesta.
 * https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{country}
 */

const FEED_BASE_URL = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom';

// Mappa codice paese → nome per l'URL del feed
const COUNTRY_FEED_NAMES: Record<string, string> = {
	IT: 'italy',
	FR: 'france',
	DE: 'germany',
	ES: 'spain',
	CH: 'switzerland',
	AT: 'austria',
	GB: 'united-kingdom',
};

// Mappa area MeteoAlarm (EMMA_ID) → bounding box approssimativo [latMin, latMax, lonMin, lonMax]
const ITALY_REGIONS: Record<string, { name: string; bbox: [number, number, number, number] }> = {
	'IT001': { name: 'Piemonte', bbox: [44.1, 46.5, 6.6, 9.2] },
	'IT002': { name: "Valle d'Aosta", bbox: [45.5, 46.0, 6.8, 7.9] },
	'IT003': { name: 'Lombardia', bbox: [45.0, 46.6, 8.5, 11.4] },
	'IT004': { name: 'Trentino-Alto Adige', bbox: [45.7, 47.1, 10.4, 12.5] },
	'IT005': { name: 'Veneto', bbox: [44.8, 46.7, 10.6, 13.1] },
	'IT006': { name: 'Friuli Venezia Giulia', bbox: [45.6, 46.6, 12.3, 13.9] },
	'IT007': { name: 'Liguria', bbox: [43.8, 44.7, 7.5, 10.1] },
	'IT008': { name: 'Emilia e Romagna', bbox: [43.7, 45.1, 9.2, 12.8] },
	'IT009': { name: 'Toscana', bbox: [42.2, 44.5, 9.7, 12.4] },
	'IT010': { name: 'Umbria', bbox: [42.4, 43.6, 12.1, 13.3] },
	'IT011': { name: 'Marche', bbox: [42.7, 43.9, 12.1, 13.9] },
	'IT012': { name: 'Lazio', bbox: [41.2, 42.9, 11.4, 14.0] },
	'IT013': { name: 'Abruzzo', bbox: [41.7, 42.9, 13.0, 14.8] },
	'IT014': { name: 'Molise', bbox: [41.4, 41.9, 14.1, 15.2] },
	'IT015': { name: 'Campania', bbox: [40.0, 41.5, 13.8, 15.8] },
	'IT016': { name: 'Puglia', bbox: [39.8, 42.0, 15.0, 18.5] },
	'IT017': { name: 'Basilicata', bbox: [39.9, 41.1, 15.3, 16.9] },
	'IT018': { name: 'Calabria', bbox: [37.9, 39.9, 15.6, 17.1] },
	'IT019': { name: 'Sardegna', bbox: [38.8, 41.3, 8.1, 9.8] },
	'IT020': { name: 'Sicilia', bbox: [36.6, 38.3, 12.4, 15.7] },
};

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	isArray: (name) => name === 'entry', // force entries to always be array
});

/**
 * Determina il codice paese dalle coordinate.
 */
function getCountryCode(lat: number, lon: number): string {
	if (lat >= 35.5 && lat <= 47.1 && lon >= 6.6 && lon <= 18.5) return 'IT';
	if (lat >= 41.3 && lat <= 51.1 && lon >= -5.1 && lon <= 9.6) return 'FR';
	if (lat >= 47.3 && lat <= 55.1 && lon >= 5.9 && lon <= 15.0) return 'DE';
	if (lat >= 36.0 && lat <= 43.8 && lon >= -9.5 && lon <= 3.3) return 'ES';
	if (lat >= 45.8 && lat <= 47.8 && lon >= 5.9 && lon <= 10.5) return 'CH';
	if (lat >= 46.4 && lat <= 49.0 && lon >= 9.5 && lon <= 17.2) return 'AT';
	if (lat >= 49.5 && lat <= 61.0 && lon >= -8.2 && lon <= 1.8) return 'GB';
	return 'IT';
}

/**
 * Verifica se un punto (lat, lon) è dentro il bounding box di una regione.
 */
function isInBbox(lat: number, lon: number, bbox: [number, number, number, number]): boolean {
	return lat >= bbox[0] && lat <= bbox[1] && lon >= bbox[2] && lon <= bbox[3];
}

/**
 * Mappa severity da MeteoAlarm (Yellow/Orange/Red) al nostro formato.
 */
function mapSeverity(severity: string | undefined): string {
	if (!severity) return 'moderate';
	const s = severity.toLowerCase();
	if (s === 'extreme' || s === 'red') return 'extreme';
	if (s === 'severe' || s === 'orange') return 'severe';
	if (s === 'moderate' || s === 'yellow') return 'moderate';
	if (s === 'minor' || s === 'green') return 'minor';
	return 'moderate';
}

/**
 * Fetcha le allerte MeteoAlarm per una posizione geografica.
 * Scarica il feed Atom del paese corrispondente, filtra per regione.
 */
export async function fetchMeteoAlarmAlerts(lat: number, lon: number): Promise<WeatherAlert[]> {
	const countryCode = getCountryCode(lat, lon);
	const countryName = COUNTRY_FEED_NAMES[countryCode];
	if (!countryName) return [];

	const feedUrl = `${FEED_BASE_URL}-${countryName}`;

	try {
		const response = await fetch(feedUrl, {
			headers: { 'Accept': 'application/atom+xml, application/xml, text/xml' },
			signal: AbortSignal.timeout(8000),
		});

		if (!response.ok) {
			console.error(`[MeteoAlarm] Feed error: ${response.status} ${response.statusText} for ${feedUrl}`);
			return [];
		}

		const xml = await response.text();
		const parsed = xmlParser.parse(xml);

		const entries = parsed?.feed?.entry;
		if (!entries || !Array.isArray(entries)) {
			console.log(`[MeteoAlarm] No entries in feed for ${countryName}`);
			return [];
		}

		const now = new Date();
		const alerts: WeatherAlert[] = [];

		for (const entry of entries) {
			const geocode = entry['cap:geocode'] || entry['geocode'];
			const areaId = geocode?.['cap:value'] || geocode?.['value'] || '';
			const areaDesc = entry['cap:areaDesc'] || entry['areaDesc'] || '';

			// Filtra per regione: verifica se l'area corrisponde alla posizione
			const regionMatch = matchRegion(areaId, areaDesc, lat, lon, countryCode);
			if (!regionMatch) continue;

			const severity = entry['cap:severity'] || entry['severity'] || '';
			const effectiveTime = entry['cap:effective'] || entry['cap:onset'] || entry['cap:sent'] || '';
			const expireTime = entry['cap:expires'] || '';

			// Filtra allerte scadute
			if (expireTime) {
				const expDate = new Date(expireTime);
				if (expDate < now) continue;
			}

			const event = entry['cap:event'] || entry['title'] || '';
			const status = entry['cap:status'] || '';
			if (status.toLowerCase() === 'test' || status.toLowerCase() === 'exercise') continue;

			const alertId = entry['id'] || entry['cap:identifier'] || `meteoalarm:${areaId}_${event}_${effectiveTime}`;

			alerts.push({
				id: `meteoalarm:${alertId}`,
				areaId: areaId,
				areaName: regionMatch.name || areaDesc,
				certainty: mapCertainty(entry['cap:certainty'] || entry['certainty']),
				countryCode,
				description: buildDescription(entry, event),
				effectiveTime: effectiveTime || now.toISOString(),
				expireTime: expireTime || new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
				issuedTime: entry['cap:sent'] || entry['updated'] || '',
				eventSource: 'EUMETNET',
				event: event,
				severity: mapSeverity(severity),
				source: 'MeteoAlarm',
				urgency: (entry['cap:urgency'] || 'future').toLowerCase(),
				detailsUrl: entry['link']?.['@_href'] || `https://meteoalarm.org`,
				providerSource: 'meteoalarm',
			});
		}

		console.log(`[MeteoAlarm] ${countryName} feed: ${entries.length} total entries, ${alerts.length} matching ${lat},${lon}`);
		return alerts;
	} catch (error: any) {
		console.error(`[MeteoAlarm] Error fetching alerts:`, error.message);
		return [];
	}
}

/**
 * Verifica se un'allerta corrisponde alla regione dell'utente.
 */
function matchRegion(
	areaId: string,
	areaDesc: string,
	lat: number,
	lon: number,
	countryCode: string
): { name: string } | null {
	if (countryCode === 'IT') {
		// Match per EMMA_ID (es. "IT008" → Emilia-Romagna)
		const region = ITALY_REGIONS[areaId];
		if (region && isInBbox(lat, lon, region.bbox)) {
			return { name: region.name };
		}

		// Fallback: controlla tutte le regioni per bounding box
		for (const [, reg] of Object.entries(ITALY_REGIONS)) {
			if (isInBbox(lat, lon, reg.bbox) && areaDesc.toLowerCase().includes(reg.name.toLowerCase().slice(0, 6))) {
				return { name: reg.name };
			}
		}
	}

	// Fallback generico: accetta se l'area è nazionale o se contiene "all"
	const descLower = areaDesc.toLowerCase();
	if (descLower.includes('national') || descLower.includes('tutto') || descLower === '') {
		return { name: areaDesc || countryCode };
	}

	return null;
}

function mapCertainty(certainty: string | undefined): string {
	if (!certainty) return 'possible';
	const c = certainty.toLowerCase();
	if (c === 'observed') return 'observed';
	if (c === 'likely') return 'likely';
	if (c === 'possible') return 'possible';
	if (c === 'unlikely') return 'unlikely';
	return 'possible';
}

function buildDescription(entry: any, event: string): string {
	// Cerca il messaggio in italiano, poi inglese, poi il summary
	const summary = entry['summary'] || entry['content'] || '';
	if (typeof summary === 'string' && summary.length > 10) return summary;
	if (typeof summary === 'object' && summary['#text']) return summary['#text'];

	return event || 'Allerta meteo';
}
