import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getSmartForecast } from './engine/smartEngine';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req: Request, res: Response) => {
	res.send('Smart Meteo Engine V1 is running 🚀 (TypeScript)');
});

app.get('/api/health', (req: Request, res: Response) => {
	res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/forecast', async (req: Request, res: Response) => {
	const lat = req.query.lat as string;
	const lon = req.query.lon as string;

	if (!lat || !lon) {
		res.status(400).json({ error: 'Missing lat/lon parameters' });
		return;
	}

	try {
		const data = await getSmartForecast(Number(lat), Number(lon));
		res.json(data);
	} catch (error: any) {
		console.error(error);
		res.status(500).json({ error: error.message });
	}
});

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});
