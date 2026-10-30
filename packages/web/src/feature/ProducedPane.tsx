// What a feature produced, as rows in a pane of the Home's column: while it runs, its lines
// changed, tokens, agent time, and elapsed time; once done, its total time, lines, tokens, agent
// time, questions, and decisions. A row with a detail leads to it.
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";
import { scrollBelowBar } from "../Folds.tsx";
import { Pane } from "../layout/Pane.tsx";
import { type FigureRow, type FigureValue } from "./figureRows.ts";
import { DiffCount, diffLine } from "../layout/DiffCount.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  row: {
    alignItems: "baseline",
    columnGap: spacingVars["--spacing-3"],
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacingVars["--spacing-0-5"],
  },
  value: { alignItems: "flex-end", display: "flex", flexDirection: "column", textAlign: "start" },
});

/** A row of a pane of the column: its name at the start, its value at the end. */
export function FactRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div aria-label={label} role="group" {...stylex.props(styles.row)}>
      <Text color="secondary">{label}</Text>
      {children}
    </div>
  );
}

/** A value as one line of text, for a link's accessible name. */
function valueText(value: FigureValue): string {
  if (typeof value === "string") {
    return value;
  }
  if ("added" in value) {
    return diffLine(value.added, value.removed);
  }
  return value.lines.join(", ");
}

/** A row's value: plain, lines added in green and removed in red, or one line per part. */
function Value({ value }: { value: FigureValue }) {
  if (typeof value === "string") {
    return <Text hasTabularNumbers>{value}</Text>;
  }
  if ("added" in value) {
    return <DiffCount added={value.added} removed={value.removed} />;
  }
  return (
    <>
      {value.lines.map((line) => (
        <Text hasTabularNumbers key={line}>
          {line}
        </Text>
      ))}
    </>
  );
}

/** One figure: its name, its value, what it counts, and, when it has a detail, a link to it. */
function Figure({ row }: { row: FigureRow }) {
  const body = (
    <span {...stylex.props(styles.value)}>
      <Value value={row.value} />
      {row.caption && (
        // The space keeps the value and its caption two words in the link's text, as its name has them.
        <Text color="secondary" type="supporting">
          {" "}
          {row.caption}
        </Text>
      )}
    </span>
  );
  if (!row.href) {
    return <FactRow label={row.label}>{body}</FactRow>;
  }
  const caption = row.caption ? `, ${row.caption}` : "";
  const inPage = row.href.startsWith("#");
  return (
    <FactRow label={row.label}>
      <Link
        aria-label={`${row.label}: ${valueText(row.value)}${caption}`}
        href={row.href}
        // Out of the app, like the pull request's files: in a new tab, as the app's external links.
        {...(inPage ? {} : { rel: "noopener noreferrer", target: "_blank" })}
      >
        {body}
      </Link>
    </FactRow>
  );
}

/**
 * What follows a figure's in-page link, by a tap or a key: `open` opens the detail when it is
 * folded, then the page scrolls to it and moves the focus there, its title's when it has one, in the
 * same history entry. The browser's own jump would push an entry without the page's state, whose
 * position and open items Back could not restore.
 */
function jumpInPage(
  open: ((id: string) => void) | undefined,
  before: ((go: () => void) => void) | undefined,
) {
  return (event: MouseEvent) => {
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
    const go = () => {
      open?.(target.id);
      scrollBelowBar(target);
      const focus = document.getElementById(`${target.id}-title`) ?? target;
      if (!focus.hasAttribute("tabindex")) {
        focus.setAttribute("tabindex", "-1");
      }
      focus.focus({ preventScroll: true });
    };
    if (before) {
      before(go);
    } else {
      go();
    }
  };
}

/** The pane's title: "Produced so far" while the feature runs, "What it produced" once done. */
export function producedTitle(done: boolean) {
  return done ? "What it produced" : "Produced so far";
}

/**
 * The figures of `rows`, without a pane, as the phone's sheet shows them. With no rows, a done
 * item says its commits could not be traced. `onOpen` opens a detail of the page by its id, when
 * it is folded, as its figure leads to it; `beforeJump` runs the jump itself, as once the sheet
 * holding the figures closed.
 */
export function ProducedRows({
  beforeJump,
  onOpen,
  rows,
}: {
  beforeJump?: (go: () => void) => void;
  onOpen?: (id: string) => void;
  rows: ReadonlyArray<FigureRow>;
}) {
  return (
    <div onClickCapture={jumpInPage(onOpen, beforeJump)}>
      <VStack gap={2}>
        {rows.length === 0 && <Empty>No figures: its commits could not be traced</Empty>}
        {rows.map((row) => (
          <Figure key={row.label} row={row} />
        ))}
      </VStack>
    </div>
  );
}

/** The pane of `rows`, titled by `producedTitle`, holding `ProducedRows`. */
export function ProducedPane({
  done,
  onOpen,
  rows,
}: {
  done: boolean;
  onOpen?: (id: string) => void;
  rows: ReadonlyArray<FigureRow>;
}) {
  return (
    <Pane title={producedTitle(done)}>
      <ProducedRows onOpen={onOpen} rows={rows} />
    </Pane>
  );
}
