import nodemailer, { type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

export type EmailEnv = Record<string, string | undefined>;

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  messageId: string | null;
  delivered: boolean;
}

let cachedTransporter: Transporter | null = null;

/**
 * Resolved lazily per call so tests and builds can inspect or override provider.
 */
export function getEmailProvider(env: EmailEnv = process.env): string {
  return String(env.EMAIL_PROVIDER || 'smtp').trim().toLowerCase();
}

/**
 * Delivery defaults to true in production, false otherwise, overridable by EMAIL_DELIVERY_ENABLED.
 */
export function isEmailDeliveryEnabled(env: EmailEnv = process.env): boolean {
  const raw = env.EMAIL_DELIVERY_ENABLED;
  if (raw !== undefined && raw.trim() !== '') {
    const normalized = raw.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
      return false;
    }
  }

  return (env.NODE_ENV || 'development') === 'production';
}

/**
 * Validates provider configuration. Returns null when valid, or a descriptive issue string.
 */
export function getEmailConfigIssue(env: EmailEnv = process.env): string | null {
  const provider = getEmailProvider(env);

  if (provider === 'gmail') {
    const user = String(env.GMAIL_USER || '').trim();
    const from = String(env.EMAIL_FROM || '').trim();
    const appPassword = String(env.GMAIL_APP_PASSWORD || '').trim();
    const clientId = String(env.GMAIL_CLIENT_ID || '').trim();
    const clientSecret = String(env.GMAIL_CLIENT_SECRET || '').trim();
    const refreshToken = String(env.GMAIL_REFRESH_TOKEN || '').trim();

    const hasAuth = Boolean(appPassword || (clientId && clientSecret && refreshToken));
    if (!user || !from || !hasAuth) {
      // i18n-ignore: operator-facing config error, never shown in the UI
      return 'Set EMAIL_PROVIDER=gmail, GMAIL_USER, EMAIL_FROM and either GMAIL_APP_PASSWORD or Gmail OAuth2 credentials';
    }
    return null;
  }

  const host = String(env.SMTP_HOST || '').trim();
  const from = String(env.EMAIL_FROM || '').trim();
  const rawPort = env.SMTP_PORT;
  const port = rawPort !== undefined && rawPort.trim() !== '' ? Number(rawPort) : NaN;
  const hasValidPort = Number.isInteger(port) && port > 0 && port <= 65535;

  if (!host || !hasValidPort || !from) {
    // i18n-ignore: operator-facing config error, never shown in the UI
    return 'Set SMTP_HOST, valid SMTP_PORT, and EMAIL_FROM';
  }

  return null;
}

/**
 * Asserts that email delivery is properly configured, throwing an Error if not.
 */
export function assertEmailConfigured(env: EmailEnv = process.env): void {
  const issue = getEmailConfigIssue(env);
  if (issue) {
    throw new Error(issue);
  }
}

/**
 * Builds nodemailer transport options for Gmail (app password or OAuth2) or SMTP.
 */
export function buildTransportOptions(env: EmailEnv = process.env): SMTPTransport.Options {
  const provider = getEmailProvider(env);

  if (provider === 'gmail') {
    const gmailUser = String(env.GMAIL_USER || '').trim();
    const gmailAppPassword = String(env.GMAIL_APP_PASSWORD || '').trim();

    if (gmailAppPassword) {
      return {
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      };
    }

    return {
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId: String(env.GMAIL_CLIENT_ID || '').trim(),
        clientSecret: String(env.GMAIL_CLIENT_SECRET || '').trim(),
        refreshToken: String(env.GMAIL_REFRESH_TOKEN || '').trim(),
        accessToken: String(env.GMAIL_ACCESS_TOKEN || '').trim() || undefined,
      },
    };
  }

  const authUser = String(env.SMTP_USER || '').trim();
  const authPass = String(env.SMTP_PASS || '');
  const secure = ['true', '1', 'yes'].includes(String(env.SMTP_SECURE || '').trim().toLowerCase());
  const port = env.SMTP_PORT ? Number(env.SMTP_PORT) : 587;

  return {
    host: env.SMTP_HOST,
    port,
    secure,
    auth: authUser || authPass ? { user: authUser, pass: authPass } : undefined,
  };
}

/**
 * Root URL for emailed links (e.g. password resets). Required in production.
 */
export function getPublicBaseUrl(env: EmailEnv = process.env): string {
  const isProd = (env.NODE_ENV || 'development') === 'production';
  const raw = env.PUBLIC_BASE_URL?.trim();

  if (isProd) {
    if (!raw) {
      throw new Error('PUBLIC_BASE_URL must be set in production');
    }
    return raw.replace(/\/+$/, '');
  }

  return (raw || 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Returns the cached transporter or instantiates one from the environment.
 */
export function getTransporter(env: EmailEnv = process.env): Transporter {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(buildTransportOptions(env));
  }
  return cachedTransporter;
}

/**
 * Resets the cached transporter (for test isolation).
 */
export function resetTransporter(): void {
  cachedTransporter = null;
}

/**
 * Sends an email or logs to console when delivery is disabled.
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  headers,
}: SendEmailOptions): Promise<SendEmailResult> {
  if (!isEmailDeliveryEnabled()) {
    console.info(
      `[email:dev] Email delivery disabled (EMAIL_DELIVERY_ENABLED=false)\n` +
        `To: ${to}\n` +
        `Subject: ${subject}\n` +
        `Body:\n${text}\n`
    );
    return {
      messageId: null,
      delivered: false,
    };
  }

  assertEmailConfigured();

  const from = process.env.EMAIL_FROM;
  const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;

  const transporter = getTransporter();
  const info = await transporter.sendMail({
    from,
    replyTo,
    to,
    subject,
    text,
    html,
    headers,
  });

  return {
    messageId: info?.messageId || null,
    delivered: true,
  };
}
