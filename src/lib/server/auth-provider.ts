/**
 * Auth provider seam. Routes call ONLY this module for auth operations;
 * the implementation below uses Supabase Auth. To swap providers (self-hosted
 * GoTrue, Keycloak, etc.) reimplement these functions — no route changes needed.
 */
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseAuthClient } from '$lib/server/supabase';
import { supabaseAuthConfigured } from '$lib/server/config';

export type EmailTokenType = EmailOtpType;

export type AuthResult =
	| { ok: true; email: string; hasSession: boolean }
	| { ok: false; error: string };

export type AuthAck = { ok: true } | { ok: false; error: string };

export function authConfigured(): boolean {
	return supabaseAuthConfigured();
}

export async function signInWithPassword(
	email: string,
	password: string
): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });
	if (error) return { ok: false, error: error.message || 'Invalid email or password' };
	if (!data.user?.email) return { ok: false, error: 'Login failed' };
	return { ok: true, email: data.user.email, hasSession: Boolean(data.session) };
}

export async function signUpWithPassword(
	email: string,
	password: string,
	emailRedirectTo: string
): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	let appOrigin = '';
	try {
		appOrigin = new URL(emailRedirectTo).origin;
	} catch {
		appOrigin = '';
	}
	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo,
			// Email templates can build {{ .Data.app_origin }}/auth/callback
			// so the link host is ours even when Supabase Site URL is localhost.
			data: appOrigin ? { app_origin: appOrigin } : undefined
		}
	});
	if (error) return { ok: false, error: error.message || 'Could not create account' };
	return { ok: true, email: data.user?.email ?? email, hasSession: Boolean(data.session) };
}

export async function sendPasswordReset(
	email: string,
	redirectTo: string
): Promise<AuthAck> {
	const supabase = createSupabaseAuthClient();
	const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
	if (error) return { ok: false, error: error.message || 'Could not send reset email' };
	return { ok: true };
}

export async function exchangeCodeForEmail(code: string): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	const { data, error } = await supabase.auth.exchangeCodeForSession(code);
	if (error) return { ok: false, error: error.message || 'Could not confirm email' };
	if (!data.user?.email) return { ok: false, error: 'Could not confirm email' };
	return { ok: true, email: data.user.email, hasSession: Boolean(data.session) };
}

export async function verifyEmailToken(
	tokenHash: string,
	type: EmailTokenType
): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
	if (error) return { ok: false, error: error.message || 'Could not confirm email' };
	if (!data.user?.email) return { ok: false, error: 'Could not confirm email' };
	return { ok: true, email: data.user.email, hasSession: Boolean(data.session) };
}

export async function emailFromAccessToken(accessToken: string): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	const { data, error } = await supabase.auth.getUser(accessToken);
	if (error) return { ok: false, error: error.message || 'Invalid confirmation session' };
	if (!data.user?.email) return { ok: false, error: 'Invalid confirmation session' };
	return { ok: true, email: data.user.email, hasSession: false };
}

export async function resetPasswordWithToken(
	tokenHash: string,
	type: EmailTokenType,
	newPassword: string
): Promise<AuthResult> {
	const supabase = createSupabaseAuthClient();
	const { data, error: verifyErr } = await supabase.auth.verifyOtp({
		token_hash: tokenHash,
		type
	});
	if (verifyErr) return { ok: false, error: verifyErr.message || 'Invalid or expired reset link' };
	if (!data.user?.email) return { ok: false, error: 'Invalid or expired reset link' };
	if (data.session) {
		await supabase.auth.setSession(data.session);
	}
	const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
	if (updateErr) return { ok: false, error: updateErr.message || 'Could not update password' };
	return { ok: true, email: data.user.email, hasSession: Boolean(data.session) };
}
