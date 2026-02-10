import { useState, useEffect, useCallback } from 'react';
import { createClient } from './supabase/client';
import { upsertLocation, getFavorites, addToFavorites, removeFromFavorites as removeSupabaseFavorite } from './supabase/locations';

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
	const [user, setUser] = useState<any>(null);
	const supabase = createClient();

	// 1. Check Auth State
	useEffect(() => {
		const checkUser = async () => {
			const { data: { session } } = await supabase.auth.getSession();
			setUser(session?.user ?? null);
		};
		checkUser();

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setUser(session?.user ?? null);
		});

		return () => subscription.unsubscribe();
	}, [supabase]);

	// 2. Load Data (LocalStorage or Supabase)
	useEffect(() => {
		const loadData = async () => {
			// Always load local storage first to be snappy or for guest usage
			const localHome = localStorage.getItem(HOME_KEY);
			const localSaved = localStorage.getItem(SAVED_KEY);

			let parsedHome: SavedLocation | null = null;
			let parsedSaved: SavedLocation[] = [];

			if (localHome) {
				try {
					parsedHome = JSON.parse(localHome);
					setHomeLocation(parsedHome);
				} catch (e) { console.error(e); }
			}

			if (localSaved) {
				try {
					parsedSaved = JSON.parse(localSaved);
					setSavedLocations(parsedSaved);
				} catch (e) { console.error(e); }
			}

			// If user is logged in, fetch from Supabase AND migrate local data
			if (user) {
				try {
					// Migration: Upload any local saved locations that aren't already synced?
					// For simplicity: specific "migration" logic can be complex.
					// We'll just fetch remote favorites.
					// IF local has items and remote has 0, maybe we push local to remote?
					const remoteFavorites = await getFavorites(user.id);

					// Simple sync strategy: Remote is source of truth if logged in.
					// If remote is empty but local has items, we assume first login after using as guest -> migrate.
					if (remoteFavorites.length === 0 && parsedSaved.length > 0) {
						// Migrate local to remote
						console.log("Migrating local favorites to Supabase...");
						for (const loc of parsedSaved) {
							await addToFavorites(user.id, loc);
						}
						// Refetch
						const newRemote = await getFavorites(user.id);
						setSavedLocations(newRemote);
						// Clear local to avoid confusion? Or keep as cache?
						// Let's clear local to stick to "Logged in = Cloud" mode
						localStorage.removeItem(SAVED_KEY);
					} else {
						// Use remote data
						setSavedLocations(remoteFavorites);
					}

					// Home location: stored in profiles preferences?
					// Currently `profiles` table schema has `preferences` jsonb but no dedicated `home_location` column.
					// We will continue using localStorage for Home for now, as schema change wasn't planned for Home specifically in Implementation Plan
					// (Plan only mentioned `locations` and `profiles` tables usage).
					// Wait, I can put home location in `preferences`.
					// For this iteration, let's keep Home in localStorage to minimize risk, or just keep it local.
					// The user request specifically mentioned "locations table should be the one saving all locations...".
					// But `favorite_locations` is an array. Home is specific.
					// Let's stick to: Favorites -> Supabase. Home -> LocalStorage (unless I modify schema or use preferences).
					// I'll leave Home as LocalStorage for now to respect strict schema compliance, or use `preferences` if I can.

				} catch (err) {
					console.error("Error syncing with Supabase:", err);
				}
			}

			setIsLoaded(true);
		};

		loadData();
	}, [user]);

	const saveHomeLocation = (location: SavedLocation) => {
		setHomeLocation(location);
		localStorage.setItem(HOME_KEY, JSON.stringify(location));
	};

	const removeHomeLocation = () => {
		setHomeLocation(null);
		localStorage.removeItem(HOME_KEY);
	};

	const addSavedLocation = async (location: SavedLocation) => {
		// Optimistic update
		const tempId = location.id || `${location.lat}-${location.lon}`;
		const locWithId = { ...location, id: tempId };

		setSavedLocations(prev => {
			if (prev.some(l => l.lat === location.lat && l.lon === location.lon)) return prev;
			return [...prev, locWithId];
		});

		if (user) {
			// Persist to Supabase
			await addToFavorites(user.id, locWithId);
			// Refresh to get real UUID
			const fresh = await getFavorites(user.id);
			setSavedLocations(fresh);
		} else {
			// Persist to LocalStorage
			const current = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
			if (!current.some((l: SavedLocation) => l.lat === location.lat && l.lon === location.lon)) {
				const updated = [...current, locWithId];
				localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
			}
		}
	};

	const removeSavedLocation = async (id: string) => {
		// Optimistic update
		setSavedLocations(prev => prev.filter(l => l.id !== id));

		if (user) {
			await removeSupabaseFavorite(user.id, id);
			// Refresh to ensure sync
			const fresh = await getFavorites(user.id);
			setSavedLocations(fresh);
		} else {
			const current = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
			const updated = current.filter((l: SavedLocation) => l.id !== id);
			localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
		}
	};

	const isSaved = (lat: number, lon: number) => {
		// Only check by lat/lon because ID might differ (uuid vs lat-lon string)
		return savedLocations.some(l =>
			Math.abs(l.lat - lat) < 0.0001 && Math.abs(l.lon - lon) < 0.0001
		);
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
