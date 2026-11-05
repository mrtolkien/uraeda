// What every picker shows beside its list, on wide and semi-wide screens: the item under the cursor,
// drawn as the app draws that content, through the components that draw it on its own page. A
// document is markdown, as a page renders it (`ProseMarkdown`), its frontmatter left out; a section
// of a list is the list's own pane and rows (`SectionBody`, `Card`), as the priorities and the inbox
// draw them; anything else is plain lines in the UI's font, or in a font's own for the font picker.
// Where a pick lands, as a note promoted, is highlighted as a picked row is (`pickedStyles`). The
// preview is to be looked at: its content is inert, so its rows and links take no press and no focus,
// and the picker's list keeps them.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useMemo } from "react";
import { pickedStyles } from "../layout/picked.ts";
import type { WorkRow } from "../lists/Card.tsx";
import { SectionBody } from "../lists/SectionBody.tsx";
import { ProseMarkdown, proseStyles } from "../Prose.tsx";
import type { PickerPreview as Preview, PreviewRow } from "./pickerSources.ts";

const styles = stylex.create({
  // The parts of a document, one after the other, in prose's rhythm.
  document: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--prose-paragraph-gap)",
  },
  // Where a pick lands: a picked row's tint and bar, its text set in from the bar.
  here: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // A link of the document, drawn as one, which the preview does not follow.
  lines: { overflowWrap: "break-word", whiteSpace: "pre-wrap" },
  link: {
    color: colorVars["--color-text-accent"],
    textDecoration: "underline",
    textUnderlineOffset: "0.2em",
  },
  // A preview in a font of its own: the font picker's.
  face: (family: string) => ({ fontFamily: family }),
});

/** A document's frontmatter, `---` lines and what is between them, at its very start. */
const FRONTMATTER = /^---\n[\s\S]*?\n---\n*/;

/** A link of the preview: its text, as a link reads, going nowhere. */
function PreviewLink({ children }: { children: ReactNode; href: string }) {
  return <span {...stylex.props(styles.link)}>{children}</span>;
}

/** The markdown's parts the preview draws its own way. */
const COMPONENTS = { link: PreviewLink };

/** A document's parts, rendered, a part where a pick lands highlighted. */
function Document({ parts }: { parts: Extract<Preview, { kind: "markdown" }>["parts"] }) {
  return (
    // The preview's width is its line: the reading measure would leave room at its end.
    <div {...stylex.props(styles.document, proseStyles.paneWide)}>
      {parts.map((part, at) => {
        const text = at === 0 ? part.text.replace(FRONTMATTER, "") : part.text;
        return text.trim() === "" ? null : (
          <div
            data-here={part.isHere ? "" : undefined}
            key={at}
            {...stylex.props(part.isHere && [pickedStyles.picked, styles.here])}
          >
            <ProseMarkdown components={COMPONENTS}>{text}</ProseMarkdown>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The rows as a list's cards: each line's key its place, a nested row under the line before it at
 * a lower depth, as the list nests them.
 */
function previewRows(rows: ReadonlyArray<PreviewRow>): Array<WorkRow> {
  const parents: Array<string> = [];
  return rows.map((row, at) => {
    const key = `preview-${at}`;
    parents[row.depth] = key;
    return {
      href: "",
      isFixed: true,
      key,
      lines: [],
      text: row.text,
      ...(row.icon === undefined ? {} : { icon: row.icon }),
      ...(row.isLinked ? { isLinked: true } : {}),
      ...(row.marks === undefined ? {} : { marks: row.marks }),
      ...(row.depth > 0 ? { depth: row.depth, parent: parents[row.depth - 1] ?? key } : {}),
    };
  });
}

const ignore = () => {};

/** A section of a list, as its page draws it: its pane, its title, and its rows, one highlighted. */
function Outline({ preview }: { preview: Extract<Preview, { kind: "outline" }> }) {
  const rows = useMemo(() => previewRows(preview.rows), [preview.rows]);
  const here = preview.rows.findIndex((row) => row.isHere);
  return (
    <SectionBody
      canNest={false}
      isColumn={false}
      onHover={ignore}
      onOpen={ignore}
      rows={rows}
      section={{
        id: "preview",
        isFixed: true,
        rows,
        title: preview.title,
        tone: preview.tone ?? "neutral",
      }}
      {...(here === -1 ? {} : { selected: `preview-${here}` })}
    />
  );
}

/** Plain lines, an empty one held open. */
function Lines({ preview }: { preview: Extract<Preview, { kind: "text" }> }) {
  return (
    <div
      {...stylex.props(styles.lines, preview.family !== undefined && styles.face(preview.family))}
    >
      {preview.lines.map((text, at) => (
        <div key={at}>{text === "" ? <br /> : text}</div>
      ))}
    </div>
  );
}

/** An item's preview, drawn as the app draws its content. */
export function PickerPreview({ preview }: { preview: Preview }) {
  return (
    // Looked at, not used: nothing in it takes a press or the focus.
    <div inert>
      {preview.kind === "markdown" ? (
        <Document parts={preview.parts} />
      ) : preview.kind === "outline" ? (
        <Outline preview={preview} />
      ) : (
        <Lines preview={preview} />
      )}
    </div>
  );
}
