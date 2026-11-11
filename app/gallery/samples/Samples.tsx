// The design language's samples, on the real renderer: one page, which draws the sample and the
// theme its host names, from the tokens of `app/ui/tokens/`. `just samples-shots` takes their
// pictures on the hidden display. It is a throwaway: the gallery replaces it once the component
// library exists.
import { colorScheme, host, type JSX, mount } from "nsh";
import { buttons } from "./buttons";
import { dialog } from "./dialog";
import { glassBar } from "./glassbar";
import { heights } from "./heights";
import { list } from "./list";
import { panes } from "./panes";
import { bare } from "./parts";
import { scene } from "./session";
import { status } from "./status";
import { Backdrop } from "../../ui/surfaces";
import { DEFAULT_THEMES, type Mode, showTokens, type Tokens, tokensOf } from "../../ui/tokens";

/** The eight samples, by the name a picture is saved under. */
export const SAMPLES: Record<string, (v: Tokens) => JSX.Element> = {
  heights,
  panes,
  glass: (v) => glassBar(v, Number(host.params.rows ?? 400), host.params.bar !== false),
  buttons,
  dialog,
  list,
  status: (v) => status(v, host.params.only === true),
  session: (v) => scene(v),
};

function Samples() {
  const v = tokensOf(DEFAULT_THEMES[(host.params.theme as Mode | undefined) ?? colorScheme()]);
  // The surfaces read the tokens shown: the page shows the theme it draws.
  showTokens(v);
  const sample = SAMPLES[String(host.params.sample)] ?? SAMPLES.session!;
  host.on("bare", () => bare.set(true));
  return <Backdrop>{sample(v)}</Backdrop>;
}

mount(Samples);
