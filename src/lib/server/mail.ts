import { getMailFrom, getPublicOrigin, getResendApiKey } from '$lib/server/config';

export async function sendMagicLink(email: string, token: string): Promise<{ devLink?: string }> {
	const link = `${getPublicOrigin()}/auth/verify?token=${encodeURIComponent(token)}`;
	const apiKey = getResendApiKey();

	if (!apiKey) {
		console.info(`[statsman] Magic link for ${email}: ${link}`);
		return { devLink: link };
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: getMailFrom(),
			to: [email],
			subject: 'Your Statsman login link',
			text: `Sign in to Statsman:\n\n${link}\n\nThis link expires in 15 minutes.`
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Resend failed: ${res.status} ${body}`);
	}

	return {};
}
