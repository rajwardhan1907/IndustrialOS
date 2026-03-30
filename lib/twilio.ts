// lib/twilio.ts
// Phase 11 — WhatsApp Order Updates via Twilio
// Lazy init — won't crash at build time if keys are missing.

import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

export function getTwilio() {
  if (_client) return _client;
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set.");
  }
  _client = twilio(sid, token);
  return _client;
}

// The WhatsApp number you registered with Twilio (e.g. "whatsapp:+14155238886")
export function getTwilioWhatsAppFrom(): string {
  return process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";
}

// Build the message text for each stage
export function buildWhatsAppMessage(
  customerName: string,
  orderId:      string,
  sku:          string,
  stage:        string,
  companyName:  string,
): string {
  const stageMessages: Record<string, string> = {
    Confirmed:  `✅ Hi ${customerName}, your order *${orderId}* (${sku}) has been *confirmed* by ${companyName} and is being prepared.`,
    Picked:     `📦 Hi ${customerName}, your order *${orderId}* (${sku}) has been *picked* and is ready for dispatch.`,
    Shipped:    `🚚 Hi ${customerName}, your order *${orderId}* (${sku}) is on its way! It has been *shipped* by ${companyName}.`,
    Delivered:  `🎉 Hi ${customerName}, your order *${orderId}* (${sku}) has been *delivered*. Thank you for your business!`,
  };
  return stageMessages[stage] ?? `📋 Hi ${customerName}, your order *${orderId}* is now *${stage}*.`;
}
