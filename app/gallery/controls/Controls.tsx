// The controls' gallery pages, on the real renderer: one page, which draws the page and the theme
// its host names, at the window's width. `just gallery-shots` takes their pictures on the hidden
// display, in both themes, at a desktop's and a phone's width. The gallery app (task 35) takes
// these pages in.
import { colorScheme, host, type JSX, mount, windowSize } from "nsh";
import { buttons } from "./buttons";
import { choices } from "./choices";
import { icons } from "./icons";
import { menu, select } from "./open";
import { words } from "./words";
import { Backdrop } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, tokensOf } from "../../ui/tokens";

/** The pages, by the name a picture is saved under: each takes whether the window is narrow. */
export const PAGES: Record<string, (narrow: boolean) => JSX.Element> = {
  buttons,
  choices,
  icons,
  menu,
  select,
  words,
};

function Controls() {
  showTokens(tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]));
  const page = PAGES[String(host.params.page)] ?? buttons;
  return <Backdrop>{page(windowSize().width < 768)}</Backdrop>;
}

mount(Controls);
