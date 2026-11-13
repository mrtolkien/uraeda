// What every part of the tokens is made from: a theme's roles in its mode, and what Rust mixes
// from them, `crates/app/src/theme/mixing.rs`.
import { mixTheme } from "uraeda/native";
import { type Mode, modeOf, type Roles, rolesOf, type ThemeSource, wholeRoles } from "./roles";

/** What Rust mixes from a theme's roles: glass's tint and shares, a key's block, a well's shade. */
export type Mixed = ReturnType<typeof mixTheme>;

export type Source = {
  mode: Mode;
  /** Glow needs darkness: a light theme draws ink in its place. */
  dark: boolean;
  role: Roles;
  mixed: Mixed;
  /** What shade and shadows are made of: black, or a light theme's dark ink. */
  black: string;
};

/** The source of `theme`. It throws when one of its roles is no colour. */
export function sourceOf(theme: ThemeSource): Source {
  const mode = modeOf(theme);
  const mixed = mixTheme(JSON.stringify(wholeRoles(theme)), mode);
  return { mode, dark: mode === "dark", role: rolesOf(theme), mixed, black: mixed.black };
}
