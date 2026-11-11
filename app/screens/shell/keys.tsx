// The leader's tree and the go keys, declared where the frame is drawn: each runs what a press in
// the frame runs. The places (`g <key>`, and `Space <key>` but for New), the repositories' switcher
// (`Space r`, `g r`), New (`Space n s`, `c`, `f`), Find (`Space Space`, `Space f f`, `Space f s`),
// the look (`Space u m` the mode, `Space u t` the theme, `Space u f <key>` a part's font, `Space u
// f d` the default fonts), and Back (`b`). The key map's `?` is the keys' host's own.
import { openPicker } from "./pickers";
import { PLACES } from "./places";
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

function placeKeys(): KeySpec[] {
  return PLACES.flatMap((place) => {
    const prefixes = place.goOnly === true ? ["g"] : ["g", "space"];
    return prefixes.map((prefix) => ({
      icon: place.icon,
      keys: `${prefix} ${place.key}`,
      label: place.label,
      run: () => navigate(place.to),
    }));
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

/** Declares the shell's keys while the frame is drawn. */
export function ShellKeys() {
  registerKey([
    ...placeKeys(),
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
    {
      icon: "inbox",
      keys: "space n i",
      label: "Note",
      run: () => navigate({ page: "inbox" }, { focus: "text" }),
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
