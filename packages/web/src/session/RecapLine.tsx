// A stretch of the agent's calls and thoughts as one line of the chat, and the live line that ends
// a running turn: what the agent did, or does, and for how long, as a link that opens the
// session's Activity at that stretch. The words are `stretches.ts`'s; this file draws them, and
// joins a stretch that a turn's pages of 100 items cut.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  sizeVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, type ReactNode, Suspense, useEffect, useState } from "react";
import { redirect, usePathname } from "../routes.tsx";
import { useTurnLog } from "../sessionData.ts";
import { StatusMark } from "../StatusMark.tsx";
import type { Actions, TranscriptItem } from "../TranscriptMessages.tsx";
import {
  doingText,
  joinStretches,
  liveText,
  recapText,
  slotsOf,
  type Stretch,
  type ToolItem,
} from "./stretches.ts";

const styles = stylex.create({
  line: {
    // A rule at its start, as the mockup's recap lines: apart from the agent's text, quieter.
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: `calc(2 * ${borderVars["--border-width"]})`,
    // As tall as a control: a finger's 44 px under a coarse pointer.
    minHeight: sizeVars["--size-element-sm"],
  },
  link: {
    display: "block",
  },
  open: {
    color: colorVars["--color-text-accent"],
    flexShrink: 0,
    marginInlineStart: "auto",
  },
  time: {
    color: colorVars["--color-text-primary"],
    fontWeight: fontWeightVars["--font-weight-medium"],
  },
});

/** A line's words, its time first, "**2 min** · read 3 files". */
function Words({ text }: { text: string }) {
  const [time = "", ...rest] = text.split(" · ");
  return (
    <span>
      <span {...stylex.props(styles.time)}>{time}</span>
      {rest.map((part) => ` · ${part}`).join("")}
    </span>
  );
}

/**
 * Follows a recap line on the session's own page in place of the history entry, as a column's tab
 * does, so Back leaves the page rather than stepping back through the stretches. A plain click
 * only: one with a modifier is the browser's.
 */
function inPlace(href: string) {
  return (event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    const plain = !event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0;
    if (plain && new URL(href, window.location.href).pathname === window.location.pathname) {
      event.preventDefault();
      redirect(href);
    }
  };
}

/**
 * A recap line: a stretch's `text`, as a link to `href`, its Activity at the stretch, whose name
 * is `text` alone. On the session's page it replaces the history entry, as a tab does; from a
 * document's column it opens the session's page in a new entry. Without `href`, it is text. `live`,
 * a running turn's line: a working dot named `activity`, the agent's activity, and the text, which
 * changes each second, hidden from screen readers.
 */
export function RecapLine({
  activity = "Working",
  href,
  live = false,
  text,
}: {
  activity?: string;
  href?: string;
  live?: boolean;
  text: string;
}) {
  const here = usePathname();
  const inPage = href !== undefined && new URL(href, window.location.href).pathname === here;
  const line = (
    <HStack
      align="center"
      as="span"
      gap={2}
      paddingBlock={0.5}
      paddingInlineStart={3}
      xstyle={styles.line}
    >
      {live ? <StatusMark label={activity} small status="working" /> : <Icon icon="wrench" />}
      {live ? (
        <span aria-hidden>
          <Words text={text} />
        </span>
      ) : (
        <Words text={text} />
      )}
      {href !== undefined && (
        // Where it leads, for the eye: the link's name is the stretch's words. On the session's
        // page, its Activity beside; from a document's column, away to the session's page.
        <HStack align="center" aria-hidden as="span" gap={1} xstyle={styles.open}>
          {inPage && "Activity"}
          <Icon icon={inPage ? "chevronRight" : "uraeda:arrow-right"} size="xsm" />
        </HStack>
      )}
    </HStack>
  );
  if (href === undefined) {
    return (
      <Text color="secondary" display="block" type="supporting">
        {line}
      </Text>
    );
  }
  return (
    <Link
      color="secondary"
      display="block"
      href={href}
      onClick={inPlace(href)}
      type="supporting"
      xstyle={styles.link}
    >
      {line}
    </Link>
  );
}

/**
 * `stretch` joined with the stretches of the pages before it that it goes on from, given to
 * `children`: a stretch `continued` on a page after `after`, the page before, goes on from that
 * page's last stretch when that one is `open`, and so back to the stretch's start. `after` is
 * undefined on the turn's first page, or when the items drawn do not start the page.
 */
export function JoinedStretch({
  after,
  children,
  stretch,
  turn,
}: {
  after: number | undefined;
  children: (stretch: Stretch) => ReactNode;
  stretch: Stretch;
  turn: string;
}) {
  if (!stretch.continued || after === undefined) {
    return children(stretch);
  }
  // The page before is read as the tail reads its pages. Until it is in, the line counts this
  // page's part of the stretch, so the chat keeps its place rather than the line popping in.
  return (
    <Suspense fallback={children(stretch)}>
      <PageBefore after={after} stretch={stretch} turn={turn}>
        {children}
      </PageBefore>
    </Suspense>
  );
}

/** The page `after`'s open stretch joined before `stretch`, and the pages before it in turn. */
function PageBefore({
  after,
  children,
  stretch,
  turn,
}: {
  after: number;
  children: (stretch: Stretch) => ReactNode;
  stretch: Stretch;
  turn: string;
}) {
  const page = useTurnLog(`${turn}:${after}`);
  const last = slotsOf(turn, page?.items ?? []).at(-1);
  if (last?.kind !== "stretch" || !last.stretch.open) {
    return children(stretch);
  }
  return (
    <JoinedStretch
      after={after > 0 ? after - 1 : undefined}
      stretch={joinStretches(last.stretch, stretch)}
      turn={turn}
    >
      {children}
    </JoinedStretch>
  );
}

/** A stretch's recap line, its counts those of the whole stretch, across the pages before. */
export function StretchRecap({
  actions,
  after,
  stretch,
  turn,
}: {
  actions: Actions;
  after: number | undefined;
  stretch: Stretch;
  turn: string;
}) {
  return (
    <JoinedStretch after={after} stretch={stretch} turn={turn}>
      {(whole) => (
        <RecapLine href={actions.stretchHref?.(whole.key)} text={recapText(whole.items)} />
      )}
    </JoinedStretch>
  );
}

/** The open stretch that ends the page `after`, its recap line, else nothing. */
function EndOfPage({ actions, after, turn }: { actions: Actions; after: number; turn: string }) {
  const page = useTurnLog(`${turn}:${after}`);
  const last = slotsOf(turn, page?.items ?? []).at(-1);
  if (last?.kind !== "stretch" || !last.stretch.open) {
    return null;
  }
  return (
    <StretchRecap
      actions={actions}
      after={after > 0 ? after - 1 : undefined}
      stretch={last.stretch}
      turn={turn}
    />
  );
}

/**
 * The recap line of a stretch that the page `after` ends with and that its page after does not go
 * on with: that page did not draw it, waiting for the page after, which draws it before its first
 * item.
 */
export function EarlierRecap({
  actions,
  after,
  turn,
}: {
  actions: Actions;
  after: number;
  turn: string;
}) {
  // The page before is drawn above, so it is in already: the wait is for its first read alone.
  return (
    <Suspense fallback={null}>
      <EndOfPage actions={actions} after={after} turn={turn} />
    </Suspense>
  );
}

/** The time now, again each second: of the live line, and the running sub-agents' rows. */
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** The activity of a running turn: its label, "Working" or "Thinking", and since when. */
type Activity = { label: string; since: string };

/**
 * What the main agent does now: its latest call still going, "reading src/tasks/undo.ts", else its
 * activity, "thinking". It reads the turn's last page alone, which the tail has in: a call still
 * going on a page before, as one followed by a page of its sub-agents' items, is missed, and the
 * line reads the activity then, a rare case not worth reading the pages before each second.
 */
function doing(items: ReadonlyArray<TranscriptItem>, activity: Activity): string {
  const going = items.findLast(
    (item): item is ToolItem & { seq: number } =>
      item.kind === "tool" &&
      item.parent === undefined &&
      (item.status === "in_progress" || item.status === "pending"),
  );
  return going
    ? doingText(going)
    : `${activity.label.charAt(0).toLowerCase()}${activity.label.slice(1)}`;
}

/**
 * The live line's words, again each second, linking `href`: the clock ticks here alone, below the
 * join of the pages, which runs only when they change.
 */
function Ticking({
  activity,
  doing,
  href,
  subagents,
}: {
  activity: Activity;
  doing: string;
  href: string | undefined;
  subagents: number;
}) {
  const now = useNow();
  const text = liveText(Math.max(now - Date.parse(activity.since), 0), doing, subagents);
  return <RecapLine activity={activity.label} href={href} live text={text} />;
}

/** The live line, over the turn's last page `items`: it opens the open stretch, else the Activity. */
function LiveLine({
  actions,
  activity,
  after,
  items,
  turn,
}: {
  actions: Actions;
  activity: Activity;
  after: number | undefined;
  items: ReadonlyArray<TranscriptItem>;
  turn: string;
}) {
  const what = doing(items, activity);
  const line = (key?: string) => (
    <Ticking
      activity={activity}
      doing={what}
      href={actions.stretchHref?.(key)}
      subagents={actions.subagents ?? 0}
    />
  );
  const last = slotsOf(turn, items).at(-1);
  if (last?.kind !== "stretch") {
    return line();
  }
  return (
    <JoinedStretch after={after} stretch={last.stretch} turn={turn}>
      {(whole) => line(whole.key)}
    </JoinedStretch>
  );
}

/** The last page of a running turn, read for its live line. */
function LastPage(props: { actions: Actions; activity: Activity; page: number; turn: string }) {
  const { page, turn } = props;
  const log = useTurnLog(`${turn}:${page}`, true);
  return <LiveLine {...props} after={page > 0 ? page - 1 : undefined} items={log?.items ?? []} />;
}

/**
 * A running turn's live recap line, "12 s · reading src/tasks/undo.ts · 2 sub-agents running":
 * how long its current call or thought lasts, what it does, and the main agent's running
 * sub-agents. It stands for the turn's open stretch, whose recap line it is while it runs.
 */
export function LiveRecap({
  actions,
  activity,
  pages,
  turn,
}: {
  actions: Actions;
  activity: Activity;
  pages: number;
  turn: string;
}) {
  return pages === 0 ? (
    <LiveLine actions={actions} activity={activity} after={undefined} items={[]} turn={turn} />
  ) : (
    <LastPage actions={actions} activity={activity} page={pages - 1} turn={turn} />
  );
}
