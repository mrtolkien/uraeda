// The scene `reading`, which `just frames reading` times: a plan of about 2,700 lines, the length
// of the NSH migration's, read in a `DocumentScroll`, scrolling by itself as the scene
// `scrolling` does, 900 points a frame one way for two seconds, then back: a fling far faster
// than a hand's, which makes blocks of every kind on every frame.
import { cleanup, View } from "nsh";
import { markdownTree } from "uraeda/native";
import type { Document as Tree } from "../../store/protocol";
import { DocumentScroll, type DocumentScrollRef } from "../../ui/document";

/** One task of the plan: its heading, its files, its steps, a table, and code: 33 lines. */
const task = (at: number) => `## Task ${at}: The part number ${at}

Follows [what every screen task does](#task-1-the-part-number-1).

- **Files:** \`app/screens/part-${at}/\`, \`crates/server/src/part_${at}.rs\`
- **Reads:** the old screens of part ${at}, and the decisions that apply to them.
- **Tests:** \`a part ${at} survives a restart\`.

The part keeps what the human relies on, and drops what the old screen did wrong. Its records come
from the store; its keys from the registry; its looks from the tokens, through the library.

| Step | What it does | Expected |
| ---- | ------------ | -------- |
| 1 | Reads the old screen | a list of what it does |
| 2 | Writes the tests | FAIL |
| 3 | Builds the screen | PASS |

- [x] **Step 1: Read the old screens and their guide**, as the shared step 1 says.
- [x] **Step 2: Write the tests** this task names.
- [ ] **Step 3: Build the screens**, as the shared step 3 says.
- [ ] **Step 4: Review each screen in the running app**, as the shared step 4 says.
- [ ] **Step 5: Run the task's validation**. Expected: PASS.

\`\`\`ts
export function part${at}(input: string): string {
  return input.trim();
}
\`\`\`

**As built**: the part's panes are declared in its folder, and its place lists them in order.
`;

/** A plan of 82 tasks, about 2,700 lines. */
const PLAN = `# Plan: A long plan\n\n**Goal:** read for half an hour.\n\n${Array.from({ length: 82 }, (_, at) => task(at + 1)).join("\n")}`;

export function reading() {
  const tree = JSON.parse(markdownTree(PLAN)) as Tree;
  let scroll: DocumentScrollRef | undefined;
  let going = true;
  let frame = 0;
  let offset = 0;
  const step = () => {
    if (!going) return;
    offset = Math.max(0, offset + (frame % 240 < 120 ? 900 : -900));
    scroll?.scrollTo(offset);
    frame += 1;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
  cleanup(() => (going = false));
  return (
    <View style={{ flex: 1 }} testID="scene-reading">
      <DocumentScroll document={tree} keys={false} ref={(made) => (scroll = made)} />
    </View>
  );
}
