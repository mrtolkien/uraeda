// The "Hub" variant of home, for the discovery round of the home's redesign: a control hub of cards
// over the whole width. Four stat tiles first, then what needs the human and what agents do in the
// main column, and the priorities, the inbox, and what is done in the column beside it. On the
// phone, one column in the same order, the tiles two by two.
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import type { CardVariant } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useInbox, useWorkspace } from "../data.ts";
import {
  agentState,
  type Feature,
  featureStatus,
  homeFeatures,
  inboxSummary,
  nowAndNext,
  Row,
} from "../Home.tsx";
import { notes } from "../InboxPage.tsx";
import { waiting } from "../labels.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRepoPath } from "../routes.tsx";

const styles = stylex.create({
  // The main column takes two thirds: what needs the human reads first, and widest.
  columns: {
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
  },
  eyebrow: {
    textTransform: "uppercase",
  },
  hub: {
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
    width: "100%",
  },
  wide: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
});

/** A stat tile: its name, its number, and a line saying what it counts; tapped, it opens `href`. */
function Tile({
  caption,
  href,
  label,
  value,
  variant = "default",
}: {
  caption: string;
  href?: string;
  label: string;
  value: number;
  variant?: CardVariant;
}) {
  const body = (
    <VStack gap={1}>
      <Text color="secondary" type="label" xstyle={styles.eyebrow}>
        {label}
      </Text>
      <Text hasTabularNumbers size="4xl" weight="bold">
        {value}
      </Text>
      <Text color="secondary" type="supporting">
        {caption}
      </Text>
    </VStack>
  );
  if (href) {
    return (
      <ClickableCard
        href={href}
        label={`${label}: ${value}, ${caption}`}
        padding={4}
        variant={variant}
      >
        {body}
      </ClickableCard>
    );
  }
  return (
    <Card padding={4} variant={variant}>
      {body}
    </Card>
  );
}

/** A card of the hub: its heading, its count, and its rows. */
function Panel({ children, count, title }: { children: ReactNode; count?: number; title: string }) {
  const wide = useWidthClass() === "wide";
  return (
    <Card padding={wide ? 4 : 3}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Heading level={2}>{title}</Heading>
          {count !== undefined && <Badge label={String(count)} variant="neutral" />}
        </HStack>
        {children}
      </VStack>
    </Card>
  );
}

/** What waits on the human, each by its verb and its line, then the files to fix. */
function NeedsYou({ human, invalid }: { human: Array<Feature>; invalid: Array<Feature> }) {
  const here = useRepoPath();
  return (
    <Panel count={human.length + invalid.length} title="Needs you">
      {human.length + invalid.length === 0 ? (
        <Text color="secondary">Nothing waits on you.</Text>
      ) : (
        <List aria-label="Needs you" hasDividers>
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
          {invalid.map((feature) => (
            <Row
              badge={<Badge label="Fix" variant="error" />}
              href={here(`/f/${feature.folder}`)}
              key={feature.folder}
              line={feature.problems[0].message}
              title={feature.title}
            />
          ))}
        </List>
      )}
    </Panel>
  );
}

/** The features agents work on, with their step, their task, and their plan's progress. */
function AgentsPanel({ agents, running }: { agents: Array<Feature>; running: Array<string> }) {
  const here = useRepoPath();
  return (
    <Panel count={agents.length} title="Agents at work">
      {agents.length === 0 ? (
        <Text color="secondary">No agent has work.</Text>
      ) : (
        <List aria-label="Agents at work" hasDividers>
          {agents.map((feature) => {
            const { line, step, working } = agentState(feature, running);
            const progress = feature.step.progress;
            return (
              <Row
                badge={
                  <Badge
                    label={working ? "Working" : step}
                    variant={working ? "success" : "info"}
                  />
                }
                href={here(`/f/${feature.folder}`)}
                key={feature.folder}
                line={
                  progress ? (
                    <VStack gap={1}>
                      {line && <span>{line}</span>}
                      <ProgressBar
                        formatValueLabel={(value: number, max: number) => `Task ${value} of ${max}`}
                        hasValueLabel
                        label={`${feature.title}: task ${progress.position} of ${progress.total}`}
                        max={progress.total}
                        value={progress.position}
                      />
                    </VStack>
                  ) : (
                    line || undefined
                  )
                }
                title={feature.title}
              />
            );
          })}
        </List>
      )}
    </Panel>
  );
}

/** The Now lines, each started or not, then the Next ones. */
function NowPanel({ workspace }: { workspace: NonNullable<ReturnType<typeof useWorkspace>> }) {
  const here = useRepoPath();
  const { next, now } = nowAndNext(workspace);
  return (
    <Panel title="Now">
      <List aria-label="Now and next" hasDividers>
        {[...now, ...next].map(({ entry, feature }) => (
          <Row
            badge={
              entry.section === "next" ? (
                <Badge label="Next" variant="neutral" />
              ) : feature ? (
                <Badge {...featureStatus(feature, workspace.running)} />
              ) : (
                <Badge label="Not started" variant="neutral" />
              )
            }
            href={here(feature ? `/f/${feature.folder}` : `/priorities/${entry.key}`)}
            key={entry.id}
            title={entry.text}
          />
        ))}
        <Row href={here("/priorities")} title="All priorities" />
      </List>
    </Panel>
  );
}

/** The inbox, kept small: its categories with their counts, and the latest notes. */
function InboxPanel() {
  const here = useRepoPath();
  const { categories, count, latest } = inboxSummary(useInbox());
  return (
    <Panel count={count} title="Inbox">
      <HStack gap={1} wrap="wrap">
        {categories.map((category) => (
          <Badge
            key={category.name}
            label={`${category.name} ${category.count}`}
            variant="neutral"
          />
        ))}
      </HStack>
      <List aria-label="Latest notes" hasDividers>
        {latest.map((note) => (
          <Row href={here(`/inbox/${note.key}`)} key={note.id} title={note.text} />
        ))}
        <Row href={here("/inbox")} title={count ? `Organize ${notes(count)}` : "Open the inbox"} />
      </List>
    </Panel>
  );
}

/** The five features merged last. */
function DonePanel({ done }: { done: Array<Feature> }) {
  const here = useRepoPath();
  if (!done.length) {
    return null;
  }
  return (
    <Panel title="Recently done">
      <List aria-label="Recently done" density="compact" hasDividers>
        {done.slice(0, 5).map((feature) => (
          <Row href={here(`/f/${feature.folder}`)} key={feature.folder} title={feature.title} />
        ))}
      </List>
    </Panel>
  );
}

/** Home as a control hub of cards, over the whole width. */
export function HomeHub() {
  const workspace = useWorkspace();
  const inbox = useInbox();
  const here = useRepoPath();
  const wide = useWidthClass() === "wide";
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const { agents, done, human, invalid } = homeFeatures(workspace.features);
  const { now } = nowAndNext(workspace);
  const started = now.filter(({ feature }) => feature).length;
  const needs = human.length + invalid.length;
  const main = (
    <>
      <NeedsYou human={human} invalid={invalid} />
      <AgentsPanel agents={agents} running={workspace.running} />
    </>
  );
  const side = (
    <>
      <NowPanel workspace={workspace} />
      <InboxPanel />
      <DonePanel done={done} />
    </>
  );
  return (
    <div {...stylex.props(styles.hub, wide && styles.wide)}>
      <VStack gap={wide ? 6 : 4}>
        <Grid columns={wide ? 4 : 2} gap={wide ? 4 : 3}>
          <Tile
            caption={needs === 1 ? "feature waits on you" : "features wait on you"}
            label="Needs you"
            value={needs}
            variant={needs ? "yellow" : "default"}
          />
          <Tile
            caption={`${workspace.running.length} running now`}
            label="Agents"
            value={agents.length}
            variant="blue"
          />
          <Tile
            caption={`${started} of ${now.length} started`}
            href={here("/priorities")}
            label="Now"
            value={now.length}
            variant="green"
          />
          <Tile
            caption="notes to organize"
            href={here("/inbox")}
            label="Inbox"
            value={inbox?.count ?? 0}
            variant="muted"
          />
        </Grid>
        {wide ? (
          <Grid gap={6} xstyle={styles.columns}>
            <VStack gap={6}>{main}</VStack>
            <VStack gap={6}>{side}</VStack>
          </Grid>
        ) : (
          <VStack gap={4}>
            {main}
            {side}
          </VStack>
        )}
      </VStack>
    </div>
  );
}
