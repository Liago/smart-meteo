'use client';

import { useId } from 'react';
import type { AstronomyData } from '@/lib/types';

interface MoonCardProps {
	astronomy?: AstronomyData;
}

/**
 * Orario di un evento lunare.
 *
 * Il backend passa i valori delle fonti senza riscriverli: WWO li manda in ISO
 * con offset, WeatherKit in UTC con `Z`, WeatherAPI come "07:42 PM" convertito a
 * 24h. Si prova quindi il parsing come data e si ricade sui caratteri della
 * stringa quando non è una data valida, invece di mostrare "Invalid Date".
 */
export function formatMoonTime(iso?: string): string | null {
	if (!iso) return null;
	const d = new Date(iso);
	if (!isNaN(d.getTime())) {
		return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
	}
	const match = iso.match(/(\d{1,2}):(\d{2})/);
	return match ? `${match[1]!.padStart(2, '0')}:${match[2]}` : null;
}

/**
 * Luna crescente o calante, dal nome della fase.
 *
 * Le fonti lo scrivono in italiano («Gibbosa Crescente», «Primo Quarto») o in
 * inglese («Waxing Crescent», «First Quarter»): basta riconoscere la metà del
 * ciclo. Senza nome si assume crescente — sbagliare il lato illuminato è un
 * difetto estetico, non un dato falso, perché la percentuale resta giusta.
 */
export function isWaxing(phase?: string): boolean {
	if (!phase) return true;
	const p = phase.toLowerCase();
	if (/calante|ultimo|waning|last|third/.test(p)) return false;
	return true;
}

/**
 * Tracciato della parte illuminata di un disco di raggio `r` centrato in
 * (`cx`, `cy`), illuminato a destra (luna crescente nell'emisfero nord).
 *
 * Mezzo cerchio sul lato acceso più il terminatore, un'ellisse con semiasse
 * orizzontale |1 - 2k|·r: sotto il 50% il terminatore piega verso il lato
 * acceso (falce), sopra verso quello in ombra (gibbosa).
 */
export function litPath(fraction: number, cx: number, cy: number, r: number): string {
	const k = Math.max(0, Math.min(1, fraction));
	const rx = Math.abs(1 - 2 * k) * r;
	const sweep = k < 0.5 ? 0 : 1;
	return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} A ${rx} ${r} 0 0 ${sweep} ${cx} ${cy - r} Z`;
}

export default function MoonCard({ astronomy }: MoonCardProps) {
	const gradientId = `moonlit-${useId().replace(/:/g, '')}`;
	const moonrise = formatMoonTime(astronomy?.moonrise);
	const moonset = formatMoonTime(astronomy?.moonset);
	const illumination = astronomy?.moon_illumination ?? null;

	// Mostrata solo se il backend ha trovato una fonte con i dati lunari.
	if (!moonrise && !moonset && illumination == null) return null;

	const R = 30;
	const C = 36;
	const waxing = isWaxing(astronomy?.moon_phase);

	return (
		<section className="glass flex flex-col p-5" style={{ color: 'var(--color-duet-ink)' }} aria-label="Luna">
			<h3 className="text-base font-bold uppercase tracking-wide">Luna</h3>

			<div className="flex flex-1 items-center justify-center py-4">
				<svg width="72" height="72" viewBox="0 0 72 72" role="img" aria-label={astronomy?.moon_phase || 'Fase lunare'}>
					<defs>
						<radialGradient id={gradientId} cx="40%" cy="35%" r="75%">
							<stop offset="0%" stopColor="#f8fafc" />
							<stop offset="100%" stopColor="#94a3b8" />
						</radialGradient>
					</defs>
					{/* Disco in ombra: la luna c'è tutta, anche la parte non illuminata */}
					<circle cx={C} cy={C} r={R} fill="#334155" />
					<circle cx={C} cy={C} r={R} fill="none" stroke="rgba(148,163,184,0.35)" strokeWidth="1" />
					{illumination != null && illumination > 0 && (
						<path
							d={litPath(illumination / 100, C, C, R)}
							fill={`url(#${gradientId})`}
							transform={waxing ? undefined : `translate(${2 * C} 0) scale(-1 1)`}
						/>
					)}
					{/* Qualche cratere, appena accennato */}
					<g fill="rgba(15,23,42,0.18)">
						<circle cx="28" cy="28" r="4" />
						<circle cx="44" cy="44" r="5" />
						<circle cx="40" cy="24" r="2.5" />
					</g>
				</svg>
			</div>

			<div className="grid grid-cols-3 gap-2 text-center">
				<div>
					<div className="text-[12px]" style={{ color: 'var(--color-duet-muted)' }}>Luna &uarr;</div>
					<div className="text-lg font-bold tabular-nums">{moonrise || '--:--'}</div>
				</div>
				<div>
					<div className="text-[12px]" style={{ color: 'var(--color-duet-muted)' }}>Luna &darr;</div>
					<div className="text-lg font-bold tabular-nums">{moonset || '--:--'}</div>
				</div>
				<div>
					<div className="text-[12px] uppercase" style={{ color: 'var(--color-duet-muted)' }}>Illuminata</div>
					<div className="text-lg font-bold tabular-nums">
						{illumination != null ? `${Math.round(illumination)}%` : '--'}
					</div>
				</div>
			</div>
		</section>
	);
}
