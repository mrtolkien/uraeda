// What the New page starts from an inbox note, a priority line, or a feature's title: a change,
// whose session opens, or a feature's draft, which opens in the editor.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { readInbox, readPriorities, readPrioritiesHash, rereadChanges } from "./data.ts";
import { refusal } from "./errors.ts";
import { navigate, useRepoPath } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { DraftView, FeatureView, PrioritiesView } from "./views.ts";
import { runWrite } from "./writes/store.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A line of the priorities, as the view reads it: its id, and the draft it links. */
export type StartLine = { draft?: { path: string } | null; id: string };

/** A note of the inbox, by its id. */
export type StartNote = { id: string };

/** A call's result: a draft's path or a feature's folder, or the refusal to show. */
type Made = { error: string } | { value: string };

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
async function startChange(fate: Fate, draft: Made): Promise<Made> {
  if ("error" in draft) {
    return draft;
  }
  return made(
    await fate.mutations.feature.start({
      input: { draft: draft.value, kind: "change" },
      view: FeatureView,
    }),
    "folder",
  );
}

/**
 * The New page's starts from a note, a line, or a title. A change opens its session, with the
 * workflow's message to send; a feature's draft opens in the editor. A refusal is `error`.
 */
export function useStartFrom() {
  const fate = useFateClient();
  const here = useRepoPath();
  const [error, setError] = useState<string>();
  const run = async (making: () => Promise<Made>, open: (value: string) => void) => {
    setError(undefined);
    const result = await making();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    open(result.value);
  };
  const edit = (path: string) => navigate(here(`/edit/${path}`));
  const change = (draft: () => Promise<Made>) =>
    run(
      () =>
        runWrite({ label: "Starting the change…" }, async () => startChange(fate, await draft())),
      (folder) => handOver(folder, "start"),
    );
  return {
    change: {
      fromLine: (entry: StartLine) => change(() => lineDraft(fate, entry)),
      fromNote: (note: StartNote) => change(() => noteDraft(fate, note)),
    },
    error,
    feature: {
      fromLine: (entry: StartLine) => run(() => lineDraft(fate, entry), edit),
      fromNote: (note: StartNote) => run(() => noteDraft(fate, note), edit),
      fromTitle: (title: string) => run(() => titleDraft(fate, title), edit),
    },
  };
}
