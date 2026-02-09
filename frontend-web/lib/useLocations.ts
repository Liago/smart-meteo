import { useState, useEffect } from 'react';

export interface SavedLocation {
	id: string;
	name: string;
	lat: number;
	lon: number;
}

const HOME_KEY = 'smart-meteo-home';
const SAVED_KEY = 'smart-meteo-saved';

export function useLocations() {
	const [homeLocation, setHomeLocation] = useState<SavedLocation | null>(null);
	const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
	const [isLoaded, setIsLoaded] = useState(false);

	useEffect(() => {
		// Load data from localStorage on mount
		const home = localStorage.getItem(HOME_KEY);
		const saved = localStorage.getItem(SAVED_KEY);

		if (home) {
			try {
				setHomeLocation(JSON.parse(home));
			} catch (e) {
				console.error('Failed to parse home location', e);
			}
		}

		if (saved) {
			try {
				setSavedLocations(JSON.parse(saved));
			} catch (e) {
				console.error('Failed to parse saved locations', e);
			}
		}

		setIsLoaded(true);
	}, []);

	const saveHomeLocation = (location: SavedLocation) => {
		setHomeLocation(location);
		localStorage.setItem(HOME_KEY, JSON.stringify(location));
	};

	const removeHomeLocation = () => {
		setHomeLocation(null);
		localStorage.removeItem(HOME_KEY);
	};

	const addSavedLocation = (location: SavedLocation) => {
		setSavedLocations(prev => {
			if (prev.some(l => l.id === location.id || (l.lat === location.lat && l.lon === location.lon))) {
				return prev;
			}
			const updated = [...prev, location];
			localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
			return updated;
		});
	};

	const removeSavedLocation = (id: string) => {
		setSavedLocations(prev => {
			const updated = prev.filter(l => l.id !== id);
			localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
			return updated;
		});
	};

	const isSaved = (lat: number, lon: number) => {
		return savedLocations.some(l => l.lat === lat && l.lon === lon);
	};

	const isHome = (lat: number, lon: number) => {
		return homeLocation?.lat === lat && homeLocation?.lon === lon;
	};

	return {
		homeLocation,
		savedLocations,
		saveHomeLocation,
		removeHomeLocation,
		addSavedLocation,
		removeSavedLocation,
		isSaved,
		isHome,
		isLoaded
	};
}
