import { RARITIES, RARITY_FLAVOUR, type Rarity } from "./constants";
import { alertToken } from "./session";
import { listAccounts, saveCreature } from "./store";
import { mailEnabled, sendBatch, type Message } from "./mail";
import type { Account, Creature } from "./types";

/**
 * The two things worth an email: someone new made it into the dex, and someone
 * already in it climbed a rarity tier. Everything here is best-effort — the
 * caller's request has already succeeded by the time we are asked to send, and
 * a mail provider having a bad day must not turn that into a failed approval.
 */

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://primafacie.in").replace(/\/$/, "");
}

function dexNo(creature: Creature): string {
  return creature.dexNumber ? `No.${String(creature.dexNumber).padStart(3, "0")}` : "";
}

/** Recipients: an address on file, and alerts still switched on. */
async function audience(excludeUsername?: string): Promise<Account[]> {
  const accounts = await listAccounts();
  const skip = excludeUsername?.toLowerCase();
  return accounts.filter(
    (a) => a.alerts && a.email && a.username.toLowerCase() !== skip,
  );
}

/* -------------------------------------------------------------------------- */
/*  Template                                                                   */
/* -------------------------------------------------------------------------- */

function escape(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

/**
 * Plain, dark and centred. Mail clients are a hostile rendering target, so this
 * is table-free, inline-styled, and readable with images blocked — the sprite
 * is a nicety, never the message.
 */
function render(opts: {
  heading: string;
  creature: Creature;
  line: string;
  unsubscribe: string;
}): { html: string; text: string } {
  const { heading, creature, line, unsubscribe } = opts;
  const site = siteUrl();
  const number = dexNo(creature);
  const title = creature.title ? `<div style="color:#8b9bb4;font-size:14px;margin-top:4px">${escape(creature.title)}</div>` : "";
  const sprite = /^https?:\/\//.test(creature.spriteUrl)
    ? `<img src="${escape(creature.spriteUrl)}" width="160" height="160" alt="" style="display:block;margin:0 auto 18px;image-rendering:pixelated;background:#070b10">`
    : "";

  const html = `<div style="background:#0b0f14;color:#dbe6f5;font-family:ui-monospace,Menlo,Consolas,monospace;padding:28px 18px">
  <div style="max-width:440px;margin:0 auto;background:#121a24;padding:24px;border:2px solid #05080c">
    <div style="color:#ffcb05;font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:18px">${escape(heading)}</div>
    ${sprite}
    <div style="font-size:20px;font-weight:bold">${escape(`${number} ${creature.name}`.trim())}</div>
    ${title}
    <p style="font-size:15px;line-height:1.5;color:#dbe6f5">${escape(line)}</p>
    <a href="${site}/dex" style="display:inline-block;margin-top:8px;background:#cf3a30;color:#fff;text-decoration:none;padding:12px 18px;font-size:13px;letter-spacing:.08em">OPEN THE DEX</a>
    <div style="margin-top:24px;font-size:11px;color:#6f8199;line-height:1.6">
      You get this because you added an email to your Ashoka Pokedex account.
      <a href="${unsubscribe}" style="color:#8b9bb4">Turn these off</a>.
    </div>
  </div>
</div>`;

  const text = `${heading}

${`${number} ${creature.name}`.trim()}${creature.title ? ` — ${creature.title}` : ""}

${line}

Open the dex: ${site}/dex

You get this because you added an email to your Ashoka Pokedex account.
Turn these off: ${unsubscribe}`;

  return { html, text };
}

function build(
  accounts: Account[],
  subject: string,
  heading: string,
  creature: Creature,
  line: string,
): Message[] {
  const site = siteUrl();
  return accounts.map((a) => {
    const { html, text } = render({
      heading,
      creature,
      line,
      unsubscribe: `${site}/api/alerts/unsubscribe?t=${encodeURIComponent(alertToken(a.id))}`,
    });
    return { to: a.email, subject, html, text };
  });
}

/* -------------------------------------------------------------------------- */
/*  Events                                                                     */
/* -------------------------------------------------------------------------- */

/** A new entry cleared the queue and is now in the public dex. */
export async function notifyApproved(creature: Creature): Promise<void> {
  if (!mailEnabled) return;
  try {
    // The person who submitted it already knows; everyone else is being told.
    const to = await audience(creature.submittedBy);
    await sendBatch(
      build(
        to,
        `${dexNo(creature)} ${creature.name} is in the dex`.trim(),
        "NEW DEX ENTRY",
        creature,
        creature.entry ||
          "A new entry just cleared the approval queue. Go and see whether you recognise them.",
      ),
    );
  } catch (e) {
    console.error(`notifyApproved: ${String((e as Error).message)}`);
  }
}

/** An entry climbed a rarity tier because more of campus reported seeing them. */
export async function notifyEvolved(creature: Creature, from: Rarity | null, to: Rarity): Promise<void> {
  if (!mailEnabled) return;
  try {
    const recipients = await audience();
    await sendBatch(
      build(
        recipients,
        `${creature.name} evolved to ${to}`,
        "EVOLUTION",
        creature,
        `${creature.name} just went ${from ? `from ${from} ` : ""}to ${to}. ${RARITY_FLAVOUR[to]}`,
      ),
    );
  } catch (e) {
    console.error(`notifyEvolved: ${String((e as Error).message)}`);
  }
}

/**
 * Record the tier an entry has been announced at, and announce it if that tier
 * went up. Returns true when mail was actually triggered.
 *
 * Rarity is derived from sightings rather than stored, so this is the only
 * thing standing between one recount and an inbox full of duplicates: the tier
 * is written back, and only a strictly higher one ever fires again.
 */
export async function announceRarity(creature: Creature, current: Rarity): Promise<boolean> {
  const seenAt = creature.notifiedRarity;
  if (seenAt && RARITIES.indexOf(current) <= RARITIES.indexOf(seenAt)) return false;

  creature.notifiedRarity = current;
  await saveCreature(creature);

  // Reaching the base tier is just "you got approved", which the approval mail
  // already covered. Only a genuine climb is an evolution.
  if (!seenAt) return false;

  await notifyEvolved(creature, seenAt, current);
  return true;
}
