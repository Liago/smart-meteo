import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';

const figtree = Figtree({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });

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
	themeColor: '#0077b3',
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
			<body className={`${figtree.variable} antialiased font-sans`}>
				{children}
			</body>
		</html>
	);
}
