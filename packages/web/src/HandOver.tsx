// Handing a feature over to the agent: the workflow's message an address asks for, read for the
// session page's composer. The feature's run options decide which session its run goes to.
import { Component, type ReactNode, useEffect } from "react";
import type { Trigger } from "uraeda-server/fate";
import { useWorkflowMessage } from "./data.ts";

/** Draws nothing once its children fail: what they read stays unread. */
export class Unread extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** The workflow's message an address asks for: `?continue=<trigger>&file=<file>`. */
export function useHandOver(search: string): { file?: string; trigger: Trigger } | undefined {
  const params = new URLSearchParams(search);
  const trigger = params.get("continue");
  const file = params.get("file");
  return trigger ? { trigger: trigger as Trigger, ...(file ? { file } : {}) } : undefined;
}

/** The workflow's message as read: its text, its refusal, and the step it was read at. */
export type ReadMessage = {
  refusal: string | null;
  step?: string;
  text: string;
};

/** Reads the workflow's message for a feature, and gives it, or its refusal, to the page. */
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
  const text = message?.text;
  const refusal = message?.refusal;
  const step = message?.step ?? undefined;
  useEffect(() => {
    if (text !== undefined && refusal !== undefined) {
      onRead({ refusal, text, ...(step === undefined ? {} : { step }) });
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once per message read: `onRead` is a new function at each draw
  }, [text, refusal, step]);
  return null;
}
