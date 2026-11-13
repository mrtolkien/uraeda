// The frame every screen draws in, once the server welcomed the app: the rail of places with the
// sidebar's panes, the two stacks of the page's panes, and the status line, from the layout shell
// (`app/ui/layout/`). The shell gives it the repository's places and panes, and picks what the main
// stack shows when the repository cannot: the first run, a name not in the list, a folder gone.
//
// It follows the theme picked on this device among the server's themes, and keeps the one shown
// for the next start, which draws it from its first frame.
import { computed, effect, Scroll, untracked, View } from "nsh";
import { deviceTheme, followsSystem, keepsShownTheme, scheme } from "./boot";
import { ShellKeys } from "./keys";
import { NeedsYouToasts, Notifier } from "./Notifications";
import { DroppedFiles } from "../../web/Drops";
import { nothingFor } from "./panes";
import { openPicker, Pickers } from "./pickers";
import { placesIn } from "./places";
import { Sidebar, UsageBar } from "./Sidebar";
import { Branch, modeSlot, StatusEnd } from "./Status";
import { UndoKeys, UndoQuestion, UndoToast } from "./Undo";
import { LandingWrites, RefusedWrites } from "./Writes";
import "../routes";
import { ExtensionKeys, offPlace } from "../extension";
import { isOnIn } from "../../extensions/contributions";
import { ReadAllDeclarations } from "../../extensions/ExtensionPlace";
import { FollowKeyboard } from "../settings/follow";
import { firstRun, missingFolder, unknownRepository } from "../repository/panes";
import { call, device, navigate, record, redirect, route } from "../../store";
import { type Around, aroundOf, type Place, placeOf, Stacks } from "../../ui/layout";
import { Toasts } from "../../ui/surfaces";
import { applyFonts, applyTheme, followSystem, pickTheme } from "../../ui/theme";

/** The repository the address names. */
const repo = () => route().repo;

/** The places of the repository shown, the one shown lit. */
function places(shownRepo: string | undefined) {
  const now = route();
  return placesIn(shownRepo).map((one) => ({
    count: one.count?.(),
    current: one.holds(now),
    icon: one.icon,
    // As the rail writes them, tight: `gi`, and `␣w` for a key after the leader.
    keys: one.keys[0]?.replace(/^space /, "␣ "),
    label: one.label,
    onPhone: one.onPhone,
    onPress: () => navigate(one.to),
  }));
}

/** The main stack holding one pane, in place of the page's. */
const alone = (pane: Place["main"][number]): Place => ({ main: [pane], side: [] });

export function Frame() {
  const repositories = record("Repositories", null);
  const rows = () => repositories()?.rows;
  const row = () => rows()?.find((one) => one.name === repo());

  // An address that names no repository opens the one opened last.
  effect(() => {
    const first = rows()?.[0];
    if (repo() === undefined && first !== undefined) {
      untracked(() => redirect({ ...route(), repo: first.name }));
    }
  });
  // The repository shown moves first in the list, once each time it is opened: by its name, not
  // its row, which every navigation makes again, and asked the server for at each page.
  const opened = computed(() => {
    const shown = row();
    return shown === undefined || shown.missing ? undefined : shown.name;
  });
  effect(() => {
    const name = opened();
    if (name !== undefined) {
      untracked(() => void call("repositories.open", { name }).catch(() => undefined));
    }
  });
  // The theme picked on this device, among the server's, kept for the next start's first frame.
  effect(() => {
    const themes = record("Themes", null)()?.themes;
    if (themes === undefined) return;
    // Before the system's mode is read: a device back on "System" hands the appearance back.
    followSystem(followsSystem());
    const shown = pickTheme(themes, deviceTheme(), scheme());
    untracked(() => {
      if (applyTheme(shown) && keepsShownTheme()) device.set("theme.shown", shown);
    });
  });
  effect(() => applyFonts(device.get("fonts")));

  const place = computed((): Place | undefined => {
    const listed = rows();
    if (listed === undefined) return { main: [], side: [] };
    if (listed.length === 0) return alone(firstRun({}));
    const name = repo();
    if (name === undefined) return { main: [], side: [] };
    const found = row();
    if (found === undefined) return alone(unknownRepository({ name }));
    if (found.missing) return alone(missingFolder({ name, path: found.home }));
    const off = offPlace(route());
    if (off !== undefined) return off;
    const own = placeOf(route());
    return own.main.length === 0 ? alone(nothingFor()) : own;
  });
  // What the page draws beside its panes, while they are its own: kept while its key stays.
  const around = computed((): ReadonlyArray<Around> => {
    const own = placeOf(route());
    const drawn = place();
    const shared = own.main.length > 0 && drawn?.main[0]?.key === own.main[0]?.key;
    const found = shared ? aroundOf(route()) : undefined;
    return found === undefined ? [] : [found];
  });

  const shown = () => (row()?.missing === false ? repo() : undefined);
  // The extensions of the repository shown, held here, where the keys' guards read them.
  const extensions = computed(() => {
    const name = shown();
    return name === undefined ? undefined : record("Extensions", { repo: name })()?.extensions;
  });
  const isOnHere = (name: string) => {
    const here = shown();
    return here !== undefined && isOnIn(extensions(), name, here);
  };
  const end = <StatusEnd repo={shown()} />;
  const start = <Branch repo={shown()} />;
  const sidebar = (
    <If when={shown()}>
      {(name) => (
        <Scroll style={{ flex: 1 }}>
          <View style={{ gap: 10 }}>
            <Sidebar repo={name()} />
          </View>
        </Scroll>
      )}
    </If>
  );
  const bar = <If when={shown()}>{(name) => <UsageBar repo={name()} />}</If>;

  return (
    <>
      <ShellKeys on={isOnHere} />
      <FollowKeyboard />
      <Stacks
        place={place()}
        rail={{
          bar,
          onTitle: () => openPicker("repositories"),
          places: places(shown()),
          sidebar,
          title: repo() ?? "Uraeda",
        }}
        status={{ end, mode: modeSlot(), place: repo(), start }}
      />
      <Each key={(one: Around) => one.key} of={around()}>
        {(one) => untracked(one).view()}
      </Each>
      <Pickers repo={shown()} />
      <UndoKeys />
      <If when={shown()}>
        {(name) => (
          <>
            <ExtensionKeys repo={name()} />
            <ReadAllDeclarations repo={name()} />
            <If when={isOnHere("notifications")}>
              <Notifier />
            </If>
          </>
        )}
      </If>
      {/* The toasts, the most important first: what was refused, what needs the human, what
          was done, and what lands. */}
      <Toasts>
        <RefusedWrites />
        <NeedsYouToasts />
        <UndoToast />
        <LandingWrites />
        <DroppedFiles />
      </Toasts>
      <UndoQuestion />
    </>
  );
}
