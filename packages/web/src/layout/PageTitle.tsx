// A page's title, the one level-1 heading of the page, drawn the same on every page (UI coherence):
// what sits above it, such as a file's status, the title with its count, what acts on the page
// beside it, and a line that says what the page is for under it.
import { Badge } from "@astryxdesign/core/Badge";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { fileStatusBadge } from "../labels.ts";
import { Paragraph } from "./Paragraph.tsx";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  // The title takes the row's room, its words wrapping beside what stays with it.
  title: { flexGrow: 1, minWidth: 0 },
  // What stays beside the title keeps its whole width.
  beside: { flexShrink: 0 },
});

/** What a page's title says of its subject, under it: marks, such as a status, then its text. */
export type TitleMeta = { marks?: ReactNode; text: ReactNode };

/**
 * A page's title: `children`, its words, at level 1, `id` its anchor, `around` drawing it inside
 * another element, as a block a comment can select. `count` follows it, a badge without words, as
 * the inbox's review asked (C3). `actions` stay beside it at every width, as a "…" menu; `aside`
 * sits at the row's end on wider screens, and under the title on the phone, as a search or a page's
 * main tool. `above` is the line over it, a file's path; `status` a workflow file's status, as a
 * badge over it; `meta` the supporting line under it, the subject's state; `description` the
 * secondary text under them, what the page is for.
 */
export function PageTitle({
  above,
  actions,
  around = (heading) => heading,
  aside,
  children,
  count,
  description,
  id,
  meta,
  status,
}: {
  above?: ReactNode;
  actions?: ReactNode;
  around?: (heading: ReactNode) => ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  count?: number;
  description?: ReactNode;
  id?: string;
  meta?: TitleMeta;
  status?: ReturnType<typeof fileStatusBadge>;
}) {
  const narrow = isNarrow(useWidthClass());
  const heading = around(
    <Heading id={id} level={1}>
      {children}
    </Heading>,
  );
  const row = (
    <HStack align="center" gap={2} justify="between">
      <HStack align="center" gap={2} xstyle={styles.title}>
        {heading}
        {count !== undefined && <Badge label={String(count)} variant="neutral" />}
      </HStack>
      {actions && <div {...stylex.props(styles.beside)}>{actions}</div>}
      {aside && !narrow && <div {...stylex.props(styles.beside)}>{aside}</div>}
    </HStack>
  );
  return (
    <VStack gap={2}>
      {above}
      {status && (
        <HStack>
          <Badge label={status.label} variant={status.variant} />
        </HStack>
      )}
      {row}
      {meta && (
        <HStack align="center" gap={2} wrap="wrap">
          {meta.marks}
          <Text color="secondary" type="supporting">
            {meta.text}
          </Text>
        </HStack>
      )}
      {aside && narrow && aside}
      {description && <Paragraph color="secondary">{description}</Paragraph>}
    </VStack>
  );
}
