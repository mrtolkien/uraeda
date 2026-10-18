// What `ura check` finds in a feature's files: the problems that stop the workflow, in a banner above
// "Next", and the notes that do not, folded at the bottom of the page.
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { sizeVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useRepoPath } from "../routes.tsx";

const styles = stylex.create({
  // The fold's row, a control's height for a finger.
  trigger: { alignItems: "center", display: "flex", minHeight: sizeVars["--size-element-md"] },
});

/** A check's result: its file from the repository's top, its line, and its message. */
type Problem = { file: string; line?: number | null; message: string };

/** A file's name, from its path. */
function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

/** Each result: its file and line, then its message. */
function ProblemLines({ problems }: { problems: Array<Problem> }) {
  return (
    <List density="compact">
      {problems.map((problem, index) => (
        <ListItem
          description={<>{problem.message}</>}
          key={index}
          label={
            <Text type="code">
              {fileName(problem.file)}
              {problem.line ? `:${problem.line}` : ""}
            </Text>
          }
        />
      ))}
    </List>
  );
}

/** The problems that stop the workflow, and a button to the first one's file. */
export function Blocking({ folder, problems }: { folder: string; problems: Array<Problem> }) {
  const here = useRepoPath();
  const first = problems[0];
  if (!first) {
    return null;
  }
  const name = fileName(first.file);
  return (
    <Banner
      collapsible={false}
      description={<ProblemLines problems={problems} />}
      endContent={
        <Button href={here(`/f/${folder}/${name}`)} label={`Open ${name}`} variant="secondary" />
      }
      status="error"
      title="This feature cannot go on"
    />
  );
}

/** The check's notes, which block nothing, folded and muted. */
export function Notes({ notes }: { notes: Array<Problem> }) {
  if (notes.length === 0) {
    return null;
  }
  return (
    <Collapsible
      defaultIsOpen={false}
      trigger={
        <span {...stylex.props(styles.trigger)}>
          <Text color="secondary">
            {notes.length} format {notes.length === 1 ? "note" : "notes"}
          </Text>
        </span>
      }
    >
      <VStack gap={2}>
        <Text color="secondary" type="supporting">
          They block nothing: the next agent step rewrites what drifted.
        </Text>
        <ProblemLines problems={notes} />
      </VStack>
    </Collapsible>
  );
}
