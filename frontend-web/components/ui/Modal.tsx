'use client';

import { useEffect, useId, useRef, useSyncExternalStore, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
	isOpen: boolean;
	onClose: () => void;
	title: ReactNode;
	children: ReactNode;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

// createPortal ha bisogno del document, che in SSR non esiste: questo restituisce
// false sul server e true dopo l'idratazione, senza setState dentro a un effect.
const subscribeNoop = () => () => {};
const useIsClient = () =>
	useSyncExternalStore(
		subscribeNoop,
		() => true,
		() => false
	);

/**
 * Modale centrata nella pagina. È l'unico dialog dell'app, quindi implementa
 * qui il minimo indispensabile per essere corretto: portal, ESC, blocco dello
 * scroll, gestione del focus e ruoli ARIA.
 *
 * Il pannello sta a z-101 perché il dropdown della SearchBar occupa z-50, che
 * era finora il massimo usato nell'app. La superficie usa `.glass`, la stessa
 * della card "Dettagli previsione", così i due contesti hanno lo stesso tono.
 */
export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
	const isClient = useIsClient();
	const panelRef = useRef<HTMLDivElement>(null);
	const titleId = useId();

	// ESC per chiudere + trap del Tab dentro al pannello.
	useEffect(() => {
		if (!isOpen) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.stopPropagation();
				onClose();
				return;
			}
			if (e.key !== 'Tab' || !panelRef.current) return;

			const focusable = Array.from(
				panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
			).filter((el) => el.offsetParent !== null);
			if (focusable.length === 0) return;

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};

		document.addEventListener('keydown', onKeyDown);
		return () => document.removeEventListener('keydown', onKeyDown);
	}, [isOpen, onClose]);

	// Blocca lo scroll della pagina sotto e ripristina il focus alla chiusura.
	useEffect(() => {
		if (!isOpen) return;

		const previouslyFocused = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		panelRef.current?.focus();

		return () => {
			document.body.style.overflow = previousOverflow;
			previouslyFocused?.focus?.();
		};
	}, [isOpen]);

	if (!isClient) return null;

	return createPortal(
		<AnimatePresence>
			{isOpen && (
				<>
					<motion.div
						className="fixed inset-0 z-[100] backdrop-blur-sm"
						style={{ background: 'rgba(8,42,77,.45)' }}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={onClose}
						aria-hidden="true"
					/>
					{/*
					  Il contenitore centra il pannello e lascia passare i click
					  all'overlay sottostante, che è quello che chiude la modale.
					*/}
					<div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
						<motion.div
							ref={panelRef}
							role="dialog"
							aria-modal="true"
							aria-labelledby={titleId}
							tabIndex={-1}
							className="w-full max-w-lg glass-strong max-h-[85dvh] overflow-y-auto p-4 sm:p-6 outline-none pointer-events-auto"
							style={{ color: 'var(--color-duet-ink)' }}
							initial={{ opacity: 0, scale: 0.95, y: 12 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 12 }}
							transition={{ type: 'spring', damping: 26, stiffness: 320 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="flex items-center justify-between mb-4">
								{/*
								  Non un <h2>: il titolo può contenere controlli (la dropdown
								  di selezione della metrica porta con sé una listbox), che in
								  un heading sarebbero flow content dentro phrasing content.
								  role="heading" conserva la semantica per gli screen reader.
								*/}
								<div
									id={titleId}
									role="heading"
									aria-level={2}
									className="flex items-center gap-2 text-base font-bold"
								>
									{title}
								</div>
								<button
									type="button"
									onClick={onClose}
									aria-label="Chiudi"
									className="dt-icon-btn w-9 h-9 flex items-center justify-center rounded-full transition-colors"
									style={{ background: 'var(--color-duet-bg)', color: 'var(--color-duet-muted)' }}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
										<path d="M18 6L6 18M6 6l12 12" />
									</svg>
								</button>
							</div>
							{children}
						</motion.div>
					</div>
				</>
			)}
		</AnimatePresence>,
		document.body
	);
}
