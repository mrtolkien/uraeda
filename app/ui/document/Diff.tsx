// A file's diff: the server's unified text of one file (`git diff`'s), drawn by Native Shell's
// `DiffView`, in one column, in the theme's roles: added lines tinted with `added`, removed ones
// with `removed`, the changed words a step stronger, the code font on the interface's line. It
// fills the room it is given and scrolls inside itself, down and sideways, never the page; with
// `wrap`, long lines wrap at its width instead. With `keys`, the pane it is in scrolls it by `j`
// `k` and goes from change to change by `n` `N`. The Git page and a session's changes draw it.
//
// `DiffView` draws nothing for a patch it cannot read, and says nothing: a patch Rust finds it
// cannot (`patchProblem`) shows as its plain text, under a quiet line that says why. Its code's
// colours are `DiffView`'s own, for a light or a dark theme: it takes no colour of a token's
// (ruling T93.7). Its rows, numbers, and changed words are the theme's roles.
import { computed, Scroll, type StyleProp, Text, View, type ViewStyle } from "nsh";
import { DiffView, type DiffViewRef } from "nsh/base";
import { patchProblem } from "uraeda/native";
import { Icon } from "../controls";
import { registerKey } from "../keys/registry";
import { Well } from "../surfaces";
import { alpha, tokens } from "../tokens";

export type DiffProps = {
  /** Its keys, in the scope around it: `j` `k` scroll, `n` `N` go to the next or previous change. */
  keys?: boolean;
  /** The unified diff of one file: its `---` and `+++` lines, then its hunks. */
  patch: string;
  /** The file's path, which names its language for the colours of its code. */
  path: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Long lines wrap at the view's width, as on a phone, in place of scrolling sideways. */
  wrap?: boolean;
};

/** A colour's wash, behind a row or a word. */
const tint = (colour: string, share: number) => ({ backgroundColor: alpha(colour, share) });

/** The diff's parts, in the theme's roles: read inside the view's props, so a theme follows. */
function parts() {
  const role = tokens.role;
  return {
    content: { paddingLeft: 10, paddingRight: 16 },
    filler: tint(role.ruleQuiet, 0.3),
    gutter: { backgroundColor: role.codeGround },
    indicatorAdded: { backgroundColor: role.added },
    indicatorDeleted: { backgroundColor: role.removed },
    lineAdded: tint(role.added, 0.1),
    lineDeleted: tint(role.removed, 0.1),
    lineNumber: { color: role.inkFaint },
    lineNumberAdded: { color: role.added },
    lineNumberDeleted: { color: role.removed },
    separator: {
      backgroundColor: role.codeGround,
      color: role.inkFaint,
      fontFamily: tokens.type.code,
      fontSize: tokens.type.under,
    },
    side: { backgroundColor: role.sunken, color: role.ink },
    wordAdded: tint(role.added, 0.28),
    wordDeleted: tint(role.removed, 0.28),
  };
}

/** How far `j` and `k` scroll: three rows. */
const STEP = 60;

/** A patch `DiffView` cannot read: why, on a quiet line, then its text as it came. */
function Unread(props: {
  patch: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  why: string;
}) {
  return (
    <View style={[{ flex: 1, gap: 6 }, props.style]} testID={props.testID}>
      <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 6 }}>
        <Icon name="circle-alert" size={14} style={{ marginTop: 3 }} />
        <Text style={{ color: tokens.role.inkQuiet, flexShrink: 1, fontSize: tokens.type.under }}>
          {`Not read as a diff, ${props.why}: its text as it came.`}
        </Text>
      </View>
      <Well style={{ flex: 1 }}>
        <Scroll horizontal={false} style={{ flex: 1 }}>
          <Text
            style={{
              color: tokens.role.ink,
              fontFamily: tokens.type.code,
              fontSize: tokens.type.under,
              lineHeight: 20,
              padding: 10,
            }}
          >
            {props.patch}
          </Text>
        </Scroll>
      </Well>
    </View>
  );
}

export function Diff(props: DiffProps) {
  const why = computed(() => patchProblem(props.patch));
  return (
    <If
      when={why() === ""}
      else={<Unread patch={props.patch} style={props.style} testID={props.testID} why={why()} />}
    >
      <Read {...props} />
    </If>
  );
}

function Read(props: DiffProps) {
  let view: DiffViewRef | undefined;
  // Where the rows are, and how far they go, as the view last said.
  let rows = { at: 0, most: 0 };
  const scroll = (by: number) => {
    const to = Math.max(0, Math.min(rows.most, rows.at + by));
    if (view === undefined || to === rows.at) return false;
    view.setScrollOffset({ x: 0, y: to });
    return undefined;
  };
  if (props.keys === true) {
    registerKey([
      {
        hint: "j k",
        hintLabel: "scroll",
        keys: "j",
        label: "scroll down",
        repeat: true,
        run: () => scroll(STEP),
      },
      { keys: "k", label: "scroll up", repeat: true, run: () => scroll(-STEP) },
      { keys: "ArrowDown", label: "scroll down", repeat: true, run: () => scroll(STEP) },
      { keys: "ArrowUp", label: "scroll up", repeat: true, run: () => scroll(-STEP) },
      {
        hint: "n N",
        hintLabel: "change",
        keys: "n",
        label: "next change",
        run: () => void view?.nextHunk(),
      },
      { keys: "N", label: "previous change", run: () => void view?.previousHunk() },
    ]);
  }
  return (
    <DiffView
      onScroll={(event) => {
        rows = {
          at: event.offset.y,
          most: Math.max(0, event.contentSize.height - event.size.height),
        };
      }}
      ref={(made: DiffViewRef) => (view = made)}
      fontFamily={tokens.type.code}
      fontSize={tokens.type.under}
      language={props.path}
      layout="unified"
      lineHeight={20}
      patch={props.patch}
      softWrap={props.wrap === true}
      style={[{ borderRadius: tokens.radius, flex: 1, overflow: "hidden" }, props.style]}
      styles={parts()}
      testID={props.testID}
    />
  );
}
