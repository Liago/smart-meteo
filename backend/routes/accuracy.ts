import { Router, Request, Response } from 'express';
import {
	ACCURACY_WINDOW_DAYS,
	MIN_SAMPLES_FOR_WEIGHT,
	getAccuracyReport,
	recomputeAccuracy,
} from '../services/accuracy';
import { ARCHIVE_LAG_DAYS } from '../services/observations';

/**
 * Accuratezza delle fonti: quanto ciascuna si è avvicinata alle temperature
 * realmente osservate.
 *
 * È la promessa originale del progetto — «confronteremo le previsioni con i
 * dati reali storici per aggiustare i pesi» — e l'informazione che un
 * aggregatore può dare e un singolo provider no.
 */
const router = Router();

/**
 * GET /api/accuracy
 *
 * Lettura pubblica: non c'è niente di sensibile e serve a rendere verificabile
 * il perché una fonte pesa più di un'altra.
 */
router.get('/', async (_req: Request, res: Response) => {
	try {
		const sources = await getAccuracyReport();

		res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=3600');
		res.json({
			window_days: ACCURACY_WINDOW_DAYS,
			min_samples_for_weight: MIN_SAMPLES_FOR_WEIGHT,
			// Il ritardo dell'archivio ERA5 spiega perché la verifica guarda a
			// una settimana prima e non a ieri.
			observation_lag_days: ARCHIVE_LAG_DAYS,
			metric_note:
				'MAE in °C sul nowcast: confronto fra il valore corrente dichiarato dalla fonte e la temperatura osservata nella stessa ora',
			sources,
		});
	} catch (err: any) {
		console.error('[Accuracy] Errore nel report:', err.message);
		res.status(500).json({ error: 'Impossibile leggere i dati di accuratezza' });
	}
});

/**
 * POST /api/accuracy/recompute
 *
 * Innesca la verifica di una giornata. Protetto dallo stesso segreto del
 * poller allerte: interroga provider esterni e scrive sul database, quindi non
 * può stare aperto. Come lì, senza segreto configurato si rifiuta invece di
 * lasciar passare.
 */
router.post('/recompute', async (req: Request, res: Response) => {
	const cronSecret = process.env.CRON_SECRET;
	const requestSecret = req.headers['x-cron-secret'] as string;

	if (!cronSecret) {
		console.error('[Accuracy] CRON_SECRET non configurato: ricalcolo rifiutato');
		res.status(503).json({
			error: 'Ricalcolo non disponibile: CRON_SECRET non configurato sul server',
		});
		return;
	}
	if (requestSecret !== cronSecret) {
		res.status(403).json({ error: 'Unauthorized: invalid cron secret' });
		return;
	}

	try {
		const run = await recomputeAccuracy();
		res.json({ success: true, ...run });
	} catch (err: any) {
		console.error('[Accuracy] Ricalcolo fallito:', err.message);
		res.status(500).json({ error: 'Ricalcolo fallito', details: err.message });
	}
});

export default router;
