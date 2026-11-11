// The frame every screen draws in, once the server welcomed the app: the rail of places with the
// sidebar's panes, the two stacks of the page's panes, and the status line, from the layout shell
// (`app/ui/layout/`). The shell gives it the repository's places and panes, and picks what the main
// stack shows when the repository cannot: the first run, a name not in the list, a folder gone.
//
// It follows the theme picked on this device among the server's themes, and keeps the one shown
// for the next start, which draws it from its first frame.
import { computed, effect, Scroll, untracked, View } from "nsh";
import { scheme } from "./boot";
import { ShellKeys } from "./keys";
import { nothingFor } from "./panes";
import { openPicker, Pickers } from "./pickers";
import { PLACES, placeOfPage } from "./places";
import { Sidebar, UsageBar } from "./Sidebar";
import { Branch, modeSlot, StatusEnd } from "./Status";
import "../routes";
import { firstRun, missingFolder, unknownRepository } from "../repository/panes";
import { call, device, navigate, record, redirect, route } from "../../store";
import { type Place, placeOf, Stacks } from "../../ui/layout";
import { applyFonts, applyTheme, pickTheme } from "../../ui/theme";

/** The repository the address names. */
const repo = () => route().repo;

/** The places, the one shown lit. */
function places() {
  const current = placeOfPage(route().page);
  return PLACES.map((one) => ({
    current: one === current,
    icon: one.icon,
    keys: `g ${one.key}`,
    label: one.label,
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
  // The repository shown moves first in the list, once each time it is opened.
  effect(() => {
    const shown = row();
    if (shown !== undefined && !shown.missing) {
      untracked(() => void call("repositories.open", { name: shown.name }).catch(() => undefined));
    }
  });
  // The theme picked on this device, among the server's, kept for the next start's first frame.
  effect(() => {
    const themes = record("Themes", null)()?.themes;
    if (themes === undefined) return;
    const shown = pickTheme(themes, device.get("theme"), scheme());
    untracked(() => {
      if (applyTheme(shown)) device.set("theme.shown", shown);
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
    const own = placeOf(route());
    return own.main.length === 0 ? alone(nothingFor()) : own;
  });

  const shown = () => (row()?.missing === false ? repo() : undefined);
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
      <ShellKeys />
      <Stacks
        place={place()}
        rail={{
          bar,
          onTitle: () => openPicker("repositories"),
          places: places(),
          sidebar,
          title: repo() ?? "Uraeda",
        }}
        status={{ end, mode: modeSlot(), place: repo(), start }}
      />
      <Pickers repo={shown()} />
    </>
  );
}
