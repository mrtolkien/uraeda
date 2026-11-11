// A card: several facts about one thing, with a hierarchy. It takes slots, not free children, so
// every screen draws a session, a job, a run, or a feature the same way, and the good shape is the
// easy one:
//
// - **The head**: its kind's icon, its `title` as a person would say it aloud, whole, wrapping
//   (never a hash, an id, or an internal name), its `state` in words with its tone, and its `time`.
//   On a narrow window the icon, the state, and the time are a head line, and the title takes the
//   card's full width under it, as every text of more than one line does on a phone; a card with
//   neither state nor time has its icon before its title. Elsewhere the state and the time stay
//   beside the title while both fit, and go to a second line when they do not.
// - **`who`**: one quiet line under the title, of who or what it is: "Claude · Opus 5.5".
// - **`facts`**: each led by its icon, under a quiet rule, in the order things happened; a fact
//   that is unknown is left out, never drawn empty.
// - **`body`**: what needs the card's whole width, what it asks or its step, under the facts.
// - **`actions`**: its buttons, each with its key, at its foot.
//
// It is a raised surface, square, never glowing. A running card carries a run's line on its top
// edge. The cursor's card, `selected`, has a row's look: a fill one step up and the bar on its left
// edge, lit while the list's keys work, its edge unchanged; the card open now, `current`, has its
// icon and title in the accent. Pressed, the whole card is the target.
import { type JSX, View } from "nsh";
import { Button, Icon, type IconName, StatusDot, Text } from "../controls";
import { Surface } from "../surfaces";
import { type Tone, tokens } from "../tokens";
import { isNarrow } from "../width";
import { Bar } from "./Row";

export type CardState = {
  /** In words: "Running", "Waits on you", "Done", "Paused". */
  label: string;
  tone: Tone;
  /** A run is on: the card's top edge carries the run's line. */
  running?: boolean;
};

/** When it happened, in the words the screen gives, in the server's time zone: "14:02". */
export type CardTime = {
  started: string;
  /** Absent while it goes on. */
  ended?: string;
  /** How long it took, or has been going: "3 min". */
  took?: string;
};

export type CardFact = {
  icon: IconName;
  label: string;
  /** Its words' tone: the ink unless given. */
  tone?: Tone;
};

export type CardAction = {
  icon?: IconName;
  /** Its key, declared while the card is shown: give it to the selected card's alone. */
  keys?: string;
  label: string;
  run: () => void;
  variant?: "main" | "tube" | "danger";
};

export type CardProps = {
  actions?: ReadonlyArray<CardAction>;
  body?: JSX.Element;
  /** What is open now, the item read beside the list: its icon and title in the accent. */
  current?: boolean;
  facts?: ReadonlyArray<CardFact>;
  /** Its kind's hue, a colour of the tokens: the quiet ink unless given. */
  hue?: string;
  icon: IconName;
  onPress?: () => void;
  selected?: boolean;
  state?: CardState;
  testID?: string;
  time?: CardTime;
  /** What a person calls it, aloud: never a hash or an id. */
  title: string;
  /** One quiet line of who or what it is. */
  who?: string;
};

/** "14:02 → 14:05 · 3 min", "14:02 · 3 min", or "14:02". */
export function timeWords(time: CardTime) {
  const span = time.ended === undefined ? time.started : `${time.started} → ${time.ended}`;
  return time.took === undefined ? span : `${span} · ${time.took}`;
}

function When(props: { time: CardTime }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 4 }}>
      <Icon name="clock" size={13} />
      <Text size="under" tone="faint">
        {timeWords(props.time)}
      </Text>
    </View>
  );
}

/** Whether the icon, the state, and the time are a line over the title: a narrow window's. */
const headLine = (props: CardProps) =>
  isNarrow() && (props.state !== undefined || props.time !== undefined);

function Head(props: CardProps) {
  const icon = () => (
    <Icon colour={props.current === true ? tokens.row.current : props.hue} name={props.icon} />
  );
  const state = () => (
    <If when={props.state}>{(now) => <StatusDot label={now().label} tone={now().tone} />}</If>
  );
  const time = () => <If when={props.time}>{(when) => <When time={when()} />}</If>;
  const title = () => (
    <Text
      bold
      colour={props.current === true ? tokens.row.current : undefined}
      style={{ flexBasis: "auto", flexGrow: 1, flexShrink: 1, minWidth: 0 }}
      testID={props.testID === undefined ? undefined : `${props.testID}-title`}
    >
      {props.title}
    </Text>
  );
  const hasHead = () => props.state !== undefined || props.time !== undefined;
  return (
    <If
      when={headLine(props)}
      else={
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
          <View style={{ height: tokens.type.line, justifyContent: "center" }}>{icon()}</View>
          {/* The title gets the width first: the state and the time stay beside it while both
              fit on one line, and go to the end of a second line when they do not. */}
          <View
            style={{
              alignItems: "center",
              columnGap: 12,
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              minWidth: 0,
            }}
          >
            {title()}
            <If when={hasHead()}>
              <View
                // On a line of its own, it wraps too: the time under the state, never cut.
                style={{
                  alignItems: "center",
                  columnGap: 12,
                  flexDirection: "row",
                  flexShrink: 1,
                  flexWrap: "wrap",
                  marginLeft: "auto",
                  minHeight: 24,
                  minWidth: 0,
                }}
              >
                {state()}
                {time()}
              </View>
            </If>
          </View>
        </View>
      }
    >
      <View style={{ gap: 2 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          {icon()}
          <View style={{ flex: 1 }}>{state()}</View>
          {time()}
        </View>
        {title()}
      </View>
    </If>
  );
}

export function Card(props: CardProps) {
  const pad = 10;
  return (
    <Surface
      height="raised"
      onPress={props.onPress}
      running={props.state?.running}
      testID={props.testID}
    >
      <If when={props.selected === true}>
        {/* The cursor's look, a row's: a fill one step up and the bar, never a lit edge. */}
        <View
          style={{
            backgroundColor: tokens.row.selectedUp,
            bottom: 0,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        />
        <Bar />
      </If>
      <View style={{ gap: 2, paddingHorizontal: pad, paddingVertical: 8 }}>
        <Head {...props} />
        <If when={props.who}>
          {(who) => (
            <View style={{ paddingLeft: headLine(props) ? 0 : tokens.control.icon + 8 }}>
              <Text tone="quiet">{who()}</Text>
            </View>
          )}
        </If>
      </View>
      <If when={props.facts !== undefined && props.facts.length > 0}>
        <View
          style={{
            borderTopColor: tokens.row.rule,
            borderTopWidth: 1,
            columnGap: 16,
            flexDirection: "row",
            flexWrap: "wrap",
            paddingHorizontal: pad,
            paddingVertical: 6,
            rowGap: 2,
          }}
        >
          <Each of={props.facts ?? []}>
            {(fact) => (
              // A fact longer than the card wraps under its icon's line, as a failed run's words.
              <View
                style={{ alignItems: "flex-start", flexDirection: "row", flexShrink: 1, gap: 6 }}
              >
                <Icon name={fact().icon} size={14} style={{ marginTop: 5 }} />
                <Text style={{ flexShrink: 1 }} tone={fact().tone ?? "ink"}>
                  {fact().label}
                </Text>
              </View>
            )}
          </Each>
        </View>
      </If>
      <If when={props.body}>
        {(body) => <View style={{ paddingBottom: 8, paddingHorizontal: pad }}>{body()}</View>}
      </If>
      <If when={props.actions !== undefined && props.actions.length > 0}>
        <View
          style={{
            borderTopColor: tokens.row.rule,
            borderTopWidth: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            paddingHorizontal: pad,
            paddingVertical: 8,
          }}
        >
          <Each of={props.actions ?? []}>
            {(action) => (
              <Button
                icon={action().icon}
                keys={action().keys}
                label={action().label}
                onPress={() => action().run()}
                variant={action().variant ?? "tube"}
              />
            )}
          </Each>
        </View>
      </If>
    </Surface>
  );
}
