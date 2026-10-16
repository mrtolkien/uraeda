// A feature's session's column: its step and the plan's tasks, its running sub-agents, the files
// changed on its branch, and its pages. A change's column is drawn by `ChangeAside.tsx`. Beside
// the transcript on wide screens, foldable, the choice kept in the browser.
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { Component, Fragment, type ReactNode, Suspense, useState } from "react";
import type { Feature } from "uraeda-server/fate";
import { ChangeAside } from "./ChangeAside.tsx";
import { useBranchChanges, useFeature, useFile, useSession } from "./data.ts";
import { stepLabel, waiting } from "./labels.ts";
import { SideColumn } from "./layout/SideColumn.tsx";
import { statusStyles } from "./Question.tsx";
import { useRepoPath } from "./routes.tsx";
import { StatusMark } from "./StatusMark.tsx";
import { storybookHref } from "./stories.tsx";

const styles = stylex.create({
  added: { color: colorVars["--color-text-green"] },
  // A long path breaks anywhere, rather than running under its lines' counts.
  path: { minWidth: 0, overflowWrap: "anywhere" },
  removed: { color: colorVars["--color-text-red"] },
});

/** Where the column's folded state is kept, for every session: `"shown"` or `"hidden"`. */
const KEY = "uraeda.sessionAside";

/**
 * The choice made in this document when storage refused it: pages are drawn anew at each address,
 * and keep it until the document goes.
 */
let refusedChoice: boolean | undefined;

/** Whether the column shows, and the function that shows or hides it. */
export type AsideShown = [boolean, (shown: boolean) => void];

/**
 * Whether the session's column shows, kept in `localStorage` for every session. Where the browser
 * refuses storage, the choice lasts for the page's life.
 */
export function useAsideShown(): AsideShown {
  const [shown, setShown] = useState(() => {
    if (refusedChoice !== undefined) {
      return refusedChoice;
    }
    try {
      return window.localStorage.getItem(KEY) !== "hidden";
    } catch {
      return true;
    }
  });
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(KEY, next ? "shown" : "hidden");
      refusedChoice = undefined;
    } catch {
      // Private windows may refuse storage: the choice lasts until the document reloads.
      refusedChoice = next;
    }
    setShown(next);
  };
  return [shown, set];
}

/**
 * A session's page, with a feature's column beside it at the window's edge, on wide screens: shown
 * or hidden from its button or `]`, its width kept in the browser.
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
  if (!aside || folder === undefined) {
    return <>{children}</>;
  }
  const [shown, setShown] = aside;
  return (
    <SideColumn
      content={children}
      isShown={shown}
      label="Progress"
      onShownChange={setShown}
      storageKey="uraeda.column"
    >
      <SessionAside folder={folder} {...(session === undefined ? {} : { session })} />
    </SideColumn>
  );
}

/**
 * A section of the column whose read failed: left out, so the session and the other sections go
 * on. The read is tried again with the page.
 */
export class Section extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? null : <Suspense fallback={null}>{this.props.children}</Suspense>;
  }
}

/** What the feature's step is, in words: what a gate asks of the human, or the step's name. */
export function stepTitle(feature: Parameters<typeof waiting>[0] & { step: { waitsOn: string } }) {
  return feature.step.waitsOn === "human" ? waiting(feature).title : stepLabel(feature.step.name);
}

/** A section's heading: a level-2 heading, sized as a sidebar's. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <Heading accessibilityLevel={2} level={4}>
      {children}
    </Heading>
  );
}

/**
 * The column's sections: the step and the plan's tasks, the running sub-agents, the files changed
 * on the branch, and the feature's pages. A change has sections of its own.
 */
export function SessionAside({ folder, session }: { folder: string; session?: string }) {
  const feature = useFeature(folder);
  if (!feature || feature.missing) {
    return null;
  }
  if (feature.kind === "change") {
    return <ChangeAside folder={folder} {...(session === undefined ? {} : { session })} />;
  }
  return (
    <VStack gap={6}>
      <VStack gap={2}>
        <SectionHeading>{stepTitle(feature)}</SectionHeading>
        <Section>
          <Tasks
            folder={folder}
            implemented={feature.step.implemented}
            progress={feature.step.progress ?? null}
          />
        </Section>
      </VStack>
      {session !== undefined && (
        <Section>
          <Subagents session={session} />
        </Section>
      )}
      <Section>
        <Changes folder={folder} />
      </Section>
      <Pages feature={feature} />
    </VStack>
  );
}

type Progress = NonNullable<Feature["step"]["progress"]>;

/**
 * The plan's tasks, the current one marked, under a bar while the implementation goes on, or a full
 * one once the core says it is over; "No plan yet." without a plan or a task.
 */
function Tasks({
  folder,
  implemented,
  progress,
}: {
  folder: string;
  implemented: boolean;
  progress: Progress | null;
}) {
  const plan = useFile(folder, "plan.md");
  const tasks = plan && !plan.missing ? (plan.current.items.plan?.tasks ?? []) : [];
  if (tasks.length === 0) {
    return <Text color="secondary">No plan yet.</Text>;
  }
  return (
    <VStack gap={2}>
      {progress ? (
        <ProgressBar
          label={`Task ${progress.position} of ${progress.total}`}
          max={progress.total}
          value={progress.position}
        />
      ) : (
        implemented && (
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
export function Subagents({ session }: { session: string }) {
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

/** A path that breaks after its slashes first, where a line has room for its folders. */
function breakable(path: string) {
  const parts = path.split("/");
  return parts.map((part, index) =>
    index < parts.length - 1 ? (
      <Fragment key={index}>
        {part}/<wbr />
      </Fragment>
    ) : (
      part
    ),
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
 * The files changed on the branch, outside the feature's or the change's folder: the total, then
 * the first 50 by path. No section without a branch; the error, kept, when they could not be read.
 */
export function Changes({
  folder,
  kind = "feature",
}: {
  folder: string;
  kind?: "change" | "feature";
}) {
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
        <Text color="secondary">{`Nothing outside the ${kind}'s folder yet.`}</Text>
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
                label={
                  <Text type="code" xstyle={styles.path}>
                    {breakable(file.path)}
                  </Text>
                }
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

/**
 * The row opening the Storybook page of a feature or a change, when its checkout has an active
 * preview decision; nothing otherwise.
 */
export function StorybookRow({ item }: { item: Pick<Feature, "folder" | "preview"> }) {
  const here = useRepoPath();
  return item.preview ? (
    <ListItem href={here(storybookHref(item.folder))} label="Storybook" />
  ) : null;
}

/**
 * The feature's page, its Storybook when it has a preview decision, then its workflow files but its
 * reviews, each a row that opens it.
 */
function Pages({ feature }: { feature: Pick<Feature, "files" | "folder" | "preview"> }) {
  const here = useRepoPath();
  const files = feature.files.filter((file) => file.kind !== "review");
  return (
    <VStack gap={2}>
      <SectionHeading>Feature</SectionHeading>
      <List aria-label="Feature" density="compact">
        <ListItem href={here(`/f/${feature.folder}`)} label="Feature page" />
        <StorybookRow item={feature} />
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
