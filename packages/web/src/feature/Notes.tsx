// What `ura check` finds in a feature's files: the problems that stop the workflow, in a banner above
// "Next", and the notes that do not, folded at the bottom of the page, with a button that repairs the
// links whose file moved, when their file is the default branch's.
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { Pane } from "../layout/Pane.tsx";
import { useKeys } from "../keys/registry.tsx";
import { navigate, useRepoPath } from "../routes.tsx";
import { useOpenKeys } from "../useOpenKeys.ts";

/**
 * A check's result: its file from the repository's top, its line, and its message; for a link whose
 * file moved or was deleted, `fixable`, which the repair can rewrite.
 */
type Problem = { file: string; fixable?: boolean | null; line?: number | null; message: string };

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

/**
 * The problems that stop the workflow, and a button to the first one's file. While "Next" has no
 * action, `isNextKey`, opening that file is the page's next step, and `n` does it too.
 */
export function Blocking({
  change,
  folder,
  isNextKey,
  problems,
}: {
  change: boolean;
  folder: string;
  isNextKey: boolean;
  problems: Array<Problem>;
}) {
  const here = useRepoPath();
  const first = problems[0];
  const name = first && fileName(first.file);
  const href = name && here(`/f/${folder}/${name}`);
  useKeys(
    href && isNextKey
      ? [{ hint: "n", keys: "n", label: `open ${name}`, run: () => navigate(href) }]
      : [],
  );
  if (!first || !href) {
    return null;
  }
  return (
    <AnnouncedBanner
      collapsible={false}
      description={<ProblemLines problems={problems} />}
      endContent={<Button href={href} label={`Open ${name}`} variant="secondary" />}
      status="error"
      title={`This ${change ? "change" : "feature"} cannot go on`}
    />
  );
}

/** The fold's key in the history entry, kept open across Back. */
const NOTES_KEY = "notes";

/**
 * The check's notes, which block nothing, a pane folded to its count, open as the history entry
 * keeps them. `onFix`, given for a default branch's files, repairs every fixable link, uncommitted:
 * its button is busy until it settles, so a second press runs no second repair.
 */
export function Notes({ notes, onFix }: { notes: Array<Problem>; onFix?: () => Promise<void> }) {
  const keys = useOpenKeys();
  if (notes.length === 0) {
    return null;
  }
  return (
    <Pane
      count={notes.length}
      fold={{
        isOpen: keys.open.includes(NOTES_KEY),
        onOpenChange: (isOpen) => keys.onOpenChange(NOTES_KEY, isOpen),
      }}
      title="Format notes"
    >
      <VStack gap={2}>
        <Text color="secondary" type="supporting">
          They block nothing: the next agent step rewrites what drifted.
        </Text>
        {onFix && notes.some((note) => note.fixable) && (
          <HStack>
            <Button clickAction={onFix} label="Fix moved links" variant="secondary" />
          </HStack>
        )}
        <ProblemLines problems={notes} />
      </VStack>
    </Pane>
  );
}
