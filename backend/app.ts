import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getSmartForecast } from './engine/smartEngine';
import sourcesRouter from './routes/sources';
import { requireAuth } from './middleware/auth';

dotenv.config();

const app = express();

// --- CORS Configuration ---
// Frontend (Vercel) e Backend (Netlify) sono su domini diversi.
// FRONTEND_URL va configurata come env var su Netlify (es: https://smart-meteo.vercel.app)
const allowedOrigins: string[] = [
	'http://localhost:3000',
	'http://localhost:3001',
];

if (process.env.FRONTEND_URL) {
	allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
	origin: (origin, callback) => {
		// Permettere richieste senza origin (curl, Postman, server-to-server)
		if (!origin) return callback(null, true);
		if (allowedOrigins.includes(origin)) {
			return callback(null, true);
		}
		return callback(new Error(`Origin ${origin} not allowed by CORS`));
	},
	methods: ['GET', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
	maxAge: 86400,
}));

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
	res.json({
		service: 'Smart Meteo API',
		version: 'v1',
		endpoints: [
			'GET /api/health',
			'GET /api/forecast?lat=&lon=',
			'GET /api/sources',
			'PATCH /api/sources/:id',
		],
	});
});

app.get('/api/health', (req: Request, res: Response) => {
	res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/sources', requireAuth, sourcesRouter);

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

export { app };
