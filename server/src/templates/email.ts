export function verifyTemplate(verifyUrl: string) {
  return {
    subject: 'Confirm your subscription — Nakoda Mobile',
    text: `Thanks for subscribing to Nakoda Mobile.\n\nConfirm your email: ${verifyUrl}\n\nIf you didn’t request this, you can ignore it.`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
        <h2 style="margin:0 0 12px">Confirm your subscription</h2>
        <p style="color:#555;margin:0 0 20px">Thanks for subscribing to Nakoda Mobile. Please confirm your email address.</p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">
            Confirm Subscription
          </a>
        </p>
        <p style="color:#777;font-size:13px;margin-top:24px">If the button doesn’t work, copy and paste this link:</p>
        <code style="display:block;word-break:break-all;color:#444">${verifyUrl}</code>
      </div>
    `,
  };
}
