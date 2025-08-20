import nodemailer, { Transporter } from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
} = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  // Fail fast so you don't silently swallow sends
  console.error('❌ SMTP env vars missing. Check .env');
}

export const transporter: Transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT || 465),
  secure: String(SMTP_SECURE ?? 'true') === 'true', // 465=true, 587=false
  pool: true,
  maxConnections: 3,
  maxMessages: 100,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
  // timeouts tuned to prevent "Unexpected socket close"
  connectionTimeout: 20_000,
  greetingTimeout: 20_000,
  socketTimeout: 30_000,
});

export async function verifyTransport() {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified and ready.');
  } catch (err) {
    console.error('❌ SMTP verification failed:', err);
  }
}

export async function sendMailSafe(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      ...opts,
    });
    return { ok: true, info };
  } catch (err) {
    console.error('❌ sendMail error:', err);
    return { ok: false, error: err };
  }
}
