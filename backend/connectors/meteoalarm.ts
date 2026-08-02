import { XMLParser } from 'fast-xml-parser';
import { WeatherAlert } from '../types';
import { getCountryCode, matchAreaToPoint } from '../utils/alertGeo';

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

const xmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	isArray: (name) => name === 'entry', // force entries to always be array
});

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
			headers: {
				'Accept': '*/*',
				'User-Agent': 'SmartMeteo/1.0',
			},
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
			// fast-xml-parser parses <cap:geocode><value>IT008</value></cap:geocode>
			// The child 'value' tag may be parsed as 'value' or 'cap:value' depending on config
			const areaId = geocode?.['value'] || geocode?.['cap:value'] ||
						   (typeof geocode === 'string' ? geocode : '') || '';
			// areaDesc: try cap:areaDesc, then link title
			const links = Array.isArray(entry['link']) ? entry['link'] : (entry['link'] ? [entry['link']] : []);
			const linkTitle = links.find((l: any) => l['@_title'])?.['@_title'] || '';
			const areaDesc = entry['cap:areaDesc'] || entry['areaDesc'] || linkTitle;

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
				detailsUrl: links[0]?.['@_href'] || `https://meteoalarm.org`,
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
 * Verifica se un'allerta del feed corrisponde alla posizione dell'utente.
 * Il match per regione è delegato a `alertGeo` (EMMA_ID o nome dell'area).
 */
function matchRegion(
	areaId: string,
	areaDesc: string,
	lat: number,
	lon: number,
	countryCode: string
): { name: string } | null {
	if (countryCode === 'IT') {
		const region = matchAreaToPoint(areaId, areaDesc, lat, lon);
		if (region) return { name: region.name };
	}

	// Fallback: accetta solo le allerte esplicitamente nazionali.
	// Un'area non riconosciuta NON viene accettata: il feed è nazionale e
	// lasciarla passare significherebbe mostrare allerte di altre regioni.
	const descLower = (areaDesc || '').toLowerCase();
	if (descLower.includes('national') || descLower.includes('tutto il paese')) {
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

