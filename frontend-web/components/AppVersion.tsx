import { APP_BUILD, APP_VERSION } from '@/lib/version';

/**
 * Versione dell'app in fondo alla dashboard.
 *
 * Non è un vezzo: quando un utente segnala «la pioggia di stasera non
 * compare», la prima domanda è quale build stia guardando — e senza un numero
 * scritto da qualche parte la risposta è «l'ultima», che è vera solo se ha
 * ricaricato, cosa che una PWA aperta da giorni non ha fatto. Il numero di
 * build accanto alla versione distingue due rilasci con lo stesso `1.1.0`.
 *
 * Deliberatamente in fondo e in piccolo, accanto all'orario di aggiornamento:
 * è informazione diagnostica, non meteo, e la dashboard risponde prima a chi
 * vuole sapere se piove.
 */
export default function AppVersion() {
	return (
		<span title={`Smart Meteo ${APP_VERSION} (build ${APP_BUILD})`}>
			Smart Meteo v{APP_VERSION}
			{' · '}
			build {APP_BUILD}
		</span>
	);
}
