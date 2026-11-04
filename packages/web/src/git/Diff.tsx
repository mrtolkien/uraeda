// The Git page's detail: the picked file's diff, unified, in the theme's diff colours, its path as
// its pane's title; a binary file's sizes; past 1,000 lines, its counts and "Show the whole diff".
// A commit shows its message and its files, each opening its diff. Beside the sections on wide
// screens, a page of its own on the phone, with Back to the sections.
import { Button } from "@astryxdesign/core/Button";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { type ReactNode, useState } from "react";
import { useLiveView, useRequest } from "react-fate";
import { DiffCount } from "../layout/DiffCount.tsx";
import { Pane } from "../layout/Pane.tsx";
import { navigateHere, useRepoPath } from "../routes.tsx";
import { gitAddress, type Picked } from "./address.ts";
import { GitCommitView, gitDiffId, GitDiffView } from "./data.ts";

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

/** The phone's way back from the detail to the sections. */
function Back({ isNarrow }: { isNarrow: boolean }) {
  return isNarrow ? (
    <Button
      icon={<Icon icon="arrowLeft" />}
      label="Back"
      onClick={() => navigateHere(gitAddress())}
      variant="ghost"
    />
  ) : null;
}

/** A diff's text, its sizes, or its counts with "Show the whole diff". */
function DiffBody({
  commit,
  folder,
  path,
}: {
  commit: string | null;
  folder: string | null;
  path: string;
}) {
  const [whole, setWhole] = useState(false);
  const request = { gitDiff: { id: gitDiffId(folder, commit, path, whole), view: GitDiffView } };
  const { gitDiff } = useRequest(request);
  const diff = useLiveView(GitDiffView, gitDiff);
  if (!diff) {
    return null;
  }
  if (diff.text !== null && diff.text !== undefined) {
    return (
      <CodeBlock
        code={diff.text}
        hasLineNumbers
        isDiff
        isWrapped
        language={languageOf(path)}
        width="100%"
      />
    );
  }
  if (diff.isCapped) {
    return (
      <HStack align="center" gap={3} wrap="wrap">
        <DiffCount added={diff.added} removed={diff.removed} />
        <Button label="Show the whole diff" onClick={() => setWhole(true)} variant="secondary" />
      </HStack>
    );
  }
  return (
    <Text color="secondary">{binaryLine(diff.binaryBefore ?? null, diff.binaryAfter ?? null)}</Text>
  );
}

/** A commit's message and its files, each opening its diff. */
function CommitDetail({ actions, id }: { actions: ReactNode; id: string }) {
  const here = useRepoPath();
  const { gitCommit } = useRequest({ gitCommit: { id, view: GitCommitView } });
  const commit = useLiveView(GitCommitView, gitCommit);
  if (!commit) {
    return null;
  }
  return (
    <Pane actions={actions} title={commit.subject}>
      <VStack gap={3}>
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
 * The picked row's detail: a changed file's diff, with `stage` its Stage or Unstage; a commit; or a
 * commit's file's diff. A conflict's editor is the conflicts' own (task 10).
 */
export function Detail({
  isNarrow,
  picked,
  stage,
}: {
  isNarrow: boolean;
  picked: Picked;
  stage?: ReactNode;
}) {
  const back = <Back isNarrow={isNarrow} />;
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
    >
      <DiffBody
        commit={picked.kind === "commit" ? picked.commit : null}
        folder={picked.kind === "file" ? (picked.folder ?? null) : null}
        key={JSON.stringify(picked)}
        path={path}
      />
    </Pane>
  );
}
