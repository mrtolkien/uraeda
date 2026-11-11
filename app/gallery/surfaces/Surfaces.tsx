// The surfaces' gallery pages, on the real renderer: one page, which draws the page and the theme
// its host names, at the window's width. `just gallery-shots` takes their pictures on the hidden
// display, in both themes, at a desktop's and a phone's width. The gallery app (task 35) takes
// these pages in.
import { colorScheme, host, type JSX, mount, windowSize } from "nsh";
import { heights } from "./heights";
import { corner, dialog, popover, sheet, tip, toasts } from "./overlays";
import { states } from "./states";
import { Backdrop } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, type Tokens, tokensOf } from "../../ui/tokens";

/** The pages, by the name a picture is saved under: each takes whether the window is narrow. */
export const PAGES: Record<string, (v: Tokens, narrow: boolean) => JSX.Element> = {
  heights,
  states,
  dialog,
  sheet,
  popover,
  toasts,
  corner,
  tip,
};

function Surfaces() {
  const v = tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]);
  // The surfaces read the tokens shown: the page shows the theme it draws.
  showTokens(v);
  const page = PAGES[String(host.params.page)] ?? heights;
  return <Backdrop>{page(v, windowSize().width < 768)}</Backdrop>;
}

mount(Surfaces);
