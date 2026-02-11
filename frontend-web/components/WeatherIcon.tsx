import {
	Sun,
	CloudSun,
	Cloud,
	CloudFog,
	CloudDrizzle,
	CloudRain,
	CloudSnow,
	CloudLightning,
	CloudHail,
	Moon,
	CloudMoon
} from 'lucide-react';

interface WeatherIconProps {
	code?: number | string;
	condition?: string;
	isNight?: boolean;
	className?: string;
}

export default function WeatherIcon({ code, condition, isNight = false, className = "w-6 h-6" }: WeatherIconProps) {
	// Priority: Code > Condition > Default

	if (code !== undefined) {
		const c = Number(code);

		// WMO Weather Codes
		switch (c) {
			case 0: // Clear sky
				return isNight ? <Moon className={className} /> : <Sun className={className} />;

			case 1: // Mainly clear
			case 2: // Partly cloudy
				return isNight ? <CloudMoon className={className} /> : <CloudSun className={className} />;

			case 3: // Overcast
				return <Cloud className={className} />;

			case 45: // Fog
			case 48: // Depositing rime fog
				return <CloudFog className={className} />;

			case 51: // Drizzle: Light
			case 53: // Drizzle: Moderate
			case 55: // Drizzle: Dense intensity
			case 56: // Freezing Drizzle: Light
			case 57: // Freezing Drizzle: Dense
				return <CloudDrizzle className={className} />;

			case 61: // Rain: Slight
			case 63: // Rain: Moderate
			case 65: // Rain: Heavy intensity
			case 66: // Freezing Rain: Light
			case 67: // Freezing Rain: Heavy
			case 80: // Rain showers: Slight
			case 81: // Rain showers: Moderate
			case 82: // Rain showers: Violent
				return <CloudRain className={className} />;

			case 71: // Snow fall: Slight
			case 73: // Snow fall: Moderate
			case 75: // Snow fall: Heavy intensity
			case 77: // Snow grains
			case 85: // Snow showers: Slight
			case 86: // Snow showers: Heavy
				return <CloudSnow className={className} />;

			case 95: // Thunderstorm: Slight or moderate
			case 96: // Thunderstorm with slight hail
			case 99: // Thunderstorm with heavy hail
				return <CloudLightning className={className} />;

			default:
				return <Cloud className={className} />;
		}
	}

	if (condition) {
		const norm = condition.toLowerCase();

		if (norm.includes('clear') || norm.includes('sunny'))
			return isNight ? <Moon className={className} /> : <Sun className={className} />;

		if (norm.includes('partly') || norm.includes('few'))
			return isNight ? <CloudMoon className={className} /> : <CloudSun className={className} />;

		if (norm.includes('cloud') || norm.includes('overcast'))
			return <Cloud className={className} />;

		if (norm.includes('fog') || norm.includes('mist'))
			return <CloudFog className={className} />;

		if (norm.includes('drizzle'))
			return <CloudDrizzle className={className} />;

		if (norm.includes('rain') || norm.includes('shower'))
			return <CloudRain className={className} />;

		if (norm.includes('snow') || norm.includes('ice') || norm.includes('blizzard'))
			return <CloudSnow className={className} />;

		if (norm.includes('storm') || norm.includes('thunder'))
			return <CloudLightning className={className} />;
	}

	// Fallback
	return <Cloud className={className} />;
}
