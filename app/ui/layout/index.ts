// The layout shell: the frame every screen is drawn in, and what a screen declares to be drawn in
// it. A screen imports `definePane`, `definePlace`, `usePane`, and `PaneScroll` from here; the app's
// shell mounts `Stacks`. The guide is `specs/ui/panes.md`.
export * from "./layout";
export {
  actionOf,
  definePane,
  definePlace,
  focusPane,
  kindOf,
  type PaneAction,
  type PaneArgs,
  type PaneKind,
  type PaneMark,
  PaneScroll,
  type PaneSpec,
  type PaneViewProps,
  type Placed,
  placedPages,
  placeOf,
  type Remembered,
  titleOf,
  usePane,
} from "./panes";
export { RAIL, type RailPlace, type RailSlots } from "./Rail";
export { Stacks, type StacksProps } from "./Stacks";
export { type StatusSlots, StatusLine } from "./StatusLine";
