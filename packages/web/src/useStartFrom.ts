// What the New page starts from an inbox note, a proposal line, or a feature's title: a change,
// whose session opens, or a feature's proposal file, which opens in the editor.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readProposalFile } from "./attach/useEditorImages.ts";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { refusal } from "./errors.ts";
import { splitProposal } from "./pane/proposalText.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver, sessionPath } from "./sessions.ts";
import { ProposalFileView, FeatureView, InboxView, PrioritiesView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A proposal line of the priorities, as the view reads it: its id, and the file it links. */
export type StartLine = { file?: { path: string } | null; id: string };

/** A note of the inbox, by its id. */
export type StartNote = { id: string };

/** A call's result: a proposal file's path or a feature's folder, or the refusal to show. */
type Made<T = string> = { error: string } | { value: T };

/** A started change: its folder, and whether its first run was sent, its agent at work. */
type Started = { folder: string; sent: boolean };

/** The section a note or a title is written into: the work starts now. */
const NOW = "now";

/** A mutation's result as `Made`, from the field of its result that names what it made. */
function made(result: { error?: unknown; result?: unknown }, field: "folder" | "path"): Made {
  const value = (result.result as Record<string, unknown> | undefined)?.[field];
  if (result.error || typeof value !== "string") {
    return { error: result.error ? refusal(result.error).message : "Nothing was made." };
  }
  return { value };
}

/** A start's result as `Made`: the change's folder, and whether a run was sent. */
function started(result: { error?: unknown; result?: unknown }): Made<Started> {
  const folder = made(result, "folder");
  if ("error" in folder) {
    return folder;
  }
  const session = (result.result as { session?: unknown }).session;
  return { value: { folder: folder.value, sent: session !== null && session !== undefined } };
}

/**
 * Starts the note as a change, from its text, as a typed change starts: the note leaves
 * `INBOX.md`, committed alone when it had no other change, and the change's first run is sent.
 */
async function noteChange(fate: Fate, note: StartNote): Promise<Made<Started>> {
  const { hash } = await readInbox(fate);
  const result = await fate.mutations.change.fromNote({
    input: { hash, note: note.id },
    view: FeatureView,
  });
  rereadChanges(fate);
  return started(result);
}

/**
 * Turns the note into a new proposal file in Now, or moves its note file there: the note leaves
 * `INBOX.md`.
 */
async function noteFile(fate: Fate, note: StartNote): Promise<Made> {
  const [inbox, prioritiesHash] = await Promise.all([readInbox(fate), readPrioritiesHash(fate)]);
  const result = await fate.mutations.inbox.toProposalFile({
    input: { hash: inbox.hash, note: note.id, prioritiesHash, section: NOW },
    view: ProposalFileView,
  });
  rereadChanges(fate);
  return made(result, "path");
}

/** The proposal's file: the one it links, or a new one it is expanded into. */
async function lineFile(fate: Fate, entry: StartLine): Promise<Made> {
  if (entry.file) {
    return { value: entry.file.path };
  }
  const { hash } = await readPriorities(fate);
  return made(
    await fate.mutations.proposals.expand({
      input: { hash, proposal: entry.id },
      view: ProposalFileView,
    }),
    "path",
  );
}

/**
 * Writes the title as the first of Now's proposals that has not started, then expands it into a
 * file: the started ones stay above it. An expand refused takes the proposal back out, so Now is as
 * it was.
 */
async function titleFile(fate: Fate, title: string): Promise<Made> {
  const { hash, sections } = await readPriorities(fate);
  const now = sections.find((section) => section.section === NOW)?.proposals ?? [];
  const first = now.findIndex((proposal) => !proposal.running);
  const index = first === -1 ? now.length : first;
  const inserted = await fate.mutations.proposals.insert({
    input: { hash, index, lines: [`- ${title}`], section: NOW },
    view: PrioritiesView,
  });
  if (inserted.error || !inserted.result) {
    return made(inserted, "path");
  }
  const proposal = `${NOW}-${index + 1}`;
  const expanded = made(
    await fate.mutations.proposals.expand({
      input: { hash: inserted.result.hash, proposal },
      view: ProposalFileView,
    }),
    "path",
  );
  if ("error" in expanded) {
    // The refusal shown is the expand's: a proposal left behind is in the commit bar's changes.
    await fate.mutations.proposals.remove({
      input: { hash: inserted.result.hash, proposal },
      view: PrioritiesView,
    });
  }
  return expanded;
}

/** An entry the New page's composer was filled from: its kind, id, and own file, if it has one. */
export type Taken = { id: string; kind: "line" | "note"; linked?: string | undefined };

/**
 * Takes the entries out of their file, as a start from them does: a note leaves `INBOX.md`, a
 * proposal `PRIORITIES.md`. A refused removal leaves the entry where it is: the start already
 * happened.
 */
export async function takeOut(fate: Fate, taken: ReadonlyArray<Taken>) {
  for (const entry of taken) {
    try {
      if (entry.kind === "note") {
        const { hash } = await readInbox(fate);
        await fate.mutations.inbox.remove({ input: { hash, note: entry.id }, view: InboxView });
      } else {
        const { hash } = await readPriorities(fate);
        await fate.mutations.proposals.remove({
          input: { hash, proposal: entry.id },
          view: PrioritiesView,
        });
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
  const written = first
    ? first.kind === "note"
      ? await noteFile(fate, { id: first.id })
      : await lineFile(fate, { file: first.linked ? { path: first.linked } : null, id: first.id })
    : await titleFile(fate, title);
  if ("error" in written) {
    return written;
  }
  // Its own text stays when the composer holds only what it was filled with.
  const kept = first !== undefined && body.trim() === first.inserted.trim();
  const refused = kept ? undefined : await writeBody(fate, written.value, body);
  await takeOut(fate, rest);
  return refused === undefined ? written : { error: refused };
}

/**
 * Starts the proposal file as a change: its branch and worktree are written, its proposal moves to
 * Now, and its first run is sent.
 */
async function startChange(fate: Fate, file: Made): Promise<Made<Started>> {
  if ("error" in file) {
    return file;
  }
  return started(
    await fate.mutations.change.startProposal({
      input: { proposal: file.value },
      view: FeatureView,
    }),
  );
}

/**
 * The New page's starts from a note, a proposal line, or a title. A change opens its session, where
 * its agent works, or with the workflow's message to send when no run was sent; a feature's
 * proposal file opens in the editor. A refusal is `error`.
 */
export function useStartFrom() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  // Whether it opened what it made: a refusal, or a read that failed, shows why.
  const run = async <T>(making: () => Promise<Made<T>>, open: (value: T) => void) => {
    setError(undefined);
    let result: Made<T>;
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
  const change = (starting: () => Promise<Made<Started>>) =>
    run(
      () => runWrite({ label: "Starting the change…" }, starting),
      ({ folder, sent }) =>
        sent ? navigate(here(sessionPath(folder))) : handOver(folder, "start"),
    );
  return {
    change: {
      fromLine: (entry: StartLine) =>
        change(async () => startChange(fate, await lineFile(fate, entry))),
      fromNote: (note: StartNote) => change(() => noteChange(fate, note)),
    },
    error,
    feature: {
      fromLine: (entry: StartLine) => run(() => lineFile(fate, entry), edit),
      fromNote: (note: StartNote) => run(() => noteFile(fate, note), edit),
      fromText: (input: Parameters<typeof proposalWritten>[1]) =>
        run(
          () => runWrite({ label: "Writing the proposal…" }, () => proposalWritten(fate, input)),
          edit,
        ),
      fromTitle: (title: string) => run(() => titleFile(fate, title), edit),
    },
  };
}
