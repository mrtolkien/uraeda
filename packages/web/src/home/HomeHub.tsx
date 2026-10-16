// Home as a control hub: four counts first, then what needs the human and what agents do in the main
// column, and the priorities, the inbox, what is done, and the way to the decisions in the column
// beside it. On the phone, or beside a pane, one column in the same order, the counts two by two.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import type { CardVariant } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, use, useState } from "react";
import { useInbox, usePriorities, useWorkspace } from "../data.ts";
import { waiting } from "../labels.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { ListPaneContext } from "../lists/listPane.ts";
import { useLocalPath, useRepoPath } from "../routes.tsx";
import { plain } from "../Spans.tsx";
import { agentState, type Feature, homeFeatures } from "./features.ts";
import { inboxSummary, prioritySection, runningStatus } from "./summary.ts";

const styles = stylex.create({
  // The main column takes two thirds: what needs the human reads first, and widest.
  columns: {
    gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
  },
  eyebrow: {
    textTransform: "uppercase",
  },
  // A heading's link, as tall as a control: tapped on the phone, it is one.
  headingLink: {
    alignItems: "center",
    display: "inline-flex",
    minBlockSize: "var(--size-element-md)",
  },
  // The heading's title, count, and chevron on one line, inside the heading: phrasing content only.
  heading: {
    alignItems: "center",
    columnGap: spacingVars["--spacing-2"],
    display: "inline-flex",
    flexWrap: "wrap",
  },
});

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
  // A group named by the count, so its number and its line read with their name.
  const body = (
    <div aria-label={label} role="group">
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
    </div>
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

/**
 * A card of the hub: its heading, its count, and its rows. With `href`, its heading opens the page
 * the card sums up, tapped as a whole, `label` its accessible name. `id` is its anchor, like the
 * `#done` the sidebar's Done area opens.
 */
function Panel({
  children,
  count,
  href,
  id,
  label,
  title,
}: {
  children: ReactNode;
  count?: number;
  href?: string;
  id?: string;
  label?: string;
  title: string;
}) {
  const wide = useWidthClass() === "wide";
  const parts = (
    <span {...stylex.props(styles.heading)}>
      {title}
      {count !== undefined && <Badge label={String(count)} variant="neutral" />}
      {href && (
        <Text aria-hidden="true" color="secondary">
          ›
        </Text>
      )}
    </span>
  );
  return (
    <section id={id}>
      <Card padding={wide ? 4 : 3}>
        <VStack gap={2}>
          <Heading level={2}>
            {href ? (
              <Link
                color="primary"
                href={href}
                label={label}
                type="inherit"
                xstyle={styles.headingLink}
              >
                {parts}
              </Link>
            ) : (
              parts
            )}
          </Heading>
          {children}
        </VStack>
      </Card>
    </section>
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

/** Where the hub keeps the section its Priorities card shows. */
const SECTION_KEY = "uraeda:home:priorities";

/** The section the Priorities card shows, Now until another is chosen, kept in the browser. */
function useSection(): ["now" | "next", (value: string) => void] {
  const [section, setSection] = useState<"now" | "next">(() => {
    try {
      return window.localStorage.getItem(SECTION_KEY) === "next" ? "next" : "now";
    } catch {
      // No storage, as in a private window: the card opens on Now.
      return "now";
    }
  });
  const choose = (value: string) => {
    const next = value === "next" ? "next" : "now";
    setSection(next);
    try {
      window.localStorage.setItem(SECTION_KEY, next);
    } catch {
      // No storage: the choice lasts until the page closes.
    }
  };
  return [section, choose];
}

/**
 * The entries of Now or Next: in Now, the running ones first with their status; a draft's marked
 * so. A running entry opens its feature, another its pane; the heading opens the priorities.
 */
function PrioritiesPanel({ running }: { running: Array<string> }) {
  const here = useRepoPath();
  // The pane open beside home, on wide screens.
  const pathname = useLocalPath();
  const priorities = usePriorities();
  const [section, choose] = useSection();
  const entries = priorities ? prioritySection(priorities, section) : [];
  return (
    <Panel
      href={here("/priorities")}
      label="Priorities, open the priorities page"
      title="Priorities"
    >
      <SegmentedControl label="Section of the priorities" onChange={choose} value={section}>
        <SegmentedControlItem label="Now" value="now" />
        <SegmentedControlItem label="Next" value="next" />
      </SegmentedControl>
      {entries.length === 0 ? (
        <Text color="secondary">{section === "now" ? "Nothing in Now." : "Nothing in Next."}</Text>
      ) : (
        <List aria-label={section === "now" ? "Now" : "Next"} hasDividers>
          {entries.map((entry) => (
            <Row
              badge={
                entry.running ? (
                  <Badge {...runningStatus(entry.running, running)} />
                ) : entry.draft ? (
                  <Badge
                    label={entry.draft.backlog ? "Backlog" : "Draft"}
                    variant={entry.draft.backlog ? "neutral" : "teal"}
                  />
                ) : undefined
              }
              href={here(entry.running ? `/f/${entry.running.folder}` : `/priorities/${entry.key}`)}
              isSelected={pathname === `/priorities/${entry.key}`}
              key={entry.key}
              title={plain(entry.spans)}
            />
          ))}
        </List>
      )}
    </Panel>
  );
}

/** The inbox, kept small: its categories with their counts, and the latest notes. */
function InboxPanel() {
  const here = useRepoPath();
  const { categories, count, latest } = inboxSummary(useInbox());
  return (
    <Panel count={count} href={here("/inbox")} title="Inbox">
      {count === 0 ? (
        <Text color="secondary">The inbox is empty.</Text>
      ) : (
        <>
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
          </List>
        </>
      )}
    </Panel>
  );
}

/** How many done features the hub shows before "Show all". */
const DONE_SHOWN = 5;

/** The five features merged last, and all of them once asked. */
function DonePanel({ done }: { done: Array<Feature> }) {
  const here = useRepoPath();
  const [all, setAll] = useState(false);
  if (!done.length) {
    return null;
  }
  return (
    <Panel id="done" title="Recently done">
      <List aria-label="Recently done" density="compact" hasDividers>
        {(all ? done : done.slice(0, DONE_SHOWN)).map((feature) => (
          <Row href={here(`/f/${feature.folder}`)} key={feature.folder} title={feature.title} />
        ))}
      </List>
      {!all && done.length > DONE_SHOWN && (
        <Button label={`Show all (${done.length})`} onClick={() => setAll(true)} variant="ghost" />
      )}
    </Panel>
  );
}

/** The way to the constitution and the decisions agents follow. */
function DecisionsCard() {
  const here = useRepoPath();
  const wide = useWidthClass() === "wide";
  // The card's padding as the others', so its text lines up with their rows.
  return (
    <Card padding={wide ? 4 : 3}>
      <List aria-label="Constitution and decisions">
        <Row
          href={here("/decisions")}
          line="The project's principles and the choices agents follow"
          title="Constitution and decisions"
        />
      </List>
    </Card>
  );
}

/**
 * Home as a control hub of cards: two columns on a wide screen, one on the phone or beside a pane,
 * where the list's column is too narrow for two.
 */
export function HomeHub() {
  const workspace = useWorkspace();
  const inbox = useInbox();
  const priorities = usePriorities();
  const here = useRepoPath();
  const beside = use(ListPaneContext) !== null;
  const wide = useWidthClass() === "wide";
  const columns = wide && !beside;
  if (!workspace || workspace.noSpecs) {
    return null;
  }
  const { agents, done, human, invalid } = homeFeatures(workspace.features);
  const now = priorities?.sections.find((section) => section.section === "now")?.entries ?? [];
  const started = now.filter((entry) => entry.running).length;
  const needs = human.length + invalid.length;
  const notes = inbox?.count ?? 0;
  const main = (
    <>
      <NeedsYou human={human} invalid={invalid} />
      <AgentsPanel agents={agents} running={workspace.running} />
    </>
  );
  const side = (
    <>
      <PrioritiesPanel running={workspace.running} />
      <InboxPanel />
      <DonePanel done={done} />
      <DecisionsCard />
    </>
  );
  return (
    <VStack gap={wide ? 6 : 4}>
      <Grid columns={columns ? 4 : 2} gap={wide ? 4 : 3}>
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
          caption={notes === 1 ? "note to organize" : "notes to organize"}
          href={here("/inbox")}
          label="Inbox"
          value={notes}
          variant="muted"
        />
      </Grid>
      {columns ? (
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
  );
}
