// A job's card in the Jobs place: its mark, its name, "Report only" and its switch on the head
// line, its schedule under its name, then, under a rule, its next run and its last one, each under
// its label with its icon in its role's colour. Side by side on wide screens, one over the other on
// the phone, each at the card's whole width. The selected card shows its bar, and a refusal of what
// was pressed on it shows under it until dismissed, never in a toast.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { JobRow } from "uraeda-server/fate";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Room } from "../layout/Room.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { type BarAction, RowBar } from "../lists/RowBar.tsx";
import type { Fact } from "./facts.ts";
import { scheduleWords } from "./words.ts";

const styles = stylex.create({
  // A job's card: a square frame, apart from the page.
  card: {
    backgroundColor: colorVars["--color-background-body"],
    borderColor: colorVars["--color-border-emphasized"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
  },
  // The selected card: the accent's frame and its bar at the start, as a picked row's.
  cardPicked: {
    borderColor: colorVars["--color-accent"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
  },
  // A fact of the card, its label over its value; two of them share the card's width.
  fact: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  // The facts, under a rule that sets them apart from the job's name and schedule.
  facts: {
    borderBlockStartColor: colorVars["--color-border-emphasized"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The card's head, its name and schedule, on the raised surface, apart from its facts.
  head: {
    backgroundColor: colorVars["--color-background-surface"],
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // The job's mark, in the accent, level with its name.
  jobIcon: {
    color: colorVars["--color-accent"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  label: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    textTransform: "uppercase",
  },
  // The name's link reads as the heading it sits in: the same size, weight, and colour; the underline shows on hover.
  link: { fontWeight: "inherit" },
  name: {
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
  },
  // A paused job's name and schedule, greyed: it runs at no time.
  paused: { color: colorVars["--color-text-secondary"] },
  text: { flexGrow: 1, minWidth: 0 },
});

/** The colour of a fact's icon, by what it says. */
const tones = stylex.create({
  needsYou: { color: "var(--role-needs-you)" },
  problem: { color: colorVars["--color-error"] },
  quiet: { color: colorVars["--color-text-secondary"] },
  unread: { color: colorVars["--color-accent"] },
  working: { color: "var(--role-working)" },
});

/** A fact of the card: its label, small and in capitals, over its icon and its words. */
function FactOf({ fact, label }: { fact: Fact; label: string }) {
  return (
    <VStack gap={1} xstyle={styles.fact}>
      <Text xstyle={styles.label}>{label}</Text>
      <HStack align="start" gap={2}>
        <Text xstyle={tones[fact.tone]}>
          <Icon icon={fact.icon} size="sm" />
        </Text>
        <Text xstyle={[styles.text, fact.tone === "problem" && tones.problem]}>{fact.text}</Text>
      </HStack>
      {fact.note !== undefined && (
        <HStack align="start" gap={2}>
          <Text xstyle={tones.problem}>
            <Icon icon="uraeda:triangle-alert" size="sm" />
          </Text>
          <Text xstyle={[styles.text, tones.problem]}>{fact.note}</Text>
        </HStack>
      )}
    </VStack>
  );
}

/**
 * A refusal under a card or a field, in a room that opens as it comes and keeps its words while it
 * closes, so what is under it glides. With `onDismiss`, it can be dismissed.
 */
export function Refusal({
  onDismiss,
  refusal,
}: {
  onDismiss?: () => void;
  refusal: string | undefined;
}) {
  const [shown, setShown] = useState(refusal);
  if (refusal !== undefined && refusal !== shown) {
    setShown(refusal);
  }
  return (
    <Room gap={1} isOpen={refusal !== undefined} takesGapBack>
      {shown !== undefined && (
        // Its words stay while the room closes: hidden from a screen reader at once.
        <div aria-hidden={refusal === undefined}>
          <AnnouncedBanner
            collapsible={false}
            status="error"
            title={shown}
            {...(onDismiss === undefined
              ? {}
              : { dismissLabel: "Dismiss", isDismissable: true, onDismiss })}
          />
        </div>
      )}
    </Room>
  );
}

/**
 * A job's card. `href` is its page, which its name opens; `actions` are the bar's, shown under the
 * card while `isBarred`; `onPick` selects it, with its bar, as a press on it does; `onSwitch` pauses
 * or resumes it, and `refusal` is what the last press on it was refused with.
 */
export function JobCard({
  actions,
  href,
  isBarred,
  isSelected,
  job,
  last,
  next,
  onAway,
  onDismiss,
  onPick,
  onSwitch,
  refusal,
}: {
  actions: ReadonlyArray<BarAction>;
  href: string;
  isBarred: boolean;
  isSelected: boolean;
  job: Pick<JobRow, "name" | "on" | "reportOnly" | "schedule" | "scheduleText">;
  last: Fact;
  next: Fact;
  onAway: () => void;
  onDismiss: () => void;
  onPick: () => void;
  onSwitch: (on: boolean) => void;
  refusal: string | undefined;
}) {
  const narrow = isNarrow(useWidthClass());
  const { on } = job;
  const facts = (
    <>
      <FactOf fact={next} label="Next run" />
      <FactOf fact={last} label="Last run" />
    </>
  );
  return (
    <VStack
      aria-current={isSelected ? "true" : undefined}
      as="li"
      data-row=""
      data-row-key={job.name}
      gap={1}
      onClick={onPick}
    >
      <VStack xstyle={[styles.card, isSelected && styles.cardPicked]}>
        <HStack align="start" gap={3} xstyle={styles.head}>
          <Text xstyle={[styles.jobIcon, !on && styles.paused]}>
            <Icon icon="uraeda:history" size="md" />
          </Text>
          <VStack gap={1} xstyle={styles.text}>
            <HStack align="center" gap={2} wrap="wrap">
              <Heading level={3} xstyle={[styles.name, !on && styles.paused]}>
                <Link color="inherit" href={href} type="inherit" xstyle={styles.link}>
                  {job.name}
                </Link>
              </Heading>
              {job.reportOnly && <Badge label="Report only" variant="neutral" />}
            </HStack>
            <Text xstyle={!on && styles.paused}>
              {job.schedule === null ? job.scheduleText : scheduleWords(job.schedule)}
            </Text>
          </VStack>
          <Switch
            isLabelHidden
            label={`${job.name} runs on its schedule`}
            onChange={onSwitch}
            value={on}
          />
        </HStack>
        {narrow ? (
          <VStack gap={3} xstyle={styles.facts}>
            {facts}
          </VStack>
        ) : (
          <HStack align="start" gap={4} xstyle={styles.facts}>
            {facts}
          </HStack>
        )}
      </VStack>
      {isBarred && <RowBar actions={actions} isCursor onAway={onAway} />}
      <Refusal onDismiss={onDismiss} refusal={refusal} />
    </VStack>
  );
}
