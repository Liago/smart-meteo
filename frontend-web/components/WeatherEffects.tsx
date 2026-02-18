import React from 'react';

interface WeatherEffectsProps {
	condition: string;
	isDay: boolean; // true if day, false if night
}

export default function WeatherEffects({ condition, isDay }: WeatherEffectsProps) {
	// Simple mapping of condition to effect type
	// conditions: clear, cloudy, rain, snow, storm, fog, unknown

	const renderEffect = () => {
		switch (condition) {
			case 'clear':
				return isDay ? <SunEffect /> : <StarsEffect />;
			case 'cloudy':
				return <CloudsEffect isDay={isDay} />;
			case 'rain':
				return <RainEffect isDay={isDay} />;
			case 'snow':
				return <SnowEffect isDay={isDay} />;
			case 'storm':
				return <StormEffect />;
			case 'fog':
				return <FogEffect />;
			default:
				return null;
		}
	};

	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none z-0 rounded-3xl">
			{renderEffect()}
		</div>
	);
}

// --- Specific Effect Components ---

function SunEffect() {
	return (
		<div className="weather-effect-container">
			<div className="sun-core" />
			<div className="sun-rays" />
		</div>
	);
}

function StarsEffect() {
	return (
		<div className="weather-effect-container">
			<div className="stars-layer-1" />
			<div className="stars-layer-2" />
			<div className="stars-layer-3" />
		</div>
	);
}

function CloudsEffect({ isDay }: { isDay: boolean }) {
	return (
		<div className={`weather-effect-container ${isDay ? 'clouds-day' : 'clouds-night'}`}>
			<div className="cloud cloud-1" />
			<div className="cloud cloud-2" />
			<div className="cloud cloud-3" />
		</div>
	);
}

function RainEffect({ isDay }: { isDay: boolean }) {
	return (
		<div className={`weather-effect-container ${isDay ? '' : 'rain-night'}`}>
			{/* Clouds background for rain */}
			<div className="cloud cloud-gray-1" />
			<div className="cloud cloud-gray-2" />
			{/* Rain layers */}
			<div className="rain-layer-1" />
			<div className="rain-layer-2" />
			<div className="rain-layer-3" />
		</div>
	);
}

function SnowEffect({ isDay }: { isDay: boolean }) {
	return (
		<div className="weather-effect-container">
			{/* Clouds background for snow */}
			<div className="cloud cloud-gray-1" />
			<div className="snow-layer-1" />
			<div className="snow-layer-2" />
			<div className="snow-layer-3" />
		</div>
	);
}

function StormEffect() {
	return (
		<div className="weather-effect-container storm-container">
			<div className="cloud cloud-storm-1" />
			<div className="cloud cloud-storm-2" />
			<div className="rain-layer-storm" />
			<div className="lightning-flash" />
		</div>
	);
}

function FogEffect() {
	return (
		<div className="weather-effect-container">
			<div className="fog-layer-1" />
			<div className="fog-layer-2" />
		</div>
	);
}
