// Handing a feature over to the agent: the workflow's message an address asks for, read for the
// session page's composer, and whether its run builds in a fresh session.
import { Switch } from "@astryxdesign/core/Switch";
import { type ReactNode, useEffect, useState } from "react";
import type { Trigger } from "uraeda-server/fate";
import { useSettings, useWorkflowMessage } from "./data.ts";

/**
 * The steps whose run may start in a fresh session: the first after a spec's approval, which
 * records its decisions, when it lists some, then writes the plan and builds.
 */
const FRESH_STEPS = new Set(["approval", "plan"]);

/** The workflow's message an address asks for: `?continue=<trigger>&file=<file>`. */
export function useHandOver(search: string): { file?: string; trigger: Trigger } | undefined {
  const params = new URLSearchParams(search);
  const trigger = params.get("continue");
  const file = params.get("file");
  return trigger ? { trigger: trigger as Trigger, ...(file ? { file } : {}) } : undefined;
}

/** The workflow's message as read: its text, its refusal, and its run's fresh session default. */
export type ReadMessage = {
  /** Whether the run builds in a fresh session by default, at the step that offers it alone. */
  fresh?: boolean;
  refusal: string | null;
  text: string;
};

/**
 * Reads the workflow's message for a feature, and gives it, or its refusal, to the page; at the
 * steps right after a spec's approval, with the setting's default for building in a fresh session.
 */
export function WorkflowMessage({
  folder,
  onRead,
  workflow,
}: {
  folder: string;
  onRead: (message: ReadMessage) => void;
  workflow: { file?: string; trigger: Trigger };
}) {
  const message = useWorkflowMessage(folder, workflow.trigger, workflow.file);
  const settings = useSettings();
  const text = message?.text;
  const refusal = message?.refusal;
  const fresh =
    message && FRESH_STEPS.has(message.step)
      ? settings?.runs.buildInFreshSession.inForce
      : undefined;
  useEffect(() => {
    if (text !== undefined && refusal !== undefined) {
      onRead({ refusal, text, ...(fresh === undefined ? {} : { fresh }) });
    }
    // Once per message read: `onRead` is a new function at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text, refusal, fresh]);
  return null;
}

/**
 * Whether the run the address `search` hands over builds in a fresh session: the setting's default,
 * read with its message at the step that offers it, until the human switches it.
 */
export function useFreshRun(search: string) {
  const [fresh, setFresh] = useState<{ on: boolean; search: string }>();
  const on = fresh?.search === search ? fresh.on : undefined;
  return {
    /** The workflow's input, with `fresh` and its switch once the address offers it. */
    handing<T extends object>(
      workflow: T,
    ): { options?: ReactNode; workflow: T & { fresh?: boolean } } {
      if (on === undefined) {
        return { workflow };
      }
      return {
        options: (
          <Switch
            label="Build in a fresh session"
            onChange={(next: boolean) => setFresh({ on: next, search })}
            value={on}
          />
        ),
        workflow: { ...workflow, fresh: on },
      };
    },
    /** Takes the default of a message read for the address, once. */
    read({ fresh: byDefault }: ReadMessage) {
      if (byDefault !== undefined) {
        setFresh((now) => (now?.search === search ? now : { on: byDefault, search }));
      }
    },
  };
}
