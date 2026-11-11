// A theme's roles, as the tokens name them: the names of a theme's file, `ink-faint`, in camel
// case, `inkFaint`. The core owns the list, `ROLES` in `crates/core/src/themes.rs`: a test
// compares this one with the default themes the core reads.
import defaults from "./defaults.json";

export type Mode = "dark" | "light";

/** Every role of a theme, by the name its file gives it. */
export const ROLE_NAMES = [
  "page",
  "raised",
  "sunken",
  "chip",
  "cursor-row",
  "marked",
  "rule",
  "pane-title",
  "ink",
  "ink-quiet",
  "ink-faint",
  "action",
  "on-action",
  "needs-you",
  "changed",
  "added",
  "removed",
  "caution",
  "context",
  "yours",
  "link",
  "working",
  "live",
  "example",
  "sub-agent",
  "heading-1",
  "heading-2",
  "heading-3",
  "code-inline",
  "quote",
  "mode-normal",
  "mode-insert",
  "mode-visual",
  "mode-replace",
  "mode-command",
  "code-ground",
  "syntax-keyword",
  "syntax-string",
  "syntax-comment",
  "syntax-number",
  "syntax-constant",
  "syntax-function",
  "syntax-type",
  "syntax-operator",
  "syntax-property",
  "syntax-punctuation",
  "syntax-tag",
  "syntax-attribute",
  "syntax-variable",
  "backdrop",
  "backdrop-wash-1",
  "backdrop-wash-2",
  "well",
  "rule-quiet",
  "lip",
  "shade",
  "glass-tint",
  "glass-rim",
  "light-focus",
  "light-focus-2",
  "light-running",
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

type Camel<Name extends string> = Name extends `${infer Head}-${infer Tail}`
  ? `${Head}${Capitalize<Camel<Tail>>}`
  : Name;

/** A theme's colours, each `#rrggbb` or `#rrggbbaa`: `role.inkFaint` is the role `ink-faint`. */
export type Roles = { readonly [Name in RoleName as Camel<Name>]: string };

/** What the tokens need of a theme: the record `Themes` gives it, and more. */
export type ThemeSource = {
  /** The theme's id, its file's name without `.toml`. */
  id: string;
  /** `dark` or `light`: anything else is read as dark. */
  mode: string;
  /** Each role's colour, by the name its file gives it. */
  roles: { readonly [name: string]: string };
};

/** The default theme of each mode, as the core reads them: what shows before the server answers. */
export const DEFAULT_THEMES: Record<Mode, ThemeSource> = defaults;

/** The mode of a theme. */
export function modeOf(theme: ThemeSource): Mode {
  return theme.mode === "light" ? "light" : "dark";
}

const camel = (name: string) => name.replace(/-(.)/g, (_, letter: string) => letter.toUpperCase());

/** The roles of `theme`, each one it lacks taken from the default theme of its mode. */
export function rolesOf(theme: ThemeSource): Roles {
  const inherited = DEFAULT_THEMES[modeOf(theme)].roles;
  const roles: Record<string, string> = {};
  for (const name of ROLE_NAMES) {
    roles[camel(name)] = theme.roles[name] ?? inherited[name]!;
  }
  return roles as Roles;
}

/** The roles of `theme` by their file's names, whole: what Rust mixes and shows. */
export function wholeRoles(theme: ThemeSource): Record<string, string> {
  return { ...DEFAULT_THEMES[modeOf(theme)].roles, ...theme.roles };
}
