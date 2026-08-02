/**
 * Mock condiviso di framer-motion per i test.
 *
 * Il mock inline che c'era prima elencava a mano i soli `motion.div/section/
 * span/svg`: qualunque altro tag (`motion.rect`, `motion.line`, `motion.path`…)
 * risultava `undefined` e faceva esplodere il render. Qui un Proxy risolve ogni
 * tag su richiesta.
 *
 * Le prop di animazione vengono filtrate: passate a un nodo DOM reale
 * produrrebbero warning di React su attributi sconosciuti.
 */
import React from 'react';

const ANIMATION_PROPS = new Set([
	'initial',
	'animate',
	'exit',
	'transition',
	'variants',
	'whileHover',
	'whileTap',
	'whileInView',
	'whileFocus',
	'whileDrag',
	'layout',
	'layoutId',
	'pathLength',
	'drag',
	'dragConstraints',
	'onAnimationComplete',
	'custom',
]);

/* eslint-disable @typescript-eslint/no-explicit-any */
const stripAnimationProps = (props: Record<string, any>) => {
	const clean: Record<string, any> = {};
	for (const [key, value] of Object.entries(props)) {
		if (!ANIMATION_PROPS.has(key)) clean[key] = value;
	}
	return clean;
};

/**
 * I componenti vanno memoizzati per tag: creandoli a ogni accesso, `motion.div`
 * restituirebbe un'identità nuova a ogni render e React smonterebbe e
 * rimonterebbe l'intero sottoalbero. Il vero framer-motion espone componenti
 * stabili, e un test che clicca un elemento appena ri-renderizzato lo troverebbe
 * altrimenti già staccato dal DOM.
 */
const componentCache = new Map<string, React.ComponentType<any>>();

export const motion: any = new Proxy(
	{},
	{
		get: (_target, tag: string) => {
			const cached = componentCache.get(tag);
			if (cached) return cached;

			const Component = React.forwardRef<unknown, Record<string, any>>(
				({ children, ...props }, ref) =>
					React.createElement(tag, { ...stripAnimationProps(props), ref }, children)
			);
			Component.displayName = `motion.${tag}`;
			componentCache.set(tag, Component);
			return Component;
		},
	}
);

export const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>;

export const useReducedMotion = () => false;
/* eslint-enable @typescript-eslint/no-explicit-any */
