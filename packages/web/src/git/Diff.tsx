// The Git page's detail: the picked file's diff, unified, in the theme's diff colours, the lines it
// keeps greyed, its path as its pane's title, so git's header of the file is left out; a binary file's sizes; past 1,000 lines, its counts and "Show the whole diff".
// A commit shows its message and its files, each opening its diff. Beside the sections on wide
// screens, a page of its own on the phone, with Back to the sections.
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFateClient, useLiveView, useRequest } from "react-fate";
import { DiffCount } from "../layout/DiffCount.tsx";
import { Pane } from "../layout/Pane.tsx";
import { useRepoPath } from "../routes.tsx";
import { useNow } from "../useNow.ts";
import { Back } from "./Back.tsx";
import { DetailTitle } from "./DetailTitle.tsx";
import { age } from "./History.tsx";
import { gitAddress, type Picked } from "./address.ts";
import { GitCommitView, gitDiffId, GitDiffView } from "./data.ts";

export const detailStyles = stylex.create({
  // Down to the detail's foot, as lazygit's diff fills its side (`Panes`' `fills`): the detail
  // scrolls it on its own.
  fills: { flexGrow: 1 },
});

/**
 * A file the address names that has no change left, as once its commit landed: its path, and that,
 * rather than the diff of a file git no longer lists.
 */
export function NoChange({ isNarrow, path }: { isNarrow: boolean; path: string }) {
  return (
    <Pane
      // No empty box of actions on wide screens: the title would make room for it.
      actions={isNarrow ? <Back isNarrow /> : undefined}
      title={path}
      titleNode={<DetailTitle isPath text={path} />}
      xstyle={[detailStyles.fills]}
    >
      <Text color="secondary">{path} has no change left.</Text>
    </Pane>
  );
}

/**
 * A diff's lines that change nothing, greyed so the added and removed ones stand out: a stylesheet,
 * as no prop of `CodeBlock` reaches its lines. It names Astryx's attributes, a line's `data-line`
 * and a change's `data-diff`: look at a diff after an Astryx upgrade.
 */
const CONTEXT_CSS = `[data-git-diff] [data-line]:not([data-diff]) { opacity: 0.6; }`;

/** The language a diff's lines are highlighted as, by its file's extension. */
const LANGUAGES: Readonly<Record<string, string>> = {
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  md: "markdown",
  nix: "nix",
  py: "python",
  rs: "rust",
  sh: "bash",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
};

const languageOf = (path: string) => LANGUAGES[path.split(".").at(-1) ?? ""] ?? "text";

/**
 * A diff's text without its file header, `diff --git`, `index`, `--- a/`, and `+++ b/`, the lines
 * before its first hunk: the pane's title names the file. The hunks are kept whole.
 */
export function withoutFileHeader(text: string): string {
  const lines = text.split("\n");
  const hunk = lines.findIndex((line) => line.startsWith("@@"));
  return hunk <= 0 ? text : lines.slice(hunk).join("\n");
}

/** A size in bytes, "12 KB", as a binary file's diff says it. */
export function size(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

/** A binary file's diff in words: "Binary file, 12 KB to 14 KB". */
export function binaryLine(before: number | null, after: number | null): string {
  if (before === null) {
    return `Binary file, new, ${size(after ?? 0)}`;
  }
  return after === null
    ? `Binary file, deleted, ${size(before)}`
    : `Binary file, ${size(before)} to ${size(after)}`;
}

/**
 * A diff's text, its sizes, or its counts with "Show the whole diff". A commit's diff never changes
 * and comes from the cache; a working tree's is read again as it opens, and as `version`, the page's
 * record of its file, changes, while the one held shows: the server sends no diff live.
 */
function DiffBody({
  commit,
  folder,
  path,
  version,
}: {
  commit: string | null;
  folder: string | null;
  path: string;
  version?: string | undefined;
}) {
  const fate = useFateClient();
  const [whole, setWhole] = useState(false);
  const id = gitDiffId(folder, commit, path, whole);
  const request = { gitDiff: { id, view: GitDiffView } };
  const { gitDiff } = useRequest(request, {
    mode: commit === null ? "stale-while-revalidate" : "cache-first",
  });
  // The first draw's read is the request's own: only a later change of the file reads it again.
  const read = useRef(version);
  useEffect(() => {
    if (commit !== null || read.current === version) {
      return;
    }
    read.current = version;
    void fate
      .request({ gitDiff: { id, view: GitDiffView } }, { mode: "network-only" })
      .catch(() => {});
  }, [commit, fate, id, version]);
  const diff = useLiveView(GitDiffView, gitDiff);
  if (!diff) {
    return null;
  }
  if (diff.text !== null && diff.text !== undefined) {
    return (
      // A div for the stylesheet to reach the lines: Astryx's stacks take no data attribute.
      <div data-git-diff="">
        <style>{CONTEXT_CSS}</style>
        <CodeBlock
          code={withoutFileHeader(diff.text)}
          hasLineNumbers
          isDiff
          isWrapped
          language={languageOf(path)}
          width="100%"
        />
      </div>
    );
  }
  if (diff.isCapped) {
    return (
      <HStack align="center" gap={3} wrap="wrap">
        {/* A diff capped for its size has no counts: they come with the whole diff. */}
        {diff.added + diff.removed > 0 && <DiffCount added={diff.added} removed={diff.removed} />}
        <Button label="Show the whole diff" onClick={() => setWhole(true)} variant="secondary" />
      </HStack>
    );
  }
  return (
    <Text color="secondary">{binaryLine(diff.binaryBefore ?? null, diff.binaryAfter ?? null)}</Text>
  );
}

/** A commit's message and its files, each opening its diff. */
function CommitDetail({ actions, id }: { actions?: ReactNode; id: string }) {
  const here = useRepoPath();
  const { gitCommit } = useRequest({ gitCommit: { id, view: GitCommitView } });
  const commit = useLiveView(GitCommitView, gitCommit);
  const now = useNow(60_000);
  if (!commit) {
    return null;
  }
  return (
    <Pane
      actions={actions}
      title={commit.subject}
      titleNode={<DetailTitle text={commit.subject} />}
      xstyle={[detailStyles.fills]}
    >
      <VStack gap={3}>
        <Text color="secondary" hasTabularNumbers type="supporting">
          {commit.id.slice(0, 7)} · {age(now - commit.authored * 1000)} ago
        </Text>
        {commit.body && <Text display="block">{commit.body}</Text>}
        <VStack gap={1}>
          {commit.files.map((file) => (
            <HStack align="center" gap={2} justify="between" key={file.path}>
              <Link href={here(gitAddress({ commit: id, file: file.path, kind: "commit" }))}>
                {file.path}
              </Link>
              {file.added !== undefined && file.added !== null && (
                <DiffCount added={file.added} removed={file.removed ?? 0} type="supporting" />
              )}
            </HStack>
          ))}
        </VStack>
      </VStack>
    </Pane>
  );
}

/**
 * The picked row's detail: a changed file's diff, with `stage` its Stage or Unstage and `version`
 * the page's record of it; a commit; or a
 * commit's file's diff. A conflict's editor is the conflicts' own (task 10).
 */
export function Detail({
  isNarrow,
  picked,
  stage,
  version,
}: {
  isNarrow: boolean;
  picked: Picked;
  stage?: ReactNode;
  /** The page's record of a changed file, its diff read again as it changes. */
  version?: string | undefined;
}) {
  // Back on the phone alone: on wide screens an empty box of actions would take the title's room.
  const back = isNarrow ? <Back isNarrow /> : undefined;
  if (picked.kind === "conflict") {
    return null;
  }
  if (picked.kind === "commit" && picked.file === undefined) {
    return <CommitDetail actions={back} id={picked.commit} />;
  }
  const path = picked.kind === "file" ? picked.file : (picked.file ?? "");
  return (
    <Pane
      actions={
        <HStack gap={1}>
          {stage}
          {back}
        </HStack>
      }
      title={path}
      titleNode={<DetailTitle isPath text={path} />}
      xstyle={[detailStyles.fills]}
    >
      <DiffBody
        commit={picked.kind === "commit" ? picked.commit : null}
        folder={picked.kind === "file" ? (picked.folder ?? null) : null}
        key={JSON.stringify(picked)}
        path={path}
        version={version}
      />
    </Pane>
  );
}
