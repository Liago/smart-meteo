/**
 * Il meccanismo di versioning, verificato invece che documentato.
 *
 * `version.json` in radice è la sorgente di verità e cinque file ne derivano:
 * tre `package.json`, il progetto Xcode e i due moduli TypeScript generati.
 * Un meccanismo del genere si rompe sempre nello stesso modo — qualcuno
 * modifica il derivato invece della sorgente, o la sorgente senza rilanciare
 * `sync` — e si rompe in silenzio: il numero sbagliato è comunque un numero
 * plausibile, quindi non lo nota nessuno finché non serve.
 *
 * Qui il controllo gira a ogni `npm test` del backend, e la stessa asserzione
 * è nella suite web: il disallineamento diventa un test rosso prima del
 * commit invece di una versione falsa in produzione.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { APP_BUILD, APP_VERSION, APP_VERSION_FULL } from '../version';

const REPO_ROOT = join(__dirname, '..', '..');

/** `version.json`, letto dal disco e non importato: è un dato, non un modulo. */
function readSource(): { version: string; build: number } {
	return JSON.parse(readFileSync(join(REPO_ROOT, 'version.json'), 'utf-8'));
}

describe('sorgente di verità', () => {
	it('dichiara una versione semantica e una build intera positiva', () => {
		const source = readSource();
		expect(source.version).toMatch(/^\d+\.\d+\.\d+$/);
		expect(Number.isInteger(source.build)).toBe(true);
		expect(source.build).toBeGreaterThanOrEqual(1);
	});

	it('è la versione compilata nel modulo del backend', () => {
		const source = readSource();
		expect(APP_VERSION).toBe(source.version);
		expect(APP_BUILD).toBe(source.build);
	});

	it('compone la versione completa con i metadati di build', () => {
		expect(APP_VERSION_FULL).toBe(`${APP_VERSION}+${APP_BUILD}`);
	});
});

describe('derivati', () => {
	/**
	 * Delegato allo script vero invece di riscriverne il confronto qui.
	 *
	 * Una seconda implementazione del controllo sarebbe una seconda cosa da
	 * tenere allineata: passerebbe mentre `sync` scrive qualcos'altro, che è
	 * esattamente il difetto che questo test esiste per escludere.
	 */
	it('sono tutti allineati a version.json (`npm run version:check`)', () => {
		expect(() =>
			execFileSync('node', [join(REPO_ROOT, 'scripts', 'version.mjs'), 'check'], {
				cwd: REPO_ROOT,
				encoding: 'utf-8',
				stdio: 'pipe',
			})
		).not.toThrow();
	});

	it('portano la stessa versione nel package.json del backend', () => {
		const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
		expect(pkg.version).toBe(APP_VERSION);
	});
});
