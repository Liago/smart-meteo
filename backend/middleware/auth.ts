import { createClient } from '@supabase/supabase-js';
import type { Request, Response, NextFunction } from 'express';

const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_KEY!
);

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
	const authHeader = req.headers.authorization;

	if (!authHeader) {
		res.status(401).json({ error: 'Missing authorization header' });
		return;
	}

	const token = authHeader.replace('Bearer ', '');

	const { data: { user }, error } = await supabase.auth.getUser(token);

	if (error || !user) {
		res.status(401).json({ error: 'Invalid or expired token' });
		return;
	}

	// Attach user to request
	(req as any).user = user;

	next();
};
