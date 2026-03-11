import jwt from 'jsonwebtoken';
import { UnifiedForecast, normalizeCondition } from '../utils/formatter';
import { WeatherAlert } from '../types';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Funzione per generare un token JWT valido per Apple WeatherKit Rest API
 */
function generateAppleJWT(): string | null {
	const teamId = process.env.APPLE_TEAM_ID;
	const serviceId = process.env.APPLE_SERVICE_ID;
	const keyId = process.env.APPLE_KEY_ID;
	const privateKey = process.env.APPLE_PRIVATE_KEY;

	if (!teamId || !serviceId || !keyId || !privateKey) {
		console.warn('Apple WeatherKit missing environment variables (APPLE_TEAM_ID, APPLE_SERVICE_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY)');
		return null;
	}

	try {
        // Rimuove eventuali escape dal dotenv se presenti, il privateKey dev'essere in formato PEM multiline
        const formattedKey = privateKey.replace(/\\n/g, '\n');

		const token = jwt.sign({}, formattedKey, {
			algorithm: 'ES256',
			keyid: keyId,
			issuer: teamId,
			expiresIn: '1h',
			subject: serviceId
		});
		return token;
	} catch (err) {
		console.error('Failed to generate Apple WeatherKit JWT:', err);
		return null;
	}
}

/**
 * Converte i codici condizione da Apple WeatherKit ai nostri standard
 */
function mapConditionCode(appleCondition: string): string {
    // Apple conditions: https://developer.apple.com/documentation/weatherkitrestapi/weathercondition
    const map: Record<string, string> = {
        'Clear': 'clear',
        'MostlyClear': 'clear',
        'PartlyCloudy': 'cloudy',
        'MostlyCloudy': 'cloudy',
        'Cloudy': 'cloudy',
        'Haze': 'cloudy',
        'Breezy': 'cloudy',
        'Windy': 'cloudy',
        'Drizzle': 'rain',
        'Rain': 'rain',
        'HeavyRain': 'rain',
        'FreezingDrizzle': 'snow',
        'FreezingRain': 'snow',
        'MixedRainAndSleet': 'snow',
        'MixedRainAndSnow': 'snow',
        'MixedRainAndHail': 'rain',
        'Snow': 'snow',
        'HeavySnow': 'snow',
        'Sleet': 'snow',
        'Hail': 'rain',
        'Thunderstorm': 'storm',
        'SevereThunderstorm': 'storm',
        'TropicalStorm': 'storm',
        'Hurricane': 'storm',
        'Tornado': 'storm',
        'BlowingSnow': 'snow',
        'Frigid': 'clear',
        'Hot': 'clear',
        'Dust': 'fog',
        'Sand': 'fog',
        'Smoke': 'fog',
        'SunFlurries': 'snow',
        'SunShowers': 'rain',
        'Foggy': 'fog',
        'BlowingDust': 'fog'
    };

    const mapped = map[appleCondition];
    return normalizeCondition(mapped || 'unknown');
}

/**
 * Mappa i severity di Apple WeatherKit
 */
function mapAlertSeverity(severity: string): string {
    const map: Record<string, string> = {
        'minor': 'minor',
        'moderate': 'moderate',
        'severe': 'severe',
        'extreme': 'extreme'
    };
    return map[severity?.toLowerCase()] || severity || 'moderate';
}

/**
 * Estrae le allerte meteo dalla risposta WeatherKit
 */
function parseWeatherAlerts(data: any): WeatherAlert[] {
    const alertsData = data?.weatherAlerts?.alerts;
    if (!Array.isArray(alertsData) || alertsData.length === 0) return [];

    return alertsData.map((a: any) => ({
        id: a.id || `wk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        areaId: a.areaId,
        areaName: a.areaName,
        certainty: a.certainty || 'possible',
        countryCode: a.countryCode,
        description: a.description || 'Allerta meteo',
        effectiveTime: a.effectiveTime,
        expireTime: a.expireTime,
        issuedTime: a.issuedTime,
        eventSource: a.eventSource || a.source,
        severity: mapAlertSeverity(a.severity),
        source: a.source,
        urgency: a.urgency,
        detailsUrl: a.detailsUrl
    }));
}

export interface WeatherKitResult {
    forecast: UnifiedForecast;
    alerts: WeatherAlert[];
}

/**
 * Fetch data from Apple WeatherKit API
 * Endpoint: https://weatherkit.apple.com/api/v1/weather/it/{lat}/{lon}
 */
export async function fetchFromWeatherKit(lat: number, lon: number): Promise<UnifiedForecast | null> {
    const token = generateAppleJWT();
    if (!token) return null;

    const url = `https://weatherkit.apple.com/api/v1/weather/it/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly,weatherAlerts`;

    try {
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Apple WeatherKit API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Estrazione current 
        const current = data.currentWeather || {};
        
        // Estrazione daily
        const dailyData = data.forecastDaily?.days || [];
        const daily = dailyData.slice(0, 7).map((d: any) => ({
            date: d.forecastStart.split('T')[0],
            temp_max: d.temperatureMax,
            temp_min: d.temperatureMin,
            precipitation_prob: d.precipitationChance != null ? d.precipitationChance * 100 : 0, 
            condition_code: mapConditionCode(d.conditionCode),
            condition_text: d.conditionCode,
            uv_index_max: d.maxUvIndex
        }));

        // Estrazione hourly
        const hourlyData = data.forecastHourly?.hours || [];
        const hourly = hourlyData.slice(0, 24).map((h: any) => ({
            time: h.forecastStart,
            temp: h.temperature,
            precipitation_prob: h.precipitationChance != null ? h.precipitationChance * 100 : 0,
            condition_code: mapConditionCode(h.conditionCode),
            condition_text: h.conditionCode
        }));

        // WeatherKit non restituisce aqi, ma dà uvIndex, visibility e pressure
        const forecastPayload = {
            source: 'apple_weatherkit',
            lat,
            lon,
            time: current.asOf || new Date().toISOString(),
            temp: current.temperature,
            feels_like: current.temperatureApparent,
            humidity: current.humidity != null ? current.humidity * 100 : null,
            wind_speed: current.windSpeed != null ? current.windSpeed * 3.6 : null, // (from m/s or km/h? API docs say km/h per metric, assumiamo km/h se lang=it, o kph standard)
            // Se Apple ritorna kph nativamente, rimuovere * 3.6. Documentation assumes kph per lang=it locale. Let's pass as is if Apple handles metric.
            // Let's assume m/s to be safe and standard with the rest of the app, actually Apple docs say: "The wind speed, in kilometers per hour." Se it's km/h we must convert back or keep.
            // All our backend assumes `wind_speed` in M/S before format. So if Apple is km/h, we do: / 3.6
            // actually Let's assume km/h -> m/s:
            wind_direction: current.windDirection,
            wind_gust: current.windGust != null ? current.windGust / 3.6 : null,
            condition_text: current.conditionCode,
            condition_code: mapConditionCode(current.conditionCode),
            precipitation_prob: current.precipitationChance != null ? current.precipitationChance * 100 : null,
            precipitation_intensity: current.precipitationIntensity,
            aqi: null, 
            pressure: current.pressure, 
            dew_point: current.temperatureDewPoint,
            uv_index: current.uvIndex,
            visibility: current.visibility != null ? current.visibility / 1000 : null, // from meters to km
            cloud_cover: current.cloudCover != null ? current.cloudCover * 100 : null,
            daily,
            hourly,
            // Apple non fornisce i dati astronomici (alba/tramonto) per dataset separato? Sì nell'oggetto daily!
            astronomy: dailyData[0] ? {
                sunrise: dailyData[0].sunrise,
                sunset: dailyData[0].sunset,
                moon_phase: dailyData[0].moonPhase || 'unknown'
            } as any : undefined,
            raw_data: data
        };

        // Fix wind speed since Apple gives km/h natively
        if (current.windSpeed != null) {
            forecastPayload.wind_speed = current.windSpeed / 3.6;
        }

        return new UnifiedForecast(forecastPayload);
    } catch (err: any) {
        console.error('Apple WeatherKit Fetch Error:', err.message);
        return null;
    }
}

/**
 * Fetch data + weather alerts from Apple WeatherKit API.
 * Restituisce sia il forecast che le allerte ufficiali.
 */
export async function fetchFromWeatherKitWithAlerts(lat: number, lon: number): Promise<WeatherKitResult | null> {
    const token = generateAppleJWT();
    if (!token) return null;

    const url = `https://weatherkit.apple.com/api/v1/weather/it/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly,weatherAlerts`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Apple WeatherKit API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Estrai allerte
        const alerts = parseWeatherAlerts(data);

        // Estrai forecast con la stessa logica di fetchFromWeatherKit
        const current = data.currentWeather || {};
        const dailyData = data.forecastDaily?.days || [];
        const daily = dailyData.slice(0, 7).map((d: any) => ({
            date: d.forecastStart.split('T')[0],
            temp_max: d.temperatureMax,
            temp_min: d.temperatureMin,
            precipitation_prob: d.precipitationChance != null ? d.precipitationChance * 100 : 0,
            condition_code: mapConditionCode(d.conditionCode),
            condition_text: d.conditionCode,
            uv_index_max: d.maxUvIndex
        }));
        const hourlyData = data.forecastHourly?.hours || [];
        const hourly = hourlyData.slice(0, 24).map((h: any) => ({
            time: h.forecastStart,
            temp: h.temperature,
            precipitation_prob: h.precipitationChance != null ? h.precipitationChance * 100 : 0,
            condition_code: mapConditionCode(h.conditionCode),
            condition_text: h.conditionCode
        }));

        const forecastPayload: any = {
            source: 'apple_weatherkit',
            lat, lon,
            time: current.asOf || new Date().toISOString(),
            temp: current.temperature,
            feels_like: current.temperatureApparent,
            humidity: current.humidity != null ? current.humidity * 100 : null,
            wind_speed: current.windSpeed != null ? current.windSpeed / 3.6 : null,
            wind_direction: current.windDirection,
            wind_gust: current.windGust != null ? current.windGust / 3.6 : null,
            condition_text: current.conditionCode,
            condition_code: mapConditionCode(current.conditionCode),
            precipitation_prob: current.precipitationChance != null ? current.precipitationChance * 100 : null,
            precipitation_intensity: current.precipitationIntensity,
            aqi: null,
            pressure: current.pressure,
            dew_point: current.temperatureDewPoint,
            uv_index: current.uvIndex,
            visibility: current.visibility != null ? current.visibility / 1000 : null,
            cloud_cover: current.cloudCover != null ? current.cloudCover * 100 : null,
            daily, hourly,
            astronomy: dailyData[0] ? {
                sunrise: dailyData[0].sunrise,
                sunset: dailyData[0].sunset,
                moon_phase: dailyData[0].moonPhase || 'unknown'
            } as any : undefined,
            raw_data: data
        };

        return {
            forecast: new UnifiedForecast(forecastPayload),
            alerts
        };
    } catch (err: any) {
        console.error('Apple WeatherKit Fetch Error (with alerts):', err.message);
        return null;
    }
}
