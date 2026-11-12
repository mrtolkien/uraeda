// The one view of the app that shows a web page: a preview's story, a mockup, a project's
// Storybook. Nothing else draws a web view or a frame. On GTK it is Native Shell's web view, a
// WebKitGTK page drawn inside the app's own views: its pane clips it, and a dialog or the leader
// menu draws over it. On the web (task 57) it becomes a sandboxed frame, with the same props.
//
// The page lays out at `width`, its own width in CSS pixels, scaled down to fit its room and
// never up, centred: a phone's story shows at a phone's size. While it loads it says so; a load
// that fails says why in its place, and how to try again.
//
// Keys: the page takes the keys once it has the focus, by a press in it, or Tab, GTK's own way
// between what takes the focus, and keeps them until Escape, which the page does not use, gives
// them back to the app. The page says when it gains and loses them, `onKeys`, so the screen's
// status line says how to leave. `focus()` gives them by a key on the web and macOS; on GTK,
// Native Shell focuses its text fields and, since 0.5.0, the views Tab stops at, never a web
// view: there it does nothing (rulings R341 and R422).
//
// Messages: the page posts with `window.nsh.postMessage(text)`, or, as a story's pick script
// does, `window.parent.postMessage({ uraeda })`, which at the top is the page itself: both reach
// `onMessage`, parsed from JSON when they are. `post(value)` sends the page a `message` event,
// as an object a frame's parent would send.
import { cleanup, signal, View, WebView, type WebViewRef } from "nsh";
import { Banner, Button, Spinner } from "../controls";
import { Surface } from "./Surface";

/** What a screen does with the page it shows. */
export type WebFrameRef = {
  /** Gives the keys to the page, as a press in it does: not on GTK, where Tab does. */
  focus(): void;
  /** Loads the page again. */
  reload(): void;
  /** Sends the page a message: a `message` event on its window, with `value` as its data. */
  post(value: unknown): void;
};

export type WebFrameProps = {
  /** Its height: its room's whole without one. */
  height?: number;
  /** A page given whole, in place of `src`: the gallery's, which has no server to ask. */
  html?: string;
  /** What the page says, parsed from JSON when it is. */
  onMessage?: (data: unknown) => void;
  /** The page took the keys, or gave them back. */
  onKeys?: (inPage: boolean) => void;
  /** The scale the page is drawn at, once its room is measured: 1 when it fits. */
  onScale?: (scale: number) => void;
  ref?: (frame: WebFrameRef) => void;
  /** Whether the wheel scrolls the page, rather than what holds it. */
  scrollable?: boolean;
  /** The page's whole address. */
  src?: string;
  testID?: string;
  /** What it shows, in words: "Dragging, a story". */
  title: string;
  /** The width the page lays out at, in CSS pixels: its room's without one. */
  width?: number;
};

/**
 * Run in the page before its own scripts: it tells the app when the page gains and loses the
 * keys, passes on what a story's pick script posts to its parent, and gives the page what the app
 * posts as the object a parent window would send.
 */
const BRIDGE = `(() => {
  const send = (message) => window.nsh && window.nsh.postMessage(JSON.stringify(message));
  window.addEventListener("focus", () => send({ uraeda: "keys", on: true }));
  window.addEventListener("blur", () => send({ uraeda: "keys", on: false }));
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (typeof data === "string") {
      try {
        const sent = JSON.parse(data);
        if (sent && typeof sent === "object") window.postMessage(sent, "*");
      } catch {}
    } else if (data && ["ready", "size", "picked", "pick-stopped"].includes(data.uraeda)) {
      send(data);
    }
  });
})();`;

/** A message's data, parsed when it is JSON. */
function parsed(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function WebFrame(props: WebFrameProps) {
  const room = signal<{ height: number; width: number } | undefined>(undefined);
  const loading = signal(true);
  const failed = signal<string | undefined>(undefined);
  let web: WebViewRef | undefined;
  // A layout or a message may come after the frame is gone, as its pane closes: nothing hears it.
  let live = true;
  cleanup(() => {
    live = false;
  });

  const scale = () => {
    const size = room();
    if (size === undefined || props.width === undefined) return 1;
    return Math.min(1, size.width / props.width);
  };
  const height = () => props.height ?? room()?.height ?? 0;
  const pageWidth = () => props.width ?? room()?.width ?? 0;

  props.ref?.({
    focus: () => web?.focus(),
    // Native Shell's `postMessage` reaches the page shown, and takes no origin: not a window's.
    // oxlint-disable-next-line unicorn/require-post-message-target-origin
    post: (value) => web?.postMessage(JSON.stringify(value)),
    // A page that failed is drawn again, which loads it.
    reload: () => (failed() === undefined ? web?.reload() : failed.set(undefined)),
  });

  const heard = (data: string) => {
    if (!live) return;
    const message = parsed(data);
    if (typeof message === "object" && message !== null && "uraeda" in message) {
      const { on, uraeda } = message as { on?: unknown; uraeda: unknown };
      if (uraeda === "keys") {
        props.onKeys?.(on === true);
        return;
      }
    }
    props.onMessage?.(message);
  };

  return (
    <View
      onLayout={(event) => {
        if (!live) return;
        const { height: tall, width: wide } = event.bounds.size;
        room.set({ height: tall, width: wide });
        props.onScale?.(props.width === undefined ? 1 : Math.min(1, wide / props.width));
      }}
      style={{
        alignItems: "center",
        flex: props.height === undefined ? 1 : undefined,
        height: props.height,
        overflow: "hidden",
      }}
      testID={props.testID}
    >
      <If when={room() !== undefined && failed() === undefined}>
        <View
          style={{
            height: height(),
            overflow: "hidden",
            width: pageWidth() * scale(),
          }}
        >
          <WebView
            accessibilityLabel={props.title}
            injectedJavaScriptBeforeContentLoaded={BRIDGE}
            onError={(event) => {
              if (!live) return;
              loading.set(false);
              failed.set(event.message);
            }}
            onLoad={() => live && loading.set(false)}
            onLoadStart={() => {
              if (!live) return;
              loading.set(true);
              failed.set(undefined);
            }}
            onMessage={(event) => heard(event.data)}
            ref={(node) => {
              web = node;
            }}
            html={props.html}
            scrollable={props.scrollable}
            src={props.html === undefined ? props.src : undefined}
            style={{
              height: height() / scale(),
              left: 0,
              position: "absolute",
              top: 0,
              transform: scale() === 1 ? "none" : `scale(${scale()})`,
              transformOrigin: "top left",
              width: pageWidth(),
            }}
          />
        </View>
      </If>
      <If when={failed()}>
        {(message) => (
          <View style={{ alignSelf: "stretch", padding: 12 }}>
            <Banner
              action={
                <Button
                  icon="refresh-cw"
                  label="Load it again"
                  onPress={() => failed.set(undefined)}
                />
              }
              title={`${props.title} did not load`}
              tone="danger"
            >
              {message()}
            </Banner>
          </View>
        )}
      </If>
      <If when={loading() && failed() === undefined}>
        <Surface
          height="raised"
          style={{
            left: 12,
            paddingHorizontal: 10,
            paddingVertical: 6,
            position: "absolute",
            top: 12,
          }}
        >
          <Spinner label={`Loading ${props.title}`} />
        </Surface>
      </If>
    </View>
  );
}
