import express from 'express';
import { supabase } from '../services/supabase';
import { sendPushNotification, getAPNsHealthStatus } from '../services/apns';
import { pollAlerts } from '../services/alertPoller';
import { fetchFromWeatherKitWithAlerts } from '../connectors/weatherkit';
import { fetchFromWeatherAPIWithAlerts } from '../connectors/weatherapi';
import { fetchOWMAlerts } from '../connectors/openweathermap';
import { fetchMeteoAlarmAlerts } from '../connectors/meteoalarm';
import { WeatherAlert } from '../types';
import { aggregateAlerts, isAlertRelevantForPoint } from '../utils/alertGeo';
import {
    HORIZON_DEFAULT_HOURS,
    RULE_METRICS,
    validateRule,
} from '../utils/alertRules';

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

    // Scarta le scadute, quelle di aree che non riguardano il punto, e deduplica
    const deduplicated = aggregateAlerts(allAlerts, lat, lon);

    debugInfo.rawTotal = allAlerts.length;
    debugInfo.deduplicatedTotal = deduplicated.length;

    console.log(`[AlertsRoute] Live fetch for ${lat},${lon}: raw=${allAlerts.length} rilevanti=${deduplicated.length} sources=${[...new Set(allAlerts.map(a => a.providerSource))].join(',') || 'none'}`);

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
        // Un device = una sola subscription attiva, e la riga va aggiornata in
        // place: l'app si ri-registra a ogni spostamento significativo, e
        // cancellare/ricreare la riga cambierebbe l'id ad ogni giro.
        const { data: existing, error: lookupError } = await supabase
            .from('alert_subscriptions')
            .select('id')
            .eq('device_token', deviceToken)
            .order('updated_at', { ascending: false });

        if (lookupError) throw lookupError;

        let data;

        if (existing && existing.length > 0) {
            const keep = existing[0]!;

            // Registrazioni residue dello stesso device: ognuna riceverebbe la
            // propria copia di ogni notifica.
            const stale = existing.slice(1).map(s => s.id);
            if (stale.length > 0) {
                const { error: cleanupError } = await supabase
                    .from('alert_subscriptions')
                    .delete()
                    .in('id', stale);
                if (cleanupError) {
                    console.warn('[AlertSubscribe] Failed to clean duplicate subscriptions:', cleanupError.message);
                } else {
                    console.log(`[AlertSubscribe] Rimosse ${stale.length} subscription duplicate per il device`);
                }
            }

            const { data: updated, error: updateError } = await supabase
                .from('alert_subscriptions')
                .update({
                    location_lat: lat,
                    location_lon: lon,
                    location_name: locationName,
                    platform,
                    enabled: true
                })
                .eq('id', keep.id)
                .select()
                .single();

            if (updateError) throw updateError;
            data = updated;
        } else {
            const { data: inserted, error: insertError } = await supabase
                .from('alert_subscriptions')
                .insert({
                    device_token: deviceToken,
                    location_lat: lat,
                    location_lon: lon,
                    location_name: locationName,
                    platform
                })
                .select()
                .single();

            if (insertError) throw insertError;
            data = inserted;
        }

        return res.json({ success: true, message: 'Iscritto alle allerte (posizione aggiornata)', data });
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

        // 2. Fetch allerte dal DB, vincolate all'area richiesta.
        //    Le righe legacy senza coordinate non superano il confronto di range
        //    e restano quindi escluse: prima venivano restituite a chiunque.
        const now = new Date().toISOString();
        const { data: dbAlerts, error } = await supabase
            .from('weather_alerts')
            .select('*')
            .gt('expire_time', now)
            .not('external_alert_id', 'is', null)
            .gte('effective_time', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // ultimi 2 giorni
            .gte('location_lat', lat - radius)
            .lte('location_lat', lat + radius)
            .gte('location_lon', lon - radius)
            .lte('location_lon', lon + radius)
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
                    const mapped: WeatherAlert = {
                        id: key,
                        description: dbAlert.message || '',
                        severity: dbAlert.severity === 'critical' ? 'extreme' : dbAlert.severity === 'warning' ? 'moderate' : 'minor',
                        effectiveTime: dbAlert.effective_time || '',
                        expireTime: dbAlert.expire_time || '',
                        areaId: dbAlert.area_id,
                        areaName: dbAlert.area_name,
                        countryCode: dbAlert.country_code,
                        eventSource: dbAlert.event_source,
                        certainty: 'possible',
                        providerSource: dbAlert.event_source,
                    };
                    // Seconda barriera: il cluster di raccolta può essere più ampio
                    // dell'area effettiva dell'allerta.
                    if (isAlertRelevantForPoint(mapped, lat, lon)) {
                        merged.set(key, mapped);
                    }
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

    // Senza segreto configurato la richiesta va rifiutata, non lasciata
    // passare: questo endpoint interroga i provider e fa partire le push, e
    // prima un deploy con la variabile dimenticata lo lasciava aperto a
    // chiunque.
    if (!cronSecret) {
        console.error('[AlertPoller] CRON_SECRET non configurato: polling rifiutato');
        return res.status(503).json({
            error: 'Polling non disponibile: CRON_SECRET non configurato sul server',
        });
    }

    if (requestSecret !== cronSecret) {
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

        // Self-check dello schema: se una migration non è stata applicata, le
        // insert di deduplicazione falliscono e le notifiche vengono rispedite
        // ad ogni giro. Meglio scoprirlo qui che dai log.
        const { error: schemaError } = await supabase
            .from('weather_alerts')
            .select('location_lat, device_token_hash, alert_signature, delivery_status')
            .limit(1);

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
            schema: {
                ok: !schemaError,
                error: schemaError?.message,
                hint: schemaError ? 'Applicare le migration in supabase/migrations (020, 021)' : undefined,
            },
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



/**
 * Metriche disponibili per le regole di soglia personali.
 *
 * Serve ai client per costruire il form senza ricopiare il registro: le unità,
 * i confronti ammessi e le etichette vivono in un posto solo.
 */
alertsRouter.get('/rules/metrics', (_req, res) => {
    return res.json({
        metrics: RULE_METRICS.map(m => ({
            id: m.id,
            label: m.label,
            unit: m.unit,
            aggregation: m.aggregation,
            decimals: m.decimals,
            comparators: m.comparators,
        })),
        horizon_default_hours: HORIZON_DEFAULT_HOURS,
    });
});

/**
 * Regole di soglia di un device.
 *
 * Il device si identifica col proprio token, come in `/subscribe`: il token è
 * il segreto, e chi non ce l'ha non può leggere le regole altrui. Passa nel
 * body e non in query string, per non finire nei log del proxy.
 */
alertsRouter.post('/rules/list', async (req, res) => {
    const { deviceToken } = req.body;
    if (!deviceToken) {
        return res.status(400).json({ error: 'Manca deviceToken' });
    }

    try {
        const { data, error } = await supabase
            .from('alert_rules')
            .select('id, metric, comparator, threshold, horizon_hours, enabled, created_at')
            .eq('device_token', deviceToken)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return res.json({ rules: data || [] });
    } catch (err: any) {
        console.error('Error in /alerts/rules/list:', err.message);
        return res.status(500).json({ error: 'Impossibile leggere le regole', details: err.message });
    }
});

/**
 * Crea una regola di soglia.
 *
 * Payload: { deviceToken, metric, comparator, threshold, horizonHours? }
 */
alertsRouter.post('/rules', async (req, res) => {
    const { deviceToken, metric, comparator, threshold, horizonHours = HORIZON_DEFAULT_HOURS } = req.body;

    if (!deviceToken) {
        return res.status(400).json({ error: 'Manca deviceToken' });
    }

    const invalid = validateRule(metric, comparator, threshold, horizonHours);
    if (invalid) {
        return res.status(400).json({ error: invalid });
    }

    try {
        // Il device deve essere già iscritto: una regola senza subscription non
        // ha una località su cui essere valutata, e nessuno la vedrebbe mai
        // scattare.
        const { data: subscription, error: subError } = await supabase
            .from('alert_subscriptions')
            .select('id')
            .eq('device_token', deviceToken)
            .limit(1);

        if (subError) throw subError;
        if (!subscription || subscription.length === 0) {
            return res.status(409).json({
                error: 'Device non iscritto alle allerte: chiamare prima /alerts/subscribe',
            });
        }

        const { data, error } = await supabase
            .from('alert_rules')
            .insert({
                device_token: deviceToken,
                metric,
                comparator,
                threshold,
                horizon_hours: horizonHours,
            })
            .select('id, metric, comparator, threshold, horizon_hours, enabled, created_at')
            .single();

        if (error) {
            // Regola identica già presente: è un no-op voluto, non un errore da
            // 500. Si restituisce quella esistente.
            if (error.code === '23505') {
                const { data: existing } = await supabase
                    .from('alert_rules')
                    .select('id, metric, comparator, threshold, horizon_hours, enabled, created_at')
                    .match({ device_token: deviceToken, metric, comparator, threshold, horizon_hours: horizonHours })
                    .single();
                return res.status(200).json({ rule: existing, duplicate: true });
            }
            throw error;
        }

        return res.status(201).json({ rule: data });
    } catch (err: any) {
        console.error('Error in POST /alerts/rules:', err.message);
        return res.status(500).json({ error: 'Impossibile creare la regola', details: err.message });
    }
});

/**
 * Abilita o disabilita una regola. Il deviceToken è il lasciapassare: senza,
 * chiunque conoscesse un id potrebbe spegnere le allerte di un altro.
 */
alertsRouter.patch('/rules/:id', async (req, res) => {
    const { deviceToken, enabled } = req.body;
    if (!deviceToken || typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Servono deviceToken e enabled (booleano)' });
    }

    try {
        const { data, error } = await supabase
            .from('alert_rules')
            .update({ enabled })
            .match({ id: req.params.id, device_token: deviceToken })
            .select('id, metric, comparator, threshold, horizon_hours, enabled')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Regola non trovata per questo device' });

        return res.json({ rule: data });
    } catch (err: any) {
        console.error('Error in PATCH /alerts/rules:', err.message);
        return res.status(500).json({ error: 'Impossibile aggiornare la regola', details: err.message });
    }
});

/**
 * Elimina una regola. Il deviceToken è obbligatorio per lo stesso motivo del
 * PATCH.
 */
alertsRouter.delete('/rules/:id', async (req, res) => {
    const { deviceToken } = req.body;
    if (!deviceToken) {
        return res.status(400).json({ error: 'Manca deviceToken' });
    }

    try {
        const { data, error } = await supabase
            .from('alert_rules')
            .delete()
            .match({ id: req.params.id, device_token: deviceToken })
            .select('id')
            .maybeSingle();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Regola non trovata per questo device' });

        return res.json({ success: true });
    } catch (err: any) {
        console.error('Error in DELETE /alerts/rules:', err.message);
        return res.status(500).json({ error: 'Impossibile eliminare la regola', details: err.message });
    }
});
