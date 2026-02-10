import { createClient } from './client';
import { SavedLocation } from '../useLocations';

export async function upsertLocation(location: SavedLocation): Promise<string | null> {
	const supabase = createClient();

	// Prepare payload for upsert_location RPC
	const payload = {
		p_name: location.name,
		p_latitude: location.lat,
		p_longitude: location.lon,
		p_country: null, // We don't strictly need this for now
		p_timezone: null // We don't strictly need this for now
	};

	const { data, error } = await supabase.rpc('upsert_location', payload);

	if (error) {
		console.error('Error upserting location:', error);
		return null;
	}

	return data as string; // returns uuid
}

export async function getFavorites(userId: string): Promise<SavedLocation[]> {
	const supabase = createClient();

	// 1. Get favorite_locations IDs from profile
	const { data: profile, error: profileError } = await supabase
		.from('profiles')
		.select('favorite_locations')
		.eq('id', userId)
		.single();

	if (profileError || !profile || !profile.favorite_locations) {
		console.error('Error fetching profile favorites:', profileError);
		return [];
	}

	const favoriteIds: string[] = profile.favorite_locations;

	if (favoriteIds.length === 0) return [];

	// 2. Fetch location details from locations table
	const { data: locations, error: locationsError } = await supabase
		.from('locations')
		.select('id, name, latitude, longitude')
		.in('id', favoriteIds);

	if (locationsError) {
		console.error('Error fetching locations details:', locationsError);
		return [];
	}

	// Map to SavedLocation type
	return locations.map(loc => ({
		id: loc.id,
		name: loc.name,
		lat: loc.latitude,
		lon: loc.longitude
	}));
}

export async function addToFavorites(userId: string, location: SavedLocation): Promise<boolean> {
	const supabase = createClient();

	// 1. Upsert location to ensure it exists and get its ID
	const locationId = await upsertLocation(location);
	if (!locationId) return false;

	// 2. Add to profile's favorite_locations array (using array_append logic via PostgreSQL or simple update)
	// Since we are client-side, we can fetch current -> append -> update
	// OR use a Postgres function if available. Migration 006 doesn't have a specific helper for appending.
	// We'll fetching current, check existence, and update.

	const { data: profile, error: fetchError } = await supabase
		.from('profiles')
		.select('favorite_locations')
		.eq('id', userId)
		.single();

	if (fetchError) {
		console.error('Error fetching profile for update:', fetchError);
		return false;
	}

	const currentFavorites: string[] = profile.favorite_locations || [];

	// Avoid duplicates
	if (currentFavorites.includes(locationId)) return true;

	const newFavorites = [...currentFavorites, locationId];

	const { error: updateError } = await supabase
		.from('profiles')
		.update({ favorite_locations: newFavorites })
		.eq('id', userId);

	if (updateError) {
		console.error('Error updating favorites:', updateError);
		return false;
	}

	return true;
}

export async function removeFromFavorites(userId: string, locationId: string): Promise<boolean> {
	// Note: locationId passed here might be the coordinate-based ID used in local state (lat-lon),
	// OR the UUID from database.
	// The UI currently uses `lat-lon` string as ID for localStorage items.
	// However, when getting favorites from DB, we get actual UUIDs.
	// We need to handle both or ensure we always work with UUIDs when online.

	const supabase = createClient();

	const { data: profile, error: fetchError } = await supabase
		.from('profiles')
		.select('favorite_locations')
		.eq('id', userId)
		.single();

	if (fetchError) return false;

	const currentFavorites: string[] = profile.favorite_locations || [];

	// If we only have UUIDs in the DB list, we can only remove by UUID.
	// If the frontend passes a non-UUID ID, we might have a mismatch.
	// BUT `getFavorites` returns UUIDs as `id`. So if we loaded from Supabase, `id` is UUID.

	const newFavorites = currentFavorites.filter(id => id !== locationId);

	const { error: updateError } = await supabase
		.from('profiles')
		.update({ favorite_locations: newFavorites })
		.eq('id', userId);

	if (updateError) {
		console.error('Error removing favorite:', updateError);
		return false;
	}

	return true;
}
