import { expect, test } from '@playwright/test';
import { dashboardReady, mockApi, seedHomeLocation } from './fixtures/api';

/**
 * Accesso e pagine protette.
 *
 * La sessione Supabase è verificata dal middleware di Next, cioè **server-side**:
 * `page.route` non può intercettarla, e in questo ambiente le variabili Supabase
 * sono fittizie. Gli scenari coprono quindi il comportamento da ospite — che è
 * anche quello che un utente incontra per primo — mentre la pagina fonti
 * autenticata resta fuori dalla portata degli E2E finché non c'è un progetto
 * Supabase di test.
 */

test.beforeEach(async ({ page }) => {
	await seedHomeLocation(page);
	await mockApi(page);
});

test('la dashboard è accessibile senza account', async ({ page }) => {
	await page.goto('/');

	await dashboardReady(page);
	await expect(page.getByRole('link', { name: 'Accedi' })).toBeVisible();
});

test('la pagina fonti richiede autenticazione e reindirizza al login', async ({ page }) => {
	await page.goto('/sources');

	await expect(page).toHaveURL(/\/login/);
});

test('la pagina di login mostra il form email e password', async ({ page }) => {
	await page.goto('/login');

	await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
	await expect(page.locator('input[type="password"]')).toBeVisible();
	await expect(page.getByRole('button', { name: /accedi|entra|login/i }).first()).toBeVisible();
});

test('dal login si torna alla dashboard', async ({ page }) => {
	await page.goto('/login');

	await page.getByRole('link').first().click();

	await expect(page).toHaveURL('/');
});
