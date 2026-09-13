import { expect, test } from '@playwright/test';
import { mockApi, seedHomeLocation, startAsNewVisitor } from './fixtures/api';

/**
 * Ricerca località e gestione dei preferiti.
 *
 * Il geocoding Nominatim è intercettato: senza questo i test dipenderebbero da
 * un servizio pubblico esterno e dai suoi rate limit.
 */

test.beforeEach(async ({ page }) => {
	await seedHomeLocation(page);
	await mockApi(page);
});

test('digitando una città appaiono i suggerimenti', async ({ page }) => {
	await page.goto('/');

	await page.getByPlaceholder('Cerca una localita...').fill('Milano');

	// Il componente mostra solo la prima parte di `display_name`: "Milano",
	// non "Milano, Lombardia, Italia".
	await expect(page.getByRole('button', { name: 'Milano', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Milano Marittima', exact: true })).toBeVisible();
});

test('selezionando un suggerimento la dashboard passa a quella località', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByText('Fonti contribuenti')).toBeVisible();

	await page.getByPlaceholder('Cerca una localita...').fill('Milano');
	await page.getByRole('button', { name: 'Milano Marittima', exact: true }).click();

	// Il nome mostrato nella dashboard è quello scelto, non più quello di casa.
	await expect(page.getByText('Milano Marittima').first()).toBeVisible();
});

test('la ricerca si può svuotare', async ({ page }) => {
	await page.goto('/');

	const campo = page.getByPlaceholder('Cerca una localita...');
	await campo.fill('Milano');
	await expect(page.getByRole('button', { name: 'Milano Marittima', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Cancella ricerca' }).click();

	await expect(campo).toHaveValue('');
	await expect(page.getByRole('button', { name: 'Milano Marittima', exact: true })).toHaveCount(0);
});

test('una ricerca senza risultati non lascia suggerimenti a schermo', async ({ page }) => {
	await page.route(/nominatim\.openstreetmap\.org/, (route) => route.fulfill({ json: [] }));
	await page.goto('/');

	await page.getByPlaceholder('Cerca una localita...').fill('asdfghjkl');

	await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('senza una località selezionata il salvataggio è inerte', async ({ page }) => {
	// Il pulsante dipende dall'avere delle coordinate, non dall'essere
	// autenticati: resta visibile ma inerte, così si capisce che la funzione
	// esiste.
	//
	// Questo test prima girava con la località di casa già in localStorage e
	// asseriva «da ospite il salvataggio è disabilitato»: un comportamento che
	// il prodotto non ha mai avuto. Passava solo vincendo la corsa con
	// l'effetto che legge quella località, e falliva a intermittenza.
	await startAsNewVisitor(page);
	await page.goto('/');

	await expect(page.getByRole('button', { name: 'Salva nei preferiti' })).toBeDisabled();
});

test('da ospite si può comunque salvare nei preferiti, in locale', async ({ page }) => {
	// È il comportamento dichiarato: localStorage per gli ospiti, con
	// sincronizzazione su Supabase al login.
	await page.goto('/');

	const salva = page.getByRole('button', { name: 'Salva nei preferiti' });
	await expect(salva).toBeEnabled();
	await salva.click();

	// Il pulsante diventa quello per rimuovere: la località è nei preferiti.
	await expect(page.getByRole('button', { name: 'Rimuovi dai preferiti' })).toBeVisible();
});
