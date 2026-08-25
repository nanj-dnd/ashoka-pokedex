/**
 * Outbound email through Resend.
 *
 * Sending is entirely optional: with RESEND_API_KEY or RESEND_FROM unset the
 * dex behaves exactly as it did before alerts existed, which is what keeps the
 * local JSON backend and anyone's fork running with no mail provider at all.
 *
 * Resend's REST API is a single POST, so there is no SDK here — one fewer
 * dependency in a repo whose whole point is that it is small.
 */

const API = "https://api.resend.com/emails/batch";
const KEY = process.env.RESEND_API_KEY?.trim();
const FROM = process.env.RESEND_FROM?.trim();

/** Resend accepts at most 100 messages per batch call. */
const BATCH_LIMIT = 100;

export const mailEnabled = Boolean(KEY && FROM);

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function normaliseEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 200) : "";
}

/**
 * Deliberately loose. The only real test of an address is whether mail to it
 * arrives, and a stricter pattern here would reject valid addresses while
 * catching nothing that matters.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(email) && email.length <= 200;
}

/**
 * Send a batch. Never throws: a dex entry going live is the important event,
 * and the mail about it failing must not take the request down with it. The
 * caller gets back how many were accepted so a route can log it if it cares.
 */
export async function sendBatch(messages: Message[]): Promise<number> {
  if (!mailEnabled || !messages.length) return 0;

  let sent = 0;
  for (let i = 0; i < messages.length; i += BATCH_LIMIT) {
    const chunk = messages.slice(i, i + BATCH_LIMIT);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          chunk.map((m) => ({
            from: FROM,
            to: [m.to],
            subject: m.subject,
            html: m.html,
            text: m.text,
          })),
        ),
      });
      if (res.ok) {
        sent += chunk.length;
      } else {
        console.error(`resend: ${res.status} ${(await res.text()).slice(0, 300)}`);
      }
    } catch (e) {
      console.error(`resend: ${String((e as Error).message)}`);
    }
  }
  return sent;
}
