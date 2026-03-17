import express from 'express';
import { supabase } from '../services/supabase';
import { sendPushNotification, getAPNsHealthStatus } from '../services/apns';
import { pollAlerts } from '../services/alertPoller';

export const alertsRouter = express.Router();

/**
 * Registra o aggiorna una sottoscrizione per allerte meteo associata a un device.
 * Payload: { deviceToken: string, lat: number, lon: number, locationName?: string }
 */
alertsRouter.post('/subscribe', async (req, res) => {
    const { deviceToken, lat, lon, locationName, platform = 'ios' } = req.body;

    if (!deviceToken || lat == null || lon == null) {
        return res.status(400).json({ error: 'Mancano parametri obbligatori (deviceToken, lat, lon)' });
    }

    try {
        // Usa upsert su un indice univoco se è stato definito, altrimenti inserimento manuale gestendo i conflitti
        const { data, error } = await supabase
            .from('alert_subscriptions')
            .upsert({
                device_token: deviceToken,
                location_lat: lat,
                location_lon: lon,
                location_name: locationName,
                platform
            }, { onConflict: 'device_token, location_lat, location_lon' })
            .select()
            .single();

        if (error) throw error;
        
        return res.json({ success: true, message: 'Iscritto alle allerte', data });
    } catch (err: any) {
        console.error('Error in /alerts/subscribe:', err.message);
        return res.status(500).json({ error: 'Impossibile iscriversi alle allerte', details: err.message });
    }
});

/**
 * Rimuove un'iscrizione a una località per un dato device.
 */
alertsRouter.post('/unsubscribe', async (req, res) => {
    const { deviceToken, lat, lon } = req.body;
    if (!deviceToken || lat == null || lon == null) {
        return res.status(400).json({ error: 'Mancano parametri obbligatori' });
    }

    try {
        const { error } = await supabase
            .from('alert_subscriptions')
            .delete()
            .match({ device_token: deviceToken, location_lat: lat, location_lon: lon });
        
        if (error) throw error;

        return res.json({ success: true, message: 'Cancellato correttamente' });
    } catch (err: any) {
        console.error('Error in /alerts/unsubscribe:', err.message);
        return res.status(500).json({ error: 'Impossibile rimuovere iscrizione', details: err.message });
    }
});

/**
 * Restituisce le allerte meteo attive (non scadute) per una data area geografica.
 * Query params: lat, lon, radius (opzionale, default 0.5 gradi ~50km)
 */
alertsRouter.get('/active', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseFloat(req.query.radius as string) || 0.5;

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'Parametri lat/lon mancanti o non validi' });
    }

    try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('weather_alerts')
            .select('*')
            .gt('expire_time', now)
            .not('external_alert_id', 'is', null)
            .order('sent_at', { ascending: false });

        if (error) throw error;

        // Deduplica per external_alert_id (una riga per allerta, non per sottoscrizione)
        const seen = new Set<string>();
        const unique = (data || []).filter(alert => {
            if (!alert.external_alert_id || seen.has(alert.external_alert_id)) return false;
            seen.add(alert.external_alert_id);
            return true;
        });

        return res.json({ alerts: unique });
    } catch (err: any) {
        console.error('Error in /alerts/active:', err.message);
        return res.status(500).json({ error: 'Impossibile recuperare le allerte attive', details: err.message });
    }
});

/**
 * Endpoint di TEST manuale
 * Invoca forzatamente un'allerta push ad un device specifico per verificare la configurazione APNs.
 * Payload: { deviceToken: string, title: string, body: string }
 */
alertsRouter.post('/test-push', async (req, res) => {
    const { deviceToken, title = 'Test Allerta', body = 'Questa è un allerta di prova da Smart Meteo' } = req.body;

    if (!deviceToken) {
        return res.status(400).json({ error: 'Device token mancante' });
    }

    const payload = {
        categoryId: 'WEATHER_ALERT',
        customData: {
            "type": "test_alert"
        }
    };

    const sent = await sendPushNotification(deviceToken, title, body, payload);

    if (sent) {
        return res.json({ success: true, message: 'Push notification inviata correttamente ad APNs' });
    } else {
        return res.status(500).json({ error: 'Impossibile inviare notifica push, controllare i log del backend' });
    }
});

/**
 * Endpoint di polling allerte — chiamato dalla Netlify Scheduled Function.
 * Protetto da header X-Cron-Secret.
 * Interroga tutte le location sottoscritte, cerca allerte, le processa.
 */
alertsRouter.post('/poll', async (req, res) => {
    const cronSecret = process.env.CRON_SECRET;
    const requestSecret = req.headers['x-cron-secret'] as string;

    if (cronSecret && requestSecret !== cronSecret) {
        return res.status(403).json({ error: 'Unauthorized: invalid cron secret' });
    }

    try {
        const result = await pollAlerts();
        return res.json({
            success: true,
            ...result,
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('[AlertPoller] Poll endpoint error:', err.message);
        return res.status(500).json({ error: 'Errore durante il polling allerte', details: err.message });
    }
});

/**
 * Health check per il sistema allerte.
 * Restituisce stato APNs, conteggio sottoscrizioni, statistiche delivery.
 */
alertsRouter.get('/health', async (_req, res) => {
    try {
        const apnsStatus = getAPNsHealthStatus();

        // Conteggio sottoscrizioni attive
        const { count: subsCount } = await supabase
            .from('alert_subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('enabled', true);

        // Statistiche delivery ultime 24h
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentAlerts } = await supabase
            .from('weather_alerts')
            .select('id, severity')
            .gt('sent_at', since24h);

        return res.json({
            apns: apnsStatus,
            subscriptions: {
                active: subsCount || 0,
            },
            alerts_24h: {
                total: recentAlerts?.length || 0,
            },
            timestamp: new Date().toISOString(),
        });
    } catch (err: any) {
        console.error('Error in /alerts/health:', err.message);
        return res.status(500).json({ error: 'Errore health check allerte', details: err.message });
    }
});
