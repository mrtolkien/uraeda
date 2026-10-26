// The session's Changes: the files its completed edit calls changed, each with its number of edits
// and no diff, then, for a feature's or a change's session, the files committed on its branch with
// their lines (US2). The branch lists its first two files, the rest the core sends a button away,
// then how many more the core left out (ruling R7).
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useBranchChanges } from "../data.ts";
import { StatusText } from "../fields/StatusText.tsx";
import { useSession } from "../sessionData.ts";
import { useOpenKeys } from "../useOpenKeys.ts";
import { Path } from "./Path.tsx";
import { Section } from "./Section.tsx";
import { plural } from "../labels.ts";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  added: { color: colorVars["--color-text-green"] },
  removed: { color: colorVars["--color-text-red"] },
});

/** The branch's files listed before its "more files" button. */
const FIRST_FILES = 2;

/** The key, among the history entry's open ones, of the branch's files unfolded. */
const BRANCH_OPEN = "changes:branch";

/** What Changes reads while the session changed no file. */
const NOTHING = "No file changed yet.";

/** "1 file", or "N files". */
export function fileCount(count: number) {
  return plural(count, "file");
}

/** A part's title: its name and counts, over its rows. */
function PartTitle({ children }: { children: string }) {
  return (
    <Text color="secondary" type="supporting">
      {children}
    </Text>
  );
}

/** "1 edit", or "N edits". */
function editCount(count: number) {
  return plural(count, "edit");
}

/** "N more files", the count past those shown. */
function moreFiles(count: number) {
  return plural(count, "more file", "more files");
}

/** What Changes reads while the session changed no file. */
function Nothing() {
  return <Empty>{NOTHING}</Empty>;
}

/** The files the session `session` edited, with their edits, or that it changed none yet. */
function ThisSession({ session }: { session: string }) {
  const edited = useSession(session)?.edited ?? [];
  if (edited.length === 0) {
    return <Nothing />;
  }
  return (
    <VStack gap={1}>
      <PartTitle>{`This session · ${fileCount(edited.length)}`}</PartTitle>
      <List aria-label="This session's files" density="compact">
        {edited.map((file) => (
          <ListItem
            endContent={
              <Text color="secondary" type="supporting">
                {editCount(file.edits)}
              </Text>
            }
            key={file.path}
            label={<Path path={file.path} />}
            startContent={<Icon icon="uraeda:file-pen-line" size="sm" />}
          />
        ))}
      </List>
    </VStack>
  );
}

/** A changed file's lines: added in green, removed in red, or "binary". */
function Lines({ added, removed }: { added: number | null; removed: number | null }) {
  if (added === null || removed === null) {
    return (
      <Text color="secondary" type="supporting">
        binary
      </Text>
    );
  }
  return (
    <Text type="supporting">
      <span {...stylex.props(styles.added)}>+{added}</span>{" "}
      <span {...stylex.props(styles.removed)}>-{removed}</span>
    </Text>
  );
}

/**
 * The files committed on the folder's branch, outside its folder: their total, then the first two,
 * then the rest the core sent on demand, then how many more it left out. Nothing without a branch
 * or a file outside the folder; the error, kept, when they could not be read.
 */
function OnTheBranch({ folder }: { folder: string }) {
  const read = useBranchChanges(folder);
  const { onOpenChange, open } = useOpenKeys();
  if (!read || (read.changes === null && !read.failed)) {
    return null;
  }
  const { changes } = read;
  if (changes === null) {
    return <StatusText tone="error">The changes could not be read.</StatusText>;
  }
  if (changes.count === 0) {
    return null;
  }
  const isOpen = open.includes(BRANCH_OPEN);
  const shown = isOpen ? changes.files : changes.files.slice(0, FIRST_FILES);
  const folded = changes.count - FIRST_FILES;
  const left = changes.count - changes.files.length;
  return (
    <VStack gap={1}>
      <PartTitle>
        {`On the branch · ${fileCount(changes.count)} · +${changes.added} -${changes.removed}`}
      </PartTitle>
      <List aria-label="The branch's files" density="compact">
        {shown.map((file) => (
          <ListItem
            endContent={<Lines added={file.added} removed={file.removed} />}
            key={file.path}
            label={<Path path={file.path} />}
          />
        ))}
      </List>
      {folded > 0 && !isOpen && (
        <Button
          label={moreFiles(folded)}
          onClick={() => onOpenChange(BRANCH_OPEN, true)}
          size="sm"
          variant="ghost"
        />
      )}
      {isOpen && left > 0 && (
        <Text color="secondary" type="supporting">
          {`and ${moreFiles(left)}`}
        </Text>
      )}
    </VStack>
  );
}

/**
 * The files the session `session` changed, then those committed on the branch of `folder`, the
 * feature's or the change's; a chat in the main checkout has no branch part.
 */
export function ChangesPanel({ folder, session }: { folder?: string; session?: string }) {
  return (
    <VStack gap={3}>
      {/* Before its first message, the session does not exist: it changed nothing. */}
      {session === undefined ? (
        <Nothing />
      ) : (
        <Section>
          <ThisSession session={session} />
        </Section>
      )}
      {folder !== undefined && (
        <Section>
          <OnTheBranch folder={folder} />
        </Section>
      )}
    </VStack>
  );
}
