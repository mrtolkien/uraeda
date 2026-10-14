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
import { useRepoPath, useRestoreScroll } from "./routes.tsx";
import { FileView } from "./views.ts";

const styles = stylex.create({
  frame: {
    // The mockup as tall as the screen, the page's full width.
    backgroundColor: colorVars["--color-background-surface"],
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    borderWidth: 0,
    boxSizing: "border-box",
    display: "block",
    height: "var(--size-viewport-height)",
    width: "100%",
  },
  header: {
    // The page's full width, under its header.
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-4"],
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
  const here = useRepoPath();
  useRestoreScroll(true);
  const source = here(`/mockups/specs/${folder}/mockups/${name}`);
  const reviewing = spec && !spec.missing && spec.status === "awaiting-human";
  const document = spec && (spec.committed ?? spec.current).document;
  // The first block of the spec, in its order, that links the mockup.
  const line =
    document && document.blocks.find((block) => selectable(block) && links(document, block, name));

  const send = async (text: string) => {
    const result = await fate.mutations.review.comment({
      input: {
        file: "spec.md",
        folder,
        ...(line
          ? { endLine: line.endLine, startLine: line.startLine, text }
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
        <Crumbs current={name} folder={folder} />
        <HStack align="center" gap={2} wrap="wrap">
          <Link hasUnderline href={source} target="_blank">
            Open in a new tab
          </Link>
          {reviewing && <Button label="Comment" onClick={() => setOpen(true)} />}
        </HStack>
      </div>
      <iframe sandbox="allow-scripts" src={source} title={name} {...stylex.props(styles.frame)} />
      {reviewing && (
        <Overlay isOpen={open} label="Comment" onClose={() => setOpen(false)}>
          <CommentForm
            anchor={
              line
                ? anchor({ end: line.endLine, heading: line.heading ?? "", start: line.startLine })
                : `General, on ${name}`
            }
            onCancel={() => setOpen(false)}
            onSubmit={send}
            quote={line && document ? quoteOf(textOf(document, line)) : undefined}
          />
        </Overlay>
      )}
    </>
  );
}
