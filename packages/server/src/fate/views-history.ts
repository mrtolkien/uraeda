// The data view of a feature's or a change's history: its stages and their starts, read from git
// by the core.
import { dataView } from "@nkzw/fate/server";
import type { HistoryView, StageView } from "uraeda-binding";
import type { Record_ } from "./views.ts";

/** A view as it is sent: each field the core may leave out sent as null. */
type Sent<T> = {
  [Key in keyof T]-?: undefined extends T[Key] ? Exclude<T[Key], undefined> | null : T[Key];
};

/** A feature's or a change's history, by its folder. */
export type HistoryRecord = Omit<Sent<Record_<HistoryView>>, "stages"> & {
  id: string;
  stages: Array<Sent<StageView>>;
};

/** A history as it is sent: the client's cache keeps a field an answer leaves out. */
export function sentHistory(history: HistoryView): HistoryRecord {
  return {
    ...history,
    finished: history.finished ?? null,
    id: history.folder,
    lines: history.lines ?? null,
    questions: history.questions ?? null,
    rounds: history.rounds ?? null,
    stages: history.stages.map((stage) => ({ ...stage, started: stage.started ?? null })),
    totalSeconds: history.totalSeconds ?? null,
  };
}

export const historyDataView = dataView<HistoryRecord>("History")({
  current: true,
  decisions: true,
  finished: true,
  folder: true,
  found: true,
  id: true,
  lines: true,
  questions: true,
  rounds: true,
  stages: true,
  totalSeconds: true,
});
