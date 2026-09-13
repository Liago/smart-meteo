import jwt from 'jsonwebtoken';
import { UnifiedForecast, normalizeCondition } from '../utils/formatter';
import { WeatherAlert, ForecastNextHour } from '../types';
import { getCountryCode } from '../utils/alertGeo';
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
        id: a.id || `wk:${(a.areaId || 'unknown')}_${(a.severity || 'mod')}_${a.effectiveTime || a.issuedTime || 'notime'}`,
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

/**
 * Estrae e normalizza il dataset forecastNextHour dalla risposta WeatherKit.
 * Fornisce previsione precipitazioni minuto-per-minuto per la prossima ora.
 */
function parseForecastNextHour(data: any): ForecastNextHour | undefined {
    const nextHour = data?.forecastNextHour;
    if (!nextHour) return undefined;

    const summary = Array.isArray(nextHour.summary)
        ? nextHour.summary.map((s: any) => ({
            condition: s.condition || 'clear',
            startTime: s.startTime,
            endTime: s.endTime,
        }))
        : [];

    const minutes = Array.isArray(nextHour.minutes)
        ? nextHour.minutes.map((m: any) => ({
            startTime: m.startTime,
            precipitationChance: m.precipitationChance != null ? m.precipitationChance * 100 : 0,
            precipitationIntensity: m.precipitationIntensity ?? 0,
        }))
        : [];

    if (summary.length === 0 && minutes.length === 0) return undefined;

    return { summary, minutes };
}

export interface WeatherKitResult {
    forecast: UnifiedForecast;
    alerts: WeatherAlert[];
}

/**
/**
 * Millimetri di neve di Apple → centimetri.
 *
 * `snowfallAmount` e `snowfallIntensity` sono **lunghezze**, non equivalente in
 * acqua: Apple le dà in millimetri di manto, mentre il contratto interno (e
 * Open-Meteo) usa i centimetri. Senza la divisione per dieci, 40 mm di neve
 * diventerebbero «40 cm» — un errore di un ordine di grandezza su un numero che
 * la gente usa per decidere se mettere le catene.
 */
function snowMmToCm(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(value)) return null;
    return Number((value / 10).toFixed(2));
}

/**
 * Costruisce l'oggetto unificato da una risposta WeatherKit.
 *
 * Condiviso fra `fetchFromWeatherKit` e `fetchFromWeatherKitWithAlerts`: erano
 * due blocchi copiati, già divergenti sull'arrotondamento della velocità del
 * vento, e ogni campo aggiunto a uno solo dei due sarebbe comparso o sparito a
 * seconda di quale funzione l'engine avesse chiamato.
 */
function buildWeatherKitForecast(data: any, lat: number, lon: number): UnifiedForecast {
    const current = data.currentWeather || {};

    const dailyData = data.forecastDaily?.days || [];
    const daily = dailyData.slice(0, 7).map((d: any) => ({
        date: d.forecastStart.split('T')[0],
        temp_max: d.temperatureMax,
        temp_min: d.temperatureMin,
        precipitation_prob: d.precipitationChance != null ? d.precipitationChance * 100 : 0,
        condition_code: mapConditionCode(d.conditionCode),
        condition_text: d.conditionCode,
        uv_index_max: d.maxUvIndex,
        precipitation_mm: d.precipitationAmount ?? null,
        snowfall_cm: snowMmToCm(d.snowfallAmount),
    }));

    const hourlyData = data.forecastHourly?.hours || [];
    const hourly = hourlyData.slice(0, 24).map((h: any) => ({
        time: h.forecastStart,
        temp: h.temperature,
        precipitation_prob: h.precipitationChance != null ? h.precipitationChance * 100 : 0,
        condition_code: mapConditionCode(h.conditionCode),
        condition_text: h.conditionCode,
        feels_like: h.temperatureApparent ?? null,
        humidity: h.humidity != null ? h.humidity * 100 : null,
        wind_speed: h.windSpeed != null ? Number((h.windSpeed / 3.6).toFixed(2)) : null, // km/h → m/s
        wind_direction: h.windDirection ?? null,
        wind_gust: h.windGust != null ? Number((h.windGust / 3.6).toFixed(2)) : null, // km/h → m/s
        uv_index: h.uvIndex ?? null,
        // Su timestep di 1h l'accumulo (mm) e l'intensità (mm/h) coincidono
        precipitation_mm: h.precipitationAmount ?? h.precipitationIntensity ?? null,
        // Stesso ragionamento sulla neve: su un'ora l'intensità in mm/h è
        // l'accumulo dell'ora. Apple non espone un `snowfallAmount` orario.
        snowfall_cm: snowMmToCm(h.snowfallIntensity),
    }));

    const forecastPayload: any = {
        source: 'apple_weatherkit',
        lat,
        lon,
        time: current.asOf || new Date().toISOString(),
        temp: current.temperature,
        feels_like: current.temperatureApparent,
        humidity: current.humidity != null ? current.humidity * 100 : null,
        // Apple documenta windSpeed in km/h, il contratto interno è m/s.
        wind_speed: current.windSpeed != null ? Number((current.windSpeed / 3.6).toFixed(2)) : null,
        wind_direction: current.windDirection,
        wind_gust: current.windGust != null ? current.windGust / 3.6 : null,
        condition_text: current.conditionCode,
        condition_code: mapConditionCode(current.conditionCode),
        precipitation_prob: current.precipitationChance != null ? current.precipitationChance * 100 : null,
        precipitation_intensity: current.precipitationIntensity,
        // WeatherKit non restituisce la qualità dell'aria.
        aqi: null,
        pressure: current.pressure,
        dew_point: current.temperatureDewPoint,
        uv_index: current.uvIndex,
        visibility: current.visibility != null ? current.visibility / 1000 : null, // metri → km
        cloud_cover: current.cloudCover != null ? current.cloudCover * 100 : null,
        daily,
        hourly,
        // Apple non ha un dataset astronomico separato: alba e tramonto stanno
        // nel primo giorno del daily.
        astronomy: dailyData[0]
            ? {
                  sunrise: dailyData[0].sunrise,
                  sunset: dailyData[0].sunset,
                  moon_phase: dailyData[0].moonPhase || 'unknown',
              }
            : undefined,
        raw_data: data,
    };

    const nextHour = parseForecastNextHour(data);
    if (nextHour) {
        forecastPayload.forecastNextHour = nextHour;
    }

    return new UnifiedForecast(forecastPayload);
}

/**
 * Fetch data from Apple WeatherKit API
 * Endpoint: https://weatherkit.apple.com/api/v1/weather/it/{lat}/{lon}
 */
export async function fetchFromWeatherKit(lat: number, lon: number): Promise<UnifiedForecast | null> {
    const token = generateAppleJWT();
    if (!token) return null;

    const countryCode = getCountryCode(lat, lon);
    const url = `https://weatherkit.apple.com/api/v1/weather/it/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly,forecastNextHour,weatherAlerts&countryCode=${countryCode}`;

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

        return buildWeatherKitForecast(data, lat, lon);
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

    const countryCode = getCountryCode(lat, lon);
    const url = `https://weatherkit.apple.com/api/v1/weather/it/${lat}/${lon}?dataSets=currentWeather,forecastDaily,forecastHourly,forecastNextHour,weatherAlerts&countryCode=${countryCode}`;

    try {
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            throw new Error(`Apple WeatherKit API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        const alerts = parseWeatherAlerts(data);

        return {
            forecast: buildWeatherKitForecast(data, lat, lon),
            alerts
        };
    } catch (err: any) {
        console.error('Apple WeatherKit Fetch Error (with alerts):', err.message);
        return null;
    }
}
