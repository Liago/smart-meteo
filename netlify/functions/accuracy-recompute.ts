import type { Config } from '@netlify/functions';
import dotenv from 'dotenv';
import { recomputeAccuracy } from '../../backend/services/accuracy';

dotenv.config();

/**
 * Verifica giornaliera dell'accuratezza delle fonti.
 *
 * Confronta le previsioni archiviate con le temperature osservate e ricalcola
 * il MAE sulla finestra scorrevole, da cui lo Smart Engine deriva i pesi
 * dinamici.
 *
 * Gira una volta al giorno perché l'archivio ERA5 ha un ritardo di produzione
 * di circa cinque giorni: più spesso non aggiungerebbe dati.
 *
 * Come per il poller delle allerte, la funzione chiama il servizio
 * direttamente e non passa dall'endpoint HTTP: non serve il segreto, che
 * protegge solo l'innesco manuale dall'esterno.
 */
export default async () => {
	const startedAt = new Date().toISOString();
	console.log(`[AccuracyCron] Avvio ${startedAt}`);

	try {
		const run = await recomputeAccuracy();
		console.log(
			`[AccuracyCron] Completato: giorno ${run.date}, ${run.samples} campioni, ` +
				`${run.locations} località, ${run.sourcesUpdated} fonti aggiornate`
		);
		return new Response(JSON.stringify({ success: true, ...run }), {
			headers: { 'Content-Type': 'application/json' },
		});
	} catch (err: any) {
		console.error('[AccuracyCron] Fallito:', err.message);
		return new Response(JSON.stringify({ success: false, error: err.message }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' },
		});
	}
};

export const config: Config = {
	// Ogni giorno alle 04:10 UTC: dopo che l'archivio ha pubblicato il giorno
	// nuovo, e a un'ora di traffico basso.
	schedule: '10 4 * * *',
};
