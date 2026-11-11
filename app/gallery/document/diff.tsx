// The diff's page: a file's change, as the Git page and a session's changes draw it, its long line
// scrolling sideways inside the view.
import { View } from "nsh";
import { Diff } from "../../ui/document";

const PATCH = `--- a/src/tasks.ts
+++ b/src/tasks.ts
@@ -8,8 +8,11 @@ export type Task = {
   id: string;
   title: string;
-  done: boolean;
+  /** When it was done, or null while it waits. */
+  doneAt: string | null;
+  repeats?: "daily" | "weekly";
 };

-export function finish(task: Task): Task {
-  return { ...task, done: true };
+export function finish(task: Task, now: Date): Task {
+  const doneAt = now.toISOString();
+  return task.repeats === undefined ? { ...task, doneAt } : { ...task, doneAt: null, title: task.title };
 }
`;

export const diff = () => (
  <View style={{ height: 420 }}>
    <Diff patch={PATCH} path="src/tasks.ts" />
  </View>
);
