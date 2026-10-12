import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { Block, Document } from "uraeda-binding";
import { selectable } from "./Blocks.tsx";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { anchor, textOf } from "./ReviewPage.tsx";
import { useRestoreScroll } from "./routes.tsx";
import { FileView } from "./views.ts";

const styles = stylex.create({
  // The page's full width, under its header.
  header: {
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-4"],
  },
  // The mockup as tall as the screen, the page's full width.
  frame: {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    height: "var(--size-viewport-height)",
    borderWidth: 0,
    borderBlockStartWidth: borderVars["--border-width"],
    borderBlockStartStyle: "solid",
    borderBlockStartColor: colorVars["--color-border"],
    backgroundColor: colorVars["--color-background-surface"],
  },
});

/** Whether a block of the spec links the mockup, `mockups/<name>`, in its text or its cells. */
function links(document: Document, block: Block, name: string) {
  const spans = [
    ...block.spans,
    ...document.blocks
      .filter((b) => b.parent === block.id && b.kind === "cell")
      .flatMap((b) => b.spans),
  ];
  return spans.some((span) => {
    const target = span.link?.target.split("#")[0].replace(/^\.\//, "");
    return target === `mockups/${name}`;
  });
}

/**
 * A mockup of a feature, inside the UI: its file in a sandboxed frame, a link to open it in a tab of
 * its own, and, while the spec waits for review, a comment on the spec's line that links it, or a
 * general comment naming it when no line does.
 */
export function MockupPage({ folder, name }: { folder: string; name: string }) {
  const fate = useFateClient();
  const spec = useFile(folder, "spec.md");
  const [open, setOpen] = useState(false);
  useRestoreScroll(true);
  const source = `/mockups/specs/${folder}/mockups/${name}`;
  const reviewing = spec && !spec.missing && spec.status === "awaiting-human";
  const document = spec && (spec.committed ?? spec.current).document;
  // The first block of the spec, in its order, that links the mockup.
  const line =
    document && document.blocks.find((block) => selectable(block) && links(document, block, name));

  const send = async (text: string) => {
    const result = await fate.mutations.review.comment({
      input: {
        folder,
        file: "spec.md",
        ...(line
          ? { text, startLine: line.startLine, endLine: line.endLine }
          : { text: `Mockup ${name}: ${text}` }),
      },
      view: FileView,
    });
    if (result.error) {
      return refusal(result.error).message;
    }
    setOpen(false);
    return undefined;
  };

  return (
    <>
      <div {...stylex.props(styles.header)}>
        <Crumbs folder={folder} current={name} />
        <HStack gap={2} wrap="wrap" align="center">
          <Link href={source} target="_blank" hasUnderline>
            Open in a new tab
          </Link>
          {reviewing && <Button label="Comment" onClick={() => setOpen(true)} />}
        </HStack>
      </div>
      <iframe title={name} src={source} sandbox="allow-scripts" {...stylex.props(styles.frame)} />
      {reviewing && (
        <Overlay label="Comment" isOpen={open} onClose={() => setOpen(false)}>
          <CommentForm
            anchor={
              line
                ? anchor({ start: line.startLine, end: line.endLine, heading: line.heading ?? "" })
                : `General, on ${name}`
            }
            quote={line && document ? quoteOf(textOf(document, line)) : undefined}
            onSubmit={send}
            onCancel={() => setOpen(false)}
          />
        </Overlay>
      )}
    </>
  );
}
