'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';

export interface SegmentedTabsItem<T extends string> {
	id: T;
	label: string;
	/** Numero mostrato accanto all'etichetta; omesso quando non c'è niente da contare. */
	count?: number;
}

interface SegmentedTabsProps<T extends string> {
	items: SegmentedTabsItem<T>[];
	value: T;
	onChange: (id: T) => void;
	/** Prefisso degli id ARIA: serve a legare ogni linguetta al suo pannello. */
	idPrefix: string;
	'aria-label': string;
}

/**
 * Controllo segmentato accessibile, nel linguaggio del resto dell'interfaccia.
 *
 * Tre cose che un gruppo di bottoni non dà e che qui servono:
 *
 * - **Semantica di tablist.** Uno screen reader annuncia «scheda 2 di 4,
 *   selezionata» invece di leggere quattro bottoni scollegati, e sa quale
 *   pannello stanno comandando grazie ad `aria-controls`.
 * - **Tabindex mobile.** Nel pattern tablist il Tab entra e esce dal gruppo in
 *   un colpo solo e ci si sposta con le frecce: solo la linguetta attiva è
 *   raggiungibile col Tab, le altre hanno `tabIndex={-1}`. Senza, arrivare al
 *   contenuto da tastiera costa quattro Tab.
 * - **Indicatore condiviso.** La pillola è un solo elemento che si sposta
 *   (`layoutId`), non quattro sfondi che appaiono e scompaiono: l'occhio segue
 *   il movimento e capisce che le sezioni sono sorelle.
 */
export default function SegmentedTabs<T extends string>({
	items,
	value,
	onChange,
	idPrefix,
	'aria-label': ariaLabel,
}: SegmentedTabsProps<T>) {
	const refs = useRef<Record<string, HTMLButtonElement | null>>({});

	const move = (delta: number) => {
		const index = items.findIndex((i) => i.id === value);
		if (index < 0) return;
		// Ciclico: dall'ultima sezione la freccia destra torna alla prima, che è
		// quello che un tablist fa di norma e risparmia il viaggio di ritorno.
		const next = items[(index + delta + items.length) % items.length]!;
		onChange(next.id);
		refs.current[next.id]?.focus();
	};

	const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		switch (event.key) {
			case 'ArrowRight':
			case 'ArrowDown':
				event.preventDefault();
				move(1);
				break;
			case 'ArrowLeft':
			case 'ArrowUp':
				event.preventDefault();
				move(-1);
				break;
			case 'Home':
				event.preventDefault();
				onChange(items[0]!.id);
				refs.current[items[0]!.id]?.focus();
				break;
			case 'End':
				event.preventDefault();
				onChange(items[items.length - 1]!.id);
				refs.current[items[items.length - 1]!.id]?.focus();
				break;
		}
	};

	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			onKeyDown={onKeyDown}
			/*
			  Sotto i 400 px quattro etichette non ci stanno: la barra scorre in
			  orizzontale invece di andare a capo, così l'altezza della zona
			  appiccicata in cima resta costante mentre si scorre la pagina.
			*/
			className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			/*
			  Pista grigia, segmento attivo bianco: il fondo della pagina è già
			  grigio, quindi una pista dello stesso colore renderebbe invisibile
			  il controllo e visibile solo la pillola, che da sola non si legge
			  come «ce ne sono altre tre».
			*/
			style={{ background: 'var(--color-duet-border)' }}
		>
			{items.map((item) => {
				const selected = item.id === value;
				return (
					<button
						key={item.id}
						ref={(el) => {
							refs.current[item.id] = el;
						}}
						role="tab"
						id={`${idPrefix}-tab-${item.id}`}
						aria-controls={`${idPrefix}-panel-${item.id}`}
						aria-selected={selected}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(item.id)}
						className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors"
						style={{ color: selected ? 'var(--color-duet-ink)' : 'var(--color-duet-muted)' }}
					>
						{selected && (
							<motion.span
								layoutId={`${idPrefix}-segment`}
								transition={{ type: 'spring', stiffness: 400, damping: 34 }}
								className="absolute inset-0 rounded-full"
								style={{
									background: 'var(--color-duet-surface)',
									boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
								}}
								aria-hidden="true"
							/>
						)}
						<span className="relative">{item.label}</span>
						{item.count != null && (
							<span
								className="relative text-xs font-semibold tabular-nums"
								style={{
									color: selected ? 'var(--color-duet-accent)' : 'var(--color-duet-faint)',
								}}
							>
								{item.count}
							</span>
						)}
					</button>
				);
			})}
		</div>
	);
}
