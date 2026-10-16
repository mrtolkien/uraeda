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
function Row({
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
type Feature = NonNullable<ReturnType<typeof useWorkspace>>["features"][number];

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

/** The features agents work on, each with its step, or "Working" while its agent runs. */
function AgentsGroup({ features, running }: { features: Array<Feature>; running: Array<string> }) {
  const here = useRepoPath();
  if (!features.length) {
    return null;
  }
  return (
    <Group title="Agents at work">
      {features.map((feature) => {
        const working = running.includes(feature.folder);
        const step = stepLabel(feature.step.name);
        const line = working
          ? [step, feature.step.task].filter(Boolean).join(" · ")
          : feature.step.task;
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
  const features = workspace.features;
  const human = features.filter((f) => f.step.waitsOn === "human" && !f.problems.length);
  const agents = features.filter(
    (f) => f.step.waitsOn === "agent" && f.step.name !== "none" && !f.problems.length,
  );
  const invalid = features.filter((f) => f.problems.length && f.step.name !== "done");
  // Latest first: a folder's name starts with its date.
  const done = features
    .filter((f) => f.step.name === "done")
    .sort((a, b) => b.folder.localeCompare(a.folder));
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
