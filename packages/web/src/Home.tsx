import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useLayoutEffect } from "react";
import { useInbox, useWorkspace } from "./data.ts";
import { notes } from "./InboxPage.tsx";
import { stepLabel, waiting } from "./labels.ts";
import { Page } from "./layout/Page.tsx";
import { useHash, useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";

/** A row that leads somewhere, tapped as a whole. */
export function Row({
  badge,
  href,
  isSelected,
  line,
  title,
}: {
  badge?: ReactNode;
  href: string;
  isSelected?: boolean;
  line?: ReactNode;
  title: string;
}) {
  return (
    <ListItem
      description={line === undefined || line === null ? undefined : <>{line}</>}
      endContent={
        <Text aria-hidden="true" color="secondary">
          ›
        </Text>
      }
      href={href}
      isSelected={isSelected}
      // Nodes, not strings, so long titles and lines wrap instead of being cut.
      label={<>{title}</>}
      startContent={badge}
    />
  );
}

/** A group of rows under its heading. */
function Group({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <List
      aria-label={title ? undefined : "More"}
      hasDividers
      header={title ? <Heading level={2}>{title}</Heading> : undefined}
    >
      {children}
    </List>
  );
}

/** The workspace's features, as home reads them. */
export type Feature = NonNullable<ReturnType<typeof useWorkspace>>["features"][number];

/** The features waiting on the human, each by what it waits for, with the block's line. */
function WaitingGroup({ features }: { features: Array<Feature> }) {
  const here = useRepoPath();
  if (!features.length) {
    return <Banner status="info" title="Nothing waits on you." />;
  }
  return (
    <Group title="Waiting on you">
      {features.map((feature) => {
        const { href, line, verb } = waiting(feature);
        return (
          <Row
            badge={<Badge label={verb} variant="warning" />}
            href={here(href)}
            key={feature.folder}
            line={line}
            title={feature.title}
          />
        );
      })}
    </Group>
  );
}

/** The features whose files have problems, each with its first one. */
function ProblemsGroup({ features }: { features: Array<Feature> }) {
  const here = useRepoPath();
  if (!features.length) {
    return null;
  }
  return (
    <Group title="Files to fix">
      {features.map((feature) => (
        <Row
          badge={<Badge label="Problems" variant="error" />}
          href={here(`/f/${feature.folder}`)}
          key={feature.folder}
          line={feature.problems[0].message}
          title={feature.title}
        />
      ))}
    </Group>
  );
}

/**
 * A feature an agent works on: whether its agent runs now, its step's label, and the line under
 * its title, the step and the task while it runs, the task alone otherwise.
 */
export function agentState(feature: Feature, running: Array<string>) {
  const working = running.includes(feature.folder);
  const step = stepLabel(feature.step.name);
  const line = working ? [step, feature.step.task].filter(Boolean).join(" · ") : feature.step.task;
  return { line, step, working };
}

/** The features agents work on, each with its step, or "Working" while its agent runs. */
function AgentsGroup({ features, running }: { features: Array<Feature>; running: Array<string> }) {
  const here = useRepoPath();
  if (!features.length) {
    return null;
  }
  return (
    <Group title="Agents at work">
      {features.map((feature) => {
        const { line, step, working } = agentState(feature, running);
        return (
          <Row
            // A running agent says so; its step moves to the line under the title.
            badge={
              <Badge label={working ? "Working" : step} variant={working ? "success" : "info"} />
            }
            href={here(`/f/${feature.folder}`)}
            key={feature.folder}
            line={line || undefined}
            title={feature.title}
          />
        );
      })}
    </Group>
  );
}

/** How many notes wait in the inbox, opening it; nothing when it holds none. */
function InboxGroup() {
  const inbox = useInbox();
  const here = useRepoPath();
  const count = inbox?.count ?? 0;
  if (!count) {
    return null;
  }
  return (
    <Group title="Inbox">
      <Row href={here("/inbox")} title={`${notes(count)} to organize`} />
    </Group>
  );
}

/** The Now and Next lines not started, each opening its task view, then all the priorities. */
function PrioritiesGroup({
  priorities,
}: {
  priorities: NonNullable<ReturnType<typeof useWorkspace>>["priorities"];
}) {
  // The task view open beside home, on wide screens.
  const pathname = useLocalPath();
  const here = useRepoPath();
  return (
    <Group title={priorities.length > 0 ? "Priorities" : undefined}>
      {priorities.map((entry) => (
        <Row
          href={here(`/priorities/${entry.key}`)}
          isSelected={pathname === `/priorities/${entry.key}`}
          key={entry.id}
          line={entry.section === "now" ? "Now" : "Next"}
          title={entry.text}
        />
      ))}
      <Row href={here("/priorities")} title="All priorities" />
    </Group>
  );
}

/** The merged features, latest first. */
function DoneGroup({ features }: { features: Array<Feature> }) {
  const here = useRepoPath();
  if (!features.length) {
    return null;
  }
  return (
    // The sidebar's Done area opens it at `#done`.
    <div id="done">
      <Group title="Done">
        {features.map((feature) => (
          <Row
            badge={<Badge label="Merged" variant="success" />}
            href={here(`/f/${feature.folder}`)}
            key={feature.folder}
            title={feature.title}
          />
        ))}
      </Group>
    </div>
  );
}

/**
 * The features as home sorts them: waiting on the human, on an agent, with problems in their files,
 * and merged, latest first.
 */
export function homeFeatures(features: Array<Feature>) {
  return {
    agents: features.filter(
      (f) => f.step.waitsOn === "agent" && f.step.name !== "none" && !f.problems.length,
    ),
    // Latest first: a folder's name starts with its date.
    done: features
      .filter((f) => f.step.name === "done")
      .sort((a, b) => b.folder.localeCompare(a.folder)),
    human: features.filter((f) => f.step.waitsOn === "human" && !f.problems.length),
    invalid: features.filter((f) => f.problems.length && f.step.name !== "done"),
  };
}

/**
 * A started feature's status in a word, as a badge shows it: what it waits on the human for, its
 * agent working, or its step.
 */
export function featureStatus(
  feature: Feature,
  running: Array<string>,
): { label: string; variant: "info" | "success" | "warning" } {
  if (feature.step.waitsOn === "human") {
    return { label: waiting(feature).verb, variant: "warning" };
  }
  const { step, working } = agentState(feature, running);
  return working ? { label: "Working", variant: "success" } : { label: step, variant: "info" };
}

/** The workspace's priorities, as home reads them. */
export type Priority = NonNullable<ReturnType<typeof useWorkspace>>["priorities"][number];

/**
 * The inbox as home sums it up: its count, each category with its number of notes, the notes
 * without one first, and the last `latest` notes written. Notes carry no date: quick add writes at
 * the end of the notes without a category, so the latest are taken from there first.
 */
export function inboxSummary(inbox: ReturnType<typeof useInbox>, latest = 3) {
  const categories = (inbox?.categories ?? []).filter((category) => category.notes.length);
  const loose = categories.filter((category) => !category.name).flatMap((c) => c.notes);
  const sorted = categories.filter((category) => category.name).flatMap((c) => c.notes);
  return {
    categories: categories.map((category) => ({
      count: category.notes.length,
      name: category.name ?? "Not sorted",
    })),
    count: inbox?.count ?? 0,
    latest: [...loose.toReversed(), ...sorted.toReversed()].slice(0, latest),
  };
}

/** The Now and Next lines, each with the feature it started, when it did. */
export function nowAndNext(workspace: { features: Array<Feature>; priorities: Array<Priority> }) {
  const entries = workspace.priorities
    .filter((entry) => entry.section === "now" || entry.section === "next")
    .map((entry) => ({
      entry,
      feature: workspace.features.find((feature) => feature.folder === entry.feature),
    }));
  return {
    next: entries.filter(({ entry }) => entry.section === "next"),
    now: entries.filter(({ entry }) => entry.section === "now"),
  };
}

/**
 * The home screen: what waits on the human, what agents do, the notes to organize, the next
 * priorities, and what is done.
 */
export function Home() {
  const workspace = useWorkspace();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  const hash = useHash();
  // After the position: the sidebar's "…" opens the Done group.
  useLayoutEffect(() => {
    if (hash === "#done") {
      document.getElementById("done")?.scrollIntoView();
    }
  }, [hash]);
  if (!workspace) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <Page>
        <Banner
          status="warning"
          title={`No specs/ folder in ${workspace.noSpecs}. Set Uraeda up with ura init.`}
        />
      </Page>
    );
  }
  const { agents, done, human, invalid } = homeFeatures(workspace.features);
  const priorities = workspace.priorities.filter(
    (entry) => (entry.section === "now" || entry.section === "next") && !entry.feature,
  );

  return (
    <Page>
      <VStack gap={6}>
        <WaitingGroup features={human} />
        <ProblemsGroup features={invalid} />
        <AgentsGroup features={agents} running={workspace.running} />
        <InboxGroup />
        <PrioritiesGroup priorities={priorities} />
        <DoneGroup features={done} />
      </VStack>
    </Page>
  );
}
