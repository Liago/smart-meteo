import { supabase } from './supabase';
import { UnifiedForecast } from '../utils/formatter';

export interface SourceMAE {
    source_id: string;
    metric: string;
    mae: number;
}

/**
 * Fetches the current Mean Absolute Errors from the db to adjust source weights.
 */
export async function getSourceAccuracies(): Promise<SourceMAE[]> {
    try {
        const { data, error } = await supabase
            .from('source_accuracy')
            .select('source_id, metric, mae');

        if (error) {
            console.error('Error fetching source accuracies:', error);
            return [];
        }

        return data as SourceMAE[];
    } catch (err) {
        console.error('Exception fetching source accuracies:', err);
        return [];
    }
}

/**
 * Maps the accuracies from DB to a fast lookup dictionary: Record<source_id, Record<metric, MAE>>
 */
export async function getAccuracyMap(): Promise<Record<string, Record<string, number>>> {
    const list = await getSourceAccuracies();
    const map: Record<string, Record<string, number>> = {};
    
    for (const item of list) {
        if (!map[item.source_id]) {
            map[item.source_id] = {};
        }
        // Use non-null assertion since we just initialized it above
        map[item.source_id]![item.metric] = Number(item.mae);
    }
    
    return map;
}

/**
 * Background task to calculate the deviation of each source's forecast against
 * the final "Smart" aggregated forecast (the consensus). 
 * This deviation is then logged back to Supabase.
 */
export async function logAccuracyDeviations(
    smartForecast: any, 
    rawForecasts: UnifiedForecast[]
) {
    if (!smartForecast || rawForecasts.length === 0) return;

    // We primarily track error on temperature (which is most universally reported)
    // and potentially precipitation, but let's do a unified "overall" metric as simplified MAE based 
    // on temperature deviation currently, to keep weights simple.
    // Or we log everything. For engine simplicity, an "overall_temp" metric is good.

    const consensusTemp = smartForecast.temp;
    if (consensusTemp == null) return;

    for (const raw of rawForecasts) {
        if (raw.temp != null) {
            // Error is absolute difference from consensus
            const errVal = Math.abs(raw.temp - consensusTemp);

            // Execute RPC fire-and-forget
            void (async () => {
                const { error } = await supabase.rpc('update_source_accuracy', {
                    p_source_id: raw.source,
                    p_metric: 'temperature',
                    p_error: errVal
                });
                if (error) console.error(`Failed to update accuracy for ${raw.source}:`, error);
            })();
        }
    }
}
