export function getMoonPhase(date: Date): string {
	let year = date.getFullYear();
	let month = date.getMonth() + 1;
	let day = date.getDate();

	if (month < 3) {
		year--;
		month += 12;
	}

	++month;

	let c = 365.25 * year;
	let e = 30.6 * month;
	let total = c + e + day - 694039.09; // jd is total days elapsed
	total /= 29.5305882; // divide by the moon cycle
	let phase = parseInt(total.toString()); // int(total) -> integer part
	total -= phase; // fractional part remains
	phase = Math.round(total * 8); // scale fraction to 0-8

	if (phase >= 8) phase = 0; // 0 and 8 are the same (New Moon)

	// 0 => New Moon
	// 1 => Waxing Crescent
	// 2 => First Quarter
	// 3 => Waxing Gibbous
	// 4 => Full Moon
	// 5 => Waning Gibbous
	// 6 => Last Quarter
	// 7 => Waning Crescent

	switch (phase) {
		case 0: return 'Luna Nuova';
		case 1: return 'Luna Crescente';
		case 2: return 'Primo Quarto';
		case 3: return 'Gibbosa Crescente';
		case 4: return 'Luna Piena';
		case 5: return 'Gibbosa Calante';
		case 6: return 'Ultimo Quarto';
		case 7: return 'Luna Calante';
		default: return 'Luna Nuova';
	}
}
