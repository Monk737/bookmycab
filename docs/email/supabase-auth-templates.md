# Supabase Auth email templates (BookMyCab branded)

Paste these into **Supabase Dashboard → Authentication → Emails → [template]**.
They mirror the app's branded layout in `src/lib/email/templates.ts` (ink
header, yellow "Automation" chip, bordered CTA, footer) and are email-client
safe (table layout, inline CSS, bulletproof button, hidden preheader).

Supabase template variables used: `{{ .ConfirmationURL }}` (the secure action
link). Others available: `{{ .Email }}`, `{{ .SiteURL }}`, `{{ .Token }}`.

Set **Authentication → URL Configuration**:
- Site URL: `https://bookmycab.io`
- Redirect URLs: `https://bookmycab.io/accept-invite`, `https://bookmycab.io/reset-password`

---

## 1. Invite user

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f6f6f4;-webkit-text-size-adjust:100%;">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
      Set your password and sign in to your BookMyCab dashboard.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f4;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:3px solid #0a0a0a;">
            <!-- Header -->
            <tr>
              <td style="background:#0a0a0a;padding:16px 24px;">
                <span style="font:800 20px/1 Arial,Helvetica,sans-serif;color:#ffffff;letter-spacing:-0.02em;">BookMyCab</span>
                <span style="display:inline-block;margin-left:8px;padding:2px 8px;background:#ffd400;font:700 11px/1.4 Arial,Helvetica,sans-serif;color:#0a0a0a;text-transform:uppercase;letter-spacing:0.06em;">Automation</span>
              </td>
            </tr>
            <!-- Body -->
            <tr>
              <td style="padding:28px 24px 8px;">
                <h1 style="margin:0 0 16px;font:800 22px/1.25 Arial,Helvetica,sans-serif;color:#0a0a0a;letter-spacing:-0.01em;">Welcome to BookMyCab</h1>
                <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">
                  Your account is ready. You've been added to your taxi booking automation. Set a password below to sign in and open your dashboard.
                </p>
                <p style="margin:0 0 14px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:#0a0a0a;">
                  From there you can watch bookings arrive in real time, review conversations and calls, and manage your automation settings.
                </p>
                <!-- Bulletproof CTA -->
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                  <tr>
                    <td style="background:#ffd400;border:3px solid #0a0a0a;">
                      <a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:12px 28px;font:700 15px/1 Arial,Helvetica,sans-serif;color:#0a0a0a;text-decoration:none;letter-spacing:0.02em;">Set your password</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">
                  This link expires in 24 hours and can be used once. If the button doesn't work, copy and paste this URL into your browser:
                </p>
                <p style="margin:0 0 14px;font:400 12px/1.5 Arial,Helvetica,sans-serif;color:#52525b;word-break:break-all;">
                  <a href="{{ .ConfirmationURL }}" style="color:#0a0a0a;">{{ .ConfirmationURL }}</a>
                </p>
                <p style="margin:0 0 8px;font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">
                  If you weren't expecting this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td style="padding:20px 24px;border-top:2px solid #0a0a0a;">
                <p style="margin:0;font:400 12px/1.6 Arial,Helvetica,sans-serif;color:#52525b;">
                  BookMyCab by FlowMo AI LTD. You're receiving this because your organisation uses BookMyCab. Need help? Just reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

---

## 2. Magic Link / Confirm sign-in

Same shell as above with these swaps:

- **Preheader:** `Your secure sign-in link for BookMyCab.`
- **Heading:** `Sign in to BookMyCab`
- **First paragraph:** `Click below to sign in to your BookMyCab dashboard. No password needed.`
- **Remove** the second paragraph.
- **CTA label:** `Sign in to BookMyCab`
- **Expiry line:** `This link expires in 1 hour and can be used once.`

---

## 3. Reset Password

Same shell with these swaps:

- **Preheader:** `Reset your BookMyCab password.`
- **Heading:** `Reset your password`
- **First paragraph:** `We received a request to reset your BookMyCab password. Choose a new one below. If you didn't ask for this, you can ignore this email and your password stays the same.`
- **Remove** the second paragraph.
- **CTA label:** `Choose a new password`
- **Expiry line:** `This link expires in 1 hour and can be used once.`

---

## 4. Confirm signup (only if you ever enable self-signup; currently disabled)

Same shell with these swaps:

- **Preheader:** `Confirm your email to activate BookMyCab.`
- **Heading:** `Confirm your email`
- **First paragraph:** `Thanks for signing up. Confirm your email address to activate your BookMyCab account.`
- **CTA label:** `Confirm email address`

---

### Notes
- Yellow (`#ffd400`) always carries **dark ink** text, never white (brand rule).
- Keep copy free of internal terms (n8n, "workflow", CabLab) — say "automation".
- The button is a bordered table cell with a padded anchor: renders in Outlook,
  Gmail, Apple Mail without VML. The plain URL fallback covers text-only clients.
```
