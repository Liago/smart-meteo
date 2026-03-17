import type { Config } from '@netlify/functions';
import { pollAlerts } from '../../backend/services/alertPoller';
import { initializeAPNs } from '../../backend/services/apns';
import dotenv from 'dotenv';

dotenv.config();

// Inizializza APNs per la scheduled function
initializeAPNs();

export default async () => {
    console.log('[AlertPoll] Scheduled function triggered at', new Date().toISOString());

    try {
        const result = await pollAlerts();
        console.log(`[AlertPoll] Completed: ${result.clusters} clusters, ${result.alertsFound} found, ${result.alertsProcessed} processed`);

        return new Response(JSON.stringify({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        }), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        console.error('[AlertPoll] Scheduled function error:', err.message);
        return new Response(JSON.stringify({
            error: err.message,
            timestamp: new Date().toISOString(),
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};

// Esegui ogni 15 minuti
export const config: Config = {
    schedule: '*/15 * * * *',
};
