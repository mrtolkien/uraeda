// TEMPORARY: a decision's change as the specs redesign shows it (`specs/2026-10-17-redesign-specs/`),
// drawn by `DecisionChange.stories.tsx` and `SpecPage.stories.tsx`: the new text with the words that
// changed marked in place, new parts marked new, and removed parts folded behind their count. It
// cuts both versions into paragraphs and list items, so a line wrapped anew is no change, and
// compares their words. The implementation computes the change in the core, from the default
// branch's and the feature branch's files.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Code } from "@astryxdesign/core/Code";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";

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
  bulletRemoved: {
    borderInlineStartColor: colorVars["--color-error"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
  },
  item: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    margin: 0,
  },
  removed: {
    // Deleted words: a red tint and struck through.
    backgroundColor: colorVars["--color-background-red"],
    color: "inherit",
    textDecorationColor: colorVars["--color-error"],
    textDecorationLine: "line-through",
  },
});

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

/** The share of the shorter text's words that the other keeps: a rule merged into a longer one
 * still pairs with it. */
function likeness(before: string, after: string): number {
  const pieces = wordDiff(before, after);
  const words = (kind: Piece["kind"]) =>
    pieces.filter((p) => p.kind === kind).reduce((n, p) => n + p.text.split(" ").length, 0);
  const shorter = Math.min(words("same") + words("removed"), words("same") + words("added"));
  return words("same") / Math.max(1, shorter);
}

/** A part of the new text, with the part of the old text it replaces, if any. */
type Change = { after?: string; before?: string; item: boolean; section: string };

/** The decision's parts, each new part paired with the old part it most resembles. */
function changesOf(before: string, after: string): Array<Change> {
  const old = partsOf(before);
  const paired = new Set<number>();
  const changes: Array<Change> = partsOf(after).map((part) => {
    let best = -1;
    let score = 0.6;
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

/** A part as it reads now: kept, changed with its words marked, or new. */
function NowPart({ change }: { change: Change }) {
  const kind = kindOf(change);
  if (kind === "same") {
    return (
      <p {...stylex.props(styles.item, change.item && styles.bullet)}>
        <Inline text={change.after ?? ""} />
      </p>
    );
  }
  return (
    <div {...stylex.props(styles.bullet, kind === "new" ? styles.bulletNew : styles.bulletChanged)}>
      <VStack gap={1}>
        <HStack>
          <Badge
            label={kind === "new" ? "New" : "Changed"}
            variant={kind === "new" ? "success" : "warning"}
          />
        </HStack>
        <p {...stylex.props(styles.item)}>
          {kind === "new" ? (
            <Inline text={change.after ?? ""} />
          ) : (
            <Redline after={change.after ?? ""} before={change.before ?? ""} />
          )}
        </p>
      </VStack>
    </div>
  );
}

/** A run of unchanged parts, folded behind a count. */
function Unchanged({ changes }: { changes: ReadonlyArray<Change> }) {
  const [open, setOpen] = useState(false);
  const count = changes.length;
  return (
    <VStack gap={2}>
      <HStack>
        <Button
          label={open ? "Fold the unchanged" : `${count} unchanged`}
          onClick={() => setOpen(!open)}
          size="sm"
          variant="ghost"
        />
      </HStack>
      {open && changes.map((change, index) => <NowPart change={change} key={index} />)}
    </VStack>
  );
}

/** The parts the change removes, folded behind their count, struck once shown. */
function Removed({ changes }: { changes: ReadonlyArray<Change> }) {
  const [open, setOpen] = useState(false);
  const count = changes.length;
  return (
    <div {...stylex.props(styles.bullet, styles.bulletRemoved)}>
      <VStack gap={1}>
        <HStack align="center" gap={2}>
          <Badge label={`${count} removed`} variant="error" />
          <Button
            label={open ? "Hide what is removed" : "Show what is removed"}
            onClick={() => setOpen(!open)}
            size="sm"
            variant="ghost"
          />
        </HStack>
        {open &&
          changes.map((change, index) => (
            <p key={index} {...stylex.props(styles.item)}>
              <del {...stylex.props(styles.removed)}>
                <Inline text={change.before ?? ""} />
              </del>
            </p>
          ))}
      </VStack>
    </div>
  );
}

/**
 * A decision's change, section by section: changed parts with their words marked in place, new
 * parts marked new, unchanged runs folded behind their count, and removed parts folded at the
 * section's end. Sections without a change are left out.
 */
export function DecisionChange({ after, before }: { after: string; before: string }) {
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
          const kind = kindOf(change);
          if (kind === "same") {
            same.push(change);
          } else if (kind !== "removed") {
            flush();
            runs.push(<NowPart change={change} key={index} />);
          }
        });
        flush();
        const removed = inSection.filter((c) => kindOf(c) === "removed");
        return (
          <VStack gap={2} key={section}>
            <Heading level={4}>{section || "Intent"}</Heading>
            {runs}
            {removed.length > 0 && <Removed changes={removed} />}
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
