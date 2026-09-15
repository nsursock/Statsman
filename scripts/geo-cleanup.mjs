/**
 * One-time cleanup for the "Hong Kong · Russia" geo mismatch bug.
 *
 * The old `geoFromHeaders` merged city (from Cloudflare) with country+coords
 * (from the stale geoip-lite database) per-field, producing rows where the
 * city belonged to a different country than the coordinates — e.g. a Hong
 * Kong visitor whose IP geoip-lite misresolved to Russia kept Russia's
 * country + coordinates (Moscow: 55.74, 37.61) but took "Hong Kong" from
 * cf-ipcity. The pin was plotted in Moscow but labelled "Hong Kong · Russia".
 *
 * We never persisted IPs (privacy-first), so we can't re-resolve. Two-pass
 * detection, since the bug has two shapes:
 *
 *  1. CITY MISMATCH (the common case — e.g. "Hong Kong" · RU @ Moscow):
 *     The city came from Cloudflare (accurate); country + coords came from
 *     stale geoip-lite (wrong). A curated CITIES map (major world cities →
 *     country + coords) lets us TRUST the city and correct country + lat +
 *     lng to the city's true values. This actually fixes the pin rather than
 *     just hiding it.
 *
 *  2. COORDS MISMATCH (city not in the curated map):
 *     The stored (lat, lng) falls outside the stored country's bounding box.
 *     We can't re-derive the true location, so we null city + lat + lng
 *     (keep country for the countries list — it's coarse). The row still
 *     counts as a pageview everywhere else.
 *
 * Usage:
 *   node scripts/geo-cleanup.mjs              # dry-run — report mismatches only
 *   node scripts/geo-cleanup.mjs --apply      # fix mismatched rows
 *   node scripts/geo-cleanup.mjs --fill-cities # dry-run — reverse-geocode unknown cities
 *   node scripts/geo-cleanup.mjs --fill-cities --apply  # fill unknown cities
 *
 * Connects directly via DATABASE_PATH (SQLite) or DATABASE_URL / PG* (Postgres).
 *
 * --fill-cities uses OpenStreetMap's Nominatim API (free, no key). It respects
 * the public usage policy: 1 req/sec, descriptive User-Agent, single thread.
 */
import { existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import pg from 'postgres';

/* --------------------- curated city → geo reference --------------------- */
/* Major world cities → [country, lat, lng]. Web traffic concentrates in
 * population centers, so this covers the vast majority of real cases. The
 * city name is matched case-insensitively and trimmed. Coordinates are the
 * city center (good enough for a globe pin — the globe already averages). */
const CITIES = {
	'Hong Kong': ['HK', 22.32, 114.17], 'Macau': ['MO', 22.17, 113.55],
	'Taipei': ['TW', 25.03, 121.57], 'Singapore': ['SG', 1.35, 103.82],
	'Tokyo': ['JP', 35.68, 139.69], 'Osaka': ['JP', 34.69, 135.5], 'Nagoya': ['JP', 35.18, 136.91],
	'Seoul': ['KR', 37.57, 126.98], 'Busan': ['KR', 35.18, 129.08],
	'Beijing': ['CN', 39.9, 116.4], 'Shanghai': ['CN', 31.23, 121.47], 'Guangzhou': ['CN', 23.13, 113.26],
	'Shenzhen': ['CN', 22.54, 114.06], 'Chengdu': ['CN', 30.57, 104.07], 'Hangzhou': ['CN', 30.27, 120.16],
	'New York': ['US', 40.71, -74.01], 'Los Angeles': ['US', 34.05, -118.24], 'Chicago': ['US', 41.88, -87.63],
	'Houston': ['US', 29.76, -95.37], 'Phoenix': ['US', 33.45, -112.07], 'Philadelphia': ['US', 39.95, -75.17],
	'San Antonio': ['US', 29.42, -98.49], 'San Diego': ['US', 32.72, -117.16], 'Dallas': ['US', 32.78, -96.8],
	'San Jose': ['US', 37.34, -121.89], 'Austin': ['US', 30.27, -97.74], 'Jacksonville': ['US', 30.33, -81.66],
	'San Francisco': ['US', 37.77, -122.42], 'Seattle': ['US', 47.61, -122.33], 'Denver': ['US', 39.74, -104.99],
	'Boston': ['US', 42.36, -71.06], 'Portland': ['US', 45.52, -122.68], 'Las Vegas': ['US', 36.17, -115.14],
	'Atlanta': ['US', 33.75, -84.39], 'Miami': ['US', 25.76, -80.19], 'Minneapolis': ['US', 44.98, -93.27],
	'Washington': ['US', 38.9, -77.04], 'Detroit': ['US', 42.33, -83.05], 'Nashville': ['US', 36.16, -86.78],
	'London': ['GB', 51.51, -0.13], 'Manchester': ['GB', 53.48, -2.24], 'Birmingham': ['GB', 52.48, -1.9],
	'Glasgow': ['GB', 55.86, -4.25], 'Edinburgh': ['GB', 55.95, -3.19], 'Liverpool': ['GB', 53.4, -2.99],
	'Paris': ['FR', 48.86, 2.35], 'Marseille': ['FR', 43.3, 5.37], 'Lyon': ['FR', 45.76, 4.84],
	'Toulouse': ['FR', 43.6, 1.44], 'Nice': ['FR', 43.7, 7.26],
	'Berlin': ['DE', 52.52, 13.41], 'Munich': ['DE', 48.14, 11.58], 'Hamburg': ['DE', 53.55, 9.99],
	'Frankfurt': ['DE', 50.11, 8.68], 'Cologne': ['DE', 50.94, 6.96], 'Stuttgart': ['DE', 48.78, 9.18],
	'Dusseldorf': ['DE', 51.23, 6.79], 'Leipzig': ['DE', 51.34, 12.37],
	'Madrid': ['ES', 40.42, -3.7], 'Barcelona': ['ES', 41.39, 2.17], 'Valencia': ['ES', 39.47, -0.38],
	'Seville': ['ES', 37.39, -5.98], 'Bilbao': ['ES', 43.26, -2.93],
	'Amsterdam': ['NL', 52.37, 4.9], 'Rotterdam': ['NL', 51.92, 4.48], 'The Hague': ['NL', 52.07, 4.3],
	'Eindhoven': ['NL', 51.44, 5.47], 'Utrecht': ['NL', 52.09, 5.12],
	'Rome': ['IT', 41.9, 12.5], 'Milan': ['IT', 45.46, 9.19], 'Naples': ['IT', 40.85, 14.27],
	'Turin': ['IT', 45.07, 7.69], 'Florence': ['IT', 43.77, 11.25], 'Bologna': ['IT', 44.49, 11.34],
	'Stockholm': ['SE', 59.33, 18.07], 'Gothenburg': ['SE', 57.71, 11.97], 'Malmo': ['SE', 55.61, 13.0],
	'Oslo': ['NO', 59.91, 10.75], 'Bergen': ['NO', 60.39, 5.32],
	'Copenhagen': ['DK', 55.68, 12.57], 'Aarhus': ['DK', 56.16, 10.2],
	'Helsinki': ['FI', 60.17, 24.94], 'Tampere': ['FI', 61.5, 23.76],
	'Dublin': ['IE', 53.35, -6.26], 'Cork': ['IE', 51.9, -8.47],
	'Brussels': ['BE', 50.85, 4.35], 'Antwerp': ['BE', 51.22, 4.4], 'Ghent': ['BE', 51.05, 3.72],
	'Vienna': ['AT', 48.21, 16.37], 'Graz': ['AT', 47.07, 15.43],
	'Zurich': ['CH', 47.37, 8.54], 'Geneva': ['CH', 46.2, 6.14], 'Basel': ['CH', 47.56, 7.59],
	'Bern': ['CH', 46.95, 7.45], 'Lausanne': ['CH', 46.52, 6.63],
	'Toronto': ['CA', 43.65, -79.38], 'Montreal': ['CA', 45.5, -73.57], 'Vancouver': ['CA', 49.28, -123.12],
	'Calgary': ['CA', 51.05, -114.07], 'Ottawa': ['CA', 45.42, -75.7], 'Edmonton': ['CA', 53.55, -113.49],
	'Winnipeg': ['CA', 49.9, -97.14], 'Quebec City': ['CA', 46.81, -71.21], 'Hamilton': ['CA', 43.26, -79.84],
	'Sydney': ['AU', -33.87, 151.21], 'Melbourne': ['AU', -37.81, 144.96], 'Brisbane': ['AU', -27.47, 153.03],
	'Perth': ['AU', -31.95, 115.86], 'Adelaide': ['AU', -34.93, 138.6], 'Canberra': ['AU', -35.28, 149.13],
	'Auckland': ['NZ', -36.85, 174.76], 'Wellington': ['NZ', -41.29, 174.78], 'Christchurch': ['NZ', -43.53, 172.64],
	'Sao Paulo': ['BR', -23.55, -46.63], 'Rio de Janeiro': ['BR', -22.91, -43.17], 'Brasilia': ['BR', -15.79, -47.88],
	'Salvador': ['BR', -12.97, -38.5], 'Fortaleza': ['BR', -3.72, -38.54],
	'Buenos Aires': ['AR', -34.6, -58.38], 'Cordoba': ['AR', -31.42, -64.18], 'Rosario': ['AR', -32.95, -60.64],
	'Santiago': ['CL', -33.45, -70.67], 'Valparaiso': ['CL', -33.04, -71.63],
	'Lima': ['PE', -12.05, -77.04], 'Bogota': ['CO', 4.71, -74.07], 'Medellin': ['CO', 6.25, -75.56],
	'Caracas': ['VE', 10.49, -66.88], 'Quito': ['EC', -0.18, -78.47], 'Guayaquil': ['EC', -2.17, -79.92],
	'Mexico City': ['MX', 19.43, -99.13], 'Guadalajara': ['MX', 20.66, -103.34], 'Monterrey': ['MX', 25.69, -100.32],
	'Havana': ['CU', 23.13, -82.38], 'Santo Domingo': ['DO', 18.49, -69.93], 'San Jose': ['CR', 9.93, -84.08],
	'Panama City': ['PA', 8.98, -79.52],
	'Mumbai': ['IN', 19.08, 72.88], 'Delhi': ['IN', 28.61, 77.21], 'Bangalore': ['IN', 12.97, 77.59],
	'Bengaluru': ['IN', 12.97, 77.59], 'Chennai': ['IN', 13.08, 80.27], 'Kolkata': ['IN', 22.57, 88.36],
	'Hyderabad': ['IN', 17.39, 78.49], 'Pune': ['IN', 18.52, 73.86], 'Ahmedabad': ['IN', 23.03, 72.58],
	'Surat': ['IN', 21.17, 72.83], 'Jaipur': ['IN', 26.91, 75.79],
	'Karachi': ['PK', 24.86, 67.01], 'Lahore': ['PK', 31.55, 74.34], 'Islamabad': ['PK', 33.68, 73.05],
	'Dhaka': ['BD', 23.81, 90.41], 'Chittagong': ['BD', 22.36, 91.82],
	'Colombo': ['LK', 6.93, 79.86], 'Kandy': ['LK', 7.29, 80.64],
	'Jakarta': ['ID', -6.21, 106.85], 'Surabaya': ['ID', -7.25, 112.75], 'Bandung': ['ID', -6.92, 107.61],
	'Manila': ['PH', 14.6, 120.98], 'Cebu': ['PH', 10.32, 123.9], 'Davao': ['PH', 7.19, 125.45],
	'Bangkok': ['TH', 13.76, 100.5], 'Chiang Mai': ['TH', 18.79, 98.99],
	'Hanoi': ['VN', 21.03, 105.85], 'Ho Chi Minh City': ['VN', 10.82, 106.63], 'Da Nang': ['VN', 16.05, 108.2],
	'Kuala Lumpur': ['MY', 3.14, 101.69], 'George Town': ['MY', 5.41, 100.33], 'Johor Bahru': ['MY', 1.49, 103.74],
	'Phnom Penh': ['KH', 11.56, 104.93], 'Vientiane': ['LA', 17.97, 102.63], 'Yangon': ['MM', 16.84, 96.17],
	'Dubai': ['AE', 25.2, 55.27], 'Abu Dhabi': ['AE', 24.45, 54.38], 'Sharjah': ['AE', 25.35, 55.4],
	'Doha': ['QA', 25.29, 51.53], 'Riyadh': ['SA', 24.71, 46.68], 'Jeddah': ['SA', 21.49, 39.19],
	'Mecca': ['SA', 21.39, 39.86], 'Medina': ['SA', 24.47, 39.61],
	'Kuwait City': ['KW', 29.38, 47.97], 'Manama': ['BH', 26.23, 50.59], 'Muscat': ['OM', 23.59, 58.38],
	'Tehran': ['IR', 35.69, 51.39], 'Mashhad': ['IR', 36.3, 59.61], 'Isfahan': ['IR', 32.65, 51.67],
	'Baghdad': ['IQ', 33.32, 44.36], 'Basra': ['IQ', 30.51, 47.83],
	'Amman': ['JO', 31.95, 35.91], 'Beirut': ['LB', 33.89, 35.5], 'Damascus': ['SY', 33.51, 36.29],
	'Jerusalem': ['IL', 31.78, 35.22], 'Tel Aviv': ['IL', 32.08, 34.78], 'Haifa': ['IL', 32.79, 34.99],
	'Gaza': ['PS', 31.5, 34.47],
	'Cairo': ['EG', 30.04, 31.24], 'Alexandria': ['EG', 31.2, 29.92], 'Giza': ['EG', 30.01, 31.21],
	'Casablanca': ['MA', 33.57, -7.59], 'Rabat': ['MA', 34.02, -6.83], 'Marrakesh': ['MA', 31.63, -7.99],
	'Tunis': ['TN', 36.81, 10.18], 'Algiers': ['DZ', 36.75, 3.06], 'Oran': ['DZ', 35.69, -0.64],
	'Tripoli': ['LY', 32.89, 13.19], 'Benghazi': ['LY', 32.12, 20.07],
	'Nairobi': ['KE', -1.29, 36.82], 'Mombasa': ['KE', -4.04, 39.67],
	'Lagos': ['NG', 6.52, 3.38], 'Abuja': ['NG', 9.06, 7.49], 'Kano': ['NG', 12.0, 8.52],
	'Accra': ['GH', 5.6, -0.19], 'Kumasi': ['GH', 6.69, -1.62],
	'Addis Ababa': ['ET', 9.03, 38.74], 'Dakar': ['SN', 14.72, -17.47],
	'Johannesburg': ['ZA', -26.2, 28.05], 'Cape Town': ['ZA', -33.92, 18.42], 'Durban': ['ZA', -29.86, 31.03],
	'Pretoria': ['ZA', -25.75, 28.19], 'Port Elizabeth': ['ZA', -33.96, 25.6],
	'Moscow': ['RU', 55.75, 37.62], 'Saint Petersburg': ['RU', 59.93, 30.34], 'Novosibirsk': ['RU', 55.03, 82.92],
	'Yekaterinburg': ['RU', 56.84, 60.61], 'Nizhny Novgorod': ['RU', 56.3, 43.94], 'Kazan': ['RU', 55.79, 49.12],
	'Kyiv': ['UA', 50.45, 30.52], 'Kharkiv': ['UA', 49.99, 36.23], 'Odesa': ['UA', 46.48, 30.73],
	'Warsaw': ['PL', 52.23, 21.01], 'Krakow': ['PL', 50.06, 19.94], 'Wroclaw': ['PL', 51.11, 17.04],
	'Prague': ['CZ', 50.08, 14.44], 'Brno': ['CZ', 49.2, 16.61],
	'Budapest': ['HU', 47.5, 19.04], 'Debrecen': ['HU', 47.53, 21.64],
	'Bucharest': ['RO', 44.43, 26.1], 'Cluj-Napoca': ['RO', 46.77, 23.59],
	'Sofia': ['BG', 42.7, 23.32], 'Plovdiv': ['BG', 42.15, 24.75],
	'Belgrade': ['RS', 44.79, 20.45], 'Zagreb': ['HR', 45.81, 15.98], 'Ljubljana': ['SI', 46.06, 14.51],
	'Sarajevo': ['BA', 43.85, 18.41], 'Skopje': ['MK', 41.99, 21.43], 'Tirana': ['AL', 41.33, 19.82],
	'Athens': ['GR', 37.98, 23.73], 'Thessaloniki': ['GR', 40.64, 22.94],
	'Istanbul': ['TR', 41.01, 28.98], 'Ankara': ['TR', 39.93, 32.86], 'Izmir': ['TR', 38.42, 27.14],
	'Bursa': ['TR', 40.19, 29.06], 'Antalya': ['TR', 36.9, 30.71],
	'Minsk': ['BY', 53.9, 27.57], 'Vilnius': ['LT', 54.69, 25.28], 'Riga': ['LV', 56.95, 24.11],
	'Tallinn': ['EE', 59.44, 24.75],
	'Tbilisi': ['GE', 41.69, 44.83], 'Yerevan': ['AM', 40.18, 44.51], 'Baku': ['AZ', 40.41, 49.87],
	'Almaty': ['KZ', 43.22, 76.85], 'Astana': ['KZ', 51.16, 71.43], 'Shymkent': ['KZ', 42.34, 69.59],
	'Tashkent': ['UZ', 41.31, 69.24], 'Samarkand': ['UZ', 39.65, 66.97],
	'Ashgabat': ['TM', 37.96, 58.38], 'Dushanbe': ['TJ', 38.56, 68.77], 'Bishkek': ['KG', 42.87, 74.59],
	'Kabul': ['AF', 34.55, 69.2], 'Ulaanbaatar': ['MN', 47.92, 106.92],
	'Pyongyang': ['KP', 39.02, 125.75],
	'Christchurch': ['NZ', -43.53, 172.64], 'Hamilton': ['NZ', -37.79, 175.28],
	'Reykjavik': ['IS', 64.15, -21.94], 'Tbilisi': ['GE', 41.69, 44.83],
	'Valletta': ['MT', 35.9, 14.51], 'Nicosia': ['CY', 35.18, 33.36],
	'Luxembourg': ['LU', 49.61, 6.13], 'Monaco': ['MC', 43.74, 7.42],
	'Vaduz': ['LI', 47.14, 9.52], 'San Marino': ['SM', 43.94, 12.45],
	'Central': ['HK', 22.28, 114.16] // DB-IP labels HK as "Central"
};

/* Build a case-insensitive lookup. */
const CITIES_LOOKUP = new Map();
for (const [name, geo] of Object.entries(CITIES)) {
	CITIES_LOOKUP.set(name.toLowerCase().trim(), geo);
}

/* ----------------------- country bounding boxes ----------------------- */
/* ISO 3166-1 alpha-2 → [minLat, maxLat, minLng, maxLng]. Used as a fallback
 * when the city isn't in the curated map. Countries not listed are skipped. */
const BOUNDS = {
	AD: [42.4, 42.7, 1.4, 1.8], AE: [22.6, 26.1, 51.4, 56.6], AF: [29.4, 38.5, 60.5, 74.9],
	AG: [16.9, 17.7, -62.0, -61.6], AI: [18.1, 18.4, -63.2, -62.9], AL: [39.6, 42.7, 19.3, 21.1],
	AM: [38.8, 41.6, 43.4, 46.7], AO: [-18.0, -5.9, 11.7, 24.1], AR: [-55.1, -21.8, -73.6, -53.6],
	AT: [46.4, 49.0, 9.5, 17.2], AU: [-43.7, -10.4, 113.3, 153.6], AW: [12.4, 12.6, -70.1, -69.9],
	AZ: [38.4, 41.9, 44.8, 50.8], BA: [42.6, 45.3, 15.7, 19.6], BB: [13.0, 13.3, -59.7, -59.4],
	BD: [20.5, 26.6, 88.0, 92.7], BE: [49.5, 51.5, 2.5, 6.4], BF: [9.4, 15.1, -5.5, 2.4],
	BG: [41.2, 44.2, 22.4, 28.6], BH: [25.5, 26.3, 50.4, 50.8], BI: [-4.5, -2.3, 29.0, 30.8],
	BJ: [6.2, 12.4, 0.8, 3.9], BN: [4.0, 5.1, 114.1, 115.4], BO: [-22.9, -9.7, -69.6, -57.5],
	BR: [-33.8, 5.3, -73.9, -34.8], BS: [20.9, 27.9, -80.5, -72.7], BT: [26.7, 28.2, 88.8, 92.1],
	BW: [-26.9, -17.8, 19.9, 29.4], BY: [51.3, 56.2, 23.2, 32.8], BZ: [15.9, 18.5, -89.2, -87.8],
	CA: [41.7, 83.1, -141.0, -52.6], CD: [-13.5, 5.4, 12.2, 31.3], CF: [2.2, 11.0, 14.4, 27.5],
	CG: [-5.0, 3.7, 11.2, 18.7], CH: [45.8, 47.8, 5.9, 10.5], CI: [4.2, 10.7, -8.6, -2.5],
	CL: [-56.0, -17.5, -75.7, -66.4], CM: [1.7, 13.1, 8.3, 16.2], CN: [18.2, 53.6, 73.6, 134.8],
	CO: [-4.2, 12.5, -81.7, -66.9], CR: [8.0, 11.2, -86.0, -82.5], CU: [19.8, 23.2, -84.9, -74.1],
	CY: [34.6, 35.7, 32.3, 34.6], CZ: [48.5, 51.1, 12.1, 18.9], DE: [47.3, 55.1, 5.9, 15.0],
	DJ: [10.9, 12.7, 41.8, 43.7], DK: [54.6, 57.8, 8.0, 12.7], DO: [17.5, 19.9, -72.0, -68.3],
	DZ: [18.9, 37.1, -8.7, 12.0], EC: [-5.0, 1.4, -81.1, -75.2], EE: [57.5, 59.7, 21.8, 28.2],
	EG: [22.0, 31.7, 24.7, 37.0], ER: [12.4, 18.0, 36.4, 43.1], ES: [35.9, 43.8, -9.4, 3.3],
	ET: [3.4, 14.9, 33.0, 48.0], FI: [59.8, 70.1, 19.2, 31.6], FJ: [-21.8, -12.5, 174.6, -178.0],
	FM: [5.3, 10.1, 137.3, 163.0], FR: [41.3, 51.1, -5.1, 9.6], GA: [-3.9, 2.3, 8.7, 14.5],
	GB: [49.9, 60.9, -8.6, 1.8], GD: [11.9, 12.3, -61.8, -61.4], GE: [41.0, 43.6, 40.0, 46.7],
	GH: [4.7, 11.2, -3.3, 1.3], GM: [13.1, 13.8, -16.8, -13.8], GN: [7.2, 12.7, -15.0, -7.6],
	GQ: [0.9, 3.8, 9.3, 11.3], GR: [34.8, 41.8, 19.6, 28.3], GT: [13.7, 17.8, -92.2, -88.2],
	GW: [10.6, 12.7, -16.7, -13.6], GY: [1.2, 8.6, -61.4, -56.5], HN: [13.0, 16.5, -89.4, -83.0],
	HR: [42.2, 46.6, 13.5, 19.4], HT: [18.0, 20.1, -74.5, -71.6], HU: [45.7, 48.6, 16.1, 22.9],
	ID: [-11.0, 6.1, 95.0, 141.0], IE: [51.4, 55.4, -10.7, -5.4], IL: [29.5, 33.4, 34.3, 35.9],
	IN: [6.7, 35.5, 68.1, 97.4], IQ: [29.1, 37.4, 38.8, 48.6], IR: [25.0, 39.8, 44.0, 63.3],
	IS: [63.3, 66.6, -24.5, -13.5], IT: [35.5, 47.1, 6.6, 18.8], JM: [17.7, 18.5, -78.4, -76.2],
	JO: [29.2, 33.4, 34.9, 39.3], JP: [24.3, 45.6, 122.9, 153.9], KE: [-4.7, 4.6, 33.9, 41.9],
	KG: [39.2, 43.2, 69.3, 80.2], KH: [9.3, 14.7, 102.3, 107.6], KI: [-11.4, 3.4, 169.0, -171.0],
	KM: [-12.4, -11.3, 43.0, 44.5], KN: [17.1, 17.4, -62.9, -62.5], KP: [38.6, 43.0, 124.2, 130.7],
	KR: [33.2, 38.6, 124.6, 131.9], KW: [28.5, 30.1, 46.6, 48.8], KZ: [40.6, 55.4, 46.5, 87.3],
	LA: [13.9, 22.5, 100.1, 107.7], LB: [33.0, 34.7, 35.1, 36.6], LC: [13.7, 14.1, -61.1, -60.9],
	LI: [47.0, 47.3, 9.5, 9.6], LK: [5.9, 9.8, 79.7, 81.9], LR: [4.3, 8.5, -11.5, -7.4],
	LS: [-30.7, -28.6, 27.0, 29.5], LT: [53.9, 56.5, 20.9, 26.8], LU: [49.4, 50.2, 5.7, 6.5],
	LV: [55.6, 58.1, 20.6, 28.2], LY: [19.5, 33.2, 9.3, 25.2], MA: [21.3, 35.9, -13.2, -1.0],
	MD: [45.5, 48.5, 26.6, 30.2], ME: [41.9, 43.6, 18.4, 20.4], MG: [-25.6, -12.0, 43.0, 50.5],
	MW: [-17.1, -9.4, 32.7, 35.9], MX: [14.5, 32.7, -118.4, -86.7], MY: [0.9, 7.4, 99.6, 119.3],
	MZ: [-26.9, -10.5, 30.2, 40.8], NA: [-28.9, -16.9, 11.5, 25.3], NE: [11.7, 23.5, 0.2, 16.0],
	NG: [4.3, 13.9, 2.7, 14.7], NI: [10.7, 15.0, -87.7, -83.1], NL: [50.8, 53.5, 3.3, 7.2],
	NO: [57.9, 71.2, 4.6, 31.2], NP: [26.3, 30.4, 80.1, 88.2], NZ: [-52.6, -29.2, 166.4, -175.3],
	OM: [16.6, 26.6, 51.9, 60.0], PA: [7.2, 9.7, -83.1, -77.2], PE: [-18.3, -0.0, -81.4, -68.7],
	PG: [-11.7, -1.3, 141.0, 156.8], PH: [4.6, 21.1, 116.9, 126.6], PK: [23.6, 37.1, 60.9, 77.8],
	PL: [49.0, 54.8, 14.1, 24.2], PT: [36.8, 42.2, -9.5, -6.2], PW: [3.0, 8.1, 131.1, 134.7],
	PY: [-27.6, -19.3, -62.6, -54.3], QA: [24.5, 26.2, 50.8, 51.7], RO: [43.6, 48.3, 20.3, 29.7],
	RS: [42.2, 46.2, 18.8, 23.0], RU: [41.2, 82.1, 19.0, 180.0], RW: [-2.9, -1.0, 28.9, 30.9],
	SA: [16.0, 32.1, 34.5, 55.7], SB: [-13.0, -5.0, 155.5, 170.8], SC: [-10.0, -3.5, 46.2, 56.3],
	SD: [9.0, 22.2, 22.0, 38.6], SE: [55.3, 69.1, 11.0, 24.2], SG: [1.1, 1.5, 103.6, 104.1],
	SI: [45.4, 46.9, 13.4, 16.6], SK: [47.7, 49.6, 16.8, 22.6], SL: [6.9, 10.0, -13.3, -10.2],
	SN: [12.3, 16.7, -17.5, -11.3], SO: [-1.7, 12.0, 40.9, 51.4], SR: [1.8, 6.0, -58.1, -53.9],
	SS: [3.5, 12.2, 24.1, 35.9], SV: [13.1, 14.4, -90.1, -87.7], SY: [32.3, 37.3, 35.7, 42.4],
	SZ: [-27.3, -25.7, 30.8, 32.1], TD: [7.4, 23.5, 13.5, 24.0], TG: [6.1, 11.1, -1.4, 1.3],
	TH: [5.6, 20.5, 97.3, 105.7], TJ: [36.7, 41.0, 67.3, 75.1], TL: [-9.5, -8.1, 124.0, 127.4],
	TM: [35.1, 42.8, 52.4, 66.7], TN: [30.2, 37.6, 7.5, 11.6], TO: [-21.9, -15.4, -176.3, -173.0],
	TR: [35.8, 42.1, 25.6, 45.0], TT: [10.0, 11.4, -61.9, -60.9], TW: [21.9, 25.3, 119.4, 122.0],
	TZ: [-11.7, -0.9, 29.3, 40.6], UA: [44.4, 52.4, 22.1, 40.2], UG: [-1.5, 4.2, 29.3, 35.0],
	US: [24.4, 49.4, -125.0, -66.9], UY: [-36.0, -30.1, -58.4, -53.1], UZ: [37.2, 45.6, 55.9, 73.1],
	VA: [41.9, 41.9, 12.2, 12.5], VE: [0.6, 12.2, -73.4, -59.8], VN: [8.2, 23.4, 102.1, 109.5],
	VU: [-20.3, -13.1, 166.3, 170.2], WS: [-14.1, -13.4, -172.8, -171.2], YE: [12.1, 19.0, 42.5, 54.6],
	ZA: [-34.8, -22.1, 16.5, 33.0], ZM: [-18.1, -8.2, 21.9, 33.7], ZW: [-22.4, -15.6, 25.2, 33.1],
	HK: [22.1, 22.6, 113.8, 114.5], MO: [22.1, 22.2, 113.5, 113.6]
};

function inBounds(lat, lng, country) {
	const b = BOUNDS[country];
	if (!b) return null; // unknown country — can't verify, skip
	const [minLat, maxLat, minLng, maxLng] = b;
	// Handle antimeridian crossing (e.g. NZ, FJ, KI) where maxLng < minLng.
	if (maxLng < minLng) {
		return lat >= minLat && lat <= maxLat && (lng >= minLng || lng <= maxLng);
	}
	return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
}

/* ------------------------------ DB helpers ------------------------------ */

function getDb() {
	const dbUrl = process.env.DATABASE_URL || '';
	if (/^postgres(ql)?:\/\//i.test(dbUrl)) {
		return { kind: 'pg', conn: pg(dbUrl) };
	}
	const pgHost = process.env.PGHOST || process.env.POSTGRES_HOST || '';
	if (pgHost) {
		const conn = pg({
			host: pgHost,
			port: Number(process.env.PGPORT || process.env.POSTGRES_PORT || 5432),
			database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'postgres',
			user: process.env.PGUSER || process.env.POSTGRES_USER || '',
			password: process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD || ''
		});
		return { kind: 'pg', conn };
	}
	const path = process.env.STATSMAN_DATABASE_PATH || process.env.DATABASE_PATH || './data/statsman.db';
	if (!existsSync(path)) {
		console.error(`SQLite DB not found at ${path}`);
		process.exit(1);
	}
	return { kind: 'sqlite', conn: new Database(path, { readonly: !apply }) };
}

const apply = process.argv.includes('--apply');
const fillCities = process.argv.includes('--fill-cities');

/* --------------------- reverse geocoding (Nominatim) --------------------- */
/* OpenStreetMap's Nominatim — free, no API key. Public usage policy requires
 * max 1 req/sec, a descriptive User-Agent, and no heavy batch use. We
 * reverse-geocode DISTINCT coordinate groups (not individual rows), so even
 * thousands of unknown-city rows collapse to a few hundred lookups at most. */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'Statsman-GeoCleanup/1.0 (https://statsman.xyz)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
	const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&accept-language=en`;
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) return null;
	const data = await res.json();
	// jsonv2 returns address.city, address.town, address.village, address.hamlet…
	const a = data?.address ?? {};
	const name = a.city || a.town || a.village || a.hamlet || a.municipality || a.county || null;
	return name ? name.slice(0, 80) : null;
}

async function runFillCities(kind, conn) {
	// Distinct coordinate groups where city is unknown but coords exist.
	// Round to 2 dp when grouping so nearby pins collapse to one lookup.
	const sql =
		kind === 'pg'
			? `SELECT ROUND(lat::numeric, 2) AS rl, ROUND(lng::numeric, 2) AS rn,
			          AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*)::int AS n
			   FROM events
			   WHERE (city IS NULL OR city = '' OR city = 'Unknown')
			     AND lat IS NOT NULL AND lng IS NOT NULL
			   GROUP BY rl, rn ORDER BY n DESC`
			: `SELECT ROUND(lat, 2) AS rl, ROUND(lng, 2) AS rn,
			          AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*) AS n
			   FROM events
			   WHERE (city IS NULL OR city = '' OR city = 'Unknown')
			     AND lat IS NOT NULL AND lng IS NOT NULL
			   GROUP BY rl, rn ORDER BY n DESC`;

	const groups = kind === 'pg' ? await conn.unsafe(sql) : conn.prepare(sql).all();
	console.log(`Found ${groups.length} distinct coordinate groups with unknown cities.`);

	if (groups.length === 0) {
		console.log('Nothing to fill — all cities are known.');
		return;
	}

	let resolved = 0;
	let failed = 0;
	let totalUpdated = 0;

	for (let i = 0; i < groups.length; i++) {
		const g = groups[i];
		const lat = Number(g.lat);
		const lng = Number(g.lng);
		const n = Number(g.n);

		process.stdout.write(`  [${i + 1}/${groups.length}] ${lat.toFixed(2)},${lng.toFixed(2)} (${n} rows) → `);

		let city = null;
		try {
			city = await reverseGeocode(lat, lng);
		} catch {
			city = null;
		}

		if (city) {
			resolved++;
			console.log(`"${city}"`);
			if (apply) {
				// Update all rows near these coords (within ~0.01° of the group avg).
				if (kind === 'pg') {
					const res = await conn`UPDATE events SET city = ${city}
					           WHERE (city IS NULL OR city = '' OR city = 'Unknown')
					             AND lat IS NOT NULL AND lng IS NOT NULL
					             AND ABS(lat - ${lat}) < 0.01 AND ABS(lng - ${lng}) < 0.01`;
					totalUpdated += res.count ?? 0;
				} else {
					const res = conn
						.prepare(
							`UPDATE events SET city = ?
							 WHERE (city IS NULL OR city = '' OR city = 'Unknown')
							   AND lat IS NOT NULL AND lng IS NOT NULL
							   AND ABS(lat - ?) < 0.01 AND ABS(lng - ?) < 0.01`
						)
						.run(city, lat, lng);
					totalUpdated += res.changes;
				}
			}
		} else {
			failed++;
			console.log('(no result)');
		}

		// Respect Nominatim's 1 req/sec policy.
		if (i < groups.length - 1) await sleep(1100);
	}

	console.log(`\nResolved ${resolved}/${groups.length} groups (${failed} failed).`);
	if (apply) console.log(`Updated ${totalUpdated} rows.`);
	else console.log('Dry run — re-run with --apply to write the city names.');
}

async function main() {
	const { kind, conn } = getDb();

	if (fillCities) {
		console.log(
			apply
				? 'FILL-CITIES APPLY — unknown cities WILL be reverse-geocoded and written.'
				: 'FILL-CITIES DRY RUN — will reverse-geocode but NOT write. Pass --apply to fill.'
		);
		await runFillCities(kind, conn);
		return;
	}

	console.log(
		apply
			? 'APPLY mode — mismatched rows WILL be fixed.'
			: 'DRY RUN — no changes. Pass --apply to fix.'
	);

	// Fetch distinct (city, country, lat, lng) groups that have all geo fields.
	const sql =
		kind === 'pg'
			? `SELECT city, country, AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*)::int AS n
			   FROM events WHERE city IS NOT NULL AND city != '' AND country IS NOT NULL AND country != ''
			     AND lat IS NOT NULL AND lng IS NOT NULL
			   GROUP BY city, country ORDER BY n DESC`
			: `SELECT city, country, AVG(lat) AS lat, AVG(lng) AS lng, COUNT(*) AS n
			   FROM events WHERE city IS NOT NULL AND city != '' AND country IS NOT NULL AND country != ''
			     AND lat IS NOT NULL AND lng IS NOT NULL
			   GROUP BY city, country ORDER BY n DESC`;

	const rows = kind === 'pg' ? await conn.unsafe(sql) : conn.prepare(sql).all();

	// Two detection passes.
	const cityFixes = []; // city known → correct country + coords (trust the CF city)
	const coordNukes = []; // coords outside country bounds → null city + lat + lng
	let skipped = 0;

	for (const r of rows) {
		const lat = Number(r.lat);
		const lng = Number(r.lng);
		const country = String(r.country).toUpperCase();
		const city = String(r.city);
		const n = Number(r.n);

		// Pass 1: is the city a known major city in a DIFFERENT country?
		const ref = CITIES_LOOKUP.get(city.toLowerCase().trim());
		if (ref) {
			const [refCountry, refLat, refLng] = ref;
			if (refCountry !== country) {
				cityFixes.push({ city, country, lat, lng, n, refCountry, refLat, refLng });
				continue;
			}
			// City + country agree — even if coords are slightly off, the pin
			// label is correct. Leave it (coords are averaged anyway).
			continue;
		}

		// Pass 2: city not in the reference — do the coords at least match the country?
		const check = inBounds(lat, lng, country);
		if (check === null) {
			skipped++;
			continue;
		}
		if (!check) {
			coordNukes.push({ city, country, lat, lng, n });
		}
	}

	console.log(`\nScanned ${rows.length} distinct (city, country) groups (${skipped} skipped — country not in bounds table).`);
	console.log(`Found ${cityFixes.length} city-mismatch groups (fixable via city reference).`);
	console.log(`Found ${coordNukes.length} coords-mismatch groups (coords outside country — will null).\n`);

	const allMismatches = [...cityFixes, ...coordNukes];
	if (allMismatches.length === 0) {
		console.log('No mismatches — nothing to do.');
		return;
	}

	if (cityFixes.length) {
		console.log('City mismatches (will correct country + coords to match the city):');
		for (const m of cityFixes.slice(0, 50)) {
			console.log(
				`  ${m.city} · ${m.country} @ ${m.lat.toFixed(2)},${m.lng.toFixed(2)} → ${m.refCountry} @ ${m.refLat},${m.refLng} — ${m.n} rows`
			);
		}
		if (cityFixes.length > 50) console.log(`  … and ${cityFixes.length - 50} more`);
	}
	if (coordNukes.length) {
		console.log('\nCoords mismatches (will null city + lat + lng):');
		for (const m of coordNukes.slice(0, 50)) {
			console.log(`  ${m.city} · ${m.country} @ ${m.lat.toFixed(2)},${m.lng.toFixed(2)} — ${m.n} rows`);
		}
		if (coordNukes.length > 50) console.log(`  … and ${coordNukes.length - 50} more`);
	}

	if (!apply) {
		console.log('\nDry run complete. Re-run with --apply to fix these groups.');
		return;
	}

	let totalUpdated = 0;

	// Fix city mismatches: trust the city, correct country + coords.
	for (const m of cityFixes) {
		if (kind === 'pg') {
			const res = await conn`UPDATE events SET country = ${m.refCountry}, lat = ${m.refLat}, lng = ${m.refLng}
			           WHERE city = ${m.city} AND country = ${m.country}
			             AND lat IS NOT NULL AND lng IS NOT NULL`;
			totalUpdated += res.count ?? 0;
		} else {
			const res = conn
				.prepare(
					`UPDATE events SET country = ?, lat = ?, lng = ?
					 WHERE city = ? AND country = ? AND lat IS NOT NULL AND lng IS NOT NULL`
				)
				.run(m.refCountry, m.refLat, m.refLng, m.city, m.country);
			totalUpdated += res.changes;
		}
	}

	// Nuke coords mismatches: can't trust anything, null city + lat + lng.
	for (const m of coordNukes) {
		if (kind === 'pg') {
			const res = await conn`UPDATE events SET city = NULL, lat = NULL, lng = NULL
			           WHERE city = ${m.city} AND country = ${m.country}
			             AND lat IS NOT NULL AND lng IS NOT NULL`;
			totalUpdated += res.count ?? 0;
		} else {
			const res = conn
				.prepare(
					`UPDATE events SET city = NULL, lat = NULL, lng = NULL
					 WHERE city = ? AND country = ? AND lat IS NOT NULL AND lng IS NOT NULL`
				)
				.run(m.city, m.country);
			totalUpdated += res.changes;
		}
	}

	console.log(`\nUpdated ${totalUpdated} rows across ${allMismatches.length} mismatched groups.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
