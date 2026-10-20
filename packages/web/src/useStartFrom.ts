// What the New page starts from an inbox note, a priority line, or a feature's title: a change,
// whose session opens, or a feature's draft, which opens in the editor.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { refusal } from "./errors.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver, sessionPath } from "./sessions.ts";
import { DraftView, FeatureView, PrioritiesView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A line of the priorities, as the view reads it: its id, and the draft it links. */
export type StartLine = { draft?: { path: string } | null; id: string };

/** A note of the inbox, by its id. */
export type StartNote = { id: string };

/** A call's result: a draft's path or a feature's folder, or the refusal to show. */
type Made<T = string> = { error: string } | { value: T };

/** A started change: its folder, and whether its first run was sent, its agent at work. */
type Started = { folder: string; sent: boolean };

/** The section a note or a title is drafted into: the work starts now. */
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

/** Turns the note into a new draft in Now: the note leaves `INBOX.md`. */
async function noteDraft(fate: Fate, note: StartNote): Promise<Made> {
  const [inbox, prioritiesHash] = await Promise.all([readInbox(fate), readPrioritiesHash(fate)]);
  const result = await fate.mutations.inbox.toNewDraft({
    input: { hash: inbox.hash, note: note.id, prioritiesHash, section: NOW },
    view: DraftView,
  });
  rereadChanges(fate);
  return made(result, "path");
}

/** The line's draft: the one it links, or a new one written for it. */
async function lineDraft(fate: Fate, entry: StartLine): Promise<Made> {
  if (entry.draft) {
    return { value: entry.draft.path };
  }
  const { hash } = await readPriorities(fate);
  return made(
    await fate.mutations.draft.create({ input: { hash, line: entry.id }, view: DraftView }),
    "path",
  );
}

/**
 * Writes the title as the first of Now's entries that has not started, then drafts it: the
 * started ones stay above it.
 */
async function titleDraft(fate: Fate, title: string): Promise<Made> {
  const { hash, sections } = await readPriorities(fate);
  const now = sections.find((section) => section.section === NOW)?.entries ?? [];
  const first = now.findIndex((entry) => !entry.running);
  const index = first === -1 ? now.length : first;
  const inserted = await fate.mutations.priorities.insert({
    input: { hash, index, lines: [`- ${title}`], section: NOW },
    view: PrioritiesView,
  });
  if (inserted.error || !inserted.result) {
    return made(inserted, "path");
  }
  return made(
    await fate.mutations.draft.create({
      input: { hash: inserted.result.hash, line: `${NOW}-${index + 1}` },
      view: DraftView,
    }),
    "path",
  );
}

/** Starts the draft as a change: its branch and worktree are written, and its line moves to Now. */
async function startChange(fate: Fate, draft: Made): Promise<Made<Started>> {
  if ("error" in draft) {
    return draft;
  }
  const folder = made(
    await fate.mutations.feature.start({
      input: { draft: draft.value, kind: "change" },
      view: FeatureView,
    }),
    "folder",
  );
  return "error" in folder ? folder : { value: { folder: folder.value, sent: false } };
}

/**
 * The New page's starts from a note, a line, or a title. A change opens its session, where its
 * agent works, or with the workflow's message to send when no run was sent; a feature's draft
 * opens in the editor. A refusal is `error`.
 */
export function useStartFrom() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const run = async <T>(making: () => Promise<Made<T>>, open: (value: T) => void) => {
    setError(undefined);
    const result = await making();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    open(result.value);
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
        change(async () => startChange(fate, await lineDraft(fate, entry))),
      fromNote: (note: StartNote) => change(() => noteChange(fate, note)),
    },
    error,
    feature: {
      fromLine: (entry: StartLine) => run(() => lineDraft(fate, entry), edit),
      fromNote: (note: StartNote) => run(() => noteDraft(fate, note), edit),
      fromTitle: (title: string) => run(() => titleDraft(fate, title), edit),
    },
  };
}
