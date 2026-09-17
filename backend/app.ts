import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getSmartForecast } from './engine/smartEngine';
import { initializeAPNs } from './services/apns';
import sourcesRouter from './routes/sources';
import accuracyRouter from './routes/accuracy';
import { alertsRouter } from './routes/alerts';
import { requireAuth } from './middleware/auth';
import { APP_BUILD, APP_VERSION, APP_VERSION_FULL } from './version';

dotenv.config();

const app = express();

// Initialize APNs provider
initializeAPNs();

// --- CORS Configuration ---
// Frontend (Vercel) e Backend (Netlify) sono su domini diversi.
// FRONTEND_URL va configurata come env var su Netlify (es: https://smart-meteo.vercel.app)
const allowedOrigins: string[] = [
	'http://localhost:3000',
	'http://localhost:3001',
	'https://smart-meteo.vercel.app', // Hardcoded production frontend
	'https://smart-meteo-git-main-liagos-projects.vercel.app', // Vercel preview/branch URLs fallback
];

if (process.env.FRONTEND_URL) {
	allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
	origin: true, // Reflect request origin (or use '*' for public)
	methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
	maxAge: 86400,
}));

app.use(express.json());
// Fallback: in Netlify Functions il body può arrivare come Buffer o stringa
// invece di essere parsato da express.json(). Questo middleware lo gestisce.
app.use((req: Request, _res: Response, next: NextFunction) => {
	if (Buffer.isBuffer(req.body)) {
		try {
			req.body = JSON.parse(req.body.toString('utf-8'));
		} catch {
			// Non è JSON valido, lascia il body com'è
		}
	} else if (typeof req.body === 'string' && req.body.length > 0) {
		try {
			req.body = JSON.parse(req.body);
		} catch {
			// Non è JSON valido
		}
	}
	next();
});

app.get('/', (req: Request, res: Response) => {
	res.json({
		service: 'Smart Meteo API',
		// `api` è il contratto degli endpoint, `version` quella del software:
		// erano la stessa stringa «v1», e chi riceveva una risposta sbagliata
		// non aveva modo di dire quale build l'avesse prodotta.
		api: 'v1',
		version: APP_VERSION,
		build: APP_BUILD,
		endpoints: [
			'GET /api/health',
			'GET /api/version',
			'GET /api/forecast?lat=&lon=',
			'GET /api/sources',
			'PATCH /api/sources/:id',
			'GET /api/accuracy',
			'POST /api/accuracy/recompute',
			'POST /api/alerts/subscribe',
			'POST /api/alerts/unsubscribe',
			'GET /api/alerts/active?lat=&lon=',
			'POST /api/alerts/test-push'
		],
	});
});

app.get('/api/health', (req: Request, res: Response) => {
	res.json({
		status: 'ok',
		timestamp: new Date(),
		version: APP_VERSION,
		build: APP_BUILD,
	});
});

/**
 * Versione del backend in esecuzione.
 *
 * Endpoint a sé oltre che campo di `/api/health` perché risponde a una domanda
 * diversa: «il servizio è vivo?» si chiede a un monitor ogni minuto, «quale
 * build sta girando?» si chiede una volta, dopo un deploy, per sapere se è
 * andato a buon fine. Netlify tiene in caldo la funzione precedente per
 * qualche minuto dopo il rilascio, quindi è proprio il caso in cui serve
 * poterlo chiedere.
 *
 * Nessuna autenticazione: è la stessa versione che il client scrive in fondo
 * alla dashboard, e un numero di build non è un'informazione riservata.
 */
app.get('/api/version', (req: Request, res: Response) => {
	res.json({
		service: 'smart-meteo-backend',
		version: APP_VERSION,
		build: APP_BUILD,
		full: APP_VERSION_FULL,
	});
});

app.use('/api/sources', sourcesRouter);
app.use('/api/accuracy', accuracyRouter);
app.use('/api/alerts', alertsRouter);

app.get('/api/forecast', async (req: Request, res: Response) => {
	const lat = req.query.lat as string;
	const lon = req.query.lon as string;

	if (!lat || !lon) {
		res.status(400).json({ error: 'Missing lat/lon parameters' });
		return;
	}

	try {
		const data = await getSmartForecast(Number(lat), Number(lon));
		res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
		res.json(data);
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

// Global error handler - returns JSON errors instead of HTML
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
	console.error('Unhandled error:', err.message);
	res.status(500).json({ error: 'Internal server error' });
});

export { app };
