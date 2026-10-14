import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  shadowVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { move } from "@dnd-kit/helpers";
import {
  type DragDropManager,
  DragDropProvider,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Accessibility, PointerActivationConstraints } from "@dnd-kit/dom";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { EntryItem } from "uraeda-binding";
import { usePriorities } from "./data.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { closeUndoToasts } from "./layout/useUndoToast.ts";
import { QuickAdd } from "./QuickAdd.tsx";
import { useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { PrioritiesView } from "./views.ts";

type Spot = { section: string; index: number };

/**
 * Where a line dropped above another goes, as the core counts it: among the lines once the
 * dragged one is taken out, so a line moved down its own section lands one place earlier.
 */
export function dropIndex(from: Spot, target: Spot) {
  return from.section === target.section && from.index < target.index
    ? target.index - 1
    : target.index;
}

/** The lines of each section, by key, in order: what a drag reorders. */
type Order = Record<string, Array<string>>;

type Priorities = NonNullable<ReturnType<typeof usePriorities>>;

function orderOf(priorities: Priorities): Order {
  return Object.fromEntries(
    priorities.sections.map((section) => [
      section.section,
      section.entries.map((entry) => entry.key),
    ]),
  );
}

/** A line's spot in an order: its section and index, if it is there. */
function spotOf(order: Order, key: string): Spot | undefined {
  for (const [section, keys] of Object.entries(order)) {
    const index = keys.indexOf(key);
    if (index >= 0) {
      return { section, index };
    }
  }
  return undefined;
}

/**
 * The move a drag asks for, as the core counts it, from the order before the drag and the order
 * it left: `undefined` when the line is back where it started. The line it was dropped above, in
 * the order before the drag, gives `dropIndex` its target; dropped last, it ends its section.
 */
export function dropMove(before: Order, after: Order, key: string) {
  const from = spotOf(before, key);
  const to = spotOf(after, key);
  if (!from || !to || (from.section === to.section && from.index === to.index)) {
    return undefined;
  }
  const next = after[to.section][to.index + 1];
  const above = next === undefined ? undefined : spotOf(before, next);
  return {
    section: to.section,
    index: above ? dropIndex(from, above) : Number.MAX_SAFE_INTEGER,
  };
}

const styles = stylex.create({
  // A line lifts while it is dragged; the long press on a phone does not open the link's menu.
  line: {
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
    userSelect: "none",
  },
  lifted: {
    position: "relative",
    zIndex: 1,
    backgroundColor: colorVars["--color-background-card"],
    boxShadow: shadowVars["--shadow-med"],
  },
  // Now, the section worked on, stands out.
  now: {
    fontSize: typeScaleVars["--text-heading-1-size"],
    lineHeight: typeScaleVars["--text-heading-1-leading"],
  },
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
  section: {
    paddingBlockStart: spacingVars["--spacing-4"],
  },
  add: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  // The bar stays at the bottom of the screen while there is something to commit.
  bar: {
    position: "sticky",
    bottom: 0,
    zIndex: 2,
    marginBlockStart: spacingVars["--spacing-4"],
    paddingBlock: spacingVars["--spacing-2"],
    backgroundColor: colorVars["--color-background-body"],
    borderBlockStartWidth: borderVars["--border-width"],
    borderBlockStartStyle: "solid",
    borderBlockStartColor: colorVars["--color-border"],
  },
});

const TITLES: Record<string, string> = {
  now: "Now",
  next: "Next",
  later: "Later",
  blocked: "Blocked",
};

/** One line: tapped, it opens its task view; dragged by its handle, or held on a touch screen. */
function Line({
  entry,
  index,
  section,
  isSelected,
  isReduced,
}: {
  entry: EntryItem;
  index: number;
  section: string;
  isSelected: boolean;
  isReduced: boolean;
}) {
  const here = useRepoPath();
  const { ref, handleRef, isDragging } = useSortable({
    id: entry.key,
    index,
    group: section,
    type: "line",
    accept: "line",
    data: { text: plain(entry.spans) },
    // With reduced motion, the lines jump to their places instead of sliding.
    transition: isReduced ? null : undefined,
  });
  const text = plain(entry.spans);
  return (
    <ListItem
      ref={ref}
      href={here(`/priorities/${entry.key}`)}
      isSelected={isSelected}
      xstyle={[styles.line, isDragging && styles.lifted]}
      startContent={
        <Button
          ref={handleRef}
          variant="ghost"
          size="sm"
          isIconOnly
          label={`Move ${text}`}
          icon={<span aria-hidden="true">⠿</span>}
        />
      }
      label={<>{text}</>}
      description={
        entry.nestedSpans.length > 0 ? (
          <>
            {entry.nestedSpans.map((spans, line) => (
              <Text key={line} display="block" color="secondary">
                {plain(spans)}
              </Text>
            ))}
          </>
        ) : undefined
      }
    />
  );
}

/** A section's lines, a drop target even when empty, ended by its Add row. */
function Section({
  section,
  count,
  children,
  onAdd,
}: {
  section: string;
  count: number;
  children: ReactNode;
  onAdd: (text: string) => Promise<string | undefined>;
}) {
  const { ref } = useDroppable({
    id: section,
    type: "section",
    accept: "line",
    // The lines in it win over the section itself.
    collisionPriority: 1,
  });
  const title = TITLES[section] ?? section;
  return (
    <section ref={ref} {...stylex.props(styles.section)} aria-label={title}>
      <Heading level={2}>
        <span {...stylex.props(section === "now" && styles.now)}>
          {title} <span {...stylex.props(styles.count)}>· {count}</span>
        </span>
      </Heading>
      <List aria-label={`${title} lines`} hasDividers>
        {children}
      </List>
      <div {...stylex.props(styles.add)}>
        <EditableLine
          value=""
          label={`Add to ${title}`}
          display={
            <>
              <span aria-hidden="true">＋ </span>
              Add to {title}
            </>
          }
          stayOpen
          onSave={onAdd}
        />
      </div>
    </section>
  );
}

/** What a screen reader hears of a drag: the line, and its place. */
function announcer(order: () => Order) {
  const place = (manager: DragDropManager, id: unknown) => {
    const spot = spotOf(order(), String(id));
    const text = String(manager.dragOperation.source?.data?.text ?? id);
    if (!spot) {
      return text;
    }
    const count = order()[spot.section].length;
    return `${text}, ${spot.index + 1} of ${count} in ${TITLES[spot.section] ?? spot.section}`;
  };
  return {
    dragstart: (event: DragStartEvent, manager: DragDropManager) =>
      event.operation.source
        ? `Picked up ${place(manager, event.operation.source.id)}.`
        : undefined,
    dragover: (event: DragOverEvent, manager: DragDropManager) =>
      event.operation.source ? `Moved: ${place(manager, event.operation.source.id)}.` : undefined,
    dragend: (event: DragEndEvent, manager: DragDropManager) =>
      event.operation.source
        ? event.canceled
          ? `Move cancelled: ${place(manager, event.operation.source.id)}.`
          : `Dropped: ${place(manager, event.operation.source.id)}.`
        : undefined,
  };
}

/**
 * Every line of `PRIORITIES.md`, by section: each opens its task view, drags to its place, and each
 * section ends with an Add row; each change is written at once, and a bar commits or discards them.
 * While a line is dragged, and until its move is written, the list stays as the drag found it: a
 * live update waits for the drag's end.
 */
export function PrioritiesPage() {
  const fate = useFateClient();
  const live = usePriorities();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(true);
  // The task view open beside the list, on wide screens.
  const pathname = useLocalPath();
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [message, setMessage] = useState<string>();
  const [confirm, setConfirm] = useState(false);
  // The priorities as the drag found them, held until its move is written.
  const [held, setHeld] = useState<Priorities>();
  const [dragged, setDragged] = useState<Order>();
  const before = useRef<{ priorities: Priorities; order: Order }>(undefined);
  const after = useRef<Order>(undefined);
  const priorities = held ?? live;
  if (!priorities) {
    return null;
  }
  const order = dragged ?? orderOf(priorities);
  const byKey = new Map(
    priorities.sections.flatMap((section) => section.entries.map((e) => [e.key, e] as const)),
  );
  const hash = priorities.hash;

  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "conflict") {
        void fate.request(
          { priorities: { id: "priorities", view: PrioritiesView } },
          { mode: "network-only" },
        );
      }
      return failed.message;
    }
    return undefined;
  };

  const add = (section: string) => (text: string) =>
    run(() =>
      fate.mutations.priorities.add({ input: { section, text, hash }, view: PrioritiesView }),
    );

  const release = () => {
    before.current = undefined;
    after.current = undefined;
    setDragged(undefined);
    setHeld(undefined);
  };

  const drop = async (event: DragEndEvent) => {
    const start = before.current;
    const key = event.operation.source?.id;
    if (!start || key === undefined || event.canceled || !after.current) {
      release();
      return;
    }
    const to = dropMove(start.order, after.current, String(key));
    const entry = start.priorities.sections
      .flatMap((section) => section.entries)
      .find((e) => e.key === String(key));
    if (!to || !entry) {
      release();
      return;
    }
    // Over the version the drag started from: a list changed meanwhile refuses the move.
    const failed = await run(() =>
      fate.mutations.priorities.move({
        input: { entry: entry.id, ...to, hash: start.priorities.hash },
        view: PrioritiesView,
      }),
    );
    setMessage(failed);
    release();
  };

  const changes = priorities.changes;
  const announcements = announcer(() => after.current ?? order);
  return (
    <Page>
      <TopBarSlot>
        <QuickAdd />
      </TopBarSlot>
      <VStack gap={2}>
        <Heading level={1}>Priorities</Heading>
        {message && <Banner status="error" title={message} collapsible={false} />}
        <DragDropProvider
          sensors={[
            PointerSensor.configure({
              // The whole line on a touch screen, after a press of half a second; the handle alone
              // with a mouse or a pen, at once.
              activatorElements: (source) => [source.element],
              activationConstraints: (event) =>
                event.pointerType === "touch"
                  ? [new PointerActivationConstraints.Delay({ value: 500, tolerance: 5 })]
                  : undefined,
              preventActivation: (event, source) =>
                event.pointerType !== "touch" &&
                !(event.target instanceof Node && source.handle?.contains(event.target)),
            }),
            KeyboardSensor,
          ]}
          plugins={(defaults) => [
            ...defaults.filter((plugin) => plugin !== Accessibility),
            Accessibility.configure({
              announcements,
              screenReaderInstructions: {
                draggable:
                  "To move a line, press Space, then the arrow keys; Space again drops it, Escape cancels.",
              },
            }),
          ]}
          onDragStart={() => {
            const found = orderOf(live ?? priorities);
            before.current = { priorities: live ?? priorities, order: found };
            after.current = found;
            setHeld(live ?? priorities);
            setDragged(found);
          }}
          onDragOver={(event) => {
            if (!after.current) {
              return;
            }
            after.current = move(after.current, event);
            setDragged(after.current);
          }}
          onDragEnd={(event) => void drop(event)}
        >
          {priorities.sections.map((section) => (
            <Section
              key={section.section}
              section={section.section}
              count={order[section.section]?.length ?? 0}
              onAdd={add(section.section)}
            >
              {(order[section.section] ?? []).map((key, index) => {
                const entry = byKey.get(key);
                return entry ? (
                  <Line
                    key={key}
                    entry={entry}
                    index={index}
                    section={section.section}
                    isSelected={pathname === `/priorities/${key}`}
                    isReduced={isReduced}
                  />
                ) : null;
              })}
            </Section>
          ))}
        </DragDropProvider>
        {changes > 0 && (
          <div {...stylex.props(styles.bar)}>
            <HStack gap={2} align="center" wrap="wrap">
              <Text>
                {changes} {changes === 1 ? "change" : "changes"} to commit
              </Text>
              <HStack gap={2} justify="end">
                {confirm ? (
                  <>
                    <Button label="Keep them" onClick={() => setConfirm(false)} />
                    <Button
                      variant="destructive"
                      label="Discard them"
                      clickAction={async () => {
                        setConfirm(false);
                        const failed = await run(() =>
                          fate.mutations.priorities.discard({ input: {}, view: PrioritiesView }),
                        );
                        setMessage(failed);
                        if (!failed) {
                          // Discarded: an Undo would write a change back over the committed file.
                          closeUndoToasts();
                        }
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Button variant="ghost" label="Discard" onClick={() => setConfirm(true)} />
                    <Button
                      variant="primary"
                      label="Commit"
                      clickAction={async () => {
                        const failed = await run(() =>
                          fate.mutations.priorities.commit({ input: {}, view: PrioritiesView }),
                        );
                        setMessage(failed);
                        if (!failed) {
                          // Committed: no Undo is left to take back.
                          closeUndoToasts();
                        }
                      }}
                    />
                  </>
                )}
              </HStack>
            </HStack>
          </div>
        )}
      </VStack>
    </Page>
  );
}
