// The gallery's pages as panes: each page of the catalogue with the view that draws it, at the
// width of the stack it is in, and the groups as the places of the layout shell.
import { type JSX, untracked } from "nsh";
import { CATALOGUE, type GroupEntry } from "./catalogue";
import { buttons } from "./controls/buttons";
import { choices } from "./controls/choices";
import { icons } from "./controls/icons";
import { menu, select } from "./controls/open";
import { words } from "./controls/words";
import { diff } from "./document/diff";
import { diagrams, reply, spec } from "./document/document";
import { keys } from "./keys/keys";
import { activity, agents, changes, notes, transcript } from "./layout/panes";
import { cards } from "./lists/cards";
import { order } from "./lists/order";
import { rows } from "./lists/rows";
import { table } from "./lists/table";
import { reading } from "./scenes/reading";
import { scene } from "./scenes/session";
import { corner, dialog, popover, sheet, tip, toasts } from "./surfaces/overlays";
import { heights } from "./surfaces/heights";
import { states } from "./surfaces/states";
import { fields } from "./text/fields";
import { definePane, PaneScroll, type PaneRef } from "../ui/layout";

/** What draws each page, by its name in the catalogue: whether its stack is narrow is its one input. */
const VIEWS: Record<string, (narrow: boolean) => JSX.Element> = {
  buttons,
  cards,
  choices,
  corner,
  diagrams,
  dialog,
  diff,
  fields,
  glass: () => scene("glass"),
  heights,
  icons,
  keys,
  menu,
  order,
  popover,
  reading: () => reading(),
  reply,
  rows,
  scrolling: () => scene("scrolling"),
  select,
  sheet,
  spec,
  states,
  streaming: () => scene("streaming"),
  table,
  tip,
  toasts,
  words,
};

/**
 * A page drawn for its stack's width: made again when the stack turns narrow or back, and for
 * nothing else it reads as it is made, as the keys it declares.
 */
const drawn = (view: (narrow: boolean) => JSX.Element, narrow: boolean) =>
  untracked(() => view(narrow));

export type Group = GroupEntry & {
  /** Its pages' panes, in the main stack. */
  panes: ReadonlyArray<PaneRef>;
  /** The panes of its side stack, besides the gallery's own. */
  side?: ReadonlyArray<PaneRef>;
};

/** Every page's pane, by its name. */
export const PANES = new Map<string, PaneRef>();

export const GROUPS: ReadonlyArray<Group> = CATALOGUE.map((group) => {
  if (group.name === "panes") {
    return Object.assign({}, group, {
      panes: [transcript({ session: "s1" }), notes({})],
      side: [activity({}), changes({}), agents({})],
    });
  }
  const panes = group.pages.map((page) => {
    const view = VIEWS[page.name]!;
    const pane = definePane({
      flush: page.fills === true,
      icon: page.icon,
      kind: `gallery-${page.name}`,
      stack: "main",
      title: page.title,
      view: (props) =>
        page.fills === true ? (
          drawn(view, props.width === "narrow")
        ) : (
          <PaneScroll style={{ flex: 1 }} testID={`page-${page.name}`}>
            {drawn(view, props.width === "narrow")}
          </PaneScroll>
        ),
    })({});
    PANES.set(page.name, pane);
    return pane;
  });
  return Object.assign({}, group, { panes });
});
