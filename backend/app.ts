import express, { type Request, type Response, type NextFunction } from 'express';
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
	'https://smart-meteo.vercel.app', // Hardcoded production frontend
	'https://smart-meteo-git-main-liagos-projects.vercel.app', // Vercel preview/branch URLs fallback
];

if (process.env.FRONTEND_URL) {
	allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
	origin: true, // Reflect request origin (or use '*' for public)
	methods: ['GET', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
	credentials: true,
	maxAge: 86400,
}));

app.use(express.json());
// Fallback: capture body as text when express.json() fails (serverless compatibility)
app.use(express.text({ type: 'application/json' }));

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

app.use('/api/sources', sourcesRouter);

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
