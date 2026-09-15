'use client';

import type { ForecastResponse } from '@/lib/types';
import { rankInsights, type InsightId } from '@/lib/dashboard';
import ActivitiesPanel from '@/components/ActivitiesPanel';
import AirQualitySummary from '@/components/AirQualitySummary';
import GardenPanel from '@/components/GardenPanel';
import PollenPanel from '@/components/PollenPanel';
import SeaPanel from '@/components/SeaPanel';
import SkyPanel from '@/components/SkyPanel';
import SnowPanel from '@/components/SnowPanel';
import SolarPanel from '@/components/SolarPanel';

interface InsightsGridProps {
	data: ForecastResponse;
}

/**
 * La griglia di «Per te».
 *
 * Prima le otto schede erano otto righe di JSX in ordine fisso, e un ordine
 * fisso è sbagliato tutto l'anno: a gennaio metteva il mare sopra la gelata, a
 * luglio i pollini sotto il fotovoltaico. Qui l'ordine lo decide
 * `rankInsights`, che è una funzione pura e ha i suoi test — la griglia si
 * limita a montare i pannelli nell'ordine che riceve.
 *
 * I pannelli restano quelli di prima, con la loro regola di visibilità
 * (`if (!sea) return null`) intatta: la classifica decide *dove* stanno, mai
 * *se* ci sono. Duplicare la decisione di visibilità qui significherebbe
 * doverla tenere allineata in due posti, ed è la classe di errore per cui il
 * badge direbbe cinque e la griglia ne mostrerebbe quattro.
 */
export default function InsightsGrid({ data }: InsightsGridProps) {
	const panels: Record<InsightId, React.ReactNode> = {
		snow: <SnowPanel snow={data.snow} />,
		air: <AirQualitySummary data={data.current} sourcesCount={data.sources_used.length} />,
		pollen: <PollenPanel pollen={data.pollen} />,
		sea: <SeaPanel sea={data.sea} />,
		garden: <GardenPanel garden={data.garden} />,
		activities: <ActivitiesPanel activities={data.activities} />,
		sky: <SkyPanel sky={data.sky} />,
		solar: <SolarPanel solar={data.solar} />,
	};

	const ordered = rankInsights(data);

	return (
		<div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-3">
			{ordered.map((card) => (
				<div key={card.id}>{panels[card.id]}</div>
			))}
		</div>
	);
}
