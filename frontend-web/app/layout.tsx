import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
	title: 'Smart Meteo - Previsioni Aggregate Intelligenti',
	description:
		'Previsioni meteo ultra-precise aggregate da 5 fonti professionali. Powered by Smart Engine.',
	keywords: ['meteo', 'previsioni', 'weather', 'forecast', 'aggregato', 'smart'],
	openGraph: {
		title: 'Smart Meteo',
		description: 'Previsioni meteo aggregate da 5 fonti per la massima precisione',
		type: 'website',
		locale: 'it_IT',
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Smart Meteo',
		description: 'Previsioni meteo aggregate da 5 fonti per la massima precisione',
	},
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	// Il blu notte del fondo pagina: la dashboard ha un tema solo, scuro, e la
	// barra di stato (e lo splash della PWA) devono continuarlo, non staccarsene.
	themeColor: '#0a1120',
	colorScheme: 'dark',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="it">
			<head>
				<link rel="manifest" href="/manifest.json" />
			</head>
			{/*
			  Nessun font Google: lo stack di sistema (-apple-system, SF Pro, ...)
			  definito in globals.css risolve nativamente a San Francisco sui
			  dispositivi Apple, il font della stessa Human Interface Guidelines,
			  senza il costo di un web font scaricato.
			*/}
			<body className="antialiased font-sans">
				{children}
			</body>
		</html>
	);
}
