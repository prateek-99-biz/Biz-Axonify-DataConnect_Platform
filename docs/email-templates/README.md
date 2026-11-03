# Branded Emails

Supabase sends three emails: the invitation, the password reset and the sign-up confirmation. By default they are plain. These
three files are branded versions with the Biz Group logo and the platform's colours. They cannot be applied from the code, so
paste them into the Supabase dashboard.

## Apply Them

1. Open the Supabase project, then **Authentication → Email Templates**.
2. For each row below, choose the template, set the **Subject**, and paste the whole file into **Message body**. Save.

| Supabase template | File | Subject |
|---|---|---|
| Invite user | `invite.html` | You have been invited to Biz Customer Intelligence |
| Reset password | `reset-password.html` | Reset your Biz Customer Intelligence password |
| Confirm signup | `confirm-signup.html` | Confirm your email address |

3. Check **Authentication → URL Configuration**: the **Site URL** must be the live address (the Vercel domain). The logo in each
   email loads from `{{ .SiteURL }}/biz-group-logo.png`, so a wrong Site URL means a broken logo.
4. Send yourself a test: **Settings → User Management → Add User** with a work address you can open.

## Notes

- `{{ .ConfirmationURL }}` and `{{ .SiteURL }}` are Supabase's own placeholders. Leave them exactly as written.
- The templates use tables and inline styles, because email programs ignore most modern CSS.
- Supabase's built-in email service is limited to a few messages an hour. For real rollout, add your own SMTP under
  **Authentication → SMTP Settings**.
