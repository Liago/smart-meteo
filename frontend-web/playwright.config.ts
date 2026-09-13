import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione E2E.
 *
 * L'API del backend non viene mai contattata: ogni scenario intercetta le
 * chiamate con `page.route` (vedi `e2e/fixtures/api.ts`). I test verificano
 * quindi il comportamento del frontend a parità di risposta, senza dipendere da
 * chiavi API, rete o meteo reale.
 *
 * Le variabili Supabase sono fittizie ma sintatticamente valide: il middleware
 * di Next costruisce il client a ogni richiesta e senza quei valori risponde
 * 500 prima di arrivare alla pagina.
 */
export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
	use: {
		baseURL: 'http://localhost:3100',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		// Dove i browser di Playwright non sono scaricabili (sandbox, runner con
		// un Chromium di sistema), si punta al binario esistente invece di
		// pretendere `npx playwright install`.
		...(process.env.CHROMIUM_PATH
			? { launchOptions: { executablePath: process.env.CHROMIUM_PATH } }
			: {}),
	},
	projects: [
		{ name: 'chromium', use: { ...devices['Desktop Chrome'] } },
		// Viewport mobile con touch, su Chromium: il descrittore 'iPhone 14'
		// implicherebbe WebKit, che non è installato in tutti gli ambienti. Dove
		// WebKit c'è, aggiungere un terzo progetto con devices['iPhone 14'].
		{ name: 'mobile', use: { ...devices['Pixel 7'] } },
	],
	webServer: {
		command: 'npx next dev --port 3100',
		port: 3100,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		env: {
			NEXT_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co',
			NEXT_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key',
			NEXT_PUBLIC_API_URL: 'http://localhost:3999',
		},
	},
});
