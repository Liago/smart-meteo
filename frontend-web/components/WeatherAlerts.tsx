'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ChevronDown, ChevronUp, X, Shield } from 'lucide-react';
import type { WeatherAlert } from '@/lib/types';

interface WeatherAlertsProps {
	alerts: WeatherAlert[];
}

function getSeverityStyles(severity: string) {
	switch (severity) {
		case 'extreme':
			return { bg: 'bg-red-500/30', border: 'border-red-400/50', icon: 'text-red-300', badge: 'bg-red-500' };
		case 'severe':
			return { bg: 'bg-orange-500/25', border: 'border-orange-400/50', icon: 'text-orange-300', badge: 'bg-orange-500' };
		case 'moderate':
			return { bg: 'bg-yellow-500/20', border: 'border-yellow-400/40', icon: 'text-yellow-300', badge: 'bg-yellow-500' };
		case 'minor':
		default:
			return { bg: 'bg-blue-500/15', border: 'border-blue-400/30', icon: 'text-blue-300', badge: 'bg-blue-500' };
	}
}

function getSeverityLabel(severity: string): string {
	switch (severity) {
		case 'extreme': return 'Estrema';
		case 'severe': return 'Severa';
		case 'moderate': return 'Moderata';
		case 'minor': return 'Lieve';
		default: return severity;
	}
}

function formatAlertTime(isoString: string): string {
	try {
		return new Date(isoString).toLocaleString('it-IT', {
			day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
		});
	} catch {
		return isoString;
	}
}

export default function WeatherAlerts({ alerts }: WeatherAlertsProps) {
	const [dismissed, setDismissed] = useState<Set<string>>(new Set());
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const visibleAlerts = alerts.filter(a => !dismissed.has(a.id));
	if (visibleAlerts.length === 0) return null;

	// Ordina per severity (extreme prima)
	const severityOrder: Record<string, number> = { extreme: 0, severe: 1, moderate: 2, minor: 3 };
	const sorted = [...visibleAlerts].sort(
		(a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
	);

	return (
		<div className="space-y-2">
			<AnimatePresence>
				{sorted.map(alert => {
					const styles = getSeverityStyles(alert.severity);
					const isExpanded = expandedId === alert.id;

					return (
						<motion.div
							key={alert.id}
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, height: 0, marginBottom: 0 }}
							className={`${styles.bg} ${styles.border} border backdrop-blur-md rounded-xl overflow-hidden`}
						>
							<div className="flex items-start gap-3 p-3">
								<AlertTriangle className={`${styles.icon} w-5 h-5 mt-0.5 flex-shrink-0`} />

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span className={`${styles.badge} text-white text-xs px-2 py-0.5 rounded-full font-medium`}>
											{getSeverityLabel(alert.severity)}
										</span>
										{alert.event && (
											<span className="text-white/80 text-sm font-medium">{alert.event}</span>
										)}
										{alert.providerSource && (
											<span className="text-white/40 text-xs">{alert.providerSource}</span>
										)}
									</div>

									<p className="text-white/90 text-sm mt-1 line-clamp-2">
										{alert.headline || alert.description.slice(0, 150)}
									</p>

									<div className="flex items-center gap-3 mt-1 text-xs text-white/50">
										{alert.areaName && <span>{alert.areaName}</span>}
										<span>{formatAlertTime(alert.effectiveTime)} — {formatAlertTime(alert.expireTime)}</span>
									</div>

									{/* Expanded details */}
									<AnimatePresence>
										{isExpanded && (
											<motion.div
												initial={{ opacity: 0, height: 0 }}
												animate={{ opacity: 1, height: 'auto' }}
												exit={{ opacity: 0, height: 0 }}
												className="mt-2 text-white/70 text-sm leading-relaxed"
											>
												{alert.description}
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										onClick={() => setExpandedId(isExpanded ? null : alert.id)}
										className="p-1 rounded-lg hover:bg-white/10 transition-colors"
										aria-label={isExpanded ? 'Comprimi' : 'Espandi'}
									>
										{isExpanded ? (
											<ChevronUp className="w-4 h-4 text-white/50" />
										) : (
											<ChevronDown className="w-4 h-4 text-white/50" />
										)}
									</button>
									<button
										onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
										className="p-1 rounded-lg hover:bg-white/10 transition-colors"
										aria-label="Nascondi allerta"
									>
										<X className="w-4 h-4 text-white/50" />
									</button>
								</div>
							</div>
						</motion.div>
					);
				})}
			</AnimatePresence>
		</div>
	);
}

/** Badge compatto per l'header che mostra il conteggio allerte attive */
export function AlertBadge({ count, onClick }: { count: number; onClick?: () => void }) {
	if (count === 0) return null;

	const color = count >= 3 ? 'bg-red-500' : count >= 1 ? 'bg-orange-500' : 'bg-yellow-500';

	return (
		<button
			onClick={onClick}
			className={`relative inline-flex items-center gap-1 px-2 py-1 rounded-full ${color} text-white text-xs font-medium hover:brightness-110 transition-all`}
		>
			<Shield className="w-3 h-3" />
			{count}
		</button>
	);
}
