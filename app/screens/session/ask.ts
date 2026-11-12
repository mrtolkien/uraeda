// Asking the agent about one point without losing one's place: a question of a round, a settled
// point, a part of a spec under review. The point goes, quoted, at the start of the composer of
// the feature's session, which opens beside the page, in the other stack, its composer focused:
// the question stays in view, and nothing is sent until the human sends it (rule 2).
import { untracked } from "nsh";
import { record } from "../../store";
import { besideOpener } from "../../ui/layout";
import { readUnsaved, writeUnsaved } from "../../ui/text";
import { draftKey, focusComposer } from "./Composer";
import { sessionBeside } from "./index";

/** `header`, then each line quoted: `> line`. */
export function quoted(header: string, lines: ReadonlyArray<string>): string {
  return [header, ...lines.map((line) => `> ${line}`)].join("\n");
}

/** A draft with `quote` at its start: what was typed stays after it, a quote already there once. */
export function withQuote(text: string, quote: string): string {
  if (text.startsWith(quote)) return text;
  return text.trim() === "" ? `${quote}\n\n` : `${quote}\n\n${text}`;
}

/** Asks the agent: `quote`, then `text` if any, in the composer. */
export type Ask = (quote: string, text?: string) => void;

/**
 * How a pane of the feature in `folder` asks its agent: `undefined` while the feature is not read,
 * or has no folder of its own. Called in a pane's view: the session opens beside that pane.
 */
export function useAsk(repo: string, folder: string): () => Ask | undefined {
  const feature = record("Feature", { id: folder, repo });
  const open = besideOpener();
  return () => {
    if (folder === "" || feature() == null) return undefined;
    return (quote, text) => {
      const session = untracked(feature)?.session ?? null;
      const key = draftKey(repo, session, folder);
      const held = untracked(() => readUnsaved(key)?.text ?? "");
      const asked = text === undefined || text.trim() === "" ? quote : `${quote}\n\n${text.trim()}`;
      writeUnsaved(key, { at: new Date().toISOString(), base: "", text: withQuote(held, asked) });
      focusComposer(key);
      open(sessionBeside({ folder, fresh: false, repo, session: "" }));
    };
  };
}
