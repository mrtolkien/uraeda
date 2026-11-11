// What the gallery's pages share: a part per kind of component, a line per variant with its name
// then the variant in each state side by side (a picture cannot hover or press), and the busiest
// page, which glass and overlays are pictured over. Every word is the library's `Text`.
import { type JSX, Text as Words, View } from "nsh";
import { Text } from "../ui/controls";
import type { PressState } from "../ui/controls";
import { Pane } from "../ui/surfaces";
import { alpha, tokens } from "../ui/tokens";

/** The states drawn still, as `state` asks, then disabled, which is a prop. */
export const STATES: ReadonlyArray<PressState | "disabled"> = [
  "rest",
  "hover",
  "focus",
  "pressed",
  "disabled",
];

/** `state` as a control takes it: rest is its own. */
export const asked = (state: PressState | "disabled") =>
  state === "rest" || state === "disabled" ? undefined : state;

/** The room between two parts of a page: one rhythm on every page, a phone's tighter. */
export const gapOf = (narrow: boolean) => (narrow ? 12 : 16);

/** A part of a page, a pane in the page's pane: a third of a wide page, all of a narrow one. */
export function Part(props: {
  children?: JSX.Element;
  /** In a column of parts: as high as it holds. */
  inColumn?: boolean;
  narrow: boolean;
  title: string;
  /** Two thirds of a wide page. */
  wide?: boolean;
}) {
  return (
    <Pane
      body={{ gap: 6 }}
      height="raised"
      style={
        props.inColumn === true
          ? undefined
          : {
              flexBasis: props.narrow ? "100%" : props.wide === true ? "62%" : "30%",
              flexGrow: 1,
              // A wide part takes the whole row where two thirds would squeeze it.
              minWidth: props.wide === true && !props.narrow ? 680 : undefined,
            }
      }
      title={props.title}
    >
      {props.children}
    </Pane>
  );
}

/** A line: its name, then what it shows, under its name on a narrow page. */
export function Line(props: { children?: JSX.Element; name: string; narrow: boolean }) {
  return (
    <View
      style={{
        alignItems: props.narrow ? "flex-start" : "center",
        flexDirection: props.narrow ? "column" : "row",
        gap: props.narrow ? 2 : 12,
      }}
    >
      <View style={{ width: props.narrow ? undefined : 96 }}>
        <Text size="under" tone="faint">
          {props.name}
        </Text>
      </View>
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          flexShrink: 1,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        {props.children}
      </View>
    </View>
  );
}

/**
 * A page: its parts in columns that wrap, with room over each row for the titles that stand on
 * the parts' edges.
 */
export function Page(props: { children?: JSX.Element; narrow: boolean }) {
  const gap = gapOf(props.narrow);
  const rise = tokens.pane.titleRise;
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap,
        paddingTop: rise,
        rowGap: gap + rise,
      }}
    >
      {props.children}
    </View>
  );
}

/** A word of the busy page, in a colour, on a block when given one. */
function span(text: string, colour: string, block?: string) {
  return (
    <Words style={{ backgroundColor: block, color: colour, fontWeight: block ? "700" : "400" }}>
      {text}
    </Words>
  );
}

/**
 * The busiest page: code, a diff, and blocks of colour, `times` over, filling the box it is put
 * in. Glass and overlays are pictured over it, as the design language's tests ask.
 */
export function Busy(props: { times: number }) {
  const r = tokens.role;
  const once = () => (
    <>
      {span("fn", r.action)} draw(surface) {"{ "}
      {span("blur", r.added)}(14); tint(0.46); {span("bend", r.needsYou)}(22) {"}"} ─ features »
      nsh-migration » plan · 61 tasks ─ {span("+ height: { recessed, standard, raised }", r.added)}{" "}
      {span("- shadow: { card, dialog }", r.needsYou)} {span("Session", r.action)} · task 27 ·{" "}
      {span(" Approve ", r.onAction, r.action)}{" "}
      {span("+ tokens.height", r.added, alpha(r.added, 0.14))}{" "}
      {span(" 10 ", r.onAction, r.needsYou)}{" "}
      {span("- tokens.shadow", r.removed, alpha(r.removed, 0.14))}{" "}
    </>
  );
  return (
    <View
      style={{
        bottom: 0,
        left: 0,
        overflow: "hidden",
        paddingHorizontal: 10,
        paddingVertical: 6,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    >
      <Text>{Array.from({ length: props.times }, once)}</Text>
    </View>
  );
}
