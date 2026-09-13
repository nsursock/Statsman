import { getContactEmail, getMailFrom, getPublicOrigin, getResendApiKey } from '$lib/server/config';
import { parseInternalPath } from '$lib/server/auth';

export async function sendMagicLink(
	email: string,
	token: string,
	next?: string | null
): Promise<{ devLink?: string }> {
	const url = new URL('/auth/verify', getPublicOrigin());
	url.searchParams.set('token', token);
	const safeNext = parseInternalPath(next);
	if (safeNext) url.searchParams.set('next', safeNext);

	const link = url.toString();
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

/** Forward a /contact form submission to the operator inbox. */
export async function sendContactMessage(input: {
	name: string;
	email: string;
	message: string;
}): Promise<{ dev?: boolean }> {
	const { name, email, message } = input;
	const to = getContactEmail();
	const apiKey = getResendApiKey();

	const text = `New contact form message via Statsman:\n\nFrom: ${name} <${email}>\n\n${message}\n\n— sent from ${getPublicOrigin()}`;

	if (!apiKey) {
		console.info(
			`[statsman] Contact form (dev, not sent):\nTo: ${to}\nFrom: ${email}\n${text}`
		);
		return { dev: true };
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: getMailFrom(),
			to: [to],
			replyTo: email,
			subject: `Statsman contact · ${name}`,
			text
		})
	});

	if (!res.ok) {
		const body = await res.text();
		throw new Error(`Resend failed: ${res.status} ${body}`);
	}

	return {};
}
