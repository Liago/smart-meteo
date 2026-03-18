import express from 'express';
import { supabase } from '../services/supabase';
import { sendPushNotification, getAPNsHealthStatus } from '../services/apns';
import { pollAlerts } from '../services/alertPoller';
import { fetchFromWeatherKitWithAlerts } from '../connectors/weatherkit';
import { fetchFromWeatherAPIWithAlerts } from '../connectors/weatherapi';
import { fetchOWMAlerts } from '../connectors/openweathermap';
import { fetchMeteoAlarmAlerts } from '../connectors/meteoalarm';
import { WeatherAlert } from '../types';

/**
 * Cache in-memory per le allerte live, evita di chiamare le API ad ogni richiesta.
 * TTL: 5 minuti per cluster geografico (arrotondato a 0.1°).
 */
const liveAlertsCache = new Map<string, { alerts: WeatherAlert[]; fetchedAt: number }>();
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuti

function getLiveCacheKey(lat: number, lon: number): string {
    return `${Math.round(lat * 10) / 10}_${Math.round(lon * 10) / 10}`;
}

/**
 * Deduplicazione allerte multi-source (stessa logica di smartEngine).
 */
function deduplicateAlerts(alerts: WeatherAlert[]): WeatherAlert[] {
    if (alerts.length <= 1) return alerts;
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const deduplicated: WeatherAlert[] = [];
    const severityRank: Record<string, number> = { minor: 1, moderate: 2, severe: 3, extreme: 4 };

    for (const alert of alerts) {
        const existingIdx = deduplicated.findIndex(existing => {
            const eventA = (existing.event || existing.description || '').toLowerCase();
            const eventB = (alert.event || alert.description || '').toLowerCase();
            const eventSimilar = eventA.includes(eventB.slice(0, 10)) || eventB.includes(eventA.slice(0, 10));
            const timeA = new Date(existing.effectiveTime).getTime();
            const timeB = new Date(alert.effectiveTime).getTime();
            const timeSimilar = Math.abs(timeA - timeB) < TWO_HOURS_MS;
            return eventSimilar && timeSimilar;
        });

        if (existingIdx >= 0) {
            const existing = deduplicated[existingIdx]!;
            if ((severityRank[alert.severity] || 2) > (severityRank[existing.severity] || 2)) {
                deduplicated[existingIdx] = alert;
            }
        } else {
            deduplicated.push(alert);
        }
    }
    return deduplicated;
}

/**
 * Fetcha allerte live da tutte le fonti (WeatherKit, WeatherAPI, OWM) con cache.
 */
interface FetchLiveAlertsResult {
    alerts: WeatherAlert[];
    debug?: {
        weatherkit: { status: string; count: number; error?: string; raw?: any };
        weatherapi: { status: string; count: number; error?: string };
        owm: { status: string; count: number; error?: string };
        meteoalarm: { status: string; count: number; error?: string };
        rawTotal: number;
        deduplicatedTotal: number;
    };
}

async function fetchLiveAlerts(lat: number, lon: number, includeDebug = false): Promise<FetchLiveAlertsResult> {
    const cacheKey = getLiveCacheKey(lat, lon);
    const cached = liveAlertsCache.get(cacheKey);
    if (!includeDebug && cached && (Date.now() - cached.fetchedAt) < LIVE_CACHE_TTL_MS) {
        return { alerts: cached.alerts };
    }

    const results = await Promise.allSettled([
        fetchFromWeatherKitWithAlerts(lat, lon)
            .then(r => ({
                alerts: r?.alerts.map(a => ({ ...a, providerSource: a.providerSource || 'weatherkit' as string })) || [],
                raw: null
            })),
        fetchFromWeatherAPIWithAlerts(lat, lon)
            .then(r => ({ alerts: r?.alerts || [], raw: null })),
        fetchOWMAlerts(lat, lon)
            .then(alerts => ({ alerts, raw: null })),
        fetchMeteoAlarmAlerts(lat, lon)
            .then(alerts => ({ alerts, raw: null })),
    ]);

    const allAlerts: WeatherAlert[] = [];
    const debugInfo: any = {
        weatherkit: { status: 'unknown', count: 0 },
        weatherapi: { status: 'unknown', count: 0 },
        owm: { status: 'unknown', count: 0 },
        meteoalarm: { status: 'unknown', count: 0 },
    };
    const sourceNames = ['weatherkit', 'weatherapi', 'owm', 'meteoalarm'] as const;

    for (let i = 0; i < results.length; i++) {
        const result = results[i]!;
        const name = sourceNames[i]!;
        if (result.status === 'fulfilled') {
            const value = result.value as { alerts: WeatherAlert[]; raw?: any };
            allAlerts.push(...value.alerts);
            debugInfo[name] = { status: 'ok', count: value.alerts.length, raw: includeDebug ? value.raw : undefined };
        } else {
            debugInfo[name] = { status: 'error', count: 0, error: result.reason?.message || String(result.reason) };
        }
    }

    const deduplicated = deduplicateAlerts(allAlerts).filter(
        a => !a.expireTime || new Date(a.expireTime) > new Date()
    );

    debugInfo.rawTotal = allAlerts.length;
    debugInfo.deduplicatedTotal = deduplicated.length;

    console.log(`[AlertsRoute] Live fetch for ${lat},${lon}: raw=${allAlerts.length} deduplicated=${deduplicated.length} sources=${[...new Set(allAlerts.map(a => a.providerSource))].join(',') || 'none'}`);

    liveAlertsCache.set(cacheKey, { alerts: deduplicated, fetchedAt: Date.now() });

    // Pulizia cache entries vecchie (max 100 entries)
    if (liveAlertsCache.size > 100) {
        const oldest = [...liveAlertsCache.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);
        for (let i = 0; i < oldest.length - 50; i++) {
            liveAlertsCache.delete(oldest[i]![0]);
        }
    }

    return { alerts: deduplicated, debug: includeDebug ? debugInfo : undefined };
}

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
 * Fetcha allerte LIVE dalle fonti (WeatherKit, WeatherAPI, OWM) con cache 5min,
 * e le merge con eventuali allerte già salvate nel DB.
 * Query params: lat, lon, radius (opzionale, default 0.5 gradi ~50km)
 */
alertsRouter.get('/active', async (req, res) => {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const radius = parseFloat(req.query.radius as string) || 0.5;
    const includeDebug = req.query.debug === 'true';

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'Parametri lat/lon mancanti o non validi' });
    }

    try {
        // 1. Fetch allerte live dalle fonti (con cache 5 min)
        const { alerts: liveAlerts, debug: debugInfo } = await fetchLiveAlerts(lat, lon, includeDebug);

        // 2. Fetch allerte dal DB (con filtro geografico)
        const now = new Date().toISOString();
        const { data: dbAlerts, error } = await supabase
            .from('weather_alerts')
            .select('*')
            .gt('expire_time', now)
            .not('external_alert_id', 'is', null)
            .gte('effective_time', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // ultimi 2 giorni
            .order('sent_at', { ascending: false });

        if (error) {
            console.warn('[AlertsRoute] DB query error (continuing with live only):', error.message);
        }

        // 3. Merge: live alerts hanno priorità, DB alerts come fallback
        const merged = new Map<string, WeatherAlert>();

        // Prima le live alerts (fonte primaria)
        for (const a of liveAlerts) {
            merged.set(a.id, a);
        }

        // Poi le DB alerts (solo quelle non già presenti)
        if (dbAlerts) {
            const seen = new Set<string>();
            for (const dbAlert of dbAlerts) {
                const key = dbAlert.external_alert_id;
                if (!key || seen.has(key)) continue;
                seen.add(key);
                if (!merged.has(key)) {
                    // Mappa formato DB → formato WeatherAlert
                    merged.set(key, {
                        id: key,
                        description: dbAlert.message || '',
                        severity: dbAlert.severity === 'critical' ? 'extreme' : dbAlert.severity === 'warning' ? 'moderate' : 'minor',
                        effectiveTime: dbAlert.effective_time || '',
                        expireTime: dbAlert.expire_time || '',
                        areaName: dbAlert.area_name,
                        eventSource: dbAlert.event_source,
                        certainty: 'possible',
                        providerSource: dbAlert.event_source,
                    });
                }
            }
        }

        const alerts = Array.from(merged.values()).filter(
            a => !a.expireTime || new Date(a.expireTime) > new Date()
        );

        console.log(`[AlertsRoute] /active response for ${lat},${lon}: live=${liveAlerts.length} db=${dbAlerts?.length || 0} merged=${alerts.length}`);

        const response: any = { alerts };
        if (includeDebug && debugInfo) {
            response.debug = debugInfo;
        }
        return res.json(response);
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

