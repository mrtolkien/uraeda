// A live page, as the previews show one: a story of a project's Storybook, or an HTML mockup,
// drawn by `WebFrame` at the width its design needs, a phone's or a desktop's, scaled down to fit
// and centred, never stretched, with the widths to pick from and what the frame does in a row
// above it. The page's own pane, `keys`, declares the keys: `w` the next width, `f` full screen
// (the pane zoomed over the window, its page kept), `R` loads it again, `o` opens it in the
// browser. A press in the page, or Tab, gives it the keys, and Escape
// takes them back, which the status line says while the page has them. A document's embed draws
// it without keys, at a height of its own, and its row's buttons take presses. Where a review
// comment can go, `comment` adds "Comment" (`i`) and, once the page's pick script is ready, pick
// mode (`p`): the element pressed then opens the comment on it, and Escape in the page ends it.
import { type JSX, openUrl, signal, View } from "nsh";
import { connection, entry } from "../../store";
import { Button, IconButton, Segmented, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane, zoomer } from "../../ui/layout";
import { WebFrame, type WebFrameRef, Well } from "../../ui/surfaces";
import { shownTheme } from "../../ui/theme";
import { type Picked, pickedOf } from "./pick";

/** The widths a page is shown at: a phone's, a desktop's, or its room's. */
export type Width = "phone" | "desktop" | "fit";

/** The phone's and the desktop's widths, in CSS pixels, as the old frame had them. */
export const WIDTHS: Record<Exclude<Width, "fit">, number> = { desktop: 1440, phone: 402 };

const OPTIONS = [
  { icon: "smartphone", label: "Phone", value: "phone" },
  { icon: "monitor", label: "Desktop", value: "desktop" },
  { icon: "maximize-2", label: "Fit", value: "fit" },
] as const;

/** A path the server gave, with the frame secret, on the server's address: a client builds none. */
export const served = (path: string) => `${connection()?.address ?? ""}${path}`;

/** The next width after `width`, round. */
const after = (width: Width): Width =>
  OPTIONS[(OPTIONS.findIndex((option) => option.value === width) + 1) % OPTIONS.length]!.value;

export type LiveFrameProps = {
  /** The screen's own buttons, before the frame's, as Restart. */
  actions?: JSX.Element;
  /** Opens a review comment on the page, or on the element picked in it. */
  comment?: (picked?: Picked) => void;
  /** Its height: its room's without one, as a page's pane gives it. */
  height?: number;
  /** Declares the frame's keys in the pane around it: only the page's own frame does. */
  keys?: boolean;
  onMessage?: (data: unknown) => void;
  /** Picks another width: without it, the page shows at `width` alone. */
  onWidth?: (width: Width) => void;
  /** Lets the wheel scroll the page: false where the page is sized to what it shows. */
  scrollable?: boolean;
  /** The page's whole address. */
  src: string;
  testID?: string;
  /** What it shows, in words, for its loading and failing words. */
  title: string;
  width: Width | number;
};

export function LiveFrame(props: LiveFrameProps) {
  const scale = signal(1);
  const inPage = signal(false);
  let frame: WebFrameRef | undefined;
  const pixels = () =>
    typeof props.width === "number"
      ? props.width
      : props.width === "fit"
        ? undefined
        : WIDTHS[props.width];
  // The height a story reports, by its pick script: an embed is as tall as its story, up to its own.
  const reported = signal<number | undefined>(undefined);
  // Pick mode: possible once the page's pick script said it is ready, on until a pick or Escape.
  const pickable = signal(false);
  const picking = signal(false);
  const pick = (on: boolean) => {
    picking.set(on);
    frame?.post({ on, uraeda: "pick" });
  };
  const height = () => {
    const own = props.height;
    const told = reported();
    return own === undefined || told === undefined ? own : Math.min(own, told * scale() + 12);
  };
  // What the page says: a story's pick script is ready, and is told the colour mode; its height.
  const heard = (data: unknown) => {
    const said = (typeof data === "object" && data !== null ? data : {}) as {
      height?: unknown;
      uraeda?: unknown;
    };
    if (said.uraeda === "ready") {
      frame?.post({ mode: shownTheme().mode, uraeda: "mode" });
      pickable.set(true);
    }
    if (said.uraeda === "pick-stopped") picking.set(false);
    const picked = pickedOf(data);
    // A page may still send a pick after pick mode ended, before it heard so.
    if (picked !== undefined && picking()) {
      picking.set(false);
      props.comment?.(picked);
    }
    if (said.uraeda === "size" && typeof said.height === "number") reported.set(said.height);
    props.onMessage?.(data);
  };
  const open = () => void openUrl(props.src);
  // Full screen, on the page's own pane: the pane zoomed over the window, its web view kept.
  const pane = props.keys === true ? usePane() : undefined;
  const zoom = zoomer();
  const zoomed = () => pane !== undefined && entry().kept.layout?.zoomed === pane.key;
  const reload = () => frame?.reload();

  if (props.keys === true) {
    registerKey([
      {
        hint: "w",
        hintLabel: "width",
        keys: "w",
        label: "Show the page at the next width",
        run: () => {
          if (props.onWidth === undefined || typeof props.width === "number") return false;
          props.onWidth(after(props.width));
        },
      },
      {
        hint: "esc",
        hintLabel: "back to the app",
        keys: "Escape",
        label: "Take the keys back from the page",
        run: () => inPage.set(false),
        when: inPage,
      },
    ]);
  }

  return (
    <View style={{ flex: props.height === undefined ? 1 : undefined, gap: 8 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <If when={props.onWidth !== undefined && typeof props.width === "string"}>
          <Segmented
            label="Width"
            onChange={(next) => props.onWidth?.(next)}
            options={OPTIONS}
            value={props.width as Width}
          />
        </If>
        <Text size="under" tone="faint">
          {pixels() === undefined
            ? "Its room's width"
            : `${pixels()} px · ${Math.round(scale() * 100)}%`}
        </Text>
        <If when={props.keys === true && !inPage()}>
          <Text size="under" tone="faint">
            Tab or a press: the page's keys
          </Text>
        </If>
        <View style={{ flex: 1 }} />
        {props.actions}
        <If when={props.comment !== undefined && pickable()}>
          <Button
            icon="mouse-pointer-click"
            keys={props.keys === true ? "p" : undefined}
            label={picking() ? "Picking: press an element" : "Pick an element"}
            onPress={() => pick(!picking())}
            testID="pick"
            variant={picking() ? "main" : undefined}
          />
        </If>
        <If when={props.comment}>
          {(comment) => (
            <Button
              icon="message-square"
              keys={props.keys === true ? "i" : undefined}
              label="Comment"
              onPress={() => comment()()}
              testID="preview-comment"
            />
          )}
        </If>
        <If when={pane !== undefined}>
          <IconButton
            icon={zoomed() ? "minimize-2" : "maximize-2"}
            keys="f"
            label={zoomed() ? "Leave full screen" : "Full screen"}
            onPress={() => zoom(!zoomed())}
            testID="full-screen"
          />
        </If>
        <IconButton
          icon="refresh-cw"
          keys={props.keys === true ? "R" : undefined}
          label="Load the page again"
          onPress={reload}
        />
        <IconButton
          icon="external-link"
          keys={props.keys === true ? "o" : undefined}
          label="Open it in the browser"
          onPress={open}
        />
      </View>
      <Well style={{ flex: props.height === undefined ? 1 : undefined, padding: 6 }}>
        <WebFrame
          height={height()}
          onKeys={(on) => inPage.set(on)}
          onMessage={heard}
          onScale={(next) => scale.set(next)}
          ref={(made) => {
            frame = made;
          }}
          scrollable={props.scrollable}
          src={props.src}
          testID={props.testID}
          title={props.title}
          width={pixels()}
        />
      </Well>
    </View>
  );
}
