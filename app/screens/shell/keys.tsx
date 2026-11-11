// The leader's tree and the go keys, declared where the frame is drawn: each runs what a press in
// the frame runs. The places (`g <key>`, and `Space <key>` but for New), the shell's and the
// built-in extensions' (`app/extensions/builtins/`), the repositories' switcher (`Space r`, `g r`),
// New (`Space n s`, `c`, `f`, and the inbox's `Space n i`), Find (`Space Space`, `Space f f`, `Space f s`),
// the look (`Space u m` the mode, `Space u t` the theme, `Space u f <key>` a part's font, `Space u
// f d` the default fonts), and Back (`b`). The key map's `?` is the keys' host's own.
import { openPicker } from "./pickers";
import { BUILT_INS } from "../../extensions/builtins";
import { leaderKeys } from "../../extensions/contributions";
import { back, device, navigate } from "../../store";
import { type KeySpec, registerKey } from "../../ui/keys";
import { chooseMode, themeChoice } from "../settings/look";
import { applyFonts } from "../../ui/theme";
import { FONT_ROLES } from "../../ui/tokens";

/** The mode after each: the system's, then light, then dark, then the system's again. */
const NEXT = { dark: "system", light: "dark", system: "light" } as const;

/** Each part's key after `Space u f`: its label's first letter. */
const FONT_KEYS: Record<string, string> = {
  body: "i",
  code: "c",
  heading: "h",
  markdown: "m",
  reading: "p",
};

/** A key that goes to a place. */
const go = (keys: string, label: string, icon: string, to: Parameters<typeof navigate>[0]) => ({
  icon,
  keys,
  label,
  run: () => navigate(to),
});

/** The shell's own places: Home and Settings, `g` and `Space` with their key, and New, `g n`. */
function shellPlaceKeys(): KeySpec[] {
  return [
    go("g h", "Home", "house", { page: "home" }),
    go("space h", "Home", "house", { page: "home" }),
    go("g n", "New", "plus", { page: "new" }),
    go("g ,", "Settings", "settings", { page: "settings" }),
    go("space ,", "Settings", "settings", { page: "settings" }),
  ];
}

/**
 * The built-ins' keys, their places' and their own, each listed and on only while its extension is
 * on in the repository shown, and kept for it while it is off: no extension of the owner's takes
 * one (`../extension/keys.tsx`), so turning a built-in on again never finds its key taken.
 */
function builtInKeys(on: (name: string) => boolean): KeySpec[] {
  return BUILT_INS.flatMap((builtIn) => {
    const when = () => on(builtIn.name);
    const places: KeySpec[] = builtIn.places.flatMap((place) =>
      ["g", "space"].map((prefix) => ({
        icon: place.icon,
        keys: `${prefix} ${place.key}`,
        label: place.title,
        run: () => navigate(place.to),
        when,
      })),
    );
    const own = builtIn.keys.map((key) =>
      Object.assign({}, key, { keys: leaderKeys(key.keys), when }),
    );
    return places.concat(own);
  });
}

function lookKeys(): KeySpec[] {
  return [
    {
      icon: "palette",
      keys: "space u m",
      label: "Mode",
      run: () => chooseMode(NEXT[themeChoice().mode]),
    },
    { icon: "palette", keys: "space u t", label: "Theme…", run: () => openPicker("themes") },
    ...FONT_ROLES.map(({ label, role }) => ({
      icon: "palette" as const,
      keys: `space u f ${FONT_KEYS[role] ?? role[0]}`,
      label: `${label}…`,
      run: () => openPicker({ font: role, label }),
    })),
    {
      icon: "palette",
      keys: "space u f d",
      label: "Default fonts",
      run: () => {
        device.set("fonts", undefined);
        applyFonts(undefined);
      },
    },
  ];
}

/**
 * Declares the shell's keys while the frame is drawn. `on` says whether an extension is on in the
 * repository shown, read as a key comes: it reads no record itself.
 */
export function ShellKeys(props: { on: (name: string) => boolean }) {
  registerKey([
    ...shellPlaceKeys(),
    ...builtInKeys(props.on),
    {
      // The leader's one hint, "space menu": it shows while the sequences are on.
      hint: "space",
      hintLabel: "menu",
      hintPress: "space",
      icon: "layers",
      keys: "space r",
      label: "Switch repository…",
      run: () => openPicker("repositories"),
    },
    {
      icon: "layers",
      keys: "g r",
      label: "Switch repository…",
      run: () => openPicker("repositories"),
    },
    {
      icon: "message-square",
      keys: "space n s",
      label: "Session",
      run: () => navigate({ kind: "session", page: "new" }),
    },
    {
      icon: "git-branch",
      keys: "space n c",
      label: "Change",
      run: () => navigate({ kind: "change", page: "new" }),
    },
    {
      icon: "flag",
      keys: "space n f",
      label: "Feature",
      run: () => navigate({ kind: "feature", page: "new" }),
    },
    { icon: "search", keys: "space space", label: "Find anything…", run: () => openPicker("all") },
    {
      icon: "flag",
      keys: "space f f",
      label: "Features and changes…",
      run: () => openPicker("features"),
    },
    {
      icon: "message-square",
      keys: "space f s",
      label: "Sessions…",
      run: () => openPicker("sessions"),
    },
    ...lookKeys(),
    // Back, on every page, with no hint: nothing before the first visit, and the key does nothing.
    { keys: "b", label: "Back", run: () => (back() ? undefined : false) },
  ]);
  return null;
}
