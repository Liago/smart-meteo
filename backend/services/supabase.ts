import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
	console.warn('Missing SUPABASE_URL or SUPABASE_KEY env vars');
}

export const supabase = createClient(
	process.env.SUPABASE_URL || '',
	process.env.SUPABASE_KEY || ''
);
