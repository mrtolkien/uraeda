// The "Flow" variant of home, for the discovery round of the home's redesign: the page follows
// Uraeda's flow, Inbox, then Priorities, then the features and changes in flight by step, as lanes
// from left to right on wide screens. What needs the human ends the row, on the right: the flow
// reads as work moving towards them, and their turn is where it lands, in the one coloured lane. On
// the phone, the lanes stack and that lane comes first, since a phone is opened to act.
import { Badge } from "@astryxdesign/core/Badge";
import { Card } from "@astryxdesign/core/Card";
import type { CardVariant } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { useInbox, useWorkspace } from "../data.ts";
import {
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
  eyebrow: {
    textTransform: "uppercase",
  },
  flow: {
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
    width: "100%",
  },
  // The inbox is a glance; the work in flight, with its five steps, gets the most room.
  lanes: {
    alignItems: "start",
    gridTemplateColumns: "minmax(0, 0.8fr) minmax(0, 1.1fr) minmax(0, 1.5fr) minmax(0, 1.1fr)",
  },
  // A quiet card: a dashed outline, no fill, no shadow.
  quiet: {
    borderColor: colorVars["--color-border-emphasized"],
    borderStyle: "dashed",
    borderWidth: borderVars["--border-width"],
  },
  wide: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
});

/** The steps a feature or a change goes through, as the lane of work in flight groups them. */
export const STAGES = ["Questions", "Spec", "Plan", "Implementation", "Pull request"] as const;

/** The steps of each stage, by their names, and the kinds of the files their gates wait on. */
const STAGE_STEPS: Array<Array<string>> = [
  ["discovery", "clarifications", "proposal"],
  ["spec", "spec-revision", "approval"],
  ["plan", "plan-revision"],
  ["implementation", "final-review", "change", "review"],
  ["pull-request", "pull-request-changes", "finish"],
];

/** The stage a feature or a change is at, from 0: at a gate, by the kind of the file it waits on. */
export function stageOf(feature: Feature): number {
  const name =
    feature.step.name === "human-gate"
      ? (feature.files.find((file) => file.name === feature.step.file)?.kind ?? "")
      : feature.step.name;
  const stage = STAGE_STEPS.findIndex((steps) => steps.includes(name));
  return stage === -1 ? (feature.step.implemented ? 4 : 0) : stage;
}

/** A lane of the flow: its place in it, its name, its count, and its cards. */
function Lane({
  children,
  count,
  place,
  title,
  variant = "muted",
}: {
  children: ReactNode;
  count: number;
  place: string;
  title: string;
  variant?: CardVariant;
}) {
  return (
    <Card padding={3} variant={variant}>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <Text color="secondary" type="label" xstyle={styles.eyebrow}>
            {place}
          </Text>
          <HStack gap={2} vAlign="center">
            <Heading level={2}>{title}</Heading>
            <Badge label={String(count)} variant="neutral" />
          </HStack>
        </VStack>
        {children}
      </VStack>
    </Card>
  );
}

/**
 * A card of a lane, tapped as a whole: its badges, its title, and its line. A transparent card is a
 * quiet one, without a shadow: what is shown elsewhere too, or not ready.
 */
function Item({
  badges,
  href,
  line,
  title,
  variant = "default",
}: {
  badges?: ReactNode;
  href: string;
  line?: string;
  title: string;
  variant?: CardVariant;
}) {
  return (
    <ClickableCard
      elevation={variant === "transparent" ? "none" : "low"}
      href={href}
      label={title}
      padding={3}
      variant={variant}
      xstyle={variant === "transparent" && styles.quiet}
    >
      <VStack gap={1}>
        {badges && (
          <HStack gap={1} wrap="wrap">
            {badges}
          </HStack>
        )}
        <Text weight="medium">{title}</Text>
        {line && (
          <Text color="secondary" type="supporting">
            {line}
          </Text>
        )}
      </VStack>
    </ClickableCard>
  );
}

/** A small heading inside a lane, with its count. */
function SubHeading({ count, title }: { count?: number; title: string }) {
  return (
    <HStack gap={1} vAlign="center">
      <Text color="secondary" type="label" weight="semibold" xstyle={styles.eyebrow}>
        {title}
      </Text>
      {count !== undefined && (
        <Text color="secondary" hasTabularNumbers type="label">
          {count}
        </Text>
      )}
    </HStack>
  );
}

/** The inbox, neutral: its categories with their counts, each opening it. */
function InboxLane({ place }: { place: string }) {
  const here = useRepoPath();
  const { categories, count, latest } = inboxSummary(useInbox());
  return (
    <Lane count={count} place={place} title="Inbox">
      <Card padding={1}>
        <List aria-label="Inbox categories" density="compact" hasDividers>
          {categories.map((category) => (
            <Row
              badge={<Badge label={String(category.count)} variant="neutral" />}
              href={here("/inbox")}
              key={category.name}
              title={category.name}
            />
          ))}
          <Row
            href={here("/inbox")}
            title={count ? `Organize ${notes(count)}` : "Open the inbox"}
          />
        </List>
      </Card>
      {latest.length > 0 && (
        <VStack gap={2}>
          <SubHeading title="Latest" />
          <Card padding={1}>
            <List aria-label="Latest notes" density="compact" hasDividers>
              {latest.map((note) => (
                <Row href={here(`/inbox/${note.key}`)} key={note.id} title={note.text} />
              ))}
            </List>
          </Card>
        </VStack>
      )}
    </Lane>
  );
}

/** The Now and Next lines not started, drafted ones raised, then the count of those started. */
function PrioritiesLane({
  place,
  workspace,
}: {
  place: string;
  workspace: NonNullable<ReturnType<typeof useWorkspace>>;
}) {
  const here = useRepoPath();
  const { next, now } = nowAndNext(workspace);
  const sections = [
    { entries: now, title: "Now" },
    { entries: next, title: "Next" },
  ];
  return (
    <Lane count={now.length + next.length} place={place} title="Priorities">
      {sections.map(({ entries, title }) => {
        // A started line has moved on to the work in flight: it is counted here, not drawn twice.
        const waitingToStart = entries.filter(({ feature }) => !feature);
        const started = entries.length - waitingToStart.length;
        return (
          <VStack gap={2} key={title}>
            <SubHeading count={entries.length} title={title} />
            {waitingToStart.map(({ entry }) => (
              <Item
                badges={
                  entry.draft ? (
                    <Badge label="Drafted" variant="purple" />
                  ) : (
                    <Badge label="Not drafted" variant="neutral" />
                  )
                }
                href={here(`/priorities/${entry.key}`)}
                key={entry.id}
                title={entry.text}
                variant={entry.draft ? "default" : "transparent"}
              />
            ))}
            {started > 0 && (
              <Text color="secondary" type="supporting">
                {waitingToStart.length
                  ? `${started} more started, in flight →`
                  : `All ${started} started, in flight →`}
              </Text>
            )}
          </VStack>
        );
      })}
      <Card padding={1}>
        <List aria-label="All priorities" density="compact">
          <Row href={here("/priorities")} title="All priorities" />
        </List>
      </Card>
    </Lane>
  );
}

/** The features and changes started and not merged, by stage, each with its status. */
function InFlightLane({
  features,
  place,
  running,
}: {
  features: Array<Feature>;
  place: string;
  running: Array<string>;
}) {
  const here = useRepoPath();
  return (
    <Lane count={features.length} place={place} title="In flight">
      {STAGES.map((stage, index) => {
        const at = features.filter((feature) => stageOf(feature) === index);
        if (!at.length) {
          return null;
        }
        return (
          <VStack gap={2} key={stage}>
            <SubHeading count={at.length} title={stage} />
            {at.map((feature) => (
              <Item
                badges={
                  <>
                    <Badge {...featureStatus(feature, running)} />
                    {feature.kind === "change" && <Badge label="Change" variant="teal" />}
                  </>
                }
                href={here(`/f/${feature.folder}`)}
                key={feature.folder}
                line={feature.step.task}
                title={feature.title}
                // Waiting on the human, it is a card of Needs you: quiet here.
                variant={feature.step.waitsOn === "human" ? "transparent" : "default"}
              />
            ))}
          </VStack>
        );
      })}
    </Lane>
  );
}

/** What waits on the human, then the files to fix: the one coloured lane. */
function NeedsYouLane({
  human,
  invalid,
  place,
}: {
  human: Array<Feature>;
  invalid: Array<Feature>;
  place: string;
}) {
  const here = useRepoPath();
  return (
    <Lane count={human.length + invalid.length} place={place} title="Needs you" variant="yellow">
      {human.length + invalid.length === 0 && <Text>Nothing waits on you.</Text>}
      {human.map((feature) => {
        const { href, line, verb } = waiting(feature);
        return (
          <Item
            badges={<Badge label={verb} variant="warning" />}
            href={here(href)}
            key={feature.folder}
            line={line}
            title={feature.title}
          />
        );
      })}
      {invalid.map((feature) => (
        <Item
          badges={<Badge label="Fix" variant="error" />}
          href={here(`/f/${feature.folder}`)}
          key={feature.folder}
          line={feature.problems[0].message}
          title={feature.title}
        />
      ))}
    </Lane>
  );
}

/** Home as Uraeda's flow: Inbox, Priorities, In flight, then Needs you. */
export function HomeFlow() {
  const workspace = useWorkspace();
  const wide = useWidthClass() === "wide";
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const { agents, human, invalid } = homeFeatures(workspace.features);
  const inFlight = [...human, ...agents];
  // Wide, the arrows say the order; narrow, the lanes stack and Needs you comes first.
  const step = (n: number, of: string) => (wide ? `${n} · ${of} →` : of);
  const needs = (
    <NeedsYouLane human={human} invalid={invalid} place={wide ? "4 · Your turn" : "Your turn"} />
  );
  const lanes = (
    <>
      <InboxLane place={step(1, "Collect")} />
      <PrioritiesLane place={step(2, "Choose")} workspace={workspace} />
      <InFlightLane features={inFlight} place={step(3, "Build")} running={workspace.running} />
    </>
  );
  return (
    <div {...stylex.props(styles.flow, wide && styles.wide)}>
      {wide ? (
        <Grid gap={4} xstyle={styles.lanes}>
          {lanes}
          {needs}
        </Grid>
      ) : (
        <VStack gap={4}>
          {needs}
          {lanes}
        </VStack>
      )}
    </div>
  );
}
