# Statsman Auth emails (Supabase + Resend SMTP)

Supabase’s built-in mailer is for testing only. To use **custom HTML templates** (and reliable delivery), enable **custom SMTP** with [Resend](https://resend.com).

## 1. Resend

1. Create a Resend account → add and **verify a domain** (DNS: SPF, DKIM, etc.).
2. Create an API key (`re_…`).
3. Pick a from-address on that domain, e.g. `Statsman <auth@yourdomain.com>`  
   (`onboarding@resend.dev` works for a quick test to *your own* Resend account email only.)

## 2. Supabase → custom SMTP

Dashboard → **Authentication** → **Email** → **SMTP Settings** (enable):

| Field | Value |
| --- | --- |
| Sender email | `auth@yourdomain.com` |
| Sender name | `Statsman` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (`re_…`) |

Save. Auth mail now goes through Resend.

Optional one-click: [Resend ↔ Supabase integration](https://resend.com/docs/knowledge-base/getting-started-with-resend-and-supabase).

After SMTP is on, raise Auth **rate limits** if needed (default stays low until you bump it).

## 3. Paste branded templates

Dashboard → **Authentication** → **Email** → **Templates**:

| Template | File | Subject |
| --- | --- | --- |
| Confirm signup | [`confirm-signup.html`](./confirm-signup.html) | `Confirm your Statsman account` |
| Reset password | [`reset-password.html`](./reset-password.html) | `Reset your Statsman password` |

Keep `{{ .ConfirmationURL }}` and `{{ .Email }}` unchanged.

## 4. URL config (same as before)

- **Site URL** = `PUBLIC_ORIGIN` (e.g. `https://statsman-production.up.railway.app` or `http://localhost:5173` for local)
- **Redirect URLs**: `{PUBLIC_ORIGIN}/auth/callback`, `{PUBLIC_ORIGIN}/auth/reset`

## 5. App env (optional)

Resend on **Railway/app** is only needed if Statsman itself sends mail (legacy magic-link). Auth confirm/reset use Supabase → Resend SMTP, so these are optional for Auth:

```bash
# Optional — app-side Resend (not required for Supabase Auth SMTP)
# RESEND_API_KEY=re_xxx
# MAIL_FROM=Statsman <auth@yourdomain.com>
```

## Notes

- Templates are **inline HTML tables** so Gmail/Apple Mail keep the Statsman look.
- Colors: `#050010` bg, `#ff2e9a` primary, `#2ee6ff` cyan, monospace type.
- Do not remove `{{ .ConfirmationURL }}` — that is the signed link.
