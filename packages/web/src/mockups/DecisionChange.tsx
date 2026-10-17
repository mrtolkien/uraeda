// TEMPORARY: a decision's change as the specs redesign's mockups show it
// (`specs/2026-10-17-redesign-specs/clarifications-01.md`), drawn by `DecisionChange.stories.tsx`
// and `SpecPage.stories.tsx`, in three ways: the new text with the words that changed marked in
// place, the old and the new side by side, or the new text with each changed part marked and its
// old wording behind a toggle. It cuts both versions into paragraphs and list items, so a line
// wrapped anew is no change, and compares their words. The implementation computes the change in
// the core, from the default branch's and the feature branch's files.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";

const styles = stylex.create({
  added: {
    // Inserted words: a green tint and an underline, so the change does not rest on colour alone.
    backgroundColor: colorVars["--color-background-green"],
    color: "inherit",
    textDecorationColor: colorVars["--color-success"],
    textDecorationLine: "underline",
  },
  bullet: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-0-5"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  bulletChanged: {
    borderInlineStartColor: colorVars["--color-warning"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
  },
  bulletNew: {
    borderInlineStartColor: colorVars["--color-success"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
  },
  columns: {
    columnGap: spacingVars["--spacing-4"],
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  },
  item: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    margin: 0,
  },
  old: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
  },
  removed: {
    // Deleted words: a red tint and struck through.
    backgroundColor: colorVars["--color-background-red"],
    color: "inherit",
    textDecorationColor: colorVars["--color-error"],
    textDecorationLine: "line-through",
  },
  side: {
    backgroundColor: colorVars["--color-background-muted"],
    borderRadius: radiusVars["--radius-element"],
    padding: spacingVars["--spacing-2"],
  },
});

/** How the change shows. */
export type ChangeMode = "inline" | "sideBySide" | "marked";

/** A part of a decision: a paragraph or a list item, under its section, its lines joined. */
type Part = { item: boolean; section: string; text: string };

/** The parts of a decision's text, after its frontmatter and its title. */
function partsOf(markdown: string): Array<Part> {
  const body = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  const parts: Array<Part> = [];
  let section = "";
  let current: Part | undefined;
  const close = () => {
    if (current) {
      parts.push(current);
    }
    current = undefined;
  };
  for (const line of body.split("\n")) {
    if (line.startsWith("#")) {
      close();
      section = line.startsWith("## ") ? line.slice(3) : "";
    } else if (line.trim() === "") {
      close();
    } else if (line.startsWith("- ")) {
      close();
      current = { item: true, section, text: line.slice(2) };
    } else if (current) {
      current.text += ` ${line.trim()}`;
    } else {
      current = { item: false, section, text: line.trim() };
    }
  }
  close();
  return parts;
}

/** A piece of a compared text: kept, added, or removed. */
type Piece = { kind: "same" | "added" | "removed"; text: string };

/** The words of `before` and `after` compared, as kept, added, and removed runs. */
function wordDiff(before: string, after: string): Array<Piece> {
  const a = before.split(/\s+/);
  const b = after.split(/\s+/);
  const longest = a.map(() => b.map(() => 0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = longest[i] ?? [];
      row[j] =
        a[i] === b[j]
          ? (longest[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(longest[i + 1]?.[j] ?? 0, row[j + 1] ?? 0);
    }
  }
  const pieces: Array<Piece> = [];
  const push = (kind: Piece["kind"], word: string) => {
    const last = pieces.at(-1);
    if (last?.kind === kind) {
      last.text += ` ${word}`;
    } else {
      pieces.push({ kind, text: word });
    }
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      push("same", a[i] ?? "");
      i++;
      j++;
    } else if (
      j < b.length &&
      (i >= a.length || (longest[i]?.[j + 1] ?? 0) >= (longest[i + 1]?.[j] ?? 0))
    ) {
      push("added", b[j] ?? "");
      j++;
    } else {
      push("removed", a[i] ?? "");
      i++;
    }
  }
  return pieces;
}

/** The share of words two texts keep in common. */
function likeness(before: string, after: string): number {
  const pieces = wordDiff(before, after);
  const words = (kind: Piece["kind"]) =>
    pieces.filter((p) => p.kind === kind).reduce((n, p) => n + p.text.split(" ").length, 0);
  return words("same") / Math.max(1, words("same") + words("added") + words("removed"));
}

/** A part of the new text, with the part of the old text it replaces, if any. */
type Change = { after?: string; before?: string; item: boolean; section: string };

/** The decision's parts, each new part paired with the old part it most resembles. */
function changesOf(before: string, after: string): Array<Change> {
  const old = partsOf(before);
  const paired = new Set<number>();
  const changes: Array<Change> = partsOf(after).map((part) => {
    let best = -1;
    let score = 0.4;
    old.forEach((candidate, index) => {
      if (paired.has(index) || candidate.section !== part.section) {
        return;
      }
      const s = likeness(candidate.text, part.text);
      if (s > score) {
        best = index;
        score = s;
      }
    });
    if (best < 0) {
      return { after: part.text, item: part.item, section: part.section };
    }
    paired.add(best);
    return { after: part.text, before: old[best]?.text, item: part.item, section: part.section };
  });
  old.forEach((part, index) => {
    if (!paired.has(index)) {
      changes.push({ before: part.text, item: part.item, section: part.section });
    }
  });
  return changes;
}

/** Text with its `code` spans drawn as code. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/).map((chunk, index) =>
        chunk.startsWith("`") ? (
          <Code key={index} size="inherit">
            {chunk.slice(1, -1)}
          </Code>
        ) : (
          chunk.replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        ),
      )}
    </>
  );
}

/** The compared words of a changed part, added ones marked, removed ones struck. */
function Redline({ after, before }: { after: string; before: string }) {
  return (
    <>
      {wordDiff(before, after).map((piece, index) => {
        const text = <Inline text={piece.text} />;
        const space = index > 0 ? " " : "";
        if (piece.kind === "added") {
          return (
            <span key={index}>
              {space}
              <ins {...stylex.props(styles.added)}>{text}</ins>
            </span>
          );
        }
        if (piece.kind === "removed") {
          return (
            <span key={index}>
              {space}
              <del {...stylex.props(styles.removed)}>{text}</del>
            </span>
          );
        }
        return (
          <span key={index}>
            {space}
            {text}
          </span>
        );
      })}
    </>
  );
}

/** What kind of change a part holds. */
function kindOf(change: Change): "same" | "changed" | "new" | "removed" {
  if (change.before === undefined) {
    return "new";
  }
  if (change.after === undefined) {
    return "removed";
  }
  return change.before === change.after ? "same" : "changed";
}

const LABELS = { changed: "Changed", new: "New", removed: "Removed" } as const;
const VARIANTS = { changed: "warning", new: "success", removed: "error" } as const;

/** A changed part, drawn the way `mode` asks. */
function ChangedPart({ change, mode }: { change: Change; mode: ChangeMode }) {
  const [showOld, setShowOld] = useState(false);
  const wide = useWidthClass() === "wide";
  const kind = kindOf(change);
  if (kind === "same") {
    return (
      <p {...stylex.props(styles.item, change.item && styles.bullet)}>
        <Inline text={change.after ?? ""} />
      </p>
    );
  }
  const badge = <Badge label={LABELS[kind]} variant={VARIANTS[kind]} />;
  const border = [styles.bullet, kind === "new" ? styles.bulletNew : styles.bulletChanged];
  if (mode === "inline") {
    return (
      <div {...stylex.props(border)}>
        <p {...stylex.props(styles.item)}>
          <Redline after={change.after ?? ""} before={change.before ?? ""} />
        </p>
      </div>
    );
  }
  if (mode === "sideBySide") {
    const column = (title: string, text: string | undefined) => (
      <VStack gap={1}>
        <Text color="secondary" type="supporting" weight="semibold">
          {title}
        </Text>
        <div {...stylex.props(styles.side)}>
          <p {...stylex.props(styles.item)}>
            {text === undefined ? <Text color="secondary">Nothing</Text> : <Inline text={text} />}
          </p>
        </div>
      </VStack>
    );
    return (
      <VStack gap={1}>
        <HStack>{badge}</HStack>
        <div {...stylex.props(wide && styles.columns)}>
          {column("Before", change.before)}
          {column("After", change.after)}
        </div>
      </VStack>
    );
  }
  return (
    <div {...stylex.props(border)}>
      <VStack gap={1}>
        <HStack align="center" gap={2}>
          {badge}
          {kind === "changed" && (
            <Button
              label={showOld ? "Hide the previous wording" : "Show the previous wording"}
              onClick={() => setShowOld(!showOld)}
              size="sm"
              variant="ghost"
            />
          )}
        </HStack>
        <p {...stylex.props(styles.item, kind === "removed" && styles.old)}>
          <Inline text={change.after ?? change.before ?? ""} />
        </p>
        {showOld && (
          <p {...stylex.props(styles.item, styles.old)}>
            Before: <Inline text={change.before ?? ""} />
          </p>
        )}
      </VStack>
    </div>
  );
}

/** A run of unchanged parts, folded behind a count. */
function Unchanged({ changes }: { changes: ReadonlyArray<Change> }) {
  const [open, setOpen] = useState(false);
  if (open) {
    return (
      <VStack gap={2}>
        {changes.map((change, index) => (
          <ChangedPart change={change} key={index} mode="inline" />
        ))}
      </VStack>
    );
  }
  const items = changes.filter((c) => c.item).length;
  const label = items > 0 ? `${changes.length} unchanged, show them` : "Unchanged, show it";
  return (
    <HStack>
      <Button label={label} onClick={() => setOpen(true)} size="sm" variant="ghost" />
    </HStack>
  );
}

/**
 * A decision's change: each section that changed, with its changed parts drawn the way `mode`
 * asks, and its unchanged parts folded. Sections without a change are left out.
 */
export function DecisionChange({
  after,
  before,
  mode,
}: {
  after: string;
  before: string;
  mode: ChangeMode;
}) {
  const changes = changesOf(before, after);
  const sections = [...new Set(changes.map((c) => c.section))].filter((section) =>
    changes.some((c) => c.section === section && kindOf(c) !== "same"),
  );
  return (
    <VStack gap={4}>
      {sections.map((section) => {
        const inSection = changes.filter((c) => c.section === section);
        const runs: Array<ReactNode> = [];
        let same: Array<Change> = [];
        const flush = () => {
          if (same.length > 0) {
            runs.push(<Unchanged changes={same} key={`same-${runs.length}`} />);
          }
          same = [];
        };
        inSection.forEach((change, index) => {
          if (kindOf(change) === "same") {
            same.push(change);
          } else {
            flush();
            runs.push(<ChangedPart change={change} key={index} mode={mode} />);
          }
        });
        flush();
        return (
          <VStack gap={2} key={section}>
            <Heading level={4}>{section || "Summary"}</Heading>
            {runs}
          </VStack>
        );
      })}
    </VStack>
  );
}

/** A new decision's rules, its summary first. */
export function NewDecision({ text }: { text: string }) {
  const parts = partsOf(text).filter((p) => p.section === "" || p.section === "Rules");
  return (
    <VStack gap={2}>
      {parts.map((part, index) => (
        <p key={index} {...stylex.props(styles.item, part.item && styles.bullet)}>
          <Inline text={part.text} />
        </p>
      ))}
    </VStack>
  );
}
