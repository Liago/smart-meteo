import { expect, test } from '@playwright/test';
import { dashboardReady, mockApi, openSection, seedHomeLocation, startAsNewVisitor } from './fixtures/api';

/**
 * Dashboard: quello che l'utente vede al primo caricamento.
 *
 * Gli scenari verificano che i dati dell'API arrivino a schermo, non che siano
 * corretti — l'aggregazione è coperta dai test del backend.
 */

test.beforeEach(async ({ page }) => {
	await seedHomeLocation(page);
});

test('senza località salvata mostra il benvenuto e non chiama l API', async ({ page }) => {
	let chiamate = 0;
	await page.route('**/api/forecast*', (route) => {
		chiamate++;
		return route.fulfill({ json: {} });
	});
	await startAsNewVisitor(page);
	await page.goto('/');

	await expect(page.getByRole('heading', { name: /Benvenuto su Smart Meteo/ })).toBeVisible();
	expect(chiamate).toBe(0);
});

test('mostra la temperatura corrente e la condizione', async ({ page }) => {
	await mockApi(page);
	await page.goto('/');

	await expect(page.getByText('24', { exact: false }).first()).toBeVisible();
	await expect(page.getByText('Umidita', { exact: false })).toBeVisible();
	await expect(page.getByText('Vento', { exact: false }).first()).toBeVisible();
});

test('mostra le fonti che hanno contribuito', async ({ page }) => {
	await mockApi(page);
	await page.goto('/');
	await openSection(page, 'Fonti');

	await expect(page.getByText('Fonti contribuenti')).toBeVisible();
	await expect(page.getByText('5 attive')).toBeVisible();
	await expect(page.getByText('Apple WeatherKit')).toBeVisible();
});

test('mostra i sette giorni di previsione', async ({ page }) => {
	await mockApi(page);
	await page.goto('/');
	await openSection(page, 'Settimana');

	await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
});

test('mostra il sole, il vento e i dati lunari', async ({ page }) => {
	await mockApi(page);
	await page.goto('/');

	await expect(page.getByText('Sole & Vento')).toBeVisible();
	await expect(page.getByText('Barometro')).toBeVisible();
	// I dati lunari sono arrivati sul web nella Fase 6A: prima li mostrava solo iOS.
	await expect(page.getByText('Illuminata')).toBeVisible();
	await expect(page.getByText('72%')).toBeVisible();
});

test('quando l API risponde con un errore mostra il fallback e non una pagina bianca', async ({ page }) => {
	await page.route('**/api/forecast*', (route) => route.fulfill({ status: 500, json: { error: 'boom' } }));
	await page.route('**/api/alerts/active*', (route) => route.fulfill({ json: { alerts: [] } }));
	await page.goto('/');

	await expect(page.getByRole('button', { name: /riprova/i })).toBeVisible();
});

test.describe('indice di consenso', () => {
	test('fonti concordi: badge verde con il punteggio', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Fonti');

		await expect(page.getByText('Fonti concordi')).toBeVisible();
		await expect(page.getByText('88/100')).toBeVisible();
	});

	test('fonti in disaccordo: lo dichiara e mostra l intervallo di temperatura', async ({ page }) => {
		await mockApi(page, {
			confidence: {
				score: 31,
				level: 'low',
				sources_count: 4,
				temperature: { spread: 3.8, min: 18, max: 26 },
				precipitation_prob: { spread: 35, min: 0, max: 90 },
			},
		});
		await page.goto('/');
		await openSection(page, 'Fonti');

		await expect(page.getByText('Fonti in disaccordo')).toBeVisible();
		await expect(page.getByText(/fra 18° e 26°/)).toBeVisible();
	});

	test('senza il blocco confidence la dashboard resta usabile', async ({ page }) => {
		// Succede leggendo una riga di cache scritta prima della Fase 6A.
		await mockApi(page, { confidence: null });
		await page.goto('/');
		await openSection(page, 'Fonti');

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		await expect(page.getByText('Fonti concordi')).toHaveCount(0);
	});
});

test.describe('nowcast al minuto', () => {
	test('pioggia in arrivo: annuncia fra quanti minuti inizia', async ({ page }) => {
		await mockApi(page, { rainStartsInMinutes: 12 });
		await page.goto('/');

		await expect(page.getByText(/Inizia fra 1[12] minuti/)).toBeVisible();
		await expect(page.getByText(/Picco 2,4 mm\/h/)).toBeVisible();
	});

	test('ora asciutta: una riga sola, senza grafico', async ({ page }) => {
		await mockApi(page, { rainStartsInMinutes: null });
		await page.goto('/');

		await expect(page.getByText('Nessuna precipitazione nella prossima ora')).toBeVisible();
	});

	test('senza il dataset WeatherKit il pannello non compare', async ({ page }) => {
		await mockApi(page, { withoutNextHour: true });
		await page.goto('/');

		await dashboardReady(page);
		await expect(page.getByText(/prossima ora/)).toHaveCount(0);
	});
});

test.describe('banda di incertezza', () => {
	test('il grafico orario disegna la banda quando i percentili ci sono', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await dashboardReady(page);
		// La banda è l'unico path decorativo del grafico orario.
		const banda = page.locator('svg path[aria-hidden="true"]');
		await expect(banda.first()).toBeAttached();
	});

	test('senza percentili il grafico resta quello di prima', async ({ page }) => {
		await mockApi(page, { withoutBand: true });
		await page.goto('/');

		await dashboardReady(page);
		await expect(page.locator('svg path[aria-hidden="true"]')).toHaveCount(0);
	});
});

test.describe('pollini', () => {
	test('mostra le specie con la più rilevante in cima', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Pollini')).toBeVisible();
		await expect(page.getByText(/Oggi soprattutto graminacee/i)).toBeVisible();
		await expect(page.getByText('Molto alto')).toBeVisible();
	});

	test('fuori dalla copertura del modello il pannello non compare', async ({ page }) => {
		await mockApi(page, { withoutPollen: true });
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Pollini')).toHaveCount(0);
	});
});

test.describe('neve e gelate', () => {
	test('in montagna dichiara la neve e la confronta con la quota della località', async ({ page }) => {
		await mockApi(page, {
			snow: {
				elevation: 1800,
				snow_line: 900,
				phase: 'snow',
				snow_depth_cm: 40,
				snowfall_cm: 12,
				frost: { level: 'severe', min_temp: -6.2, at: '2026-01-15T06:00', source: 'air' },
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Neve e gelate')).toBeVisible();
		await expect(page.getByText('Neve prevista, circa 12 cm')).toBeVisible();
		// Il confronto con l'altitudine è il motivo per cui la quota neve è
		// leggibile: senza, resterebbe un dato da bollettino.
		await expect(page.getByText('sei a 1800 m')).toBeVisible();
		await expect(page.getByText('Gelata forte')).toBeVisible();
	});

	test('in pianura resta il solo rischio gelate', async ({ page }) => {
		await mockApi(page, {
			snow: {
				elevation: 122,
				snow_line: 1200,
				phase: 'rain',
				snow_depth_cm: null,
				snowfall_cm: null,
				frost: { level: 'likely', min_temp: -1.4, at: '2026-01-15T06:00', source: 'soil' },
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		// "al suolo" non è pedanteria: fra la superficie e i due metri ci sono
		// tre o quattro gradi, e il backend le giudica con soglie diverse.
		await expect(page.getByText('Gelata probabile, minima al suolo -1° alle 06:00')).toBeVisible();
		await expect(page.getByText('Neve al suolo')).toHaveCount(0);
	});

	test('in una giornata mite il riquadro non compare', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Neve e gelate')).toHaveCount(0);
	});
});

test.describe('orto e giardino', () => {
	test('mostra il consiglio, il motivo e il dato grezzo del terreno', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Orto e giardino')).toBeVisible();
		await expect(page.getByText('Da innaffiare entro un giorno o due')).toBeVisible();
		// Il perché accanto al consiglio: senza, è un oracolo.
		await expect(page.getByText(/perde 4,8 mm/)).toBeVisible();
		await expect(page.getByText('25% vol.')).toBeVisible();
	});

	test('con la pioggia in arrivo dice di non innaffiare', async ({ page }) => {
		await mockApi(page, {
			garden: {
				soil_moisture: 0.08,
				moisture_level: 'very_dry',
				soil_temperature: 15,
				evapotranspiration_mm: 3.2,
				rain_mm: 14,
				water_balance_mm: -10.8,
				advice: 'rain_expected',
				sowing_ok: true,
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Non innaffiare: ci pensa la pioggia')).toBeVisible();
		await expect(page.getByText(/Attesi 14,0 mm/)).toBeVisible();
	});

	test('senza dati agronomici il riquadro non compare', async ({ page }) => {
		await mockApi(page, { garden: null });
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Orto e giardino')).toHaveCount(0);
	});
});

test.describe('fotovoltaico', () => {
	test('senza impianto impostato mostra la resa specifica', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Fotovoltaico')).toBeVisible();
		await expect(page.getByText('Imposta impianto')).toBeVisible();
		await expect(page.getByText('5,20 kWh/kWp').first()).toBeVisible();
		// Le assunzioni vanno sempre scritte: senza, il numero non è
		// verificabile da chi conosce il proprio tetto.
		await expect(page.getByText(/30° esposti a sud/)).toBeVisible();
	});

	test('salvata la potenza, i kWh compaiono e restano al ricaricamento', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await page.getByText('Imposta impianto').click();
		await page.getByLabel('Potenza impianto').fill('3');
		// `exact`: nell'header c'è già un «Salva nei preferiti».
		await page.getByRole('button', { name: 'Salva', exact: true }).click();

		// 5,2 kWh/kWp × 3 kWp
		await expect(page.getByText('15,6 kWh').first()).toBeVisible();

		// La potenza vive in localStorage: deve sopravvivere al ricaricamento
		// senza aver mai toccato il backend.
		await page.reload();
		await openSection(page, 'Per te');
		await expect(page.getByText('15,6 kWh').first()).toBeVisible();
	});

	test('senza dati di radiazione il riquadro non compare', async ({ page }) => {
		await mockApi(page, { solar: null });
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Fotovoltaico')).toHaveCount(0);
	});
});

test.describe('cielo', () => {
	test('mette in cima il tramonto e mostra gli ingredienti della notte', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Cielo')).toBeVisible();
		await expect(page.getByText('Tramonto spettacolare verso le 20:00')).toBeVisible();
		await expect(page.getByText('30% di nuvole, luna al 60%')).toBeVisible();
	});

	test('cede il titolo alla notte quando è lei la notevole', async ({ page }) => {
		// Senza questa regola una notte ottima sotto un tramonto ordinario
		// resterebbe invisibile.
		await mockApi(page, {
			sky: {
				sunset: { at: `${new Date().toISOString().slice(0, 10)}T20:00`, score: 10, level: 'plain' },
				sunrise: null,
				stargazing: { score: 92, level: 'excellent', cloud_cover: 5, moon_illumination: 4 },
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Notte ottima per le stelle')).toBeVisible();
		await expect(page.getByText('cielo terso, luna quasi nuova')).toBeVisible();
	});

	test('senza nuvolosità per quota il riquadro non compare', async ({ page }) => {
		await mockApi(page, { sky: null });
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Cielo')).toHaveCount(0);
	});
});

test.describe('mare', () => {
	test('sulla costa mostra acqua, onda e provenienza', async ({ page }) => {
		await mockApi(page, {
			sea: {
				sea_temperature: 24.6,
				wave_height: 0.32,
				wave_direction: 110,
				wave_period: 4.2,
				swell_height: 0.2,
				state: 'calm',
				max_wave_24h: 0.41,
				max_wave_at: `${new Date().toISOString().slice(0, 10)}T18:00`,
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Mare', { exact: true })).toBeVisible();
		await expect(page.getByText('Acqua a 25°, mare calmo')).toBeVisible();
		await expect(page.getByText('da E')).toBeVisible();
	});

	test('avvisa quando il mare peggiora nel pomeriggio', async ({ page }) => {
		await mockApi(page, {
			sea: {
				sea_temperature: 23,
				wave_height: 0.3,
				wave_direction: 200,
				wave_period: 5,
				swell_height: 0.2,
				state: 'calm',
				max_wave_24h: 1.8,
				max_wave_at: `${new Date().toISOString().slice(0, 10)}T17:00`,
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText(/Verso le 17:00 diventa mosso/)).toBeVisible();
	});

	test('nell entroterra il riquadro non compare', async ({ page }) => {
		// Il modello d'onda si auto-esclude: il backend non manda il blocco.
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Mare', { exact: true })).toHaveCount(0);
	});
});

test.describe('buona giornata per…', () => {
	test('elenca le attività con il punteggio e il fattore che lo limita', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Buona giornata per…')).toBeVisible();
		// La migliore apre il riquadro, in minuscolo dentro la frase.
		await expect(page.getByText('andare in bici: condizioni ottime')).toBeVisible();

		// La riga va cercata nel suo elemento: «62» da solo comparirebbe anche
		// altrove sulla dashboard (il picco dei pollini, per dirne una).
		const corsa = page.getByRole('listitem').filter({ hasText: 'Correre' });
		await expect(corsa).toContainText('62');
		// Il numero da solo non dice niente: accanto c'è il perché.
		await expect(corsa).toContainText('limita temperatura');
	});

	test('di sera dichiara che la finestra è quella di domani', async ({ page }) => {
		const domani = new Date();
		domani.setDate(domani.getDate() + 1);
		const date = domani.toISOString().slice(0, 10);

		await mockApi(page, {
			activities: {
				date,
				from: `${date}T08:00`,
				to: `${date}T19:00`,
				activities: [{ id: 'running', label: 'Correre', score: 90, limiting: null }],
			},
		});
		await page.goto('/');
		await openSection(page, 'Per te');

		await expect(page.getByText('Buona giornata per…')).toBeVisible();
		await expect(page.getByText('domani', { exact: true })).toBeVisible();
	});

	test('senza ore diurne davanti il riquadro non compare', async ({ page }) => {
		await mockApi(page, { activities: null });
		await page.goto('/');
		await openSection(page, 'Per te');
		await expect(page.getByText('Buona giornata per…')).toHaveCount(0);
	});
});

test.describe('dettaglio orario', () => {
	test('un click su una cella di pioggia apre il modale con il selettore di metrica', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Settimana');

		await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
		// Il terzo giorno della fixture è quello piovoso (80%, 8.4 mm).
		await page.getByText('80%').first().click();

		await expect(page.getByRole('dialog')).toBeVisible();

		// Il selettore è un button con aria-haspopup="listbox": aprendolo si
		// devono vedere le metriche del registry.
		const selettore = page.getByRole('dialog').getByRole('button', { expanded: false }).first();
		await selettore.click();
		await expect(page.getByRole('option')).toHaveCount(6);
	});

	test('la metrica temporali mostra indice, CAPE e probabilità di tuono', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Settimana');

		await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
		await page.getByText('80%').first().click();
		await expect(page.getByRole('dialog')).toBeVisible();

		const selettore = page.getByRole('dialog').getByRole('button', { expanded: false }).first();
		await selettore.click();
		await page.getByRole('option', { name: 'Temporali' }).click();

		await expect(page.getByText(/Indice 63\/100/)).toBeVisible();
		await expect(page.getByText(/CAPE 1800 J\/kg/)).toBeVisible();
		await expect(page.getByText('Probabilità di tuono')).toBeVisible();
	});

	test('senza indici convettivi la metrica lo dichiara invece di disegnare zero', async ({ page }) => {
		// Uno zero direbbe «nessun temporale», la verità è «non lo sappiamo».
		await mockApi(page, { withoutStorm: true });
		await page.goto('/');
		await openSection(page, 'Settimana');

		await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
		await page.getByText('80%').first().click();

		const selettore = page.getByRole('dialog').getByRole('button', { expanded: false }).first();
		await selettore.click();
		await page.getByRole('option', { name: 'Temporali' }).click();

		await expect(page.getByText(/Indici convettivi non disponibili/)).toBeVisible();
	});

	test('il modale si chiude con Escape', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');
		await openSection(page, 'Settimana');

		await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
		await page.getByText('80%').first().click();
		await expect(page.getByRole('dialog')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog')).toHaveCount(0);
	});
});

test.describe('allerte meteo', () => {
	test('un allerta attiva compare sopra al meteo con il badge nell header', async ({ page }) => {
		await mockApi(page, {
			alerts: [
				{
					id: 'weatherkit:lombardia-severe-1',
					areaName: 'Lombardia',
					certainty: 'likely',
					description: 'Allerta arancione per temporali forti sulla Lombardia occidentale.',
					effectiveTime: new Date(Date.now() - 3600_000).toISOString(),
					expireTime: new Date(Date.now() + 6 * 3600_000).toISOString(),
					severity: 'severe',
					event: 'Thunderstorm',
					headline: 'Temporali forti',
					providerSource: 'weatherkit',
				},
			],
		});
		await page.goto('/');

		await expect(page.getByText(/Temporali forti|Thunderstorm/).first()).toBeVisible();
	});

	test('senza allerte non compare nessun banner', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

		await dashboardReady(page);
		await expect(page.getByText(/allerta/i)).toHaveCount(0);
	});
});

test.describe('sezioni della dashboard', () => {
	/*
	  Il riordino della dashboard, verificato dal lato dell'utente: che la zona
	  a colpo d'occhio non costi un clic, che le sezioni siano navigabili e che
	  quella aperta stia nell'URL. Gli altri scenari di questo file attraversano
	  le sezioni per arrivare al contenuto che verificano; qui la navigazione è
	  il soggetto.
	*/

	test('la zona a colpo d occhio sta fuori dalle sezioni', async ({ page }) => {
		// Meteo di adesso e nowcast si vedono senza toccare niente: se piove
		// fra dodici minuti non deve costare un clic saperlo.
		await mockApi(page, { rainStartsInMinutes: 12 });
		await page.goto('/');

		await expect(page.getByText('Percepita: 25°C')).toBeVisible();
		await expect(page.getByText(/Inizia fra 1[12] minuti/)).toBeVisible();
		await expect(page.getByText('Sole & Vento')).toBeVisible();
	});

	test('all arrivo si apre Oggi e le altre sezioni restano chiuse', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

		await expect(page.getByRole('tab', { name: /^Oggi/ })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('Andamento orario')).toBeVisible();
		await expect(page.getByText('Prossimi 6 giorni')).toHaveCount(0);
		await expect(page.getByText('Fonti contribuenti')).toHaveCount(0);
	});

	test('la sezione scelta finisce nell URL e sopravvive al ricaricamento', async ({ page }) => {
		// È quello che rende una sezione condivisibile per link: senza, il
		// ricaricamento riporterebbe sempre su «Oggi».
		await mockApi(page);
		await page.goto('/');

		await openSection(page, 'Per te');
		await expect(page).toHaveURL(/#perte$/);

		await page.reload();
		await expect(page.getByRole('tab', { name: /^Per te/ })).toHaveAttribute('aria-selected', 'true');
	});

	test('un ancora verso una sezione che la località non ha ricade su Oggi', async ({ page }) => {
		// Milano non ha il mare, e un link che punta a una sezione inesistente
		// deve aprire qualcosa, non il vuoto.
		await mockApi(page);
		await page.goto('/#inventata');

		await expect(page.getByRole('tab', { name: /^Oggi/ })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('Andamento orario')).toBeVisible();
	});

	test('le frecce della tastiera scorrono le sezioni', async ({ page }) => {
		// Nel pattern tablist ci si sposta con le frecce: senza, arrivare al
		// contenuto da tastiera costerebbe un Tab per ogni linguetta.
		await mockApi(page);
		await page.goto('/');

		await page.getByRole('tab', { name: /^Oggi/ }).focus();
		await page.keyboard.press('ArrowRight');

		await expect(page.getByRole('tab', { name: /^Settimana/ })).toHaveAttribute('aria-selected', 'true');
		await expect(page.getByText('Prossimi 6 giorni')).toBeVisible();
	});

	test('il contatore della linguetta dice quante schede ci sono davvero', async ({ page }) => {
		// Se il contatore e la griglia divergessero, il badge prometterebbe
		// schede che poi non ci sono.
		await mockApi(page);
		await page.goto('/');

		const perTe = page.getByRole('tab', { name: /^Per te/ });
		await perTe.click();

		// Milano di settembre: aria, pollini, orto, fotovoltaico, cielo e
		// attività. Niente neve, niente mare.
		await expect(perTe).toContainText('6');
		await expect(page.locator('#dashboard-panel-perte h3')).toHaveCount(6);
	});
});
