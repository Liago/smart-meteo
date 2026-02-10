import { Router, Request, Response } from 'express';

export interface WeatherSource {
	id: string;
	name: string;
	weight: number;
	active: boolean;
	description: string;
	lastError: string | null;
	lastResponseMs: number | null;
}

// In-memory source registry (will be backed by Supabase in the future)
const sources: WeatherSource[] = [
	{
		id: 'tomorrow.io',
		name: 'Tomorrow.io',
		weight: 1.2,
		active: true,
		description: 'Hyper-local nowcasting with minute-by-minute precision',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'open-meteo',
		name: 'Open-Meteo',
		weight: 1.1,
		active: true,
		description: 'High-resolution scientific data from national weather services',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'openweathermap',
		name: 'OpenWeatherMap',
		weight: 1.0,
		active: true,
		description: 'Global coverage baseline and fast fallback',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'weatherapi',
		name: 'WeatherAPI',
		weight: 1.0,
		active: true,
		description: 'Cross-validation for temperature and conditions',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'accuweather',
		name: 'AccuWeather',
		weight: 1.1,
		active: true,
		description: 'Quality-focused with RealFeel temperature',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'worldweatheronline',
		name: 'WorldWeatherOnline',
		weight: 1.0,
		active: true,
		description: 'Premium global weather data',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'weatherstack',
		name: 'Weatherstack',
		weight: 0.9,
		active: true,
		description: 'Real-time weather data (Standard/Free tier)',
		lastError: null,
		lastResponseMs: null
	},
	{
		id: 'meteostat',
		name: 'Meteostat',
		weight: 0.8,
		active: true,
		description: 'Historical and statistical weather data',
		lastError: null,
		lastResponseMs: null
	}
];

const router = Router();

// GET /api/sources - List all weather sources with status
router.get('/', (req: Request, res: Response) => {
	res.json({ sources });
});

// PATCH /api/sources/:id - Update source active status
router.patch('/:id', (req: Request, res: Response) => {
	const { id } = req.params;

	// Defensive: in serverless environments (Netlify Functions + serverless-http),
	// express.json() may fail to parse the body for PATCH requests with Express 5,
	// leaving req.body undefined or as an unparsed string.
	let body = req.body;
	if (typeof body === 'string') {
		try { body = JSON.parse(body); } catch { body = {}; }
	}
	body = body ?? {};
	const { active } = body;

	const source = sources.find(s => s.id === id);
	if (!source) {
		res.status(404).json({ error: `Source '${id}' not found` });
		return;
	}

	if (typeof active !== 'boolean') {
		res.status(400).json({ error: 'Field "active" must be a boolean' });
		return;
	}

	// Prevent disabling all sources
	const activeSources = sources.filter(s => s.active);
	if (!active && activeSources.length <= 1 && source.active) {
		res.status(400).json({ error: 'Cannot disable all sources. At least one must remain active.' });
		return;
	}

	source.active = active;
	res.json({ source });
});

export { sources };
export default router;
