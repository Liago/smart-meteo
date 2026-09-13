import { expect, test } from '@playwright/test';
import { mockApi, seedHomeLocation, startAsNewVisitor } from './fixtures/api';

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

	await expect(page.getByText('Fonti contribuenti')).toBeVisible();
	await expect(page.getByText('5 attive')).toBeVisible();
	await expect(page.getByText('Apple WeatherKit')).toBeVisible();
});

test('mostra i sette giorni di previsione', async ({ page }) => {
	await mockApi(page);
	await page.goto('/');

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

		await expect(page.getByText('Fonti in disaccordo')).toBeVisible();
		await expect(page.getByText(/fra 18° e 26°/)).toBeVisible();
	});

	test('senza il blocco confidence la dashboard resta usabile', async ({ page }) => {
		// Succede leggendo una riga di cache scritta prima della Fase 6A.
		await mockApi(page, { confidence: null });
		await page.goto('/');

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

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		await expect(page.getByText(/prossima ora/)).toHaveCount(0);
	});
});

test.describe('banda di incertezza', () => {
	test('il grafico orario disegna la banda quando i percentili ci sono', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		// La banda è l'unico path decorativo del grafico orario.
		const banda = page.locator('svg path[aria-hidden="true"]');
		await expect(banda.first()).toBeAttached();
	});

	test('senza percentili il grafico resta quello di prima', async ({ page }) => {
		await mockApi(page, { withoutBand: true });
		await page.goto('/');

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		await expect(page.locator('svg path[aria-hidden="true"]')).toHaveCount(0);
	});
});

test.describe('pollini', () => {
	test('mostra le specie con la più rilevante in cima', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

		await expect(page.getByText('Pollini')).toBeVisible();
		await expect(page.getByText(/Oggi soprattutto graminacee/i)).toBeVisible();
		await expect(page.getByText('Molto alto')).toBeVisible();
	});

	test('fuori dalla copertura del modello il pannello non compare', async ({ page }) => {
		await mockApi(page, { withoutPollen: true });
		await page.goto('/');

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
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

		// "al suolo" non è pedanteria: fra la superficie e i due metri ci sono
		// tre o quattro gradi, e il backend le giudica con soglie diverse.
		await expect(page.getByText('Gelata probabile, minima al suolo -1° alle 06:00')).toBeVisible();
		await expect(page.getByText('Neve al suolo')).toHaveCount(0);
	});

	test('in una giornata mite il riquadro non compare', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		await expect(page.getByText('Neve e gelate')).toHaveCount(0);
	});
});

test.describe('dettaglio orario', () => {
	test('un click su una cella di pioggia apre il modale con il selettore di metrica', async ({ page }) => {
		await mockApi(page);
		await page.goto('/');

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

		await expect(page.getByText('Fonti contribuenti')).toBeVisible();
		await expect(page.getByText(/allerta/i)).toHaveCount(0);
	});
});
