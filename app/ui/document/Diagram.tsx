// A Mermaid diagram, drawn in Rust by Merman as a picture of shapes, in the theme's colours: a
// theme change draws it again. It never runs a script. One Merman cannot read, or that takes more
// than 2 seconds, shows its source as code, and why, as the diagrams decision asks.
//
// The app draws it itself, but in a browser: its web build leaves Merman out, 3 MB every first
// load would carry, and asks the server that served the page, which links the same drawing
// (`POST /diagram`). The browser sends its session's cookie with it.
import { effect, Image, platform, Scroll, signal, Text, View } from "nsh";
import { type DiagramPicture, diagramPicture } from "uraeda/native";
import { tokens } from "../tokens";
import { Code } from "./Code";
import { measure, prose } from "./look";

/**
 * How long a diagram may take before its source shows: in a browser the server keeps the 2
 * seconds, and the way there gets one more.
 */
const PATIENCE = platform.os === "web" ? 3000 : 2000;

/** A colour as Mermaid reads it: `#rrggbb`, a theme's alpha dropped. */
const solid = (colour: string) => colour.slice(0, 7);

/** Mermaid's theme variables, from the theme's roles: boxes a step up from the page, ink on them. */
function colours() {
  const role = tokens.role;
  const pairs: Array<[string, string]> = [
    ["background", role.page],
    ["mainBkg", role.chip],
    ["primaryColor", role.chip],
    ["primaryTextColor", role.ink],
    ["primaryBorderColor", role.rule],
    ["secondaryColor", role.raised],
    ["secondaryTextColor", role.ink],
    ["secondaryBorderColor", role.rule],
    ["tertiaryColor", role.sunken],
    ["tertiaryTextColor", role.ink],
    ["tertiaryBorderColor", role.ruleQuiet],
    ["lineColor", role.inkQuiet],
    ["textColor", role.ink],
    ["nodeBorder", role.rule],
    ["clusterBkg", role.sunken],
    ["clusterBorder", role.ruleQuiet],
    ["edgeLabelBackground", role.page],
    ["titleColor", role.heading2],
    ["noteBkgColor", role.raised],
    ["noteTextColor", role.ink],
    ["noteBorderColor", role.rule],
    ["actorBkg", role.chip],
    ["actorBorder", role.rule],
    ["actorTextColor", role.ink],
    ["actorLineColor", role.inkQuiet],
    ["signalColor", role.inkQuiet],
    ["signalTextColor", role.ink],
    ["labelBoxBkgColor", role.chip],
    ["labelBoxBorderColor", role.rule],
    ["labelTextColor", role.ink],
    ["loopTextColor", role.ink],
    ["activationBkgColor", role.raised],
    ["activationBorderColor", role.rule],
  ];
  return pairs.map(([name, value]) => ({ name, value: solid(value) }));
}

type Colours = ReturnType<typeof colours>;

/** The server's picture, for a browser: the page's own origin, signed in by its cookie. */
async function served(source: string, theme: Colours): Promise<DiagramPicture> {
  const answer = await fetch("/diagram", {
    body: JSON.stringify({ colours: theme, source }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const said = (await answer.json().catch(() => ({}))) as DiagramPicture & { error?: string };
  if (!answer.ok) throw new Error(said.error ?? `the server answered ${answer.status}`);
  return said;
}

/** The picture, drawn here, or by the server in a browser. */
const draw = platform.os === "web" ? served : diagramPicture;

type Drawn = { picture: DiagramPicture } | { failed: string } | undefined;

export function Diagram(props: { source: string }) {
  const drawn = signal<Drawn>(undefined);
  effect(() => {
    // Read here, so a theme change draws it again.
    const theme = colours();
    let done = false;
    const late = setTimeout(() => {
      if (!done) drawn.set({ failed: "it took more than 2 seconds" });
      done = true;
    }, PATIENCE);
    draw(props.source, theme).then(
      (picture) => {
        if (!done) drawn.set({ picture });
        done = true;
        clearTimeout(late);
      },
      (error: unknown) => {
        if (!done) drawn.set({ failed: String(error).replace(/^Error: /, "") });
        done = true;
        clearTimeout(late);
      },
    );
  });
  const shown = () => drawn();
  return (
    <View>
      {(() => {
        const now = shown();
        if (now === undefined) {
          // Room for it while it is drawn, a moment: no jump of the text under it.
          return <View style={{ height: tokens.type.proseLine * 4 }} />;
        }
        if ("failed" in now) {
          return (
            <View style={{ gap: 6 }}>
              <Text style={[prose(tokens.role.inkQuiet), { maxWidth: measure() }]}>
                {`The diagram could not be drawn: ${now.failed}. Its source:`}
              </Text>
              <Code code={props.source} language="mermaid" />
            </View>
          );
        }
        return (
          <Scroll horizontal style={{ flexGrow: 0 }}>
            <Image
              accessibilityLabel="A diagram"
              src={now.picture.src}
              style={{ height: now.picture.height, width: now.picture.width }}
              testID="diagram-picture"
            />
          </Scroll>
        );
      })()}
    </View>
  );
}
