// TEMPORARY: the parts of the spec page's mockup that follow the stories, each drawn its own way
// (`specs/2026-10-17-redesign-specs/`): the architecture as its units and tradeoffs, the edge cases
// by importance with the niche ones folded, the success criteria with their measure, the
// assumptions by who settled them, the constitution as a strip of principles, and the data model's
// tables with their changes as pills. They read the document tree for the shapes the core does not
// send yet.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Table } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";
import { itemsOf } from "./SpecStory.tsx";

const styles = stylex.create({
  row: {
    // A row of a list of the spec's parts, set apart from the next by a hairline.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    paddingBlockStart: spacingVars["--spacing-3"],
  },
  units: {
    display: "grid",
    gap: spacingVars["--spacing-3"],
    gridTemplateColumns: "repeat(auto-fill, minmax(var(--size-message-image), 1fr))",
  },
});

/** The cells of each row of the first table among `ids`, header first, as plain text. */
function tableOf(document: Document, ids: ReadonlyArray<number>): Array<Array<string>> {
  const table = ids.find((id) => document.blocks[id]?.kind === "table");
  return document.blocks
    .filter((b) => b.parent === table && table !== undefined)
    .map((row) => document.blocks.filter((c) => c.parent === row.id).map((c) => plain(c.spans)));
}

/** The cells of each row of the first table among `ids`, with their spans, header first. */
function cellsOf(document: Document, ids: ReadonlyArray<number>): Array<Array<Block>> {
  const table = ids.find((id) => document.blocks[id]?.kind === "table");
  return document.blocks
    .filter((b) => b.parent === table && table !== undefined)
    .map((row) => document.blocks.filter((c) => c.parent === row.id));
}

/** A change as a pill: new, changed, or removed; nothing when the cell is empty. */
function pill(text: string) {
  if (text === "") {
    return null;
  }
  const variant = text === "New" ? "success" : text === "Removed" ? "error" : "warning";
  return <Badge label={text} variant={variant} />;
}

/** A row of a data table: its cells, by column. */
type DataRow = { cells: ReadonlyArray<Block>; id: string };

/** A data table, its last column, the change, drawn as a pill. */
export function DataTable({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const [header = [], ...rows] = cellsOf(document, ids);
  const names = header.map((cell) => plain(cell.spans));
  return (
    <Table<DataRow>
      columns={names.map((name, index) => ({
        header: name,
        key: `c${index}`,
        renderCell: (row: DataRow) =>
          name === "Change" ? (
            pill(plain(row.cells[index]?.spans ?? []))
          ) : (
            <Spans spans={row.cells[index]?.spans ?? []} />
          ),
      }))}
      data={rows.map((cells, index) => ({ cells, id: String(index) }))}
      dividers="rows"
      textOverflow="wrap"
    />
  );
}

/** Each importance, in its order, with its badge. */
const IMPORTANCE = {
  High: "warning",
  Niche: "neutral",
  Normal: "neutral",
} as const;

/** The edge cases, most important first, each a row; the niche ones folded behind their count. */
export function EdgeCases({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const [open, setOpen] = useState(false);
  const [, ...rows] = tableOf(document, ids);
  const order = Object.keys(IMPORTANCE);
  const sorted = [...rows].sort((a, b) => order.indexOf(a[0] ?? "") - order.indexOf(b[0] ?? ""));
  const niche = sorted.filter((row) => row[0] === "Niche");
  const row = ([importance = "", situation = "", outcome = ""]: Array<string>) => (
    <VStack gap={1} key={situation} xstyle={styles.row}>
      <HStack align="center" gap={2}>
        <Badge
          label={importance}
          variant={IMPORTANCE[importance as keyof typeof IMPORTANCE] ?? "neutral"}
        />
        <Text weight="semibold">{situation}</Text>
      </HStack>
      <Text>{outcome.charAt(0).toUpperCase() + outcome.slice(1)}.</Text>
    </VStack>
  );
  return (
    <VStack gap={3}>
      {sorted.filter((r) => r[0] !== "Niche").map(row)}
      {niche.length > 0 && (
        <HStack>
          <Button
            label={open ? "Fold the niche cases" : `${niche.length} niche cases`}
            onClick={() => setOpen(!open)}
            size="sm"
            variant="ghost"
          />
        </HStack>
      )}
      {open && niche.map(row)}
    </VStack>
  );
}

/** The success criteria, each with its id and its measure as badges. */
export function Criteria({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  return (
    <VStack gap={3}>
      {itemsOf(document, ids).map((item) => {
        const [id, ...rest] = item.spans;
        const text = plain(rest);
        const measure = /^\s*\(([^)]*)\)/.exec(text)?.[1];
        return (
          <HStack align="start" gap={2} key={item.id} xstyle={styles.row}>
            <Icon color="success" icon="check" size="md" />
            <VStack gap={1}>
              <HStack align="center" gap={2}>
                <Badge label={id?.text ?? ""} variant="neutral" />
                {measure && <Badge label={measure} variant="info" />}
              </HStack>
              <Text>{text.replace(/^\s*(\([^)]*\))?:\s*/, "")}</Text>
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
}

/** The architecture: its approach, its units as small cards, then its tradeoffs as costs. */
export function Architecture({
  document,
  ids,
}: {
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  const wide = useWidthClass() === "wide";
  const lists = ids.filter((id) => document.blocks[id]?.kind === "list");
  const [units, tradeoffs] = lists;
  const intro = ids.filter(
    (id) =>
      document.blocks[id]?.kind === "paragraph" &&
      plain(document.blocks[id]?.spans ?? []) !== "Tradeoffs:",
  );
  return (
    <VStack gap={4}>
      <Blocks document={document} ids={intro} />
      <div {...stylex.props(wide && styles.units)}>
        {itemsOf(document, units === undefined ? [] : [units]).map((item) => {
          const [name, ...rest] = item.spans;
          return (
            <Card key={item.id} padding={3} variant="muted">
              <VStack gap={1}>
                <Text weight="semibold">{name?.text}</Text>
                <Text color="secondary" type="supporting">
                  {plain(rest).trim()}
                </Text>
              </VStack>
            </Card>
          );
        })}
      </div>
      {itemsOf(document, tradeoffs === undefined ? [] : [tradeoffs]).map((item) => (
        <HStack align="start" gap={2} key={item.id}>
          <Badge label="Cost" variant="warning" />
          <Text>
            <Spans spans={item.spans} />
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

/** The assumptions, by who settled them, each settled point open to a comment. */
export function Assumptions({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const intro = ids.find((id) => document.blocks[id]?.kind === "paragraph");
  const link = (document.blocks[intro ?? -1]?.spans ?? []).find((s) => s.link);
  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text weight="semibold">Settled by you</Text>
        <Text>
          The points of the round hold as written there:{" "}
          {link ? <Spans spans={[link]} /> : "the clarifications"}.
        </Text>
      </VStack>
      <VStack gap={2}>
        <Text weight="semibold">Settled by the agent</Text>
        {itemsOf(document, ids).map((item) => (
          <HStack align="start" gap={2} justify="between" key={item.id} xstyle={styles.row}>
            <Text>
              <Spans spans={item.spans} />
            </Text>
            <Button label="Comment" size="sm" variant="ghost" />
          </HStack>
        ))}
      </VStack>
    </VStack>
  );
}

/** The constitution check as a strip of principles, each with its mark. */
export function Principles({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const [names = [], marks = []] = tableOf(document, ids);
  return (
    <HStack gap={2} wrap="wrap">
      {names.map((name, index) => {
        const ok = (marks[index] ?? "").includes("✅");
        return (
          <Badge
            icon={<Icon icon={ok ? "check" : "warning"} />}
            key={name}
            label={name}
            variant={ok ? "success" : "warning"}
          />
        );
      })}
    </HStack>
  );
}
