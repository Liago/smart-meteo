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
			return { bg: '#fde8e8', border: '#f3b4b4', icon: '#8c2323', text: '#5c1717', badge: '#c62828' };
		case 'severe':
			return { bg: '#ffedd9', border: '#f5c98a', icon: '#8a4c0a', text: '#5c3406', badge: '#d9720a' };
		case 'moderate':
			return { bg: '#fff7dd', border: '#ffd978', icon: '#7e5710', text: '#513709', badge: '#f7b228' };
		case 'minor':
		default:
			return { bg: '#f0f7fa', border: '#d9ecf5', icon: '#00619b', text: '#0a3a57', badge: '#0077b3' };
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
							className="border rounded-lg overflow-hidden"
							style={{ background: styles.bg, borderColor: styles.border }}
						>
							<div className="flex items-start gap-3 p-4">
								<AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: styles.icon }} />

								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 flex-wrap">
										<span
											className="text-white text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wide"
											style={{ background: styles.badge }}
										>
											{getSeverityLabel(alert.severity)}
										</span>
										{alert.event && (
											<span className="text-sm font-bold" style={{ color: styles.text }}>{alert.event}</span>
										)}
										{alert.providerSource && (
											<span className="text-xs" style={{ color: styles.icon }}>{alert.providerSource}</span>
										)}
									</div>

									<p className="text-sm mt-1 line-clamp-2" style={{ color: styles.text }}>
										{alert.headline || alert.description.slice(0, 150)}
									</p>

									<div className="flex items-center gap-3 mt-1 text-xs" style={{ color: styles.icon }}>
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
												className="mt-2 text-sm leading-relaxed"
												style={{ color: styles.text }}
											>
												{alert.description}
											</motion.div>
										)}
									</AnimatePresence>
								</div>

								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										onClick={() => setExpandedId(isExpanded ? null : alert.id)}
										className="dt-icon-btn p-1 rounded-lg transition-colors"
										style={{ color: styles.icon }}
										aria-label={isExpanded ? 'Comprimi' : 'Espandi'}
									>
										{isExpanded ? (
											<ChevronUp className="w-4 h-4" />
										) : (
											<ChevronDown className="w-4 h-4" />
										)}
									</button>
									<button
										onClick={() => setDismissed(prev => new Set([...prev, alert.id]))}
										className="dt-icon-btn p-1 rounded-lg transition-colors"
										style={{ color: styles.icon }}
										aria-label="Nascondi allerta"
									>
										<X className="w-4 h-4" />
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

	return (
		<button
			onClick={onClick}
			className="relative inline-flex items-center gap-1.5 h-[30px] px-3 rounded-full text-[13px] font-semibold hover:brightness-95 transition-all"
			style={{ background: '#fff7dd', color: '#7e5710', border: '1px solid #ffd978' }}
		>
			<Shield className="w-3.5 h-3.5" />
			{count}
		</button>
	);
}
