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
				className="dt-icon-btn flex items-center gap-2 -ml-2 px-2 py-1 rounded-lg text-base font-bold transition-colors"
				style={{ color: 'var(--color-duet-ink)' }}
			>
				<CurrentIcon className="w-5 h-5 text-[var(--color-duet-accent)]" aria-hidden />
				{current.label}
				<motion.svg
					className="w-4 h-4"
					style={{ color: 'var(--color-duet-muted)' }}
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
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
						initial={{ opacity: 0, y: -8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.2 }}
						className="absolute top-full left-0 mt-1 min-w-52 glass-strong overflow-hidden rounded-xl z-10 py-1"
					>
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
									className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors ${isSelected ? 'font-semibold' : ''}`}
									style={{
										color: isSelected ? 'var(--color-duet-ink)' : 'var(--color-duet-ink-soft)',
										background: i === highlighted ? 'var(--color-duet-bg)' : undefined,
									}}
								>
									<Icon className="w-4 h-4 shrink-0 text-[var(--color-duet-accent)]" aria-hidden />
									{spec.label}
								</button>
							);
						})}
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
