/**
 * La versione mostrata dal web, e la sua coerenza con la sorgente di verità.
 *
 * Gemella di `backend/__tests__/version.test.ts`: `lib/version.ts` è un file
 * generato da `version.json`, e un file generato è esattamente il tipo di file
 * che qualcuno modifica a mano — di solito per «sistemare» un numero, che è il
 * modo in cui il derivato e la sorgente iniziano a raccontare due storie.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { render, screen } from '@testing-library/react';

import AppVersion from '@/components/AppVersion';
import { APP_BUILD, APP_VERSION, APP_VERSION_FULL } from '@/lib/version';

/** `version.json` in radice del repository: due livelli sopra `frontend-web`. */
const source: { version: string; build: number } = JSON.parse(
	readFileSync(join(__dirname, '..', '..', 'version.json'), 'utf-8')
);

describe('lib/version', () => {
	it('è generato dalla stessa version.json del backend e di iOS', () => {
		expect(APP_VERSION).toBe(source.version);
		expect(APP_BUILD).toBe(source.build);
		expect(APP_VERSION_FULL).toBe(`${source.version}+${source.build}`);
	});

	it('non è più fermo a 1.0', () => {
		// Il difetto da cui nasce tutto il meccanismo: la versione dichiarata
		// non si era mai mossa in centoquattordici commit.
		expect(APP_VERSION).not.toBe('1.0.0');
		expect(APP_BUILD).toBeGreaterThan(1);
	});
});

describe('AppVersion', () => {
	it('scrive versione e build', () => {
		render(<AppVersion />);
		expect(screen.getByText(/Smart Meteo v/)).toHaveTextContent(
			`Smart Meteo v${APP_VERSION} · build ${APP_BUILD}`
		);
	});

	it('mette la coppia completa nel title, per chi deve copiarla in una segnalazione', () => {
		render(<AppVersion />);
		expect(screen.getByTitle(`Smart Meteo ${APP_VERSION} (build ${APP_BUILD})`)).toBeInTheDocument();
	});
});
