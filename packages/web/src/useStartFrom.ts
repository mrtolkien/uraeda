// What the New page writes from its composer: a feature's proposal file, made from an inbox note,
// a proposal line, or a title, which opens in the editor.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { Priorities } from "uraeda-server/fate";
import { readProposalFile } from "./attach/useEditorImages.ts";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { startable } from "./NewEntries.tsx";
import { plain } from "./Spans.tsx";
import { refusal } from "./errors.ts";
import { withFreshBase } from "./freshBase.ts";
import { splitProposal } from "./pane/proposalText.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { ProposalFileView, InboxView, PrioritiesView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A proposal line of the priorities, as the view reads it: its id, and the file it links. */
type StartLine = { file?: { path: string } | null; id: string };

/** A call's result: a proposal file's path, or the refusal to show. */
type Made = { error: string } | { value: string };

/** The section a note or a title is written into: the work starts now. */
const NOW = "now";

/** A mutation's result as `Made`, from the field of its result that names what it made. */
function made(result: { error?: unknown; result?: unknown }, field: "path"): Made {
  const value = (result.result as Record<string, unknown> | undefined)?.[field];
  if (result.error || typeof value !== "string") {
    return { error: result.error ? refusal(result.error).message : "Nothing was made." };
  }
  return { value };
}

/**
 * Turns the note into a new proposal file in Now, or moves its note file there: the note leaves
 * `INBOX.md`.
 */
async function noteFile(fate: Fate, note: { id: string }): Promise<Made> {
  const result = await withFreshBase(
    (mode) => Promise.all([readInbox(fate, mode), readPrioritiesHash(fate, mode)]),
    ([inbox, prioritiesHash]) =>
      fate.mutations.inbox.toProposalFile({
        input: { hash: inbox.hash, note: note.id, prioritiesHash, section: NOW },
        view: ProposalFileView,
      }),
  );
  rereadChanges(fate);
  return made(result, "path");
}

/** The proposal's file: the one it links, or a new one it is expanded into. */
async function lineFile(fate: Fate, entry: StartLine): Promise<Made> {
  if (entry.file) {
    return { value: entry.file.path };
  }
  return made(
    await withFreshBase(
      (mode) => readPrioritiesHash(fate, mode),
      (hash) =>
        fate.mutations.proposals.expand({
          input: { hash, proposal: entry.id },
          view: ProposalFileView,
        }),
    ),
    "path",
  );
}

/**
 * Drafts the title as the first of Now's proposals that has not started, its file, and `body`
 * under its heading, in one request: the started ones stay above it. A refused draft leaves Now as
 * it was.
 */
async function titleFile(fate: Fate, title: string, body: string): Promise<Made> {
  const drafted = made(
    await fate.mutations.proposals.draft({
      input: { body, section: NOW, title },
      view: ProposalFileView,
    }),
    "path",
  );
  // The count of changes the priorities and the inbox carry: the draft's line is one.
  rereadChanges(fate);
  return drafted;
}

/**
 * An entry the New page's composer was filled from: its kind, id, text, and own file, if it has
 * one.
 */
export type Taken = {
  id: string;
  kind: "line" | "note";
  linked?: string | undefined;
  text: string;
};

/**
 * The ID of the startable line of `priorities` whose text is `text`, the one of `id` when several
 * are: a start moves the lines of Now, so a line read before it is found again by its text.
 */
function lineByText(priorities: Pick<Priorities, "sections">, { id, text }: Taken) {
  const found = priorities.sections
    .flatMap((section) => section.proposals)
    .filter((line) => startable(line) && plain(line.spans) === text);
  return (found.find((line) => line.id === id) ?? found[0])?.id;
}

/**
 * Takes the entries out of their file, as a start from them does: a note leaves `INBOX.md`, a
 * proposal `PRIORITIES.md`, found by its text in the priorities read after the start: none left
 * with it, it stays. A refused removal leaves the entry where it is: the start already happened. A
 * change's start replaces the first line of Now it was filled from itself, in its commit: that line
 * is not one of `taken`.
 */
export async function takeOut(fate: Fate, taken: ReadonlyArray<Taken>) {
  for (const entry of taken) {
    try {
      if (entry.kind === "note") {
        await withFreshBase(
          async (mode) => (await readInbox(fate, mode)).hash,
          (hash) =>
            fate.mutations.inbox.remove({ input: { hash, note: entry.id }, view: InboxView }),
        );
      } else {
        await withFreshBase(
          (mode) => readPriorities(fate, mode),
          async (priorities) => {
            const proposal = lineByText(priorities, entry);
            return proposal === undefined
              ? undefined
              : fate.mutations.proposals.remove({
                  input: { hash: priorities.hash, proposal },
                  view: PrioritiesView,
                });
          },
        );
      }
    } catch {
      // Left in its file, for the human to take out.
    }
  }
  rereadChanges(fate);
}

/**
 * Writes `body` into the proposal file at `path`, under what it holds already: the heading its line
 * gave it. Without `body`, nothing is written. A refusal is the message to show.
 */
async function writeBody(fate: Fate, path: string, body: string): Promise<string | undefined> {
  if (body.trim() === "") {
    return undefined;
  }
  const file = await readProposalFile(fate, path);
  if (!file) {
    return "The proposal file was not found.";
  }
  const { body: current, head } = splitProposal(file);
  const kept = current.trim() === "" ? "" : `${current.trimEnd()}\n\n`;
  const result = await fate.mutations.text.save({
    input: { hash: file.hash, path, text: `${head}${kept}${body.trim()}\n` },
    view: ProposalFileView,
  });
  return result.error ? refusal(result.error).message : undefined;
}

/**
 * A proposal written in the composer: the proposal file its first source makes, or one titled
 * `title` written as the first of Now's proposals to start, then the text under its heading, unless
 * the composer holds what the source's own was. A refused text leaves the file, with its reason.
 */
async function proposalWritten(
  fate: Fate,
  {
    body,
    sources,
    title,
  }: { body: string; sources: ReadonlyArray<Taken & { inserted: string }>; title: string },
): Promise<Made> {
  const [first, ...rest] = sources;
  if (!first) {
    return titleFile(fate, title, body);
  }
  const written =
    first.kind === "note"
      ? await noteFile(fate, { id: first.id })
      : await lineFile(fate, { file: first.linked ? { path: first.linked } : null, id: first.id });
  if ("error" in written) {
    return written;
  }
  // Its own text stays when the composer holds only what it was filled with.
  const kept = body.trim() === first.inserted.trim();
  const refused = kept ? undefined : await writeBody(fate, written.value, body);
  await takeOut(fate, rest);
  return refused === undefined ? written : { error: refused };
}

/**
 * The New page's proposal written in its composer, `feature.fromText`, whose proposal file opens in
 * the editor. A refusal is `error`.
 */
export function useStartFrom() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  // Whether it opened what it made: a refusal, or a read that failed, shows why.
  const run = async (making: () => Promise<Made>, open: (value: string) => void) => {
    setError(undefined);
    let result: Made;
    try {
      result = await making();
    } catch (error) {
      result = { error: refusal(error).message };
    }
    if ("error" in result) {
      setError(result.error);
      return false;
    }
    open(result.value);
    return true;
  };
  const edit = (path: string) => navigate(here(`/edit/${path}`));
  return {
    error,
    feature: {
      fromText: (input: Parameters<typeof proposalWritten>[1]) =>
        run(() => proposalWritten(fate, input), edit),
    },
  };
}
