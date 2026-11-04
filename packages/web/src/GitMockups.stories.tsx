// The git page's mockups (`specs/2026-11-04-basic-git/spec.md`): the page of the main checkout, its
// sync, the changed files to stage, the history, and the worktrees, with the picked
// row's diff beside them on wide screens and alone on the phone; a pull stopped by a conflict; an
// agent working in the checkout; a refused pull; and Clean's question. Built from the real components
// over fixed text, with no server: the stories show the look, and the page's data is the real page's
// once built.
import { Button } from "@astryxdesign/core/Button";
import { CheckboxInput } from "@astryxdesign/core/CheckboxInput";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import type { Meta, StoryObj } from "@storybook/react-vite";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect } from "react";
import { ConfirmHost, useConfirm } from "./fields/Confirm.tsx";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { DiffCount } from "./layout/DiffCount.tsx";
import { PageTitle } from "./layout/PageTitle.tsx";
import { Pane } from "./layout/Pane.tsx";
import { Panes } from "./layout/Panes.tsx";
import { pickedStyles } from "./layout/picked.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Path } from "./session/Path.tsx";

const styles = stylex.create({
  page: { paddingBlock: spacingVars["--spacing-3"], paddingInline: spacingVars["--spacing-3"] },
  // A row of a section: its text first, its counts and its action at the end; on the phone, those on
  // a head line over the text, which then takes the whole width.
  end: { flexShrink: 0, justifyContent: "flex-end" },
  row: {
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-2"],
    justifyContent: "space-between",
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  rowNarrow: { alignItems: "stretch", flexDirection: "column-reverse", gap: 0 },
  text: { flexGrow: 1, minWidth: 0 },
  // A row inside a folder: indented one step, as the mockup's tree has one level.
  nested: { paddingInlineStart: spacingVars["--spacing-5"] },
  // A file's room where a folder's chevron sits, so names line up.
  leaf: { flexShrink: 0, width: spacingVars["--spacing-4"] },
  // A conflict's bar, over its lines in the editor: the sides by name, then both.
  bar: {
    backgroundColor: colorVars["--color-background-muted"],
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-1"],
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

/**
 * A row of a section, `isPicked` when the keys or the pointer chose it: its text, then `end`, its
 * counts, date, or action, beside it on wider screens and on a head line over it on the phone.
 */
function Row({
  children,
  end,
  isInline = false,
  isPicked = false,
}: {
  children: ReactNode;
  end?: ReactNode;
  /** A tree's short row keeps its counts beside it on the phone too, so the tree stays compact. */
  isInline?: boolean;
  isPicked?: boolean;
}) {
  const narrow = isNarrow(useWidthClass()) && !isInline;
  return (
    <div {...stylex.props(styles.row, narrow && styles.rowNarrow, isPicked && pickedStyles.picked)}>
      <div {...stylex.props(styles.text)}>{children}</div>
      {end && (
        <HStack gap={2} xstyle={styles.end}>
          {end}
        </HStack>
      )}
    </div>
  );
}

/** The title's line: the branch against `origin`, and when it was last fetched. */
function Sync({ isWorking = false }: { isWorking?: boolean }) {
  return (
    <PageTitle
      aside={
        <HStack gap={1}>
          <Button isDisabled={isWorking} label="Fetch" size="sm" variant="secondary" />
          <Button isDisabled={isWorking} label="Pull · 3" size="sm" variant="primary" />
          <Button isDisabled={isWorking} label="Push · 6" size="sm" variant="secondary" />
        </HStack>
      }
      meta={{ text: "main · 3 to pull · 6 to push · fetched 2 minutes ago" }}
    >
      Git
    </PageTitle>
  );
}

/** A row of the changes' tree, a folder or a file, at its depth. */
type Node = {
  added: number;
  depth: number;
  isOpen?: boolean;
  name: string;
  removed: number;
  staged: boolean | "indeterminate";
};

/**
 * A row of the changes' tree: its chevron for a folder, its box, staged, empty, or mixed, which
 * Space ticks, then its counts. A staged file keeps its place.
 */
function TreeRow({
  isPicked = false,
  isWorking = false,
  node,
}: {
  isPicked?: boolean;
  isWorking?: boolean;
  node: Node;
}) {
  const isFolder = node.isOpen !== undefined;
  return (
    <Row end={<DiffCount added={node.added} removed={node.removed} />} isInline isPicked={isPicked}>
      <HStack gap={1} xstyle={node.depth > 0 && styles.nested}>
        {isFolder ? (
          <Icon icon={node.isOpen ? "chevronDown" : "chevronRight"} size="sm" />
        ) : (
          <span {...stylex.props(styles.leaf)} />
        )}
        <CheckboxInput isDisabled={isWorking} label={node.name} value={node.staged} />
      </HStack>
    </Row>
  );
}

/** The main checkout's changed files, as a tree: `specs/` mixed, `docs/` folded. */
const MAIN: ReadonlyArray<Node> = [
  { added: 4, depth: 0, isOpen: true, name: "crates/core/src", removed: 1, staged: false },
  { added: 4, depth: 1, name: "git.rs", removed: 1, staged: false },
  { added: 2, depth: 0, isOpen: false, name: "docs", removed: 0, staged: false },
  { added: 3, depth: 0, isOpen: true, name: "specs", removed: 2, staged: "indeterminate" },
  { added: 3, depth: 1, name: "INBOX.md", removed: 0, staged: true },
  { added: 0, depth: 1, name: "PRIORITIES.md", removed: 2, staged: false },
];

/**
 * Every changed file of the main checkout, as a tree, the inbox and the priorities as any other;
 * then a feature's worktree with a buffer's save, as a tree of its own with its own commit.
 */
function Changes({ isWorking = false }: { isWorking?: boolean }) {
  return (
    <VStack gap={4}>
      <Pane
        actions={
          <Button isDisabled={isWorking} label="Commit staged" size="sm" variant="primary" />
        }
        count={4}
        title="Changes"
      >
        <VStack gap={0}>
          {MAIN.map((node, index) => (
            <TreeRow
              isPicked={index === 1}
              isWorking={isWorking}
              key={`${node.depth}-${node.name}`}
              node={node}
            />
          ))}
        </VStack>
      </Pane>
      <Pane
        actions={<Button isDisabled={isWorking} label="Commit" size="sm" variant="secondary" />}
        count={1}
        title="Vim mode"
      >
        <VStack gap={0}>
          <TreeRow
            isWorking={isWorking}
            node={{
              added: 6,
              depth: 0,
              isOpen: true,
              name: "specs/changes/2026-11-04-vim-mode",
              removed: 1,
              staged: false,
            }}
          />
          <TreeRow
            isWorking={isWorking}
            node={{ added: 6, depth: 1, name: "proposal.md", removed: 1, staged: false }}
          />
        </VStack>
      </Pane>
    </VStack>
  );
}

/** The branch's commits, newest first: those to pull marked ↓, those to push ↑. */
function History() {
  const commits: ReadonlyArray<[mark: string, subject: string, hash: string, when: string]> = [
    ["↓", "feat(vim-mode): selected text stays visible in visual mode", "4f8c2b7", "1 h"],
    ["↓", "fix(reading-long): the composer folds while reading", "915e0b3", "2 h"],
    ["↓", "finish(reading-long): Reading long responses", "45782d7", "2 h"],
    ["↑", "chore(basic-git): start Basic git UI in the web ui", "d725122", "3 h"],
    ["↑", "chore(reading-long): start Reading long responses", "310f6c5", "3 h"],
    ["", "test: drop the decisions' total word budget", "1f3fb80", "7 h"],
  ];
  return (
    <Pane title="History">
      <VStack gap={0}>
        {commits.map(([mark, subject, hash, when]) => (
          <Row
            end={
              <Text color="secondary" type="supporting">
                {mark ? `${mark} ` : ""}
                {hash} · {when}
              </Text>
            }
            key={hash}
          >
            <Text>{subject}</Text>
          </Row>
        ))}
      </VStack>
    </Pane>
  );
}

/** A worktree's row: its feature's name, or its folder's, over its path and its state. */
function Worktree({ end, name, state }: { end?: ReactNode; name: string; state: string }) {
  return (
    <Row end={end}>
      <VStack gap={0}>
        <Text>{name}</Text>
        <Text color="secondary" type="supporting">
          {state}
        </Text>
      </VStack>
    </Row>
  );
}

/** Every worktree, the main checkout first, with what each one allows. */
function Worktrees() {
  return (
    <Pane count={4} title="Worktrees">
      <VStack gap={0}>
        <Worktree name="main" state="this checkout" />
        <Worktree name="Vim mode" state=".worktrees/2026-11-04-vim-mode · an agent works there" />
        <Worktree
          end={<Button label="Clean" size="sm" variant="secondary" />}
          name={'"Master" PR'}
          state=".worktrees/2026-11-03-master-pr · merged"
        />
        <Worktree
          end={<Button label="Remove" size="sm" variant="secondary" />}
          name="coherence-before"
          state=".worktrees/coherence-before · detached, no changes"
        />
      </VStack>
    </Pane>
  );
}

const DIFF = `@@ -456,6 +456,10 @@ impl Git {
     /// When \`origin\` was last fetched, from \`FETCH_HEAD\`.
     pub fn fetched_at(&self) -> Option<SystemTime> {
-        fs::metadata(self.git_dir().join("FETCH_HEAD")).ok()?.modified().ok()
+        let head = self.common_dir().join("FETCH_HEAD");
+        fs::metadata(head).ok()?.modified().ok()
     }
+
+    /// Commits the default branch lacks, and those \`origin\` has that it lacks.
+    pub fn ahead_behind(&self) -> (usize, usize) { todo!() }
 }`;

/** The picked file's diff: its path as the pane's title, unified, in the theme's diff colours. */
function Diff() {
  return (
    <Pane
      actions={<Button label="Stage" size="sm" variant="ghost" />}
      title="crates/core/src/git.rs"
    >
      <CodeBlock code={DIFF} hasLineNumbers isDiff isWrapped language="rust" />
    </Pane>
  );
}

/** The page: its sections in a column, the picked row's diff beside them, or alone on the phone. */
function GitPage({
  banner,
  detail,
  isWorking = false,
  sections,
}: {
  banner?: ReactNode;
  detail?: ReactNode;
  isWorking?: boolean;
  sections?: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.page)}>
      <Panes
        detail={detail}
        list={
          <VStack gap={4}>
            <Sync isWorking={isWorking} />
            {banner}
            {sections ?? (
              <>
                <Changes isWorking={isWorking} />
                <History />
                <Worktrees />
              </>
            )}
          </VStack>
        }
      />
    </div>
  );
}

const CONFLICT = `- Basic git UI in the web ui (pull, see diffs, ...)
<<<<<<< origin/main
- Review the UI guidelines properly, with the phone first
=======
- Review the UI guidelines properly
>>>>>>> main
- Global undo`;

/** The conflicted file in the shared editor: a bar over each conflict, its sides by branch. */
function ConflictEditor() {
  return (
    <Pane title="specs/PRIORITIES.md · 1 conflict">
      <VStack gap={0}>
        <div {...stylex.props(styles.bar)}>
          <Button label="Use origin/main" size="sm" variant="ghost" />
          <Button label="Use main" size="sm" variant="ghost" />
          <Button label="Use both" size="sm" variant="ghost" />
        </div>
        <CodeBlock code={CONFLICT} isWrapped language="markdown" />
      </VStack>
    </Pane>
  );
}

/** The conflicted files of a stopped pull, each with its whole sides, then Continue and Abort. */
function Conflicts() {
  return (
    <Pane
      actions={
        <HStack gap={1}>
          <Button label="Abort" size="sm" variant="secondary" />
          <Button isDisabled label="Continue" size="sm" variant="primary" />
        </HStack>
      }
      count={1}
      title="Conflicts"
      tone="attention"
    >
      <Row
        end={
          <>
            <Button label="Use origin/main" size="sm" variant="ghost" />
            <Button label="Use main" size="sm" variant="ghost" />
          </>
        }
        isPicked
      >
        <VStack gap={0}>
          <Path path="specs/PRIORITIES.md" />
          <Text color="secondary" type="supporting">
            both changed
          </Text>
        </VStack>
      </Row>
    </Pane>
  );
}

const meta = {
  component: GitPage,
  // The page fills the frame, as in the app's main column.
  parameters: { layout: "fullscreen" },
  title: "Mockups/Git page",
} satisfies Meta<typeof GitPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * After a pull request merged: 3 commits to pull, 6 chores to push, the changed files as a tree,
 * one staged in place, a feature's buffer save in its own tree, and the picked file's diff beside the sections.
 */
export const Behind: Story = { args: { detail: <Diff /> } };

/** Nothing picked: the sections alone, which the phone shows until a row opens its diff. */
export const Sections: Story = {};

/**
 * A pull stopped by a conflict: main's chores are being rebased onto origin/main, and
 * `PRIORITIES.md` conflicts. Continue waits for every conflict to be resolved.
 */
export const Conflict: Story = {
  args: {
    banner: (
      <AnnouncedBanner
        collapsible={false}
        description="Resolve each conflict, then Continue. Abort puts main back as it was before the pull."
        status="warning"
        title="The pull stopped: 1 file conflicts."
      />
    ),
    detail: <ConflictEditor />,
    sections: (
      <>
        <Conflicts />
        <History />
      </>
    ),
  },
};

/** A chat's agent works in the main checkout: the page reads, and its writes wait for the turn. */
export const AgentWorking: Story = {
  args: {
    banner: (
      <AnnouncedBanner
        collapsible={false}
        description="Pull, push, merge, staging, and commits come back once its turn ends."
        status="info"
        title="An agent works in this checkout."
      />
    ),
    isWorking: true,
  },
};

/** A pull refused for want of credentials: git's message, and why the server cannot prompt. */
export const PullRefused: Story = {
  args: {
    banner: (
      <AnnouncedBanner
        collapsible={false}
        description="fatal: could not read Username for 'https://github.com': terminal prompts disabled. The server runs git without a terminal: give it a credential helper or an ssh-agent."
        status="error"
        title="The pull failed."
      />
    ),
  },
};

/** Clean's question on a merged feature's worktree, as `ura clean` would act. */
function AskClean() {
  const confirm = useConfirm();
  useEffect(() => {
    void confirm({
      body: 'Removes .worktrees/2026-11-03-master-pr, deletes its branch, and removes "Master" PR from the priorities.',
      cancel: "Keep",
      confirm: "Clean",
      destructive: true,
      title: 'Clean "Master" PR?',
    });
  }, [confirm]);
  return <GitPage />;
}

export const CleanAsked: Story = {
  render: () => (
    <ConfirmHost>
      <AskClean />
    </ConfirmHost>
  ),
};

/** The icon the sidebar's Git entry takes, with its count of what waits. */
export const SidebarEntry: Story = {
  render: () => (
    <div {...stylex.props(styles.page)}>
      <Button icon={<Icon icon="git-branch" />} label="Git · ↓3" variant="secondary" />
    </div>
  ),
};
