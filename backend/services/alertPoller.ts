import { supabase } from './supabase';
import { processWeatherAlerts } from './alertProcessor';
import { fetchFromWeatherKitWithAlerts } from '../connectors/weatherkit';
import { fetchFromWeatherAPIWithAlerts } from '../connectors/weatherapi';
import { fetchOWMAlerts } from '../connectors/openweathermap';
import { fetchMeteoAlarmAlerts } from '../connectors/meteoalarm';
import { WeatherAlert } from '../types';
import { aggregateAlerts } from '../utils/alertGeo';

/**
 * Raggruppa le subscription per cluster geografico (~0.5° gradi).
 * Restituisce le coordinate centrali di ogni cluster.
 */
async function getSubscriptionClusters(): Promise<{ lat: number; lon: number; count: number }[]> {
	const { data, error } = await supabase
		.from('alert_subscriptions')
		.select('location_lat, location_lon')
		.eq('enabled', true);

	if (error || !data || data.length === 0) {
		if (error) console.error('[AlertPoller] Error fetching subscriptions:', error.message);
		return [];
	}

	// Raggruppa per griglia ~0.5° (arrotondamento)
	const clusterMap = new Map<string, { lats: number[]; lons: number[]; count: number }>();

	for (const sub of data) {
		const clusterKey = `${Math.round(sub.location_lat * 2) / 2}_${Math.round(sub.location_lon * 2) / 2}`;
		if (!clusterMap.has(clusterKey)) {
			clusterMap.set(clusterKey, { lats: [], lons: [], count: 0 });
		}
		const cluster = clusterMap.get(clusterKey)!;
		cluster.lats.push(sub.location_lat);
		cluster.lons.push(sub.location_lon);
		cluster.count++;
	}

	return Array.from(clusterMap.values()).map(c => ({
		lat: Number((c.lats.reduce((a, b) => a + b, 0) / c.lats.length).toFixed(4)),
		lon: Number((c.lons.reduce((a, b) => a + b, 0) / c.lons.length).toFixed(4)),
		count: c.count,
	}));
}

/**
 * Job principale di polling: interroga tutte le location sottoscritte,
 * cerca allerte da tutte le fonti, le processa tramite la pipeline esistente.
 */
export async function pollAlerts(): Promise<{ clusters: number; alertsFound: number; alertsProcessed: number }> {
	const logPrefix = '[AlertPoller]';
	console.log(`${logPrefix} Starting alert polling job...`);

	const clusters = await getSubscriptionClusters();
	if (clusters.length === 0) {
		console.log(`${logPrefix} No active subscriptions found, nothing to poll`);
		return { clusters: 0, alertsFound: 0, alertsProcessed: 0 };
	}

	console.log(`${logPrefix} Found ${clusters.length} cluster(s) covering ${clusters.reduce((a, c) => a + c.count, 0)} subscription(s)`);

	let totalFound = 0;
	let totalProcessed = 0;

	for (const cluster of clusters) {
		try {
			// Fetch allerte da tutte le fonti in parallelo
			const results = await Promise.allSettled([
				fetchFromWeatherKitWithAlerts(cluster.lat, cluster.lon)
					.then(r => r?.alerts.map(a => ({ ...a, providerSource: a.providerSource || 'weatherkit' })) || []),
				fetchFromWeatherAPIWithAlerts(cluster.lat, cluster.lon)
					.then(r => r?.alerts || []),
				fetchOWMAlerts(cluster.lat, cluster.lon),
				fetchMeteoAlarmAlerts(cluster.lat, cluster.lon),
			]);

			const allAlerts: WeatherAlert[] = [];
			for (const result of results) {
				if (result.status === 'fulfilled') allAlerts.push(...result.value);
			}

			if (allAlerts.length === 0) continue;

			// Scarta le scadute, quelle di aree che non riguardano il cluster, e deduplica
			const deduplicated = aggregateAlerts(allAlerts, cluster.lat, cluster.lon);

			totalFound += allAlerts.length;
			totalProcessed += deduplicated.length;

			if (deduplicated.length > 0) {
				console.log(`${logPrefix} Cluster ${cluster.lat},${cluster.lon}: ${allAlerts.length} raw → ${deduplicated.length} allerte pertinenti`);
				await processWeatherAlerts(deduplicated, cluster.lat, cluster.lon);
			}
		} catch (err: any) {
			console.error(`${logPrefix} Error polling cluster ${cluster.lat},${cluster.lon}: ${err.message}`);
		}
	}

	console.log(`${logPrefix} Polling complete: ${clusters.length} clusters, ${totalFound} alerts found, ${totalProcessed} processed`);
	return { clusters: clusters.length, alertsFound: totalFound, alertsProcessed: totalProcessed };
}
