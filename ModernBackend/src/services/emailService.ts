import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email service for OTP and transactional messages.
 *
 * Reads SMTP config from env:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * If any of SMTP_HOST / SMTP_USER / SMTP_PASS is missing the service falls
 * back to logging the OTP to console. This lets development proceed without
 * real credentials while making the fallback obvious in server logs.
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

export async function sendOtpEmail(to: string, otp: string, type: OtpType): Promise<{ sent: boolean; fallback: boolean }> {
  const target = (to ?? "").toString().trim();
  if (!target) {
    console.warn("[emailService] sendOtpEmail called with empty recipient — skipping send.");
    return { sent: false, fallback: true };
  }

  if (!isSmtpConfigured()) {
    console.warn(
      `[emailService] SMTP not configured — OTP logged to console only. to=${target} type=${type} otp=${otp}`
    );
    return { sent: true, fallback: true };
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(
      `[emailService] SMTP not configured — OTP logged to console only. to=${target} type=${type} otp=${otp}`
    );
    return { sent: true, fallback: true };
  }

  const { from } = readSmtpConfig();
  const label = humanLabel(type);
  const subject = `Your MWMS ${label} code`;
  const textBody = [
    `Your MWMS ${label} code is: ${otp}`,
    ``,
    `This code expires in 15 minutes. If you did not request it, you can safely ignore this email.`,
  ].join("\n");
  const htmlBody = [
    `<p>Your MWMS ${label} code is:</p>`,
    `<p style="font-size:22px;letter-spacing:0.25em;font-weight:700;margin:12px 0">${otp}</p>`,
    `<p style="color:#555;font-size:13px">This code expires in 15 minutes. If you did not request it, you can safely ignore this email.</p>`,
  ].join("");

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
    console.error(`[emailService] sendMail failed — falling back to console log. to=${target} type=${type} otp=${otp}`, err);
    return { sent: false, fallback: true };
  }
}

/** Generate a zero-padded 6-digit numeric OTP. */
export function generate6DigitOtp(): string {
  const n = Math.floor(Math.random() * 1_000_000);
  return n.toString().padStart(6, "0");
}
