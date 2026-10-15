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
import { dropMove, type Order, orderOf, type Priorities, spotOf } from "./drop.ts";
import { EditableLine } from "./EditableLine.tsx";
import { refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { closeUndoToasts } from "./layout/useUndoToast.ts";
import { useLocalPath, useRepoPath, useRestoreScroll } from "./routes.tsx";
import { plain } from "./Spans.tsx";
import { PrioritiesView } from "./views.ts";

/** Whether a pointer event's target is a node of the page, which a handle may contain. */
function isNode(target: EventTarget | null): target is Node {
  return target !== null && "nodeType" in target;
}

const styles = stylex.create({
  add: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  bar: {
    // The bar stays at the bottom of the screen while there is something to commit.
    backgroundColor: colorVars["--color-background-body"],
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    bottom: 0,
    marginBlockStart: spacingVars["--spacing-4"],
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
    zIndex: 2,
  },
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
  lifted: {
    // A line lifts while it is dragged.
    backgroundColor: colorVars["--color-background-card"],
    boxShadow: shadowVars["--shadow-med"],
    position: "relative",
    zIndex: 1,
  },
  line: {
    // The long press on a phone does not open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  now: {
    // Now, the section worked on, stands out.
    fontSize: typeScaleVars["--text-heading-1-size"],
    lineHeight: typeScaleVars["--text-heading-1-leading"],
  },
  section: {
    paddingBlockStart: spacingVars["--spacing-4"],
  },
});

const TITLES: Record<string, string> = {
  blocked: "Blocked",
  later: "Later",
  next: "Next",
  now: "Now",
};

/** One line: tapped, it opens its task view; dragged by its handle, or held on a touch screen. */
function Line({
  entry,
  index,
  isReduced,
  isSelected,
  section,
}: {
  entry: EntryItem;
  index: number;
  isReduced: boolean;
  isSelected: boolean;
  section: string;
}) {
  const here = useRepoPath();
  const { handleRef, isDragging, ref } = useSortable({
    accept: "line",
    data: { text: plain(entry.spans) },
    group: section,
    id: entry.key,
    index,
    type: "line",
    // With reduced motion, the lines jump to their places instead of sliding.
    transition: isReduced ? null : undefined,
  });
  const text = plain(entry.spans);
  return (
    <ListItem
      description={
        entry.nestedSpans.length > 0 ? (
          <>
            {entry.nestedSpans.map((spans, line) => (
              <Text color="secondary" display="block" key={line}>
                {plain(spans)}
              </Text>
            ))}
          </>
        ) : undefined
      }
      href={here(`/priorities/${entry.key}`)}
      isSelected={isSelected}
      label={<>{text}</>}
      ref={ref}
      startContent={
        <Button
          icon={<span aria-hidden="true">⠿</span>}
          isIconOnly
          label={`Move ${text}`}
          ref={handleRef}
          size="sm"
          variant="ghost"
        />
      }
      xstyle={[styles.line, isDragging && styles.lifted]}
    />
  );
}

/** A section's lines, a drop target even when empty, ended by its Add row. */
function Section({
  children,
  count,
  onAdd,
  section,
}: {
  children: ReactNode;
  count: number;
  onAdd: (text: string) => Promise<string | undefined>;
  section: string;
}) {
  const { ref } = useDroppable({
    accept: "line",
    id: section,
    type: "section",
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
          display={
            <>
              <span aria-hidden="true">＋ </span>
              Add to {title}
            </>
          }
          field={`priorities#add:${section}`}
          label={`Add to ${title}`}
          onSave={onAdd}
          stayOpen
          value=""
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
    dragend: (event: DragEndEvent, manager: DragDropManager) =>
      event.operation.source
        ? event.canceled
          ? `Move cancelled: ${place(manager, event.operation.source.id)}.`
          : `Dropped: ${place(manager, event.operation.source.id)}.`
        : undefined,
    dragover: (event: DragOverEvent, manager: DragDropManager) =>
      event.operation.source ? `Moved: ${place(manager, event.operation.source.id)}.` : undefined,
    dragstart: (event: DragStartEvent, manager: DragDropManager) =>
      event.operation.source
        ? `Picked up ${place(manager, event.operation.source.id)}.`
        : undefined,
  };
}

/**
 * Every line of `PRIORITIES.md`, by section: each opens its task view, drags to its place, and each
 * section ends with an Add row; each change is written at once, and a bar commits or discards them.
 * While a line is dragged, and until its move is written, the list stays as the drag found it: a
 * live update waits for the drag's end.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the drag and drop in a hook
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
  const before = useRef<{ order: Order; priorities: Priorities }>(undefined);
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
      fate.mutations.priorities.add({ input: { hash, section, text }, view: PrioritiesView }),
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
  // oxlint-disable-next-line react/refs -- before the code quality decision: read by the announcer's callbacks during a drag, not while rendering
  const announcements = announcer(() => after.current ?? order);
  return (
    <Page>
      <VStack gap={2}>
        <Heading level={1}>Priorities</Heading>
        {message && <Banner collapsible={false} status="error" title={message} />}
        <DragDropProvider
          onDragEnd={(event) => void drop(event)}
          onDragOver={(event) => {
            if (!after.current) {
              return;
            }
            after.current = move(after.current, event);
            setDragged(after.current);
          }}
          onDragStart={() => {
            const found = orderOf(live ?? priorities);
            before.current = { order: found, priorities: live ?? priorities };
            after.current = found;
            setHeld(live ?? priorities);
            setDragged(found);
          }}
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
          sensors={[
            PointerSensor.configure({
              // The whole line on a touch screen, after a press of half a second; the handle alone
              // with a mouse or a pen, at once.
              activationConstraints: (event) =>
                event.pointerType === "touch"
                  ? [new PointerActivationConstraints.Delay({ tolerance: 5, value: 500 })]
                  : undefined,
              activatorElements: (source) => [source.element],
              preventActivation: (event, source) =>
                event.pointerType !== "touch" &&
                !(isNode(event.target) && source.handle?.contains(event.target)),
            }),
            KeyboardSensor,
          ]}
        >
          {priorities.sections.map((section) => (
            <Section
              count={order[section.section]?.length ?? 0}
              key={section.section}
              onAdd={add(section.section)}
              section={section.section}
            >
              {(order[section.section] ?? []).map((key, index) => {
                const entry = byKey.get(key);
                return entry ? (
                  <Line
                    entry={entry}
                    index={index}
                    isReduced={isReduced}
                    isSelected={pathname === `/priorities/${key}`}
                    key={key}
                    section={section.section}
                  />
                ) : null;
              })}
            </Section>
          ))}
        </DragDropProvider>
        {changes > 0 && (
          <div {...stylex.props(styles.bar)}>
            <HStack align="center" gap={2} wrap="wrap">
              <Text>
                {changes} {changes === 1 ? "change" : "changes"} to commit
              </Text>
              <HStack gap={2} justify="end">
                {confirm ? (
                  <>
                    <Button label="Keep them" onClick={() => setConfirm(false)} />
                    <Button
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
                      label="Discard them"
                      variant="destructive"
                    />
                  </>
                ) : (
                  <>
                    <Button label="Discard" onClick={() => setConfirm(true)} variant="ghost" />
                    <Button
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
                      label="Commit"
                      variant="primary"
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
