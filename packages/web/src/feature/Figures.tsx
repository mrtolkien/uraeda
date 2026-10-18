// What a feature produced, as figures that lead to their detail: while it runs, its lines changed
// and its tokens; once done, its total time, lines changed, tokens, questions, and decisions.
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent } from "react";
import { scrollBelowBar } from "../Folds.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { clock, day, duration } from "./times.ts";

const styles = stylex.create({
  added: { color: colorVars["--color-success"] },
  eyebrow: { textTransform: "uppercase" },
  removed: { color: colorVars["--color-error"] },
});

/** A figure's value: plain, lines added and removed, or one line per part. */
type Value = string | { added: number; removed: number } | { lines: Array<string> };

type Figure = { caption?: string; href?: string; label: string; value: Value };

/** The tokens the server summed over the feature's session, null when none were counted. */
export type Tokens = { input: number; output: number; partial: boolean; since: string } | null;

/** What the figures read of the history. */
export type FiguresHistory = {
  decisions: ReadonlyArray<unknown>;
  found: boolean;
  lines?: { added: number; files: number; removed: number } | null;
  questions?: number | null;
  rounds?: number | null;
  stages: ReadonlyArray<{ name: string; started?: string | null }>;
  totalSeconds?: number | null;
};

const COUNT = new Intl.NumberFormat("en-US");
const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact" });

/** A token count: "5.2 M", "113 k", "2.7 k", and under 1,000 as is. */
export function tokenCount(count: number): string {
  if (count < 1000) {
    return String(count);
  }
  const parts = COMPACT.formatToParts(count);
  const number = parts
    .filter((part) => part.type !== "compact" && part.type !== "literal")
    .map((part) => part.value)
    .join("");
  const unit = parts.find((part) => part.type === "compact")?.value ?? "";
  return `${number} ${unit === "K" ? "k" : unit}`;
}

/** "1 round", "2 rounds". */
function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** A value as one line of text, for a figure's accessible name. */
function valueText(value: Value): string {
  if (typeof value === "string") {
    return value;
  }
  if ("added" in value) {
    return `+${COUNT.format(value.added)} −${COUNT.format(value.removed)}`;
  }
  return value.lines.join(", ");
}

/** A figure's value: plain, lines added in green and removed in red, or one line per part. */
function FigureValue({ value }: { value: Value }) {
  if (typeof value === "string") {
    return (
      <Text hasTabularNumbers size="xl" weight="bold">
        {value}
      </Text>
    );
  }
  if ("added" in value) {
    return (
      <HStack gap={2} wrap="wrap">
        <Text hasTabularNumbers size="lg" weight="bold" wrap="nowrap" xstyle={styles.added}>
          +{COUNT.format(value.added)}
        </Text>
        <Text hasTabularNumbers size="lg" weight="bold" wrap="nowrap" xstyle={styles.removed}>
          −{COUNT.format(value.removed)}
        </Text>
      </HStack>
    );
  }
  return (
    <VStack gap={0}>
      {value.lines.map((line) => (
        <Text hasTabularNumbers key={line} size="xl" weight="bold">
          {line}
        </Text>
      ))}
    </VStack>
  );
}

/**
 * One figure: its name, its value, and what it counts, a group named by its name; with `href`,
 * tapped, it opens its detail.
 */
function FigureCard({ figure }: { figure: Figure }) {
  const body = (
    <div aria-label={figure.label} role="group">
      <VStack gap={1}>
        <Text color="secondary" type="label" xstyle={styles.eyebrow}>
          {figure.label}
        </Text>
        <FigureValue value={figure.value} />
        {figure.caption && (
          <Text color="secondary" type="supporting">
            {figure.caption}
          </Text>
        )}
      </VStack>
    </div>
  );
  if (!figure.href) {
    return <Card padding={4}>{body}</Card>;
  }
  const caption = figure.caption ? `, ${figure.caption}` : "";
  return (
    <ClickableCard
      href={figure.href}
      label={`${figure.label}: ${valueText(figure.value)}${caption}`}
      padding={4}
    >
      {body}
    </ClickableCard>
  );
}

/** The tokens' figure: in and out on two lines, "Not recorded" when none were counted. */
function tokensFigure(tokens: Tokens): Figure {
  if (!tokens) {
    return { label: "Tokens", value: "Not recorded" };
  }
  return {
    caption: tokens.partial ? `since ${day(tokens.since)}` : "cache reads left out",
    label: "Tokens",
    value: { lines: [`${tokenCount(tokens.input)} in`, `${tokenCount(tokens.output)} out`] },
  };
}

/** The lines' figure, leading to `href` when there is one. */
function linesFigure(lines: NonNullable<FiguresHistory["lines"]>, href?: string): Figure {
  return {
    caption: plural(lines.files, "file"),
    href,
    label: "Lines changed",
    value: { added: lines.added, removed: lines.removed },
  };
}

/** A done item's figures, each leading to its detail when it has one. */
function doneFigures(
  history: FiguresHistory,
  tokens: Tokens,
  change: boolean,
  pullRequest?: string,
) {
  const figures: Array<Figure> = [];
  const start = (name: string) => history.stages.find((stage) => stage.name === name)?.started;
  const [from, to] = [start("proposal"), start("pull-request")];
  if (history.totalSeconds != null && from && to) {
    const caption = `${clock(from)} to ${clock(to, from)}`;
    figures.push({
      caption,
      href: "#stages",
      label: "Total time",
      value: duration(history.totalSeconds),
    });
  }
  if (history.lines) {
    figures.push(linesFigure(history.lines, pullRequest ? `${pullRequest}/files` : undefined));
  }
  figures.push(tokensFigure(tokens));
  // A feature always shows its questions and decisions, at zero too; a change only those it has.
  const rounds = history.rounds ?? 0;
  if (!change || rounds > 0) {
    figures.push({
      caption: rounds > 0 ? plural(rounds, "round") : "no round",
      href: rounds > 0 ? "#questions" : undefined,
      label: "Questions",
      value: String(history.questions ?? 0),
    });
  }
  if (!change || history.decisions.length > 0) {
    figures.push({
      caption: "new or changed",
      href: history.decisions.length > 0 ? "#decisions" : undefined,
      label: "Decisions",
      value: String(history.decisions.length),
    });
  }
  return figures;
}

/**
 * A figure's in-page link, followed by a tap or a key, scrolls to its detail and moves the focus
 * there, its title's when it has one, in the same history entry: the browser's own jump would push
 * an entry without the page's state, whose position and open items Back could not restore. A tap
 * on the card's surface reaches here as the click it sends its link.
 */
function jumpInPage(event: MouseEvent) {
  const link = (event.target as Element).closest?.("a");
  const href = link?.getAttribute("href");
  if (
    !href?.startsWith("#") ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey
  ) {
    return;
  }
  const target = document.getElementById(href.slice(1));
  if (!target) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  scrollBelowBar(target);
  const focus = document.getElementById(`${target.id}-title`) ?? target;
  if (!focus.hasAttribute("tabindex")) {
    focus.setAttribute("tabindex", "-1");
  }
  focus.focus({ preventScroll: true });
}

/**
 * The figures of what a feature produced, in a grid that wraps. A live item's lines lead to its
 * files below; a done one's to its pull request's files, when its record names it. A done item
 * whose commits never reached the default branch says so in place of its figures.
 */
export function Figures({
  change = false,
  done,
  history,
  pullRequest,
  tokens,
}: {
  /** A change, which shows its questions and decisions only when it has some. */
  change?: boolean;
  done: boolean;
  history: FiguresHistory;
  /** A done item's pull request, from its record. */
  pullRequest?: string;
  tokens: Tokens;
}) {
  const wide = useWidthClass() === "wide";
  if (done && !history.found) {
    return <Text color="secondary">Not found on the default branch</Text>;
  }
  const figures = done
    ? doneFigures(history, tokens, change, pullRequest)
    : [...(history.lines ? [linesFigure(history.lines, "#files")] : []), tokensFigure(tokens)];
  return (
    <div onClickCapture={jumpInPage}>
      <Grid columns={{ minWidth: wide ? 190 : 150, repeat: "fill" }} gap={3}>
        {figures.map((figure) => (
          <FigureCard figure={figure} key={figure.label} />
        ))}
      </Grid>
    </div>
  );
}
