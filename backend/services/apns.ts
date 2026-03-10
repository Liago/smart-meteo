import apn from '@parse/node-apn';
import dotenv from 'dotenv';
dotenv.config();

let apnProvider: apn.Provider | null = null;

export function initializeAPNs() {
    const teamId = process.env.APNS_TEAM_ID;
    const keyId = process.env.APNS_KEY_ID;
    const privateKey = process.env.APNS_PRIVATE_KEY;

    if (!teamId || !keyId || !privateKey) {
        console.warn('APNs environment variables missing. Push notifications will not be sent.');
        return;
    }

    try {
        const formattedKey = privateKey.replace(/\\n/g, '\n');
        
        const options: apn.ProviderOptions = {
            token: {
                key: formattedKey,
                keyId: keyId,
                teamId: teamId
            },
            production: process.env.NODE_ENV === 'production' // usa il gateway di DEV/Sandbox se in locale
        };

        apnProvider = new apn.Provider(options);
        console.log('APNs Provider initialized successfully.');
    } catch (err) {
        console.error('Failed to initialize APNs provider:', err);
    }
}

export async function sendPushNotification(
    deviceToken: string, 
    title: string, 
    body: string, 
    payload: any = {}
): Promise<boolean> {
    if (!apnProvider) {
        console.warn('APNs Provider not initialized. Cannot send notification.');
        return false;
    }

    const topic = process.env.APNS_BUNDLE_ID;
    if (!topic) {
        console.error('Missing APNS_BUNDLE_ID environment variable for push notifications.');
        return false;
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
            console.log(`Push sent successfully to ${deviceToken}`);
            return true;
        } else if (result.failed.length > 0) {
            console.error(`Push failed to ${deviceToken}:`, result.failed[0]?.response || result.failed[0]?.error);
            return false;
        }
        return false;
    } catch (err) {
        console.error(`Error sending push notification to ${deviceToken}:`, err);
        return false;
    }
}
