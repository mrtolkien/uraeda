// The agent's offers to move a session up, as its messages hold them: the grammar of the block. The
// server reads it to start the change a job's run offers, and the web UI reads it to draw the card,
// so a block means the same to both (R4).

/** What an offer moves: a session to a change, or a change to a feature. */
export type OfferKind = "change" | "feature";

/**
 * An offer block, ` ```uraeda-offer change ` or ` ```uraeda-offer feature `: its body is the
 * change's proposal, `# Title` first, or the reason to make the change a feature.
 */
export type Offer = { body: string; kind: OfferKind };

/** An offer block, closed: its kind, then its body, its lines ending in LF or CRLF. */
const BLOCK = /^```uraeda-offer[ \t]+(change|feature)[ \t]*\r?\n([\s\S]*?)\r?\n```[ \t]*\r?$/gmu;

/** A block's body as the card reads it: trimmed, its lines ending in LF. */
export const offerBody = (code: string) => code.replaceAll("\r\n", "\n").trim();

/** The last closed offer block of a message's text: a block still open is text. */
export function lastOffer(text: string): Offer | undefined {
  let last: Offer | undefined;
  for (const match of text.matchAll(BLOCK)) {
    last = { body: offerBody(match[2]), kind: match[1] as OfferKind };
  }
  return last;
}

/** A proposal's title: its first line, without the heading's `#`. */
export function proposalTitle(proposal: string): string {
  const first = proposal.trim().split("\n")[0] ?? "";
  return first.replace(/^#+\s*/u, "").trim();
}
