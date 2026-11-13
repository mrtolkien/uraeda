// A plan's tasks, one row each, in the plan's order: its steps checked of its total, the task being
// built lit, the task the reader is in marked, and the plan's progress over them. `Enter` or a
// press brings the task's heading to the reader's top, and the focus with it.
import { View } from "nsh";
import type { FileView, TaskItem } from "../../store/protocol";
import { Progress } from "../../ui/controls";
import { focusPane, PaneScroll, usePane } from "../../ui/layout";
import { createCursor, Empty, Line, List } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { currentTask, progressWords, taskDone, tasksOf } from "./facts";
import { readerPane } from "./panes";
import { jumpTo, topBlock } from "./place";
import { type FileArgs, WithFile } from "./read";

/** The task the reader is in: the last whose heading is at or before the block at its top. */
const taskAtTop = (tasks: ReadonlyArray<TaskItem>, top: number) =>
  tasks.findLast((task) => task.headingBlock <= top);

function Rows(props: { args: FileArgs; file: () => FileView }) {
  const kept = usePane().remember<string | null>("at", null);
  const tasks = () => tasksOf(props.file());
  const byId = () => new Map(tasks().map((task) => [String(task.number), task]));
  const rows = () => tasks().map((task) => ({ id: String(task.number) }));
  const now = () => currentTask(tasks())?.number;
  const reading = () => taskAtTop(tasks(), topBlock(props.args)())?.number;
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  const open = (id: string) => {
    const task = byId().get(id);
    if (task === undefined) return;
    jumpTo(props.args, task.headingBlock);
    focusPane(readerPane(props.args));
  };
  const done = () => tasks().filter(taskDone).length;
  return (
    <View style={{ gap: 12 }}>
      <If when={tasks().length > 0}>
        <View style={{ paddingHorizontal: tokens.space.panePadding, paddingTop: 8 }}>
          <Progress
            label="The plan's tasks"
            value={done() / Math.max(1, tasks().length)}
            words={progressWords(tasks())}
          />
        </View>
      </If>
      <List
        cursor={cursor}
        empty={
          <Empty
            icon="list-checks"
            title="No tasks"
            words="The plan has no `## Task` heading yet: the agent writes them as it plans."
          />
        }
        onOpen={open}
        openLabel="go to the task"
        row={(id) => {
          const task = () => byId().get(id());
          const state = () =>
            task() !== undefined && taskDone(task()!)
              ? "done"
              : task()?.number === now()
                ? "now"
                : "ahead";
          return (
            <Line
              current={task()?.number === reading()}
              hue={
                state() === "now"
                  ? tokens.role.action
                  : state() === "done"
                    ? tokens.control.tone("done")
                    : undefined
              }
              icon={
                state() === "done" ? "circle-check" : state() === "now" ? "circle-dot" : "minus"
              }
              label={`${task()?.number ?? ""}. ${task()?.title ?? ""}`}
              meta={`${task()?.done ?? 0}/${task()?.total ?? 0}`}
              quiet={state() === "ahead" && task()?.number !== reading()}
            />
          );
        }}
      />
    </View>
  );
}

/** The pane "Tasks". */
export function Tasks(props: { args: FileArgs }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <WithFile args={props.args} beside>
        {(file) => <Rows args={props.args} file={file} />}
      </WithFile>
    </PaneScroll>
  );
}
