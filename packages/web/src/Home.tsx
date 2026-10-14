import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import { useWorkspace } from "./data.ts";
import { stepLabel, waiting } from "./labels.ts";
import { Page } from "./layout/Page.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { QuickAdd } from "./QuickAdd.tsx";
import { useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";

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

/** The home screen: what waits on the human, what agents do, the next priorities, what is done. */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: each section's list in a component
export function Home() {
  const workspace = useWorkspace();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  // The task view open beside home, on wide screens.
  const pathname = useLocalPath();
  const here = useRepoPath();
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
      <TopBarSlot>
        <QuickAdd />
      </TopBarSlot>
      <VStack gap={6}>
        {!human.length && <Banner status="info" title="Nothing waits on you." />}
        {human.length > 0 && (
          <Group title="Waiting on you">
            {human.map((feature) => {
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
        )}
        {invalid.length > 0 && (
          <Group title="Files to fix">
            {invalid.map((feature) => (
              <Row
                badge={<Badge label="Problems" variant="error" />}
                href={here(`/f/${feature.folder}`)}
                key={feature.folder}
                line={feature.problems[0].message}
                title={feature.title}
              />
            ))}
          </Group>
        )}
        {agents.length > 0 && (
          <Group title="Agents at work">
            {agents.map((feature) => {
              const working = workspace.running.includes(feature.folder);
              const step = stepLabel(feature.step.name);
              const line = working
                ? [step, feature.step.task].filter(Boolean).join(" · ")
                : feature.step.task;
              return (
                <Row
                  // A running agent says so; its step moves to the line under the title.
                  badge={
                    <Badge
                      label={working ? "Working" : step}
                      variant={working ? "success" : "info"}
                    />
                  }
                  href={here(`/f/${feature.folder}`)}
                  key={feature.folder}
                  line={line || undefined}
                  title={feature.title}
                />
              );
            })}
          </Group>
        )}
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
        {done.length > 0 && (
          <Group title="Done">
            {done.map((feature) => (
              <Row
                badge={<Badge label="Merged" variant="success" />}
                href={here(`/f/${feature.folder}`)}
                key={feature.folder}
                title={feature.title}
              />
            ))}
          </Group>
        )}
      </VStack>
    </Page>
  );
}
