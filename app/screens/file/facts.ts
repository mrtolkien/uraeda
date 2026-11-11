// A file's facts, as the reader's head and the panes beside it say them: a plan's progress, what
// changed since the human's review, the decisions a spec's branch changes, and a review not sent.
// Pure: the record holds the facts, these only put them in words.
import type { FileView, TaskItem } from "../../store/protocol";
import { shownOf } from "./read";

/** "1 task", "2 tasks". */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;

/** Whether a task's steps are all checked: a task with no step is not done. */
export const taskDone = (task: TaskItem) => task.total > 0 && task.done === task.total;

/** A plan's tasks, as the version shown has them. */
export const tasksOf = (file: FileView) => shownOf(file).items.plan?.tasks ?? [];

/** The task being built: the first not done. */
export const currentTask = (tasks: ReadonlyArray<TaskItem>) =>
  tasks.find((task) => !taskDone(task));

/** "6 of 11 tasks done". */
export function progressWords(tasks: ReadonlyArray<TaskItem>) {
  const done = tasks.filter(taskDone).length;
  return `${done} of ${plural(tasks.length, "task")} done`;
}

/** The parts changed since the human's review, and those added or removed, in words. */
export function sinceWords(file: FileView): string | undefined {
  const since = file.sinceReview;
  if (since === null || !since.found || since.parts.length === 0) return undefined;
  return `${plural(since.parts.length, "part")} changed since your review`;
}

/**
 * What the reader's head says after the file's status: its file's name first, which its tab says
 * in words ("Questions, round 1"), then what it holds.
 */
export function facts(file: FileView): Array<string> {
  const said: Array<string> = [file.name];
  const tasks = tasksOf(file);
  if (file.kind === "plan" && tasks.length > 0) said.push(progressWords(tasks));
  const since = sinceWords(file);
  if (since !== undefined) said.push(since);
  if (file.decisionChanges.length > 0) {
    said.push(`${plural(file.decisionChanges.length, "decision")} changed on its branch`);
  }
  const comments = file.review?.review?.comments.length ?? 0;
  if (comments > 0) said.push(`${plural(comments, "comment")} not sent`);
  return said;
}
