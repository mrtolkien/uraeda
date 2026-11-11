// The lists' gallery pages, on the real renderer: one page, which draws the page and the theme its
// host names, at the window's width. `just gallery-shots` takes their pictures on the hidden
// display, in both themes, at a desktop's and a phone's width, and `just lists-frames` times the
// list of 20,000 rows scrolling. The gallery app (task 35) takes these pages in.
import { colorScheme, host, type JSX, mount, windowSize } from "nsh";
import { cards } from "./cards";
import { order } from "./order";
import { rows } from "./rows";
import { scroll } from "./scroll";
import { table } from "./table";
import { KeysHost } from "../../ui/keys/KeysHost";
import { Backdrop } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, tokensOf } from "../../ui/tokens";

/** The pages, by the name a picture is saved under: each takes whether the window is narrow. */
export const PAGES: Record<string, (narrow: boolean) => JSX.Element> = {
  cards,
  order,
  rows,
  scroll,
  table,
};

function Lists() {
  showTokens(tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]));
  const page = PAGES[String(host.params.page)] ?? rows;
  return (
    <KeysHost>
      <Backdrop>{page(windowSize().width < 768)}</Backdrop>
    </KeysHost>
  );
}

mount(Lists);
