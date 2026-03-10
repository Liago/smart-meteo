import express from 'express';
import { supabase } from '../services/supabase';
import { sendPushNotification } from '../services/apns';

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
