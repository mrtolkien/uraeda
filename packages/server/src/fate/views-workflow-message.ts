// The data view of the workflow's message, which fills the composer.
import { dataView } from "@nkzw/fate/server";

/**
 * The workflow's message for a feature and a trigger, `<folder>:<trigger>[:<file>]`, which the
 * composer is filled with. Empty, with the refusal, when the feature does not wait on the agent.
 */
export type WorkflowMessageRecord = {
  id: string;
  refusal: string | null;
  /** The step the message starts. */
  step: string;
  text: string;
};

export const workflowMessageDataView = dataView<WorkflowMessageRecord>("WorkflowMessage")({
  id: true,
  refusal: true,
  step: true,
  text: true,
});
