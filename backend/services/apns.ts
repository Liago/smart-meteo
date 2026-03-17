import apn from '@parse/node-apn';
import dotenv from 'dotenv';
dotenv.config();

let apnProvider: apn.Provider | null = null;

export function initializeAPNs() {
    const logPrefix = '[APNs]';
    const teamId = process.env.APNS_TEAM_ID;
    const keyId = process.env.APNS_KEY_ID;
    const privateKey = process.env.APNS_PRIVATE_KEY;
    const bundleId = process.env.APNS_BUNDLE_ID;
    // Usa variabile esplicita APNS_PRODUCTION se presente, altrimenti derivata da NODE_ENV
    const isProduction = process.env.APNS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';

    // Health check: verifica tutte le variabili necessarie
    const missing: string[] = [];
    if (!teamId) missing.push('APNS_TEAM_ID');
    if (!keyId) missing.push('APNS_KEY_ID');
    if (!privateKey) missing.push('APNS_PRIVATE_KEY');
    if (!bundleId) missing.push('APNS_BUNDLE_ID');

    if (missing.length > 0) {
        console.warn(`${logPrefix} Missing env vars: ${missing.join(', ')}. Push notifications will NOT be sent.`);
        return;
    }

    console.log(`${logPrefix} Config: gateway=${isProduction ? 'PRODUCTION' : 'SANDBOX'} teamId=${teamId} keyId=${keyId} bundleId=${bundleId}`);

    try {
        const formattedKey = privateKey!.replace(/\\n/g, '\n');

        const options: apn.ProviderOptions = {
            token: {
                key: formattedKey,
                keyId: keyId!,
                teamId: teamId!
            },
            production: isProduction
        };

        apnProvider = new apn.Provider(options);
        console.log(`${logPrefix} Provider initialized successfully (${isProduction ? 'production' : 'sandbox'} gateway).`);
    } catch (err) {
        console.error(`${logPrefix} Failed to initialize provider:`, err);
    }
}

/**
 * Restituisce lo stato di salute del provider APNs
 */
export function getAPNsHealthStatus(): { initialized: boolean; production: boolean } {
    const isProduction = process.env.APNS_PRODUCTION === 'true' || process.env.NODE_ENV === 'production';
    return {
        initialized: apnProvider !== null,
        production: isProduction,
    };
}

export interface PushResult {
    sent: boolean;
    reason?: string;
    isExpiredToken?: boolean;
}

export async function sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    payload: any = {}
): Promise<PushResult> {
    const logPrefix = '[APNs]';
    const tokenShort = deviceToken.slice(0, 8) + '...';

    if (!apnProvider) {
        console.warn(`${logPrefix} Provider not initialized. Cannot send push to ${tokenShort}`);
        return { sent: false, reason: 'provider_not_initialized' };
    }

    const topic = process.env.APNS_BUNDLE_ID;
    if (!topic) {
        console.error(`${logPrefix} Missing APNS_BUNDLE_ID env var. Cannot send push.`);
        return { sent: false, reason: 'missing_bundle_id' };
    }

    const note = new apn.Notification();
    note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now
    note.badge = 3;
    note.sound = 'ping.aiff';
    note.alert = {
        title: title,
        body: body,
    };
    note.topic = topic;
    note.payload = payload;

    try {
        const result = await apnProvider.send(note, deviceToken);
        if (result.sent.length > 0) {
            console.log(`${logPrefix} Push sent OK to ${tokenShort} topic=${topic}`);
            return { sent: true };
        } else if (result.failed.length > 0) {
            const failure = result.failed[0];
            const reason = String(failure?.response?.reason || failure?.error || 'unknown');
            const statusCode = (failure?.response as any)?.statusCode || 'N/A';
            const isExpiredToken = reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'ExpiredProviderToken';
            console.error(`${logPrefix} Push FAILED to ${tokenShort}: status=${statusCode} reason=${reason} expiredToken=${isExpiredToken}`);
            return { sent: false, reason, isExpiredToken };
        }
        console.warn(`${logPrefix} Push to ${tokenShort}: no sent/failed results (unexpected)`);
        return { sent: false, reason: 'no_result' };
    } catch (err: any) {
        console.error(`${logPrefix} Exception sending push to ${tokenShort}:`, err);
        return { sent: false, reason: err.message || 'exception' };
    }
}
