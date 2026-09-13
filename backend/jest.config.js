/**
 * Configurazione Jest del backend.
 *
 * `module: commonjs` è imposto qui e non nel tsconfig del progetto: il codice di
 * produzione compila con `nodenext`, ma Jest esegue moduli CommonJS.
 *
 * `isolatedModules` tiene il type-check fuori dal ciclo dei test — lo fa già
 * `npm run typecheck` sull'intero progetto, e ripeterlo a ogni file
 * raddoppierebbe i tempi senza aggiungere copertura.
 */
/** @type {import('jest').Config} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	roots: ['<rootDir>/__tests__'],
	testMatch: ['**/*.test.ts'],
	clearMocks: true,
	setupFiles: ['<rootDir>/jest.setup.ts'],
	transform: {
		'^.+\\.ts$': [
			'ts-jest',
			{
				tsconfig: {
					module: 'commonjs',
					target: 'es2022',
					esModuleInterop: true,
					strict: true,
					skipLibCheck: true,
					isolatedModules: true,
				},
			},
		],
	},
};
