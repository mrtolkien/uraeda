// The keys drawn as glyphs about as wide as a letter: Astryx's `space` and `delete` icons span the
// whole em, which sets them apart from the other keys.
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";

const styles = stylex.create({
  // On the text's line, sitting on its baseline as an icon does.
  glyph: { display: "inline-block", verticalAlign: "-0.125em" },
});

/** A key's glyph, `width` units wide on a 24-unit-high box, one em high. */
function Glyph({ children, label, width }: { children: ReactNode; label: string; width: number }) {
  return (
    <svg
      aria-label={label}
      fill="none"
      height="1em"
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      {...stylex.props(styles.glyph)}
      viewBox={`0 0 ${width} 24`}
      width={`${width / 24}em`}
    >
      {children}
    </svg>
  );
}

/** Space, as the open box of a space bar, narrow. */
export const SpaceGlyph = () => (
  <Glyph label="Space" width={14}>
    <path d="M2 14v4h10v-4" />
  </Glyph>
);

/** Backspace, as the symbol of its key, a tag pointing left with a cross in it, narrow. */
export const BackGlyph = () => (
  <Glyph label="Backspace" width={18}>
    <path d="M7 6h10v12H7l-5-6z" />
    <path d="m10 9.5 4 5" />
    <path d="m14 9.5-4 5" />
  </Glyph>
);
