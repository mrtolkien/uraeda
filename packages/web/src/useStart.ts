// A proposal file's start, the one of the editor's Start, its Ctrl+Enter, and Enter in the slug: the
// text typed saved first, then the start planned, which answers at once; its session opens with the
// plan's message in the composer while the server's write queue runs the start (US4).
import { useState, useSyncExternalStore } from "react";
import { useFateClient } from "react-fate";
import { refusal } from "./errors.ts";
import type { StartKind } from "./ProposalStart.tsx";
import type { useTextField } from "./fields/useTextField.ts";
import { useRepositoryPath } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { featureDraftKey } from "./useDraft.ts";
import { StartPlanView } from "./views.ts";

/**
 * A start this document planned, by its folder: what it starts as, its name, the workflow's message
 * its session's composer holds, and its proposal file. `seen` once its write showed in the queue.
 */
export type PlannedStart = {
  kind: StartKind;
  message: string;
  proposal: string;
  seen: boolean;
  title: string;
};

/** The starts planned in this document, by `featureDraftKey`, until their write left the queue. */
const planned = new Map<string, PlannedStart>();
const listeners = new Set<() => void>();
let version = 0;

function changed() {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * The start of `folder` this document planned, until its write left the queue; with what marks it
 * seen in the queue, and forgets it.
 */
export function usePlannedStart(folder: string) {
  const key = featureDraftKey(useRepositoryPath(), folder);
  useSyncExternalStore(subscribe, () => version);
  const start = planned.get(key);
  return {
    forget: () => {
      if (planned.delete(key)) {
        changed();
      }
    },
    seen: () => {
      if (start && !start.seen) {
        planned.set(key, { ...start, seen: true });
        changed();
      }
    },
    start,
  };
}

/**
 * Starts the proposal file at `path` as `kind`, under the slug typed in `slug`, once `saveTyped`
 * resolved with the text saved: the session of its folder opens as soon as the start is planned,
 * its steps where the transcript will be. A refusal of the plan, as a taken slug, shows under the
 * slug while it holds the slug refused: `slugError`. `start` answers why nothing started, if the
 * text was not saved, or whether it started.
 */
export function useStart({
  path,
  saveTyped,
  slug,
  title,
}: {
  path: string;
  saveTyped: () => Promise<boolean>;
  slug: ReturnType<typeof useTextField>;
  /** The proposal's name, which the write queue's toast reads. */
  title: string;
}) {
  const fate = useFateClient();
  const repo = useRepositoryPath();
  const [refused, setRefused] = useState<{ slug: string; text: string }>();
  const start = async (kind: StartKind): Promise<{ notSaved: string } | boolean> => {
    setRefused(undefined);
    if (!(await saveTyped())) {
      return { notSaved: `Your text is not saved: the ${kind} was not started.` };
    }
    const typed = slug.text;
    const result = await fate.mutations.feature.start({
      input: {
        kind,
        proposal: path,
        slug: typed,
        // Its refusal's "Open the proposal" comes back to this file.
        write: { href: `/edit/${path}`, label: `Starting the ${kind} ${title}` },
      },
      view: StartPlanView,
    });
    const plan = result.result;
    if (result.error || typeof plan?.folder !== "string") {
      const text = result.error ? refusal(result.error).message : `The ${kind} was not started.`;
      setRefused({ slug: typed, text });
      return false;
    }
    planned.set(featureDraftKey(repo, plan.folder), {
      kind,
      message: plan.message ?? "",
      proposal: path,
      seen: false,
      title: plan.title ?? title,
    });
    changed();
    slug.discard();
    handOver(plan.folder, "start");
    return true;
  };
  return {
    slugError: refused !== undefined && refused.slug === slug.text ? refused.text : undefined,
    start,
  };
}
