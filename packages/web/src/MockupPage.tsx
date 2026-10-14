import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, useState } from "react";
import { useFateClient } from "react-fate";
import { useImageText } from "./attach/useImageText.ts";
import { CommentForm, quoteOf } from "./CommentForm.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { useFile } from "./data.ts";
import { refusal } from "./errors.ts";
import { useTextField } from "./fields/useTextField.ts";
import { Overlay } from "./layout/Overlay.tsx";
import { anchor, textOf } from "./ReviewCommentForm.tsx";
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

/**
 * The comment form of a mockup, drawn while open, its text kept in the unsaved store by `field`:
 * its text takes images pasted or picked. A drop on the mockup lands in its frame, another page,
 * and never reaches this one.
 */
function MockupComment({
  field,
  path,
  ...props
}: { path: string } & Omit<ComponentProps<typeof CommentForm>, "images" | "saved">) {
  const { change, text } = useTextField(field, "");
  const images = useImageText({
    label: "the comment",
    onText: change,
    path,
    priority: 1,
    text,
  });
  return <CommentForm {...props} field={field} images={images} />;
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
  const version = spec && (spec.committed ?? spec.current);
  const document = version?.document;
  // The block of the spec's Mockups section that links the mockup.
  const link = version?.items.spec?.mockups.find((mockup) => mockup.path === `mockups/${name}`);
  const line = link && document?.blocks[link.block];

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
          <MockupComment
            anchor={
              line
                ? anchor({ end: line.endLine, heading: line.heading ?? "", start: line.startLine })
                : `General, on ${name}`
            }
            field={`${spec.path}#mockup:${name}`}
            onCancel={() => setOpen(false)}
            onSubmit={send}
            path={spec.path}
            quote={line && document ? quoteOf(textOf(document, line)) : undefined}
          />
        </Overlay>
      )}
    </>
  );
}
