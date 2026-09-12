export type GeoLookup = {
	country: string | null;
	city: string | null;
	/** WGS84 degrees; null when unknown */
	lat: number | null;
	lng: number | null;
};
