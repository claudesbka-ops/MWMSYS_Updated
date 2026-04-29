import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

/**
 * Email service for OTP and transactional messages.
 *
 * Send precedence:
 *   1. Resend HTTP API     — if RESEND_API_KEY is set (preferred on hosts that
 *                            block outbound SMTP, e.g. Railway).
 *   2. SMTP (nodemailer)   — if SMTP_HOST / SMTP_USER / SMTP_PASS are all set.
 *   3. Console fallback    — logs the OTP to stdout and reports fallback=true
 *                            so the client can show a "check server logs" hint
 *                            in development.
 */

let cachedTransporter: Transporter | null = null;
let cachedConfigOk: boolean | null = null;

function readSmtpConfig() {
  const host = (process.env.SMTP_HOST ?? "").toString().trim();
  const port = Number((process.env.SMTP_PORT ?? "587").toString().trim());
  const user = (process.env.SMTP_USER ?? "").toString().trim();
  const pass = (process.env.SMTP_PASS ?? "").toString();
  const from = (process.env.SMTP_FROM ?? "").toString().trim() || user || "no-reply@mwms.local";
  return { host, port, user, pass, from };
}

function isSmtpConfigured(): boolean {
  if (cachedConfigOk != null) return cachedConfigOk;
  const { host, user, pass } = readSmtpConfig();
  cachedConfigOk = Boolean(host && user && pass);
  return cachedConfigOk;
}

function getTransporter(): Transporter | null {
  if (cachedTransporter) return cachedTransporter;
  if (!isSmtpConfigured()) return null;

  const { host, port, user, pass } = readSmtpConfig();
  cachedTransporter = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) && port > 0 ? port : 587,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export type OtpType = "email_verification" | "password_reset";

function humanLabel(type: OtpType): string {
  switch (type) {
    case "email_verification":
      return "email verification";
    case "password_reset":
      return "password reset";
    default:
      return "verification";
  }
}

let cachedResend: Resend | null = null;

function getResendClient(): Resend | null {
  const key = (process.env.RESEND_API_KEY ?? "").toString().trim();
  if (!key) return null;
  if (cachedResend) return cachedResend;
  try {
    cachedResend = new Resend(key);
    return cachedResend;
  } catch (err) {
    console.error("[emailService] failed to instantiate Resend client", err);
    return null;
  }
}

function resolveFromAddress(): string {
  const explicit = (process.env.RESEND_FROM ?? "").toString().trim();
  if (explicit) return explicit;
  const smtpFrom = (process.env.SMTP_FROM ?? "").toString().trim();
  if (smtpFrom) return smtpFrom;
  return "MWMS <onboarding@resend.dev>";
}

export async function sendOtpEmail(to: string, otp: string, type: OtpType): Promise<{ sent: boolean; fallback: boolean }> {
  const target = (to ?? "").toString().trim();
  if (!target) {
    console.warn("[emailService] sendOtpEmail called with empty recipient — skipping send.");
    return { sent: false, fallback: true };
  }

  const label = humanLabel(type);
  const subject = "Your MWMS Verification Code";
  const textBody = [
    `Your verification code is: ${otp}`,
    `Valid for 15 minutes. Do not share this code.`,
  ].join("\n");
  const htmlBody = [
    `<p>Your MWMS ${label} code is:</p>`,
    `<p style="font-size:22px;letter-spacing:0.25em;font-weight:700;margin:12px 0">${otp}</p>`,
    `<p style="color:#555;font-size:13px">Valid for 15 minutes. Do not share this code.</p>`,
  ].join("");

  // Preferred path: Resend HTTP API (works on Railway where SMTP is blocked).
  const resend = getResendClient();
  if (resend) {
    try {
      const { error } = await resend.emails.send({
        from: resolveFromAddress(),
        to: target,
        subject,
        text: textBody,
        html: htmlBody,
      });
      if (error) {
        console.error(
          `[emailService] Resend API rejected send — falling back. to=${target} type=${type} otp=${otp}`,
          error
        );
      } else {
        return { sent: true, fallback: false };
      }
    } catch (err) {
      console.error(
        `[emailService] Resend send threw — falling back. to=${target} type=${type} otp=${otp}`,
        err
      );
    }
  }

  // Secondary path: SMTP via nodemailer.
  if (isSmtpConfigured()) {
    const transporter = getTransporter();
    if (transporter) {
      const { from } = readSmtpConfig();
      try {
        await transporter.sendMail({
          from,
          to: target,
          subject,
          text: textBody,
          html: htmlBody,
        });
        return { sent: true, fallback: false };
      } catch (err) {
        console.error(
          `[emailService] sendMail failed — falling back to console log. to=${target} type=${type} otp=${otp}`,
          err
        );
      }
    }
  }

  // Tertiary path: console log fallback so dev work continues without creds.
  console.warn(
    `[emailService] No email provider available — OTP logged to console only. to=${target} type=${type} otp=${otp}`
  );
  return { sent: true, fallback: true };
}

/** Generate a zero-padded 6-digit numeric OTP. */
export function generate6DigitOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}
