// The data view of a start's plan: read once, from `feature.start`, which answers with it before
// the start lands.
import { dataView } from "@nkzw/fate/server";

/**
 * A start planned, by its folder: the feature's or the change's name, and the workflow's message
 * of its first step, which its session's composer holds.
 */
export type StartPlanRecord = { folder: string; id: string; message: string; title: string };

export const startPlanDataView = dataView<StartPlanRecord>("StartPlan")({
  folder: true,
  id: true,
  message: true,
  title: true,
});
