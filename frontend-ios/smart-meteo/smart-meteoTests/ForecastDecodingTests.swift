import XCTest
@testable import smart_meteo

/// Il contratto con il backend.
///
/// È la prova che questo progetto avrebbe dovuto avere per prima. I modelli
/// Swift traducono a mano decine di chiavi snake_case, e una chiave scritta
/// male **compila benissimo**: il campo resta nil, il riquadro sparisce, e
/// nessuno se ne accorge finché un utente non lo segnala. È successo davvero —
/// `solar`, `sky`, `sea` e `activities` arrivavano dal backend e venivano
/// buttati via perché i modelli non li dichiaravano affatto.
///
/// La fixture riproduce la forma della risposta di `/api/forecast`. Quando il
/// backend aggiunge un blocco, va aggiunto anche qui: è il posto dove
/// l'asimmetria fra i client si vede subito.
final class ForecastDecodingTests: XCTestCase {

    private static let responseJSON = """
    {
      "location": { "lat": 45.46, "lon": 9.19 },
      "generated_at": "2026-09-14T08:00:00Z",
      "utc_offset_seconds": 7200,
      "sources_used": ["apple_weatherkit", "open-meteo:icon_d2"],
      "current": {
        "temperature": 24.3,
        "feels_like": 25.1,
        "humidity": 55,
        "wind_speed": 3.5,
        "precipitation_prob": 10,
        "precipitation_intensity": 0,
        "condition": "clear",
        "condition_code": "1",
        "condition_text": "CLEAR",
        "dew_point": 14.4,
        "wind_gust": 6.2,
        "wind_direction_label": "S",
        "aqi": 2,
        "pressure": 1013,
        "uv_index": 5,
        "visibility": 24.1,
        "cloud_cover": 20,
        "air_quality": {
          "aqi_us_epa": 2, "pm2_5": 12.3, "pm10": 20.1,
          "no2": 15, "o3": 40, "co": 200, "so2": 5, "european_aqi": 31
        }
      },
      "daily": [
        { "date": "2026-09-14", "temp_max": 28, "temp_min": 17,
          "precipitation_prob": 10, "condition_code": "1",
          "precipitation_mm": 0, "snowfall_cm": 0, "uv_index_max": 6 }
      ],
      "hourly": [
        { "time": "2026-09-14T09:00", "temp": 21, "precipitation_prob": 10,
          "condition_code": "1", "precipitation_mm": 0, "feels_like": 22,
          "humidity": 55, "wind_speed": 3.5, "wind_direction": 180,
          "wind_gust": 6, "uv_index": 4, "temp_p10": 19.5, "temp_p90": 22.5,
          "snowfall_cm": 0, "snow_depth_cm": 0, "freezing_level": 3800,
          "soil_temperature": 19, "soil_temperature_root": 18,
          "soil_moisture": 0.252, "evapotranspiration": 0.21,
          "vapour_pressure_deficit": 1.1, "cape": 1800,
          "lifted_index": -4, "storm_index": 63, "thunder_prob": 55 }
      ],
      "astronomy": {
        "sunrise": "2026-09-14T06:52:00", "sunset": "2026-09-14T19:44:00",
        "moon_phase": "Gibbosa Crescente", "moonrise": "2026-09-14T21:12:00",
        "moonset": "2026-09-15T11:03:00", "moon_illumination": 72
      },
      "alerts": [],
      "confidence": {
        "score": 88, "level": "high", "sources_count": 5,
        "temperature": { "spread": 0.4, "min": 23.8, "max": 24.9 },
        "precipitation_prob": { "spread": 2, "min": 8, "max": 12 }
      },
      "pollen": [
        { "species": "grass", "label": "Graminacee", "value": 8,
          "daily_max": 62, "level": "moderate", "daily_level": "very_high" }
      ],
      "snow": {
        "elevation": 1800, "snow_line": 900, "phase": "snow",
        "snow_depth_cm": 12, "snowfall_cm": 4,
        "frost": { "level": "likely", "min_temp": -1.2,
                   "at": "2026-09-15T05:00", "source": "soil" }
      },
      "garden": {
        "soil_moisture": 0.252, "moisture_level": "adequate",
        "soil_temperature": 18, "evapotranspiration_mm": 4.8,
        "rain_mm": 0, "water_balance_mm": 4.8,
        "advice": "water_soon", "sowing_ok": true
      },
      "solar": {
        "plane": "tilted", "tilt_deg": 30, "azimuth_deg": 0,
        "performance_ratio": 0.75,
        "days": [
          { "date": "2026-09-14", "kwh_per_kwp": 5.2,
            "sunshine_hours": 11, "peak_w": 890 }
        ]
      },
      "sky": {
        "sunset": { "at": "2026-09-14T20:00", "score": 82, "level": "excellent" },
        "sunrise": null,
        "stargazing": { "score": 40, "level": "fair",
                        "cloud_cover": 30, "moon_illumination": 60 }
      },
      "sea": {
        "sea_temperature": 24.6, "wave_height": 0.32, "wave_direction": 110,
        "wave_period": 4.2, "swell_height": 0.2, "state": "calm",
        "max_wave_24h": 1.8, "max_wave_at": "2026-09-14T17:00"
      },
      "activities": {
        "date": "2026-09-14", "from": "2026-09-14T08:00", "to": "2026-09-14T19:00",
        "activities": [
          { "id": "cycling", "label": "Andare in bici", "score": 100, "limiting": null },
          { "id": "running", "label": "Correre", "score": 62, "limiting": "temperatura" }
        ]
      },
      "forecastNextHour": {
        "summary": [],
        "minutes": [
          { "startTime": "2026-09-14T08:00:00Z",
            "precipitationChance": 0, "precipitationIntensity": 0 }
        ]
      }
    }
    """

    private func decodeResponse() throws -> ForecastResponse {
        try Fixture.decode(ForecastResponse.self, from: Self.responseJSON)
    }

    func testDecodesTheWholeResponse() throws {
        let forecast = try decodeResponse()

        XCTAssertEqual(forecast.location.lat, 45.46, accuracy: 0.001)
        XCTAssertEqual(forecast.utcOffsetSeconds, 7200)
        XCTAssertEqual(forecast.sourcesUsed.count, 2)
        XCTAssertEqual(forecast.current.conditionText, "CLEAR")
    }

    /// I quattro blocchi che fino al 14/09/2026 il modello Swift non dichiarava.
    func testDecodesTheBlocksThatWereBeingThrownAway() throws {
        let forecast = try decodeResponse()

        let solar = try XCTUnwrap(forecast.solar)
        XCTAssertEqual(solar.plane, "tilted")
        XCTAssertEqual(solar.tiltDeg, 30)
        XCTAssertEqual(solar.days.first?.kwhPerKwp, 5.2)
        XCTAssertEqual(solar.days.first?.sunshineHours, 11)

        let sky = try XCTUnwrap(forecast.sky)
        XCTAssertEqual(sky.sunset?.level, "excellent")
        XCTAssertNil(sky.sunrise)
        XCTAssertEqual(sky.stargazing?.cloudCover, 30)
        XCTAssertEqual(sky.stargazing?.moonIllumination, 60)

        let sea = try XCTUnwrap(forecast.sea)
        XCTAssertEqual(sea.seaTemperature, 24.6)
        XCTAssertEqual(sea.maxWave24h, 1.8)
        XCTAssertEqual(sea.maxWaveAt, "2026-09-14T17:00")

        let activities = try XCTUnwrap(forecast.activities)
        XCTAssertEqual(activities.activities.count, 2)
        XCTAssertEqual(activities.activities.first?.id, "cycling")
        // `limiting: null` deve restare nil, non diventare stringa vuota.
        XCTAssertNil(activities.activities.first?.limiting)
        XCTAssertEqual(activities.activities.last?.limiting, "temperatura")
    }

    func testDecodesSnowAndGarden() throws {
        let forecast = try decodeResponse()

        let snow = try XCTUnwrap(forecast.snow)
        XCTAssertEqual(snow.snowLine, 900)
        // La sorgente della gelata cambia il senso della frase: il backend usa
        // soglie diverse per il suolo e per i due metri.
        XCTAssertEqual(snow.frost.source, "soil")
        XCTAssertEqual(snow.frost.level, "likely")

        let garden = try XCTUnwrap(forecast.garden)
        XCTAssertEqual(garden.advice, "water_soon")
        XCTAssertEqual(garden.soilMoisture, 0.252)
        XCTAssertEqual(garden.sowingOk, true)
    }

    /// I campi orari arrivati in fasi diverse, tutti con la loro chiave.
    func testDecodesTheHourlyExtras() throws {
        let hour = try XCTUnwrap(try decodeResponse().hourly?.first)

        XCTAssertEqual(hour.tempP10, 19.5)
        XCTAssertEqual(hour.tempP90, 22.5)
        XCTAssertEqual(hour.stormIndex, 63)
        XCTAssertEqual(hour.thunderProb, 55)
        XCTAssertEqual(hour.soilMoisture, 0.252)
        XCTAssertEqual(hour.soilTemperatureRoot, 18)
        XCTAssertEqual(hour.freezingLevel, 3800)
        XCTAssertEqual(hour.liftedIndex, -4)
    }

    /// Una risposta vecchia in cache non deve far fallire la decodifica.
    ///
    /// Il backend invalida la cache per versione di schema, ma il telefono può
    /// avere una risposta più vecchia in mano: tutti i blocchi nuovi sono
    /// opzionali proprio per questo, e questa prova lo fissa.
    func testDecodesAMinimalLegacyResponse() throws {
        let legacy = """
        {
          "location": { "lat": 45.46, "lon": 9.19 },
          "generated_at": "2026-01-01T08:00:00Z",
          "sources_used": ["open-meteo"],
          "current": {
            "precipitation_prob": 0, "condition": "clear", "condition_text": "CLEAR"
          }
        }
        """

        let forecast = try Fixture.decode(ForecastResponse.self, from: legacy)

        XCTAssertNil(forecast.solar)
        XCTAssertNil(forecast.sky)
        XCTAssertNil(forecast.sea)
        XCTAssertNil(forecast.activities)
        XCTAssertNil(forecast.snow)
        XCTAssertNil(forecast.utcOffsetSeconds)
        XCTAssertNil(forecast.hourly)
    }
}
