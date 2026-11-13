// The New page's one draft, shared by its three kinds: the text, kept on the device as it is typed
// (a new session, a change, and a feature start from the same words, and the kind can change after
// typing), the line of the priorities it was filled from, and the images held for it while the app
// runs. A proposal's Start with no file of its own fills it, and opens the page.
import { signal, untracked } from "nsh";
import { navigate } from "../../store";
import type { ChatImage, ProposalItem } from "../../store/protocol";
import { type Held, keepForChat } from "../images";
import { amendUnsaved, type Taken, unsavedKey, unsavedText } from "../../ui/text";

/** The draft's key on the device. */
export const draftKey = (repo: string) => unsavedKey(repo, "new#draft");

/** The line of `PRIORITIES.md` each repository's draft was filled from: its link replaces it. */
const lines = signal<Readonly<Record<string, string>>>({});

export const lineOf = (repo: string): string | null => lines()[repo] ?? null;

export const forgetLine = (repo: string) => {
  const { [repo]: _, ...rest } = untracked(lines);
  lines.set(rest);
};

/** The images held for each repository's draft, not sent yet. */
const held = signal<Readonly<Record<string, ReadonlyArray<Held>>>>({});

export const heldFor = (repo: string) => held()[repo] ?? [];

export const hold = (repo: string, images: ReadonlyArray<Held>) => {
  if (images.length > 0)
    held.set({ ...untracked(held), [repo]: [...untracked(() => heldFor(repo)), ...images] });
};

export const release = (repo: string, keep: (image: Held) => boolean = () => false) =>
  held.set({ ...untracked(held), [repo]: untracked(() => heldFor(repo)).filter(keep) });

/** The images held for `repo`'s draft, as a start takes them: back before those added since. */
export const imagesOf = (repo: string): Taken<ReadonlyArray<Held>> => ({
  putBack: (taken) =>
    held.set({ ...untracked(held), [repo]: [...taken, ...untracked(() => heldFor(repo))] }),
  take: () => {
    const taken = untracked(() => heldFor(repo));
    release(repo);
    return taken;
  },
});

/** Sends `images` to the server, for a start or a first message to take. */
export const sentImages = (repo: string, images: ReadonlyArray<Held>): Promise<Array<ChatImage>> =>
  Promise.all(images.map((image) => keepForChat(repo, image)));

/** `text` added under what the draft holds, a blank line between. */
export function addToDraft(repo: string, text: string) {
  amendUnsaved(draftKey(repo), (now) => (now.trim() === "" ? text : `${now.trimEnd()}\n\n${text}`));
}

/** A proposal's words, with its nested lines as a list under them. */
export function proposalText(proposal: ProposalItem): string {
  const nested = proposal.nested.map((line) => `- ${line}`);
  return [proposal.text, ...(nested.length > 0 ? ["", ...nested] : [])].join("\n");
}

/** Starts from a proposal with no file: its words in the draft, its line kept, the page opened. */
export function startFromLine(repo: string, proposal: ProposalItem, kind: "feature" | "change") {
  addToDraft(repo, proposalText(proposal));
  lines.set({ ...untracked(lines), [repo]: proposal.text });
  navigate({ kind, page: "new", repo });
}

/**
 * The draft, as the page's composer holds it: its text, kept as it is typed, and its send, which
 * takes the text as it is when a start is asked and gives it back if the start is refused. Leaving
 * the page does not ask: the draft stays on the device for the next start.
 */
export const draftOf = (repo: () => string) =>
  unsavedText(
    () => draftKey(repo()),
    () => "",
    { guards: false },
  );
