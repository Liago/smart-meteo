#!/usr/bin/env node
/**
 * Versioning unico di Smart Meteo.
 *
 * Il progetto ha tre piattaforme e cinque posti che dichiarano una versione:
 * tre `package.json`, il `project.pbxproj` di Xcode e — da qui — due moduli
 * generati che backend e web leggono a runtime. Tenerli allineati a mano
 * significa dimenticarne uno, e l'app è rimasta a «1.0 build 1» per
 * centoquattordici commit proprio perché nessuno di quei posti era il posto
 * giusto dove guardare.
 *
 * La sorgente di verità è `version.json` in radice, e tutto il resto è
 * *derivato*: si modifica con i comandi qui sotto, mai a mano.
 *
 *   npm run version:show              stampa versione e build correnti
 *   npm run version:bump -- minor     1.1.0 -> 1.2.0, build +1
 *   npm run version:build             solo build +1 (nuovo archivio, stesso rilascio)
 *   npm run version:set -- 2.0.0      versione esplicita, build +1
 *   npm run version:sync              riscrive i derivati da version.json
 *   npm run version:check             fallisce se un derivato è fuori sincrono
 *
 * `check` è il pezzo che rende il meccanismo affidabile invece che
 * volontario: gira nelle suite di backend e web, quindi un file derivato
 * modificato a mano — o un `version.json` cambiato senza `sync` — fa fallire
 * i test invece di arrivare in produzione a raccontare una versione falsa.
 *
 * Due scelte deliberate:
 *
 * - **la build non si azzera a ogni versione.** È un contatore monotono per
 *   tutta la vita dell'app, come richiede App Store Connect: 1.2.0 (build 7)
 *   segue 1.1.0 (build 6). Azzerarla a 1 a ogni `minor` farebbe rifiutare
 *   l'archivio come «già caricato».
 * - **niente incremento automatico dentro Xcode.** Una fase di build che
 *   incrementa `CURRENT_PROJECT_VERSION` a ogni compilazione locale sporca il
 *   diff a ogni ⌘R e fa divergere la build iOS da quelle degli altri due
 *   client. Qui la build cambia quando lo si chiede, in un commit che si vede.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, 'version.json');

const PBXPROJ = join(ROOT, 'frontend-ios/smart-meteo/smart-meteo.xcodeproj/project.pbxproj');

// --- Sorgente di verità ------------------------------------------------------

/** @typedef {{ version: string, build: number }} AppVersion */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** @returns {AppVersion} */
function readSource() {
	const raw = JSON.parse(readFileSync(SOURCE, 'utf-8'));
	if (typeof raw.version !== 'string' || !SEMVER.test(raw.version)) {
		throw new Error(`version.json: "version" deve essere x.y.z, trovato ${JSON.stringify(raw.version)}`);
	}
	if (!Number.isInteger(raw.build) || raw.build < 1) {
		throw new Error(`version.json: "build" deve essere un intero >= 1, trovato ${JSON.stringify(raw.build)}`);
	}
	return { version: raw.version, build: raw.build };
}

/** @param {AppVersion} v */
function writeSource(v) {
	writeFileSync(SOURCE, `${JSON.stringify(v, null, 2)}\n`, 'utf-8');
}

/**
 * `1.1.0+2`: la notazione SemVer per i metadati di build.
 *
 * Serve nei log e nelle segnalazioni di problemi, dove «1.1.0» da solo non
 * distingue l'archivio che l'utente ha installato da quello successivo.
 *
 * @param {AppVersion} v
 */
const fullVersion = (v) => `${v.version}+${v.build}`;

// --- Derivati ----------------------------------------------------------------

/**
 * Un derivato sa fare due cose sul contenuto di un file: dire com'è *atteso*
 * e riscriverlo. `sync` scrive, `check` confronta — stessa funzione, quindi
 * non possono divergere, che è il modo in cui i controlli di coerenza
 * smettono di controllare.
 *
 * @typedef {{ path: string, label: string, render: (text: string, v: AppVersion) => string }} Target
 */

/**
 * `package.json`: solo `x.y.z`.
 *
 * Il numero di build non ci entra: npm accetta i metadati SemVer (`1.1.0+2`)
 * ma mezzo ecosistema li tratta come parte della versione, e questi tre
 * pacchetti sono privati — la build vive in `version.json` e nei due moduli
 * generati, che è dove viene letta.
 *
 * @param {string} path
 * @param {string} label
 * @returns {Target}
 */
function packageJson(path, label) {
	return {
		path,
		label,
		render(text, v) {
			// Riscrittura testuale e non `JSON.parse` + `stringify`: il secondo
			// normalizzerebbe indentazione e ordine delle chiavi dell'intero
			// file, producendo un diff enorme a ogni bump.
			const pattern = /^(\s*"version"\s*:\s*)"[^"]*"/m;
			if (!pattern.test(text)) {
				throw new Error(`${label}: campo "version" non trovato`);
			}
			return text.replace(pattern, `$1"${v.version}"`);
		},
	};
}

/**
 * `package-lock.json`: la versione compare due volte, in cima e in
 * `packages[""]`.
 *
 * Sono generati da npm e verrebbe da ignorarli, ma npm li riallinea al
 * `package.json` **al primo `npm install`**: senza toccarli qui, ogni bump
 * lascia tre file che cambiano da soli nel commit successivo di qualcun
 * altro, in mezzo a modifiche che non c'entrano.
 *
 * Riscrittura via `JSON.parse`/`stringify` e non testuale: npm scrive
 * esattamente `JSON.stringify(_, null, 2)` più il newline finale — verificato
 * su tutti e tre i lockfile del repository — quindi il round-trip è fedele e
 * il diff resta di due righe.
 *
 * @param {string} path
 * @param {string} label
 * @returns {Target}
 */
function packageLockJson(path, label) {
	return {
		path,
		label,
		render(text, v) {
			const lock = JSON.parse(text);
			lock.version = v.version;
			if (lock.packages && lock.packages['']) {
				lock.packages[''].version = v.version;
			}
			return `${JSON.stringify(lock, null, 2)}\n`;
		},
	};
}

/**
 * Modulo TypeScript generato, uguale per backend e web.
 *
 * Generato e versionato invece di letto a runtime da `version.json`: il
 * backend gira come Netlify Function impacchettata da esbuild e il web come
 * bundle Next, e in nessuno dei due il file in radice esiste ancora sul disco
 * al momento della richiesta. Una costante compilata dentro il bundle non può
 * mancare.
 *
 * @param {string} path
 * @param {string} label
 * @returns {Target}
 */
function generatedModule(path, label) {
	return {
		path,
		label,
		render(_text, v) {
			return `/**
 * Versione dell'applicazione. FILE GENERATO — non modificare a mano.
 *
 * Sorgente di verità: \`version.json\` in radice del repository.
 * Si rigenera con \`npm run version:sync\` (o con un qualsiasi \`version:bump\`,
 * \`version:build\`, \`version:set\`), e \`npm run version:check\` fallisce se
 * questo file è stato toccato a mano.
 */

/** Versione semantica pubblica, es. \`1.1.0\`. */
export const APP_VERSION = '${v.version}';

/** Numero di build monotono, es. \`2\`. */
export const APP_BUILD = ${v.build};

/** Versione completa con i metadati di build, es. \`1.1.0+2\`. */
export const APP_VERSION_FULL = '${fullVersion(v)}';
`;
		},
	};
}

/**
 * Il progetto Xcode.
 *
 * `GENERATE_INFOPLIST_FILE = YES` su entrambi i target, quindi
 * `CFBundleShortVersionString` e `CFBundleVersion` nascono da queste due
 * impostazioni di build e gli `Info.plist` nel repository non le contengono:
 * qui c'è tutto, e sono quattro blocchi (app e widget × Debug e Release) che
 * devono muoversi insieme — un widget fermo a una build precedente è un
 * archivio rifiutato.
 *
 * @returns {Target}
 */
function xcodeProject() {
	return {
		path: PBXPROJ,
		label: 'frontend-ios (project.pbxproj)',
		render(text, v) {
			const settings = [
				[/(\bMARKETING_VERSION = )[^;]*(;)/g, v.version],
				[/(\bCURRENT_PROJECT_VERSION = )[^;]*(;)/g, String(v.build)],
			];

			let out = text;
			for (const [pattern, value] of settings) {
				const found = out.match(pattern);
				// Un pbxproj ristrutturato che non contiene più quelle chiavi
				// passerebbe in silenzio, e il meccanismo smetterebbe di
				// toccare iOS senza che nessuno se ne accorga fino al rilascio.
				if (!found || found.length === 0) {
					throw new Error(`project.pbxproj: nessuna occorrenza di ${pattern.source}`);
				}
				out = out.replace(pattern, `$1${value}$2`);
			}
			return out;
		},
	};
}

/** @type {Target[]} */
const TARGETS = [
	packageJson(join(ROOT, 'package.json'), 'package.json (radice)'),
	packageJson(join(ROOT, 'backend/package.json'), 'backend/package.json'),
	packageJson(join(ROOT, 'frontend-web/package.json'), 'frontend-web/package.json'),
	packageLockJson(join(ROOT, 'package-lock.json'), 'package-lock.json (radice)'),
	packageLockJson(join(ROOT, 'backend/package-lock.json'), 'backend/package-lock.json'),
	packageLockJson(join(ROOT, 'frontend-web/package-lock.json'), 'frontend-web/package-lock.json'),
	generatedModule(join(ROOT, 'backend/version.ts'), 'backend/version.ts'),
	generatedModule(join(ROOT, 'frontend-web/lib/version.ts'), 'frontend-web/lib/version.ts'),
	xcodeProject(),
];

/**
 * @param {Target} target
 * @returns {string}
 */
function currentText(target) {
	try {
		return readFileSync(target.path, 'utf-8');
	} catch (err) {
		// I moduli generati possono non esistere ancora al primo `sync`.
		if (/** @type {NodeJS.ErrnoException} */ (err).code === 'ENOENT') return '';
		throw err;
	}
}

// --- Comandi -----------------------------------------------------------------

/**
 * @param {AppVersion} v
 * @param {{ quiet?: boolean }} [opts]
 * @returns {string[]} etichette dei file effettivamente riscritti
 */
function sync(v, opts = {}) {
	/** @type {string[]} */
	const changed = [];
	for (const target of TARGETS) {
		const before = currentText(target);
		const after = target.render(before, v);
		if (after === before) continue;
		writeFileSync(target.path, after, 'utf-8');
		changed.push(target.label);
	}
	if (!opts.quiet) {
		for (const label of changed) console.log(`  aggiornato  ${label}`);
		if (changed.length === 0) console.log('  tutto già allineato');
	}
	return changed;
}

/**
 * @param {AppVersion} v
 * @returns {string[]} etichette dei file fuori sincrono
 */
function drifted(v) {
	return TARGETS
		.filter((target) => {
			const text = currentText(target);
			return text === '' || target.render(text, v) !== text;
		})
		.map((target) => target.label);
}

/**
 * @param {string} version
 * @param {'major'|'minor'|'patch'} level
 */
function bumpSemver(version, level) {
	const m = version.match(SEMVER);
	if (!m) throw new Error(`versione non valida: ${version}`);
	const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
	if (level === 'major') return `${major + 1}.0.0`;
	if (level === 'minor') return `${major}.${minor + 1}.0`;
	return `${major}.${minor}.${patch + 1}`;
}

/** @param {AppVersion} v */
function report(v) {
	console.log(`Smart Meteo ${v.version} (build ${v.build})  —  ${fullVersion(v)}`);
}

const USAGE = `Uso: node scripts/version.mjs <comando>

  show                 stampa versione e build correnti
  sync                 riscrive i file derivati da version.json
  check                esce con 1 se un file derivato è fuori sincrono
  bump major|minor|patch   incrementa la versione e la build
  build                incrementa solo la build
  set <x.y.z>          imposta la versione e incrementa la build
`;

function main() {
	const [command, argument] = process.argv.slice(2);
	const source = readSource();

	switch (command) {
		case 'show':
		case undefined:
			report(source);
			return;

		case 'sync': {
			report(source);
			sync(source);
			return;
		}

		case 'check': {
			const out = drifted(source);
			if (out.length > 0) {
				console.error(`Versione fuori sincrono rispetto a version.json (${fullVersion(source)}):`);
				for (const label of out) console.error(`  - ${label}`);
				console.error('\nEsegui `npm run version:sync`.');
				process.exitCode = 1;
				return;
			}
			console.log(`Versione allineata ovunque: ${fullVersion(source)}`);
			return;
		}

		case 'bump':
		case 'build':
		case 'set': {
			/** @type {AppVersion} */
			let next;
			if (command === 'build') {
				next = { version: source.version, build: source.build + 1 };
			} else if (command === 'set') {
				if (!argument || !SEMVER.test(argument)) {
					console.error('`set` richiede una versione x.y.z, es. `npm run version:set -- 2.0.0`');
					process.exitCode = 1;
					return;
				}
				next = { version: argument, build: source.build + 1 };
			} else {
				if (argument !== 'major' && argument !== 'minor' && argument !== 'patch') {
					console.error('`bump` richiede major|minor|patch, es. `npm run version:bump -- minor`');
					process.exitCode = 1;
					return;
				}
				next = { version: bumpSemver(source.version, argument), build: source.build + 1 };
			}

			writeSource(next);
			console.log(`${fullVersion(source)}  ->  ${fullVersion(next)}`);
			sync(next);
			console.log('\nRicordati di aggiornare CHANGELOG.md e di committare i file derivati.');
			return;
		}

		default:
			console.error(`Comando sconosciuto: ${command}\n\n${USAGE}`);
			process.exitCode = 1;
	}
}

main();
