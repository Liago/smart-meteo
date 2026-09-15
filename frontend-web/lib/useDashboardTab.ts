'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { resolveTab, type TabDescriptor, type TabId } from './dashboard';

/**
 * L'ancora dell'URL come sorgente unica della sezione aperta.
 *
 * La prima stesura teneva la sezione in uno `useState` e la sincronizzava con
 * l'URL in due `useEffect`. Funzionava e aveva tre difetti, tutti dovuti
 * all'avere due copie della stessa verità: il primo render sul server non
 * poteva conoscere l'ancora (niente `location`) e serviva un effetto per
 * rimediare dopo l'idratazione; «indietro» e «avanti» del browser non
 * tornavano alla sezione precedente, perché nessuno ascoltava `hashchange`; e
 * quando cambiando località una sezione spariva — il mare c'è a Genova e non a
 * Milano — serviva un terzo effetto per non restare su una linguetta che non
 * esiste più.
 *
 * Con `useSyncExternalStore` la verità è una sola, sta nell'URL, e React la
 * legge: niente effetti, niente render a cascata, e il caso della sezione
 * sparita si risolve da sé perché `resolveTab` ricade sulla prima disponibile
 * ogni volta che l'ancora non corrisponde a niente.
 */

type Listener = () => void;

let listeners: Listener[] = [];

/**
 * `replaceState` non fa scattare `hashchange` — è proprio il motivo per cui si
 * usa al posto di assegnare `location.hash`, che invece farebbe saltare la
 * pagina all'elemento con quell'id e riempirebbe la cronologia — quindi dopo
 * averlo chiamato bisogna avvisare a mano chi è in ascolto.
 */
function emit() {
	for (const listener of listeners) listener();
}

function subscribe(onStoreChange: Listener): () => void {
	listeners = [...listeners, onStoreChange];
	window.addEventListener('hashchange', onStoreChange);
	return () => {
		listeners = listeners.filter((l) => l !== onStoreChange);
		window.removeEventListener('hashchange', onStoreChange);
	};
}

function getSnapshot(): string {
	return window.location.hash;
}

/** Sul server non c'è ancora: si parte dalla prima sezione, come un URL nudo. */
function getServerSnapshot(): string {
	return '';
}

export function useDashboardTab(tabs: TabDescriptor[]): [TabId, (id: TabId) => void] {
	const hash = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

	const select = useCallback((id: TabId) => {
		window.history.replaceState(null, '', `#${id}`);
		emit();
	}, []);

	// Finché le sezioni non sono note si restituisce comunque un valore valido:
	// il pannello a schermo non deve dipendere dall'ordine in cui arrivano i dati.
	const tab = tabs.length > 0 ? resolveTab(hash, tabs) : 'oggi';

	return [tab, select];
}
