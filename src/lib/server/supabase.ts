import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
	getSupabaseAnonKey,
	getSupabaseServiceRoleKey,
	getSupabaseUrl,
	supabaseAuthConfigured
} from '$lib/server/config';

/** Stateless server client for Auth API calls (no cookie persistence). */
export function createSupabaseAuthClient(): SupabaseClient {
	const url = getSupabaseUrl();
	const key = getSupabaseAnonKey();
	if (!url || !key) throw new Error('Supabase Auth is not configured');
	return createClient(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false
		}
	});
}

/** Service-role client for admin ops (optional). */
export function createSupabaseAdminClient(): SupabaseClient | null {
	const url = getSupabaseUrl();
	const key = getSupabaseServiceRoleKey();
	if (!url || !key) return null;
	return createClient(url, key, {
		auth: {
			persistSession: false,
			autoRefreshToken: false
		}
	});
}

export { supabaseAuthConfigured };
