# Email Notifications System

The UBMA CEIL backend uses a multi-provider email system to handle transactional notifications for enrollments, formation lifecycle changes, and teacher assignments.

## Configuration

The system is environment-driven and can be configured via `.env`.

| Variable | Description | Default |
| :--- | :--- | :--- |
| `NOTIFICATIONS_EMAIL_ENABLED` | Set to `true` to enable email dispatch. | `false` |
| `EMAIL_PROVIDER` | `resend` (production) or `console` (local development). | `console` |
| `EMAIL_FROM` | The sender address. Must be a verified domain in Resend. | None |
| `RESEND_API_KEY` | API Key from Resend dashboard. | None |

## Local Development

For local development, it is recommended to use the `console` provider to avoid domain verification issues.

```bash
NOTIFICATIONS_EMAIL_ENABLED=true
EMAIL_PROVIDER=console
EMAIL_FROM="CEIL UBMA <dev@localhost.test>"
```

In this mode, the server will log a full preview of the email to the terminal instead of sending it.

## Production Setup (Resend)

1. **Verify Domain**: Log in to [Resend](https://resend.com/domains) and add your custom domain (e.g., `ceil-annaba.dz`).
2. **DNS Records**: Add the required MX and TXT records to your DNS provider.
3. **API Key**: Generate a new API key.
4. **Configure Env**:
   ```bash
   NOTIFICATIONS_EMAIL_ENABLED=true
   EMAIL_PROVIDER=resend
   EMAIL_FROM="CEIL UBMA <noreply@ceil-annaba.dz>"
   RESEND_API_KEY=re_your_api_key
   ```

**IMPORTANT**: Resend will block dispatches from unverified domains (like `gmail.com`). Ensure `EMAIL_FROM` matches your verified domain.

## Business Rules

1. **Non-Blocking**: Email notifications are "fire-and-forget". If an email fails to send, the core business action (like assigning a teacher or processing an enrollment) will **still succeed**.
2. **Logging**: All email attempts are logged. Failures include a structured JSON error object for troubleshooting.
3. **BCC Strategy**: Bulk notifications (e.g., formation cancellations) use BCC to protect user privacy and optimize delivery.

## Troubleshooting

### Error: "The gmail.com domain is not verified"
**Cause**: You are trying to send an email from a Gmail address through Resend.
**Fix**: 
- **Local**: Set `EMAIL_PROVIDER=console` in `.env`.
- **Production**: Use an email address from a domain you have verified in the Resend dashboard.

### Emails are not appearing in the terminal
**Cause**: `NOTIFICATIONS_EMAIL_ENABLED` is set to `false`.
**Fix**: Set `NOTIFICATIONS_EMAIL_ENABLED=true`.
