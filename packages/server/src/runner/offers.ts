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

/** An offer block's info string: its language, then its kind. */
const INFO = /^uraeda-offer[ \t]+(change|feature)[ \t]*$/u;

/** A fence's opening line: up to three spaces, a run of backticks or tildes, then the info string. */
const OPENING = /^( {0,3})(`{3,}|~{3,})(.*)$/u;

/** A fence's closing line: up to three spaces, a run of its character, then nothing but blanks. */
const CLOSING = /^ {0,3}(`+|~+)[ \t]*$/u;

/** A block's body as the card reads it: trimmed, its lines ending in LF. */
export const offerBody = (code: string) => code.replaceAll("\r\n", "\n").trim();

/**
 * The offer blocks of a text, in order, read as markdown reads fences (CommonMark): a fence of N
 * backticks or tildes closes on a line of the same character, N or more of them, with nothing after
 * it, so a block quoted inside an outer fence is text, not an offer. A fence left open, as the one of
 * a message still streaming, runs to the end of the text and is no offer.
 */
function offersOf(text: string): Array<Offer> {
  const offers: Array<Offer> = [];
  let open: { body: Array<string>; fence: string; indent: number; kind?: OfferKind } | undefined;
  for (const raw of text.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (open === undefined) {
      const opening = OPENING.exec(line);
      const info = opening?.[3]?.trim() ?? "";
      // A backtick fence's info string holds no backtick, or the line is not a fence.
      if (opening && !(opening[2].startsWith("`") && info.includes("`"))) {
        open = { body: [], fence: opening[2], indent: opening[1].length };
        const kind = INFO.exec(info)?.[1];
        if (kind !== undefined) {
          open.kind = kind as OfferKind;
        }
      }
      continue;
    }
    const closing = CLOSING.exec(line)?.[1];
    if (
      closing !== undefined &&
      closing[0] === open.fence[0] &&
      closing.length >= open.fence.length
    ) {
      const body = offerBody(open.body.join("\n"));
      if (open.kind !== undefined && body !== "") {
        offers.push({ body, kind: open.kind });
      }
      open = undefined;
    } else {
      // The content's lines lose the indent of the fence that opened them, as far as they have it.
      open.body.push(line.replace(new RegExp(`^ {0,${open.indent}}`, "u"), ""));
    }
  }
  return offers;
}

/** The last closed offer block of a message's text: a block still open is text. */
export function lastOffer(text: string): Offer | undefined {
  return offersOf(text).at(-1);
}

/** A proposal's title: its first line, without the heading's `#`. */
export function proposalTitle(proposal: string): string {
  const first = proposal.trim().split("\n")[0] ?? "";
  return first.replace(/^#+\s*/u, "").trim();
}
