// The sandbox's picker: point at anything in the app, and what it is goes on the clipboard, to
// paste to the agent working on the checkout. Drawn in a development run alone (`just sandbox`),
// never in the app a person installs, a test, or a picture.
//
// `Ctrl+Shift+C` starts it, as a browser's "inspect element", and so does the chip at the
// window's corner: the keyboard's selection is outlined and named, then the view under the
// pointer once it moves; a click, or `Ctrl+Shift+C` again, copies it, and Escape leaves. The keys leave a popover or a menu open, where a click on
// the chip would close it.
import { Clipboard, colorScheme, keymap, Overlay, platform, signal, View, windowSize } from "nsh";
import { elementOf, type PickPlace, pickText, selection, under } from "./pickText";
import { followed, type Placed, placed } from "./tracked";
import { pathOf, route } from "../store";
import { Icon, Text } from "../ui/controls";
import { placeOf, titleOf } from "../ui/layout";
import { shownTheme } from "../ui/theme";
import { tokens } from "../ui/tokens";
import { width as widthClass } from "../ui/width";

const KEYS = "ctrl+shift+c";

/** How often the views' places are read again while picking, in ms: the app goes on drawing. */
const AGAIN_MS = 400;

/** How far the pointer goes, in points, before it is a hand pointing. */
const MOVED = 4;

/** How long the bar says what was copied, in ms. */
const SAID_MS = 2500;

/**
 * Whether the picker is drawn: a development run of the app, `just sandbox` or `just app-dev`,
 * which only ever works with a sandbox (`screens/shell/host.ts`). A test, a picture, and the app
 * a person installs are not hot, so nothing is followed there.
 */
export const picks = followed && platform.os !== "web";

/** The sandbox the app works with: `just sandbox`'s, unless `URAEDA_SANDBOX` names another. */
const server = () => process.env.URAEDA_SANDBOX ?? "http://127.0.0.1:4420";

function placeNow(): PickPlace {
  const now = route();
  const panes = placeOf(now);
  const size = windowSize();
  return {
    address: pathOf(now),
    height: size.height,
    mode: colorScheme(),
    page: now.page,
    panes: [...panes.main, ...panes.side].map(titleOf),
    repo: (now as { repo?: string }).repo,
    server: server(),
    theme: shownTheme().id,
    width: size.width,
    widthClass: widthClass(),
  };
}

export function SandboxPick() {
  const picking = signal(false);
  const views = signal<ReadonlyArray<Placed>>([]);
  const pointer = signal<{ x: number; y: number } | null>(null);
  const said = signal("");
  let rest: { x: number; y: number } | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;

  const read = () => void placed().then((all) => views.set(all));
  const chain = () => {
    const at = pointer();
    // Until the pointer moves, the keyboard's selection: the keys alone pick what they are on.
    return at === null ? selection(views()) : under(views(), at.x, at.y);
  };
  const say = (words: string) => {
    said.set(words);
    clearTimeout(quiet);
    quiet = setTimeout(() => said.set(""), SAID_MS);
  };
  const stop = () => {
    picking.set(false);
    clearInterval(timer);
  };
  /**
   * The pointer, once it moves: the layer hears where it rests as it is drawn, which is not a
   * hand pointing, and until then the pick is the keyboard's selection.
   */
  const moved = (at: { x: number; y: number }) => {
    if (pointer() === null) {
      rest ??= at;
      if (Math.abs(at.x - rest.x) + Math.abs(at.y - rest.y) < MOVED) return;
    }
    pointer.set(at);
  };
  const start = () => {
    rest = null;
    pointer.set(null);
    picking.set(true);
    read();
    timer = setInterval(read, AGAIN_MS);
  };
  const copy = () => {
    const found = chain();
    stop();
    if (found.length === 0) return say("Nothing to pick there");
    const text = pickText(found, views(), placeNow());
    Clipboard.writeText(text).then(
      () => say(`Copied: ${elementOf(found[0]!)}`),
      (error: Error) => say(`Not copied: ${error.message}`),
    );
  };

  keymap.bind(KEYS, () => (picking() ? copy() : start()), { when: "always" });
  keymap.bind("escape", () => stop(), { passThrough: true, when: "always" });

  const outline = () => chain()[0];
  const words = () =>
    said() !== ""
      ? said()
      : picking()
        ? outline() === undefined
          ? "Nothing selected: point at something · Esc leaves"
          : `${elementOf(outline()!)} · click or ${keymap.label(KEYS)} copies`
        : `Pick an element · ${keymap.label(KEYS)}`;
  const chip = () => (
    <View
      onPress={() => (picking() ? stop() : start())}
      style={{
        alignItems: "center",
        backgroundColor: tokens.role.page,
        borderColor: picking() ? tokens.role.action : tokens.role.rule,
        borderWidth: 1,
        bottom: 36,
        flexDirection: "row",
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        pointerEvents: picking() ? "none" : "auto",
        position: "absolute",
        right: 12,
      }}
      testID="sandbox-pick"
    >
      <Text colour={tokens.role.caution}>Sandbox</Text>
      <Icon colour={tokens.role.inkQuiet} name="mouse-pointer-click" />
      <Text lines={1} tone={picking() ? "ink" : "quiet"}>
        {words()}
      </Text>
    </View>
  );
  // While picking, an overlay of Native Shell's, mounted last: over the menus, the popovers and
  // the dialogs open then, which stay open under it, so what they hold is picked too.
  return (
    <If
      when={picking()}
      else={
        <View
          style={{
            bottom: 0,
            left: 0,
            pointerEvents: "box-none",
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 1000,
          }}
        >
          {chip()}
        </View>
      }
    >
      <Overlay style={{ bottom: 0, left: 0, right: 0, top: 0 }}>
        <View
          onMouseMove={(event) => moved(event.pagePosition)}
          onPress={(event) => {
            pointer.set(event.pagePosition);
            copy();
          }}
          style={{
            bottom: 0,
            cursor: "crosshair",
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
          }}
          testID="sandbox-pick-layer"
        >
          <If when={outline()}>
            {(view) => (
              <View
                style={{
                  borderColor: tokens.role.action,
                  borderWidth: 2,
                  height: view().height,
                  left: view().x,
                  pointerEvents: "none",
                  position: "absolute",
                  top: view().y,
                  width: view().width,
                }}
              />
            )}
          </If>
          {chip()}
        </View>
      </Overlay>
    </If>
  );
}
