// The side pane of a story's or a mockup's page: the facts of what the main pane shows, as a card,
// then the other stories or mockups of its feature, one row each. The cursor starts on the one
// shown; Enter or a press shows another in the main pane, in the same visit, and gives it the
// focus. On a phone, where one pane shows at a time, it opens the other's page.
import { type JSX, View } from "nsh";
import { navigate, redirect, type Route } from "../../store";
import { Heading } from "../../ui/controls";
import { focusPane, PaneScroll, usePane } from "../../ui/layout";
import type { PaneRef } from "../../ui/layout";
import { createCursor, Line, List } from "../../ui/lists";
import { isNarrow } from "../../ui/width";

/** A story or a mockup of the feature. */
export type Sibling = { id: string; label: string; meta?: string };

/**
 * Shows `to` in the main pane, `main`, in this visit, with the focus there; on a phone, opens
 * it, in a visit of its own, as one pane shows at a time.
 */
export function show(to: Route, main: PaneRef) {
  if (isNarrow()) {
    navigate(to);
    return;
  }
  redirect(to);
  focusPane(main);
}

export function Siblings(props: {
  /** The facts of the one shown. */
  card: JSX.Element;
  /** What the list says without a row. */
  empty: JSX.Element;
  heading: string;
  icon: "swatch-book" | "layout-template";
  open: (id: string) => void;
  rows: () => ReadonlyArray<Sibling>;
  shown: string;
}) {
  const pane = usePane();
  const picked = pane.remember<string | null>("picked", null);
  const cursor = createCursor(props.rows, {
    initial: picked() ?? props.shown,
    onChange: (id) => picked.set(id ?? null),
  });
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {props.card}
        <Heading level={3}>{props.heading}</Heading>
        <List
          cursor={cursor}
          empty={props.empty}
          onOpen={props.open}
          openLabel="Show it"
          row={(id) => {
            const row = () => props.rows().find((one) => one.id === id());
            return (
              <Line
                current={id() === props.shown}
                icon={props.icon}
                label={row()?.label ?? id()}
                meta={row()?.meta}
              />
            );
          }}
          testID="preview-siblings"
        />
      </View>
    </PaneScroll>
  );
}
