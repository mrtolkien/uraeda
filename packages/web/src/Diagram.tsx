// A `mermaid` code block drawn as a diagram (`specs/decisions/diagrams.md`): `mermaid` is imported
// only when a page holds one, into a chunk of its own, and draws at its `sandbox` security level,
// in a frame without scripts or the app's origin, since a diagram's text comes from files an agent
// writes.
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Text } from "@astryxdesign/core/Text";
import { useTheme } from "@astryxdesign/core/theme";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useRef, useState } from "react";
import { useWidthOf } from "./layout/useWidthOf.ts";

const styles = stylex.create({
  block: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  failed: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: 0,
  },
  frame: (width: string, height: string) => ({
    borderWidth: 0,
    // The frame's document has no colour scheme of its own: the frame says the same, or the
    // browser paints it an opaque white backdrop in the dark mode.
    colorScheme: "light",
    display: "block",
    height,
    // As wide as the diagram, and the card at least: past the card, the card scrolls, not the page.
    minWidth: "100%",
    width,
  }),
  scroller: {
    // A diagram wider than its card scrolls sideways inside it.
    maxWidth: "100%",
    overflowX: "auto",
  },
});

/**
 * The frame's sandbox, Mermaid's own (`allow-top-navigation-by-user-activation allow-popups`), set
 * here so a later Mermaid cannot loosen it: no scripts, and not the app's origin.
 */
const SANDBOX = "allow-popups allow-top-navigation-by-user-activation";

/** A diagram drawn: the frame's `data:` document, and its size in pixels. */
type Drawn = { height: number; src: string; width: number };

/**
 * The frame Mermaid's `sandbox` level returns, as markup: its `data:` document, and the diagram's
 * size, from its SVG's `viewBox`. Anything else is not a diagram drawn.
 */
function drawnFrom(markup: string): Drawn {
  const frame = new DOMParser().parseFromString(markup, "text/html").querySelector("iframe");
  const src = frame?.getAttribute("src") ?? "";
  if (!src.startsWith("data:text/html;")) {
    throw new Error("Mermaid returned no sandboxed frame");
  }
  const encoded = atob(src.slice(src.indexOf(",") + 1));
  const document = new TextDecoder().decode(Uint8Array.from(encoded, (c) => c.charCodeAt(0)));
  const box = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+) ([\d.]+)"/.exec(document);
  return { height: Number(box?.[2] ?? 150), src, width: Number(box?.[1] ?? 0) };
}

/** Draws `source` with Mermaid, imported on demand, in the theme of the colour mode. */
async function draw(id: string, source: string, dark: boolean): Promise<Drawn> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    securityLevel: "sandbox",
    startOnLoad: false,
    // A source that does not parse throws, rather than drawing Mermaid's error picture.
    suppressErrorRendering: true,
    theme: dark ? "dark" : "neutral",
  });
  const { svg } = await mermaid.render(id, source);
  return drawnFrom(svg);
}

/**
 * A Mermaid diagram, drawn in a sandboxed frame titled "Diagram", which scrolls sideways inside its
 * card. A source that does not parse, or a `mermaid` that does not load, shows the source as code
 * under "This diagram could not be drawn."
 */
export function Diagram({ source }: { source: string }) {
  const dark = useTheme().mode === "dark";
  // An id of letters, digits, and dashes, unique on the page: Mermaid selects by it.
  const id = `diagram-${useId().replaceAll(/[^\w-]/g, "")}`;
  const [drawn, setDrawn] = useState<Drawn | "failed" | undefined>(undefined);
  const scroller = useRef<HTMLDivElement>(null);
  const room = useWidthOf(scroller);
  useEffect(() => {
    let live = true;
    draw(id, source, dark).then(
      (result) => live && setDrawn(result),
      () => live && setDrawn("failed"),
    );
    return () => {
      live = false;
    };
  }, [dark, id, source]);
  if (drawn === "failed") {
    return (
      <div {...stylex.props(styles.block)}>
        <Text as="p" display="block" type="inherit" xstyle={styles.failed}>
          This diagram could not be drawn.
        </Text>
        <CodeBlock code={source} language="mermaid" width="100%" />
      </div>
    );
  }
  // Wider than its card, it scrolls: the keyboard reaches it, as a region named for what it holds.
  const scrolls = drawn !== undefined && room > 0 && drawn.width > room;
  return (
    <div
      ref={scroller}
      {...(scrolls
        ? { "aria-label": "Diagram, scrolls sideways", role: "region", tabIndex: 0 }
        : {})}
      {...stylex.props(styles.block, styles.scroller)}
    >
      {drawn && (
        <iframe
          sandbox={SANDBOX}
          src={drawn.src}
          title="Diagram"
          {...stylex.props(styles.frame(`${drawn.width}px`, `${drawn.height}px`))}
        />
      )}
    </div>
  );
}
