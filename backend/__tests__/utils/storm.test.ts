import {
	CIN_MIN_FACTOR,
	cinFactor,
	stormIndex,
	stormLevel,
} from '../../utils/storm';

/**
 * Indice di rischio temporali.
 *
 * Le soglie sono convenzioni operative dei servizi meteorologici, non scelte
 * arbitrarie: i test le fissano perché una semplificazione futura non le
 * sposti senza accorgersene. Il caso che conta davvero è l'ultimo: energia
 * abbondante sotto un coperchio non fa zero.
 */

describe('stormIndex da CAPE', () => {
	it('con aria stabile non produce rischio', () => {
		expect(stormIndex({ cape: 0 })).toBe(0);
		expect(stormIndex({ cape: 120 })).toBe(10);
	});

	it('rispetta le soglie operative', () => {
		expect(stormIndex({ cape: 300 })).toBe(25);
		expect(stormIndex({ cape: 1000 })).toBe(50);
		expect(stormIndex({ cape: 2500 })).toBe(75);
		expect(stormIndex({ cape: 4000 })).toBe(100);
	});

	it('interpola fra le soglie invece di fare gradini', () => {
		// 990 e 1010 J/kg non sono due mondi diversi.
		expect(stormIndex({ cape: 650 })).toBe(38);
		expect(stormIndex({ cape: 1750 })).toBe(63);
	});

	it('non supera il massimo con valori estremi', () => {
		expect(stormIndex({ cape: 9000 })).toBe(100);
	});

	it('tratta un CAPE negativo da arrotondamento come zero', () => {
		expect(stormIndex({ cape: -3 })).toBe(0);
	});
});

describe('stormIndex da lifted index', () => {
	it('il segno è invertito: più negativo, più instabile', () => {
		expect(stormIndex({ lifted_index: 5 })).toBe(0);
		expect(stormIndex({ lifted_index: 0 })).toBe(25);
		expect(stormIndex({ lifted_index: -3 })).toBe(50);
		expect(stormIndex({ lifted_index: -6 })).toBe(75);
		expect(stormIndex({ lifted_index: -12 })).toBe(100);
	});
});

describe('stormIndex con entrambi gli indici', () => {
	it('li media, perché misurano la stessa instabilità', () => {
		// CAPE 1000 → 50, LI -6 → 75: la media smorza lo scarto di un singolo
		// campo del modello senza appiattire il segnale.
		expect(stormIndex({ cape: 1000, lifted_index: -6 })).toBe(63);
	});

	it('con uno solo dei due usa quello', () => {
		// Non tutti i modelli espongono entrambi i campi.
		expect(stormIndex({ cape: 1000, lifted_index: null })).toBe(50);
		expect(stormIndex({ cape: null, lifted_index: -3 })).toBe(50);
	});

	it('senza nessun indice non inventa un valore', () => {
		expect(stormIndex({})).toBeNull();
		expect(stormIndex({ cape: null, lifted_index: undefined })).toBeNull();
		// La sola CIN non dice niente: smorza qualcosa che non c'è.
		expect(stormIndex({ convective_inhibition: -150 })).toBeNull();
	});
});

describe('cinFactor', () => {
	it('sotto la soglia libera non smorza', () => {
		expect(cinFactor(0)).toBe(1);
		expect(cinFactor(-20)).toBe(1);
		expect(cinFactor(null)).toBe(1);
	});

	it('usa il modulo, perché i modelli non concordano sul segno', () => {
		// Alcuni danno la CIN negativa (è energia che manca), altri come modulo:
		// senza il valore assoluto metà delle fonti non verrebbe smorzata.
		expect(cinFactor(-120)).toBeCloseTo(cinFactor(120), 6);
	});

	it('smorza progressivamente, non a gradini', () => {
		const debole = cinFactor(60);
		const forte = cinFactor(160);
		expect(debole).toBeLessThan(1);
		expect(forte).toBeLessThan(debole);
	});

	it('non azzera mai il rischio', () => {
		// Il coperchio si rompe: riscaldamento pomeridiano, orografia, un fronte.
		expect(cinFactor(-800)).toBe(CIN_MIN_FACTOR);
		expect(cinFactor(-800)).toBeGreaterThan(0);
	});
});

describe('stormIndex smorzato dalla CIN', () => {
	it('energia abbondante sotto un coperchio resta un rischio, non uno zero', () => {
		const libero = stormIndex({ cape: 3000 });
		const inibito = stormIndex({ cape: 3000, convective_inhibition: -400 });

		expect(libero).toBeGreaterThan(inibito!);
		// Dichiarare "nessun rischio" su 3000 J/kg inibiti è il tipo di
		// previsione che fa male a chi va in montagna.
		expect(inibito).toBeGreaterThan(20);
	});

	it('una CIN trascurabile lascia l indice intatto', () => {
		expect(stormIndex({ cape: 2500, convective_inhibition: -10 })).toBe(75);
	});
});

describe('stormLevel', () => {
	it('classifica l indice in quattro fasce', () => {
		expect(stormLevel(0)).toBe('none');
		expect(stormLevel(24)).toBe('none');
		expect(stormLevel(25)).toBe('weak');
		expect(stormLevel(49)).toBe('weak');
		expect(stormLevel(50)).toBe('moderate');
		expect(stormLevel(74)).toBe('moderate');
		expect(stormLevel(75)).toBe('strong');
		expect(stormLevel(100)).toBe('strong');
	});

	it('senza indice non dichiara un livello', () => {
		expect(stormLevel(null)).toBe('none');
		expect(stormLevel(undefined)).toBe('none');
	});
});
