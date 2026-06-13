# Supabase Auth email templates (BookMyCab branded)

Paste these into **Supabase Dashboard → Authentication → Emails → [template]**.
You **edit the built-in templates** (you can't add new ones). Each template has a
**Subject** field and an HTML **body** — set both. They mirror the app's branded
layout in `src/lib/email/templates.ts` (ink header, yellow "Automation" chip,
bordered CTA, footer) and are email-client safe (table layout, inline CSS,
bulletproof button, hidden preheader).

Supabase variables used: `{{ .ConfirmationURL }}` (the secure action link).
Others available: `{{ .Email }}`, `{{ .SiteURL }}`, `{{ .Token }}`.

Set **Authentication → URL Configuration**:
- Site URL: `https://bookmycab.io`
- Redirect URLs: `https://bookmycab.io/accept-invite`, `https://bookmycab.io/reset-password`

| Built-in template | Subject line | When it fires |
|---|---|---|
| Invite user | `Welcome to BookMyCab — set your password` | Admin adds a tenant user |
| Reset password | `Reset your BookMyCab password` | User requests a password reset |
| Magic link or OTP | `Your BookMyCab sign-in link` | Passwordless sign-in (if enabled) |
| Confirm sign up | `Confirm your email to activate BookMyCab` | Self-signup (disabled today) |

---

## 1. Invite user

**Subject:** `Welcome to BookMyCab — set your password`

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f4;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Set your password and sign in to your BookMyCab dashboard.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:3px solid #0a0a0a;">
          <tr><td style="background:#0a0a0a;padding:16px 24px;">
            <span style="font:800 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.02em;">BookMyCab</span>
            <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#ffd400;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
          </td></tr>
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0a;letter-spacing:-0.01em;">Welcome to BookMyCab</h1>
            <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">Your account is ready. You've been added to your taxi booking automation. Set a password below to sign in and open your dashboard.</p>
            <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">From there you can watch bookings arrive in real time, review conversations and calls, and manage your automation settings.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
              <td style="background:#ffd400;border:3px solid #0a0a0a;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">Set your password</a></td>
            </tr></table>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">This link expires in 24 hours and can be used once. If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="margin:0 0 14px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0a0a0a;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">If you weren't expecting this, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:20px 24px;border-top:2px solid #0a0a0a;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">BookMyCab by FlowMo AI LTD. You're receiving this because your organisation uses BookMyCab. Need help? Just reply to this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 2. Reset password

**Subject:** `Reset your BookMyCab password`

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f4;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Choose a new password for your BookMyCab account.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:3px solid #0a0a0a;">
          <tr><td style="background:#0a0a0a;padding:16px 24px;">
            <span style="font:800 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.02em;">BookMyCab</span>
            <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#ffd400;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
          </td></tr>
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0a;letter-spacing:-0.01em;">Reset your password</h1>
            <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">We received a request to reset your BookMyCab password. Choose a new one below. If you didn't ask for this, you can ignore this email and your password stays the same.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
              <td style="background:#ffd400;border:3px solid #0a0a0a;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">Choose a new password</a></td>
            </tr></table>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">This link expires in 1 hour and can be used once. If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="margin:0 0 14px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0a0a0a;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">For your security, never share this link with anyone.</p>
          </td></tr>
          <tr><td style="padding:20px 24px;border-top:2px solid #0a0a0a;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">BookMyCab by FlowMo AI LTD. You're receiving this because a password reset was requested for your account. Need help? Just reply to this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 3. Magic link or OTP

**Subject:** `Your BookMyCab sign-in link`

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f4;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Your secure one-time sign-in link for BookMyCab.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:3px solid #0a0a0a;">
          <tr><td style="background:#0a0a0a;padding:16px 24px;">
            <span style="font:800 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.02em;">BookMyCab</span>
            <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#ffd400;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
          </td></tr>
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0a;letter-spacing:-0.01em;">Sign in to BookMyCab</h1>
            <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">Click below to sign in to your BookMyCab dashboard. No password needed.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
              <td style="background:#ffd400;border:3px solid #0a0a0a;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">Sign in to BookMyCab</a></td>
            </tr></table>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">This link expires in 1 hour and can be used once. If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="margin:0 0 14px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0a0a0a;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">If you didn't request this, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:20px 24px;border-top:2px solid #0a0a0a;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">BookMyCab by FlowMo AI LTD. You're receiving this because a sign-in link was requested for your account. Need help? Just reply to this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

## 4. Confirm sign up

**Subject:** `Confirm your email to activate BookMyCab`

> Only fires if self-signup is enabled. BookMyCab is invite-only today
> (`DISABLE_SIGNUP=true`), so this template is optional, kept here for completeness.

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f4;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Confirm your email address to activate your BookMyCab account.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:3px solid #0a0a0a;">
          <tr><td style="background:#0a0a0a;padding:16px 24px;">
            <span style="font:800 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.02em;">BookMyCab</span>
            <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#ffd400;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
          </td></tr>
          <tr><td style="padding:28px 24px 8px;">
            <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0a;letter-spacing:-0.01em;">Confirm your email</h1>
            <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">Thanks for signing up. Confirm your email address below to activate your BookMyCab account and open your dashboard.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr>
              <td style="background:#ffd400;border:3px solid #0a0a0a;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">Confirm email address</a></td>
            </tr></table>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">This link expires in 24 hours and can be used once. If the button doesn't work, copy and paste this URL into your browser:</p>
            <p style="margin:0 0 14px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;word-break:break-all;"><a href="{{ .ConfirmationURL }}" style="color:#0a0a0a;">{{ .ConfirmationURL }}</a></p>
            <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">If you didn't create a BookMyCab account, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:20px 24px;border-top:2px solid #0a0a0a;">
            <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">BookMyCab by FlowMo AI LTD. Need help? Just reply to this email.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
```

---

### Notes
- Yellow (`#ffd400`) always carries **dark ink** text, never white (brand rule).
- Keep copy free of internal terms (n8n, "workflow", CabLab) — say "automation".
- The button is a bordered table cell with a padded anchor: renders in Outlook,
  Gmail, Apple Mail without VML. The plain URL fallback covers text-only clients.
- After pasting, verify `{{ .ConfirmationURL }}` survived intact in both the
  button `href` and the fallback link (some editors HTML-escape pasted text).
