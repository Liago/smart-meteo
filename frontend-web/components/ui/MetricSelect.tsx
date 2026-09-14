'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { METRICS, METRIC_ORDER, MetricId } from '@/lib/metrics';

interface MetricSelectProps {
	value: MetricId;
	onChange: (metric: MetricId) => void;
}

/**
 * Selettore della metrica mostrata nel modale di dettaglio orario.
 *
 * Sei metriche sono troppe per un segmented control HIG (che va tenuto a
 * 2-5 segmenti perché resti leggibile su schermo stretto): il pattern giusto
 * qui è un Menu in stile iOS — bottone "pill" con l'etichetta corrente, menu
 * a comparsa con l'icona a destra e un segno di spunta sulla voce attiva,
 * invece del solo sfondo evidenziato.
 *
 * Scritto a mano perché il progetto non ha una libreria di componenti headless:
 * segue il pattern della dropdown di SearchBar (chiusura su click esterno,
 * pannello animato in `AnimatePresence`) aggiungendoci la semantica listbox e la
 * navigazione da tastiera, che qui servono perché il componente vive dentro a un
 * dialog con focus trap.
 */
export default function MetricSelect({ value, onChange }: MetricSelectProps) {
	const [isOpen, setIsOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const listboxId = useId();

	// Indice evidenziato dalla tastiera, indipendente dalla selezione effettiva.
	const [highlighted, setHighlighted] = useState(() => METRIC_ORDER.indexOf(value));

	useEffect(() => {
		if (!isOpen) return;
		const handler = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		};
		document.addEventListener('mousedown', handler);
		return () => document.removeEventListener('mousedown', handler);
	}, [isOpen]);

	const open = () => {
		setHighlighted(METRIC_ORDER.indexOf(value));
		setIsOpen(true);
	};

	const select = (metric: MetricId) => {
		onChange(metric);
		setIsOpen(false);
		triggerRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape') {
			// Il dialog che ci contiene chiude su Escape: qui la propagazione va
			// fermata, altrimenti aprire la dropdown e ripensarci chiude il modale.
			if (isOpen) {
				e.stopPropagation();
				e.preventDefault();
				setIsOpen(false);
				triggerRef.current?.focus();
			}
			return;
		}

		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			if (!isOpen) {
				open();
				return;
			}
			const delta = e.key === 'ArrowDown' ? 1 : -1;
			setHighlighted((i) => (i + delta + METRIC_ORDER.length) % METRIC_ORDER.length);
			return;
		}

		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (isOpen) select(METRIC_ORDER[highlighted]);
			else open();
		}
	};

	const current = METRICS[value];
	const CurrentIcon = current.icon;

	return (
		<div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="listbox"
				aria-expanded={isOpen}
				aria-controls={isOpen ? listboxId : undefined}
				onClick={() => (isOpen ? setIsOpen(false) : open())}
				className="dt-icon-btn flex items-center gap-1.5 -ml-1 pl-2.5 pr-2 py-1.5 rounded-full hig-headline transition-colors"
				style={{ color: 'var(--color-duet-accent)', background: 'var(--color-duet-accent-soft)' }}
			>
				<CurrentIcon className="w-[18px] h-[18px]" aria-hidden />
				{current.label}
				<motion.svg
					className="w-3.5 h-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2.5}
					animate={{ rotate: isOpen ? 180 : 0 }}
					transition={{ duration: 0.2 }}
					aria-hidden="true"
				>
					<path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
				</motion.svg>
			</button>

			{/*
			  La lista è un <div> con dei <button role="option">, non <ul>/<li>: la
			  voce cliccabile deve essere l'elemento che porta role="option", e un
			  <button> figlio diretto di <ul> non sarebbe HTML valido.
			*/}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						id={listboxId}
						role="listbox"
						aria-label="Metrica da visualizzare"
						initial={{ opacity: 0, y: -6, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -6, scale: 0.96 }}
						transition={{ duration: 0.15 }}
						className="absolute top-full left-0 mt-2 min-w-56 glass-strong overflow-hidden rounded-[14px] z-10 py-1"
					>
						{/*
						  Layout da UIMenu: etichetta a sinistra, icona a destra, e un
						  segno di spunta sulla voce selezionata invece del solo grassetto —
						  è così che iOS marca la scelta corrente in un menu.
						*/}
						{METRIC_ORDER.map((id, i) => {
							const spec = METRICS[id];
							const Icon = spec.icon;
							const isSelected = id === value;
							return (
								<button
									key={id}
									type="button"
									role="option"
									aria-selected={isSelected}
									tabIndex={-1}
									onClick={() => select(id)}
									onMouseEnter={() => setHighlighted(i)}
									className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left hig-callout transition-colors"
									style={{
										color: 'var(--color-duet-ink)',
										fontWeight: isSelected ? 600 : 400,
										background: i === highlighted ? 'var(--color-duet-bg)' : undefined,
									}}
								>
									{isSelected ? (
										<svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="var(--color-duet-accent)" strokeWidth={2.5}>
											<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
										</svg>
									) : (
										<span className="w-[18px] h-[18px] shrink-0" aria-hidden />
									)}
									<span className="flex-1">{spec.label}</span>
									<Icon className="w-[18px] h-[18px] shrink-0 text-[var(--color-duet-muted)]" aria-hidden />
								</button>
							);
						})}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
