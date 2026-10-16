// The "Cockpit" variant of home, for the discovery round of the home's redesign: an instrument
// panel, dense and in the theme's tokens. A dark strip of status lights with their counts, then three
// panels side by side on wide screens, what needs the human, the agents with their progress through
// the workflow, and the queue of priorities and the inbox, over a ticker of what is done. On the
// phone, one column in the same order.
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { List } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { StatusDot, type StatusDotVariant } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useInbox, useWorkspace } from "../data.ts";
import {
  agentState,
  type Feature,
  featureStatus,
  homeFeatures,
  nowAndNext,
  Row,
} from "../Home.tsx";
import { notes } from "../InboxPage.tsx";
import { stepLabel, waiting } from "../labels.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { useRepoPath } from "../routes.tsx";
import { STAGES, stageOf } from "./HomeFlow.tsx";

const styles = stylex.create({
  // Each panel's top edge in its light's colour, as an instrument's bezel.
  agents: { borderTopColor: colorVars["--color-icon-blue"] },
  bezel: {
    borderTopStyle: "solid",
    borderTopWidth: spacingVars["--spacing-1"],
  },
  caps: {
    textTransform: "uppercase",
  },
  cockpit: {
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
    width: "100%",
  },
  dim: {
    opacity: 0.7,
  },
  needs: { borderTopColor: colorVars["--color-icon-yellow"] },
  queue: { borderTopColor: colorVars["--color-icon-green"] },
  // The strips of lights and of what is done: the theme's inverted surface, the panel's dark glass.
  strip: {
    backgroundColor: colorVars["--color-background-inverted"],
    borderRadius: radiusVars["--radius-container"],
    color: colorVars["--color-on-dark"],
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-4"],
  },
  wide: {
    paddingBlock: spacingVars["--spacing-5"],
    paddingInline: spacingVars["--spacing-6"],
  },
});

/** A light of the strip: its dot, its name, and its count, in the code font. */
function Light({
  count,
  isPulsing,
  label,
  variant,
}: {
  count: number;
  isPulsing?: boolean;
  label: string;
  variant: StatusDotVariant;
}) {
  return (
    <VStack gap={0.5}>
      <Text color="inherit" size="sm" type="code" xstyle={[styles.caps, styles.dim]}>
        {label}
      </Text>
      <HStack gap={2} vAlign="center">
        <StatusDot isPulsing={isPulsing} label={`${label}: ${count}`} variant={variant} />
        <Text color="inherit" hasTabularNumbers size="2xl" type="code" weight="bold">
          {String(count).padStart(2, "0")}
        </Text>
      </HStack>
    </VStack>
  );
}

/** A panel of the cockpit: its number and name in capitals, its count, and its rows. */
function Panel({
  bezel,
  children,
  count,
  place,
  title,
}: {
  bezel: stylex.StyleXStyles;
  children: ReactNode;
  count: number;
  place: string;
  title: string;
}) {
  return (
    <Card padding={3} xstyle={[styles.bezel, bezel]}>
      <VStack gap={2}>
        <HStack gap={2} justify="space-between" vAlign="center">
          <Text type="code" weight="bold" xstyle={styles.caps}>
            {`${place} ${title}`}
          </Text>
          <Text color="secondary" hasTabularNumbers type="code">
            {String(count).padStart(2, "0")}
          </Text>
        </HStack>
        {children}
      </VStack>
    </Card>
  );
}

/** The features at a human gate, by their verb, then the files to fix. */
function NeedsPanel({ human, invalid }: { human: Array<Feature>; invalid: Array<Feature> }) {
  const here = useRepoPath();
  return (
    <Panel bezel={styles.needs} count={human.length + invalid.length} place="01" title="Needs you">
      {human.length + invalid.length === 0 ? (
        <Text color="secondary" type="code">
          ALL CLEAR
        </Text>
      ) : (
        <List aria-label="Needs you" density="compact" hasDividers>
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

/** An agent's gauges: its stage among the workflow's five, and its plan's tasks when it has them. */
function Gauges({ feature }: { feature: Feature }) {
  const stage = stageOf(feature);
  const progress = feature.step.progress;
  const step = stepLabel(feature.step.name);
  // The step, after its stage, when it says more than the stage does.
  const reading = [`${stage + 1}/${STAGES.length}`, STAGES[stage]];
  if (step !== STAGES[stage]) {
    reading.push(`· ${step}`);
  }
  return (
    <VStack gap={1}>
      <Text color="secondary" size="sm" type="code" xstyle={styles.caps}>
        {reading.join(" ")}
      </Text>
      <ProgressBar
        isLabelHidden
        label={`${feature.title}: stage ${stage + 1} of ${STAGES.length}, ${STAGES[stage]}`}
        max={STAGES.length}
        value={stage + 1}
        variant="accent"
      />
      {progress && (
        <ProgressBar
          formatValueLabel={(value: number, max: number) => `TASK ${value}/${max}`}
          hasValueLabel
          label={`${feature.title}: task ${progress.position} of ${progress.total}`}
          max={progress.total}
          value={progress.position}
          variant="success"
        />
      )}
      {feature.step.task && (
        <Text color="secondary" type="supporting">
          {feature.step.task}
        </Text>
      )}
    </VStack>
  );
}

/** The features agents work on, each with its light and its gauges. */
function AgentsPanel({ agents, running }: { agents: Array<Feature>; running: Array<string> }) {
  const here = useRepoPath();
  return (
    <Panel bezel={styles.agents} count={agents.length} place="02" title="Agents">
      {agents.length === 0 ? (
        <Text color="secondary" type="code">
          IDLE
        </Text>
      ) : (
        <List aria-label="Agents" density="compact" hasDividers>
          {agents.map((feature) => {
            const { working } = agentState(feature, running);
            return (
              <Row
                badge={
                  <StatusDot
                    isPulsing={working}
                    label={working ? "Working" : "Waiting for its agent"}
                    variant={working ? "accent" : "neutral"}
                  />
                }
                href={here(`/f/${feature.folder}`)}
                key={feature.folder}
                line={<Gauges feature={feature} />}
                title={feature.title}
              />
            );
          })}
        </List>
      )}
    </Panel>
  );
}

/** The Now and Next lines by their place, each lit when started, then the inbox's count. */
function QueuePanel({ workspace }: { workspace: NonNullable<ReturnType<typeof useWorkspace>> }) {
  const here = useRepoPath();
  const inbox = useInbox();
  const count = inbox?.count ?? 0;
  const { next, now } = nowAndNext(workspace);
  const rows = [
    ...now.map((item, index) => ({ ...item, place: `N${index + 1}` })),
    ...next.map((item, index) => ({ ...item, place: `X${index + 1}` })),
  ];
  return (
    <Panel bezel={styles.queue} count={rows.length} place="03" title="Queue">
      <List aria-label="Queue" density="compact" hasDividers>
        {rows.map(({ entry, feature, place }) => (
          <Row
            badge={
              <HStack gap={2} vAlign="center">
                <StatusDot
                  label={feature ? "Started" : "Not started"}
                  variant={feature ? "success" : "neutral"}
                />
                <Text color="secondary" type="code">
                  {place}
                </Text>
              </HStack>
            }
            href={here(feature ? `/f/${feature.folder}` : `/priorities/${entry.key}`)}
            key={entry.id}
            line={
              feature
                ? featureStatus(feature, workspace.running).label
                : entry.draft
                  ? "Drafted"
                  : "Not started"
            }
            title={entry.text}
          />
        ))}
        <Row href={here("/priorities")} title="All priorities" />
        <Row
          badge={<Badge label={String(count)} variant="neutral" />}
          href={here("/inbox")}
          title={`Inbox · ${notes(count)}`}
        />
      </List>
    </Panel>
  );
}

/** The merged features, latest first, as a line of links. */
function DoneTicker({ done }: { done: Array<Feature> }) {
  const here = useRepoPath();
  if (!done.length) {
    return null;
  }
  return (
    <div {...stylex.props(styles.strip)}>
      <HStack gap={4} vAlign="center" wrap="wrap">
        <HStack gap={2} vAlign="center">
          <StatusDot label="Done" variant="success" />
          <Text color="inherit" type="code" weight="bold" xstyle={styles.caps}>
            Done ▸
          </Text>
        </HStack>
        {done.slice(0, 8).map((feature) => (
          <Link
            color="inherit"
            href={here(`/f/${feature.folder}`)}
            key={feature.folder}
            type="code"
          >
            {feature.title}
          </Link>
        ))}
      </HStack>
    </div>
  );
}

/** Home as a cockpit: lights, three panels, and the ticker of what is done. */
export function HomeCockpit() {
  const workspace = useWorkspace();
  const inbox = useInbox();
  const wide = useWidthClass() === "wide";
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const { agents, done, human, invalid } = homeFeatures(workspace.features);
  const { next, now } = nowAndNext(workspace);
  const queued = [...now, ...next].filter(({ feature }) => !feature).length;
  const running = workspace.running.length;
  return (
    <div {...stylex.props(styles.cockpit, wide && styles.wide)}>
      <VStack gap={wide ? 4 : 3}>
        <div {...stylex.props(styles.strip)}>
          <Grid columns={wide ? 6 : 3} gap={wide ? 4 : 3}>
            <Light
              count={human.length}
              isPulsing={human.length > 0}
              label="Needs you"
              variant="warning"
            />
            <Light count={running} isPulsing={running > 0} label="Running" variant="accent" />
            <Light count={agents.length} label="In flight" variant="accent" />
            <Light count={queued} label="Queued" variant="neutral" />
            <Light count={inbox?.count ?? 0} label="Inbox" variant="neutral" />
            <Light
              count={invalid.length}
              label="Faults"
              variant={invalid.length ? "error" : "success"}
            />
          </Grid>
        </div>
        <Grid columns={wide ? 3 : 1} gap={wide ? 4 : 3}>
          <NeedsPanel human={human} invalid={invalid} />
          <AgentsPanel agents={agents} running={workspace.running} />
          <QueuePanel workspace={workspace} />
        </Grid>
        <DoneTicker done={done} />
      </VStack>
    </div>
  );
}
