// A feature's session's column: its step and the plan's tasks, its running sub-agents, the files
// changed on its branch, and its pages. Beside the transcript on wide screens, foldable, the choice
// kept in the browser.
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { Layout, LayoutPanel } from "@astryxdesign/core/Layout";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense, useState } from "react";
import type { Feature } from "uraeda-server/fate";
import { useBranchChanges, useFeature, useFile, useSession } from "./data.ts";
import { stepLabel } from "./labels.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { statusStyles } from "./Question.tsx";
import { useRepoPath } from "./routes.tsx";
import { StatusMark } from "./StatusMark.tsx";

const styles = stylex.create({
  added: { color: colorVars["--color-text-green"] },
  panel: {
    // Beside the transcript, in view while the window scrolls, scrolling on its own when taller
    // than the window.
    alignSelf: "flex-start",
    maxHeight: "var(--size-viewport-height)",
    position: "sticky",
    top: 0,
  },
  removed: { color: colorVars["--color-text-red"] },
});

/** Where the column's folded state is kept, for every session: `"shown"` or `"hidden"`. */
const KEY = "uraeda.sessionAside";

/** Whether the column shows, and the function that shows or hides it. */
export type AsideShown = [boolean, (shown: boolean) => void];

/**
 * Whether the session's column shows, kept in `localStorage` for every session. Where the browser
 * refuses storage, the choice lasts for the page's life.
 */
export function useAsideShown(): AsideShown {
  const [shown, setShown] = useState(() => {
    try {
      return window.localStorage.getItem(KEY) !== "hidden";
    } catch {
      return true;
    }
  });
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "shown" : "hidden");
    } catch {
      // Private windows may refuse storage: the choice lasts until the page reloads.
    }
    setShown(next);
  };
  return [shown, set];
}

/** "Hide progress", or "Show progress" once hidden: on wide screens only, where the column is. */
export function AsideToggle({ aside: [shown, setShown] }: { aside: AsideShown }) {
  if (useWidthClass() !== "wide") {
    return null;
  }
  return (
    <Button
      label={shown ? "Hide progress" : "Show progress"}
      onClick={() => setShown(!shown)}
      size="sm"
      variant="ghost"
    />
  );
}

/**
 * A feature's session's content, with the column beside it on wide screens while it is shown; the
 * content alone otherwise.
 */
export function WithAside({
  aside,
  children,
  folder,
  session,
}: {
  aside: AsideShown | undefined;
  children: ReactNode;
  folder: string | undefined;
  session?: string;
}) {
  const wide = useWidthClass() === "wide";
  if (!wide || !aside?.[0] || folder === undefined) {
    return children;
  }
  return (
    <Layout
      content={children}
      end={
        <LayoutPanel
          hasDivider
          label="Progress"
          role="complementary"
          width="var(--size-session-aside)"
          xstyle={styles.panel}
        >
          <SessionAside folder={folder} {...(session === undefined ? {} : { session })} />
        </LayoutPanel>
      }
      height="auto"
    />
  );
}

/** A section's heading: a level-2 heading, sized as a sidebar's. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading accessibilityLevel={2} level={4}>
      {children}
    </Heading>
  );
}

/**
 * The column's sections: the step and the plan's tasks, the running sub-agents, the files changed
 * on the branch, and the feature's pages.
 */
export function SessionAside({ folder, session }: { folder: string; session?: string }) {
  const feature = useFeature(folder);
  if (!feature || feature.missing) {
    return null;
  }
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <SectionHeading>{stepLabel(feature.step.name)}</SectionHeading>
        <Suspense fallback={null}>
          <Tasks folder={folder} progress={feature.step.progress ?? null} />
        </Suspense>
      </VStack>
      {session !== undefined && (
        <Suspense fallback={null}>
          <Subagents session={session} />
        </Suspense>
      )}
      <Suspense fallback={null}>
        <Changes folder={folder} />
      </Suspense>
      <Pages feature={feature} />
    </VStack>
  );
}

type Progress = NonNullable<Feature["step"]["progress"]>;

/**
 * The plan's tasks, the current one marked, under a bar while the implementation goes on, or once
 * every task is done; "No plan yet." without a plan or a task.
 */
function Tasks({ folder, progress }: { folder: string; progress: Progress | null }) {
  const plan = useFile(folder, "plan.md");
  const tasks = plan && !plan.missing ? (plan.current.items.plan?.tasks ?? []) : [];
  if (tasks.length === 0) {
    return <Text color="secondary">No plan yet.</Text>;
  }
  const done = tasks.every((task) => task.done === task.total);
  return (
    <VStack gap={2}>
      {progress ? (
        <ProgressBar
          label={`Task ${progress.position} of ${progress.total}`}
          max={progress.total}
          value={progress.position}
        />
      ) : (
        done && (
          <ProgressBar
            label={`${tasks.length} of ${tasks.length} tasks done`}
            max={tasks.length}
            value={tasks.length}
            variant="success"
          />
        )
      )}
      <List aria-label="Tasks" density="compact">
        {tasks.map((task, index) => {
          const current = progress?.position === index + 1;
          const finished = task.done === task.total;
          return (
            <ListItem
              aria-label={`${finished ? "Done: " : current ? "Current: " : ""}${task.title}`}
              key={task.headingBlock}
              label={<Text weight={current ? "semibold" : "normal"}>{task.title}</Text>}
              startContent={
                <Text aria-hidden color={current ? "accent" : "secondary"}>
                  {finished ? "✓" : current ? "●" : "○"}
                </Text>
              }
            />
          );
        })}
      </List>
    </VStack>
  );
}

/** The session's running sub-agents, while any run. */
function Subagents({ session }: { session: string }) {
  const subagents = useSession(session)?.subagents ?? [];
  if (subagents.length === 0) {
    return null;
  }
  return (
    <VStack gap={2}>
      <SectionHeading>Sub-agents</SectionHeading>
      <List aria-label="Sub-agents" density="compact">
        {subagents.map((subagent) => (
          <ListItem
            key={subagent.id}
            label={subagent.description}
            startContent={<StatusMark label="Working" status="working" />}
          />
        ))}
      </List>
    </VStack>
  );
}

/** "1 file", or "N files". */
function fileCount(count: number) {
  return `${count} ${count === 1 ? "file" : "files"}`;
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
      <span {...stylex.props(styles.removed)}>−{removed}</span>
    </Text>
  );
}

/**
 * The files changed on the branch, outside the feature's folder: the total, then the first 50 by
 * path. No section without a branch; the error, kept, when they could not be read.
 */
function Changes({ folder }: { folder: string }) {
  const read = useBranchChanges(folder);
  if (!read || (read.changes === null && !read.failed)) {
    return null;
  }
  const { changes } = read;
  const more = changes ? changes.count - changes.files.length : 0;
  return (
    <VStack gap={2}>
      <SectionHeading>Changed on the branch</SectionHeading>
      {changes === null ? (
        <span {...stylex.props(statusStyles.error)}>The changes could not be read.</span>
      ) : changes.count === 0 ? (
        <Text color="secondary">{"Nothing outside the feature's folder yet."}</Text>
      ) : (
        <>
          <Text color="secondary" type="supporting">
            {`${fileCount(changes.count)} · +${changes.added} −${changes.removed}`}
          </Text>
          <List aria-label="Changed files" density="compact">
            {changes.files.map((file) => (
              <ListItem
                endContent={<Lines added={file.added} removed={file.removed} />}
                key={file.path}
                label={<Text type="code">{file.path}</Text>}
              />
            ))}
          </List>
          {more > 0 && (
            <Text color="secondary" type="supporting">
              {`and ${more} more ${more === 1 ? "file" : "files"}`}
            </Text>
          )}
        </>
      )}
    </VStack>
  );
}

/** The feature's page, then its workflow files but its reviews, each a row that opens it. */
function Pages({ feature }: { feature: Pick<Feature, "files" | "folder"> }) {
  const here = useRepoPath();
  const files = feature.files.filter((file) => file.kind !== "review");
  return (
    <VStack gap={2}>
      <SectionHeading>Feature</SectionHeading>
      <List aria-label="Feature" density="compact">
        <ListItem href={here(`/f/${feature.folder}`)} label="Feature page" />
        {files.map((file) => (
          <ListItem
            href={here(`/f/${feature.folder}/${file.name}`)}
            key={file.name}
            label={<Text type="code">{file.name}</Text>}
          />
        ))}
      </List>
    </VStack>
  );
}
