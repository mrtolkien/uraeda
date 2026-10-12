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
import { usePathname, useRestoreScroll } from "./routes.tsx";

/** A row that leads somewhere, tapped as a whole. */
function Row({
  href,
  badge,
  title,
  line,
  isSelected,
}: {
  href: string;
  badge?: ReactNode;
  title: string;
  line?: ReactNode;
  isSelected?: boolean;
}) {
  return (
    <ListItem
      href={href}
      isSelected={isSelected}
      startContent={badge}
      // Nodes, not strings, so long titles and lines wrap instead of being cut.
      label={<>{title}</>}
      description={line === undefined || line === null ? undefined : <>{line}</>}
      endContent={
        <Text color="secondary" aria-hidden="true">
          ›
        </Text>
      }
    />
  );
}

/** A group of rows under its heading. */
function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <List
      header={title ? <Heading level={2}>{title}</Heading> : undefined}
      aria-label={title ? undefined : "More"}
      hasDividers
    >
      {children}
    </List>
  );
}

/** The home screen: what waits on the human, what agents do, the next priorities, what is done. */
export function Home() {
  const workspace = useWorkspace();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  // The task view open beside home, on wide screens.
  const pathname = usePathname();
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
  const done = features.filter((f) => f.step.name === "done");
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
              const { verb, line, href } = waiting(feature);
              return (
                <Row
                  key={feature.folder}
                  href={href}
                  badge={<Badge variant="warning" label={verb} />}
                  title={feature.title}
                  line={line}
                />
              );
            })}
          </Group>
        )}
        {invalid.length > 0 && (
          <Group title="Files to fix">
            {invalid.map((feature) => (
              <Row
                key={feature.folder}
                href={`/f/${feature.folder}`}
                badge={<Badge variant="error" label="Problems" />}
                title={feature.title}
                line={feature.problems[0].message}
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
                  key={feature.folder}
                  href={`/f/${feature.folder}`}
                  // A running agent says so; its step moves to the line under the title.
                  badge={
                    <Badge
                      variant={working ? "success" : "info"}
                      label={working ? "Working" : step}
                    />
                  }
                  title={feature.title}
                  line={line || undefined}
                />
              );
            })}
          </Group>
        )}
        <Group title={priorities.length > 0 ? "Priorities" : undefined}>
          {priorities.map((entry) => (
            <Row
              key={entry.id}
              href={`/priorities/${entry.key}`}
              isSelected={pathname === `/priorities/${entry.key}`}
              title={entry.text}
              line={entry.section === "now" ? "Now" : "Next"}
            />
          ))}
          <Row href="/priorities" title="All priorities" />
        </Group>
        {done.length > 0 && (
          <Group title="Done">
            {done.map((feature) => (
              <Row
                key={feature.folder}
                href={`/f/${feature.folder}`}
                badge={<Badge variant="success" label="Merged" />}
                title={feature.title}
              />
            ))}
          </Group>
        )}
      </VStack>
    </Page>
  );
}
