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
 * Bottom sheet modale. È l'unico dialog dell'app, quindi implementa qui il
 * minimo indispensabile per essere corretto: portal, ESC, blocco dello scroll,
 * gestione del focus e ruoli ARIA.
 *
 * Il pannello sta a z-101 perché il dropdown della SearchBar occupa z-50, che
 * era finora il massimo usato nell'app.
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
						className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						onClick={onClose}
						aria-hidden="true"
					/>
					<motion.div
						ref={panelRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						tabIndex={-1}
						className="fixed bottom-0 inset-x-0 z-[101] max-w-lg mx-auto glass-strong rounded-t-3xl rounded-b-none max-h-[90dvh] overflow-y-auto p-4 outline-none"
						initial={{ y: '100%' }}
						animate={{ y: 0 }}
						exit={{ y: '100%' }}
						transition={{ type: 'spring', damping: 30, stiffness: 300 }}
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between mb-4">
							<h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold text-white">
								{title}
							</h2>
							<button
								type="button"
								onClick={onClose}
								aria-label="Chiudi"
								className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						</div>
						{children}
					</motion.div>
				</>
			)}
		</AnimatePresence>,
		document.body
	);
}
