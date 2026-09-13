import type { SkyEvent, SkyLevel, SkyOutlook, StargazingOutlook } from '@/lib/types';

/**
 * Etichette e frasi del riquadro cielo.
 *
 * La parte che vale la pena tenere fuori dal componente è la scelta di **quale
 * dei due indici mettere in cima**: il pannello ha una riga sola di titolo, e
 * dire «tramonto spettacolare» quando invece è la notte a essere eccezionale
 * sprecherebbe l'unica riga che qualcuno legge davvero.
 */

export const SKY_LABELS: Record<SkyLevel, string> = {
	plain: 'Ordinario',
	fair: 'Discreto',
	good: 'Bello',
	excellent: 'Spettacolare',
};

/** Per la notte le stesse fasce vogliono parole diverse. */
export const STARGAZING_LABELS: Record<SkyLevel, string> = {
	plain: 'Cielo chiuso',
	fair: 'Discreta',
	good: 'Buona',
	excellent: 'Ottima',
};

export const SKY_COLORS: Record<SkyLevel, string> = {
	plain: 'rgba(8,42,77,0.25)',
	fair: '#7FA8C4',
	good: '#F5A623',
	excellent: '#E8632A',
};

/** Ordine di gravità, per decidere che cosa mettere in cima. */
const RANK: Record<SkyLevel, number> = {
	excellent: 3,
	good: 2,
	fair: 1,
	plain: 0,
};

/** Ora dello slot, dalla chiave locale `YYYY-MM-DDTHH:00`. */
export function formatHour(slot: string | null | undefined): string | null {
	if (!slot) return null;
	const match = /T(\d{2}):(\d{2})/.exec(slot);
	return match ? `${match[1]}:${match[2]}` : null;
}

/** Il prossimo evento solare fra alba e tramonto, quello che c'è. */
export function nextSolarEvent(
	sky: SkyOutlook
): { event: SkyEvent; kind: 'sunset' | 'sunrise' } | null {
	if (sky.sunset && sky.sunrise) {
		// Il primo in ordine di tempo: è quello che l'utente vedrà per primo.
		return sky.sunset.at <= sky.sunrise.at
			? { event: sky.sunset, kind: 'sunset' }
			: { event: sky.sunrise, kind: 'sunrise' };
	}
	if (sky.sunset) return { event: sky.sunset, kind: 'sunset' };
	if (sky.sunrise) return { event: sky.sunrise, kind: 'sunrise' };
	return null;
}

/**
 * La riga in cima: vince l'indice più alto fra il solare e la notte.
 *
 * Con un titolo fisso sul tramonto, una notte eccezionale sotto un tramonto
 * ordinario resterebbe invisibile — ed è proprio il caso che fa aprire il
 * pannello.
 */
export function skyHeadline(sky: SkyOutlook): string {
	const solar = nextSolarEvent(sky);
	const night = sky.stargazing;

	const solarRank = solar ? RANK[solar.event.level] : -1;
	const nightRank = night ? RANK[night.level] : -1;

	if (solarRank >= nightRank && solar) {
		const quando = formatHour(solar.event.at);
		const nome = solar.kind === 'sunset' ? 'Tramonto' : 'Alba';
		const giudizio = SKY_LABELS[solar.event.level].toLowerCase();
		return quando ? `${nome} ${giudizio} verso le ${quando}` : `${nome} ${giudizio}`;
	}

	if (night) {
		return `Notte ${STARGAZING_LABELS[night.level].toLowerCase()} per le stelle`;
	}
	return 'Nessuna previsione sul cielo';
}

/** Perché la notte è (o non è) buona: nuvole e luna, i due ingredienti. */
export function stargazingReason(stargazing: StargazingOutlook): string {
	const nuvole =
		stargazing.cloud_cover <= 20
			? 'cielo terso'
			: stargazing.cloud_cover >= 70
				? 'cielo coperto'
				: `${Math.round(stargazing.cloud_cover)}% di nuvole`;

	if (stargazing.moon_illumination == null) return nuvole;

	const luna =
		stargazing.moon_illumination <= 15
			? 'luna quasi nuova'
			: stargazing.moon_illumination >= 85
				? 'luna piena'
				: `luna al ${Math.round(stargazing.moon_illumination)}%`;

	return `${nuvole}, ${luna}`;
}
