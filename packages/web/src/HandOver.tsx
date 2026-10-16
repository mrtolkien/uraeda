// Handing a feature over to the agent: the workflow's message an address asks for, read for the
// session page's composer.
import { useEffect } from "react";
import type { Trigger } from "uraeda-server/fate";
import { useWorkflowMessage } from "./data.ts";

/** The workflow's message an address asks for: `?continue=<trigger>&file=<file>`. */
export function useHandOver(search: string): { file?: string; trigger: Trigger } | undefined {
  const params = new URLSearchParams(search);
  const trigger = params.get("continue");
  const file = params.get("file");
  return trigger ? { trigger: trigger as Trigger, ...(file ? { file } : {}) } : undefined;
}

/** Reads the workflow's message for a feature, and gives it, or its refusal, to the page. */
export function WorkflowMessage({
  folder,
  onRead,
  workflow,
}: {
  folder: string;
  onRead: (message: { refusal: string | null; text: string }) => void;
  workflow: { file?: string; trigger: Trigger };
}) {
  const message = useWorkflowMessage(folder, workflow.trigger, workflow.file);
  const text = message?.text;
  const refusal = message?.refusal;
  useEffect(() => {
    if (text !== undefined && refusal !== undefined) {
      onRead({ refusal, text });
    }
    // Once per message read: `onRead` is a new function at each draw.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [text, refusal]);
  return null;
}
