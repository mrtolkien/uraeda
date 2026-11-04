// The Git page's writes: each a call of the server's `git.*` mutations, named for the toast where it
// happened, which answers once it landed in the repository's write queue. A write clears the
// refusals of its place first; a refusal shows next to the section it concerns, from the queue's
// record, or from the call's answer when the write never reached the queue, as an agent's guard
// refusing it. Discard, Remove, and Clean ask first. Staging shows its box ticked at once, until
// the write answers.
import { useState } from "react";
import { useFateClient } from "react-fate";
import { guarded, refusal } from "../errors.ts";
import type { ConfirmOptions } from "../fields/Confirm.tsx";
import { useConfirm } from "../fields/Confirm.tsx";
import { dropUnsaved, readUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { plural } from "../labels.ts";
import { useRepositoryPath } from "../routes.tsx";
import { refusedAt, useDismissWrite, useWriteQueue } from "../writes/useWriteQueue.ts";
import { GIT_PATH } from "./address.ts";
import { type GitGroup, GitPageView, type GitWorktree } from "./data.ts";
import type { FileChange } from "./tree.ts";

/**
 * Where a write's refusal shows: under the title for the sync, the merge, and a stopped pull's
 * writes; above a group's Changes for its staging, discards, and commits; above Worktrees.
 */
export type Place = "sync" | "worktrees" | { folder: string | null };

/**
 * The page a write names for the toast, by its place: the toast's Open goes there, and the page
 * finds each refusal's place by it.
 */
export function placeHref(place: Place): string {
  if (place === "sync") {
    return GIT_PATH;
  }
  if (place === "worktrees") {
    return `${GIT_PATH}#worktrees`;
  }
  return place.folder === null ? `${GIT_PATH}#changes` : `${GIT_PATH}#changes-${place.folder}`;
}

/** The unsaved store's field of a group's commit message, which `useTextField` takes. */
export const messageField = (folder: string | null) => `git:${folder ?? "main"}#message`;

/** A staged box shown before its write answers, by `stagingKey`. */
export const stagingKey = (folder: string | null, path: string) => `${folder ?? ""}\u0000${path}`;

/**
 * A group's files, each box as its staging write left it while that write answers: the index is
 * written before the page comes back, and Commit counts what the boxes show.
 */
export function filesShown(
  group: GitGroup,
  { staging }: { staging: ReadonlyMap<string, boolean> },
): ReadonlyArray<FileChange> {
  return group.files.map((file) => {
    const pending = staging.get(stagingKey(group.folder, file.path));
    return pending === undefined ? file : { ...file, staged: pending ? "yes" : "no" };
  });
}

/** What Discard asks before it restores `path`, or deletes it when it is new. */
function discardQuestion(path: string, isNew: boolean): ConfirmOptions {
  return {
    body: isNew
      ? "The file is new: it is deleted."
      : "It goes back as it was at the last commit, and your edits are lost.",
    cancel: "Keep",
    confirm: "Discard",
    // `d d` discards, as `y` does.
    confirmKey: "d",
    destructive: true,
    title: `Discard the changes to ${path}?`,
  };
}

/** What Remove asks: the folder goes, its branch stays. */
function removeQuestion(worktree: GitWorktree): ConfirmOptions {
  const body =
    worktree.state === "missing"
      ? "Its folder is gone already: git's record of it goes."
      : "Its folder goes.";
  return {
    body: worktree.branch ? `${body} Its branch ${worktree.branch} stays.` : body,
    cancel: "Keep",
    confirm: "Remove",
    destructive: true,
    title: `Remove ${worktree.path}?`,
  };
}

/** What Clean asks, as `ura clean` acts. */
function cleanQuestion(worktree: GitWorktree): ConfirmOptions {
  return {
    body: `Removes ${worktree.path}, deletes its branch, and removes ${worktree.name} from the priorities.`,
    cancel: "Keep",
    confirm: "Clean",
    destructive: true,
    title: `Clean ${worktree.name}?`,
  };
}

/** The refusals of the calls that never reached the queue, by their place's href. */
type Errors = Readonly<Record<string, string>>;

/**
 * What runs a write of a place, and the refusals of the calls that never reached the queue: a write
 * dismisses its place's refusals first, and resolves with whether it landed.
 */
function useRun() {
  const writes = useWriteQueue();
  const dismiss = useDismissWrite();
  const [errors, setErrors] = useState<Errors>({});
  /** Runs `call` as a write of `place`, named `label`. */
  const run = async (
    place: Place,
    label: string,
    call: (write: { href: string; label: string }) => Promise<{ error?: unknown }>,
  ) => {
    const href = placeHref(place);
    for (const write of writes) {
      if (refusedAt(write, { href })) {
        void dismiss(write.id);
      }
    }
    setErrors(({ [href]: _, ...rest }) => rest);
    const result = await guarded(() => call({ href, label }));
    if (result.error) {
      const { message } = refusal(result.error);
      setErrors((before) => ({ ...before, [href]: message }));
      return false;
    }
    return true;
  };
  return { errors, run };
}

/** The page's writes, and what each place shows of them. */
export function useGitWrites() {
  const fate = useFateClient();
  const confirm = useConfirm();
  const repo = useRepositoryPath();
  const { errors, run } = useRun();
  const [staging, setStaging] = useState<ReadonlyMap<string, boolean>>(new Map());
  const git = fate.mutations.git;
  const view = GitPageView;

  /** Stages `paths` of a group, or unstages them with `on` false, their boxes shown at once. */
  const stage = async (group: GitGroup, paths: ReadonlyArray<string>, on: boolean) => {
    const keys = paths.map((path) => stagingKey(group.folder, path));
    setStaging((before) => new Map([...before, ...keys.map((key) => [key, on] as const)]));
    const what = paths.length === 1 ? paths[0] : plural(paths.length, "file");
    const input = { folder: group.folder, paths: [...paths] };
    await run({ folder: group.folder }, `${on ? "Staging" : "Unstaging"} ${what}`, (write) =>
      on
        ? git.stage({ input: { ...input, write }, view })
        : git.unstage({ input: { ...input, write }, view }),
    );
    setStaging((before) => new Map([...before].filter(([key]) => !keys.includes(key))));
  };

  /** Commits what a group has staged with the message typed, which goes once the commit lands. */
  const commit = async (group: GitGroup) => {
    const key = unsavedKey(repo, messageField(group.folder));
    const message = readUnsaved(key)?.text ?? "";
    const landed = await run({ folder: group.folder }, `Committing on ${group.name}`, (write) =>
      git.commit({ input: { folder: group.folder, message, write }, view }),
    );
    // A refusal keeps the message for the next try; text typed meanwhile stays too.
    if (landed && readUnsaved(key)?.text === message) {
      dropUnsaved(key);
    }
    return landed;
  };

  const discard = async (group: GitGroup, path: string, isNew: boolean) => {
    if (!(await confirm(discardQuestion(path, isNew)))) {
      return false;
    }
    return run({ folder: group.folder }, `Discarding ${path}`, (write) =>
      git.discard({ input: { folder: group.folder, path, write }, view }),
    );
  };

  const remove = async (worktree: GitWorktree) =>
    (await confirm(removeQuestion(worktree))) &&
    run("worktrees", `Removing ${worktree.path}`, (write) =>
      git.removeWorktree({ input: { path: worktree.path, write }, view }),
    );

  const clean = async (worktree: GitWorktree) => {
    const folder = worktree.folder;
    return (
      folder !== undefined &&
      folder !== null &&
      (await confirm(cleanQuestion(worktree))) &&
      run("worktrees", `Cleaning ${worktree.name}`, (write) =>
        git.clean({ input: { folder, write }, view }),
      )
    );
  };

  return {
    clean,
    commit,
    discard,
    /** The refusal at `place` of a call that never reached the queue. */
    errorAt: (place: Place): string | undefined => errors[placeHref(place)],
    fetch: () => run("sync", "Fetching", (write) => git.fetch({ input: { write }, view })),
    merge: (branch: string) =>
      run("sync", `Merging ${branch}`, (write) => git.merge({ input: { branch, write }, view })),
    pull: () => run("sync", "Pulling", (write) => git.pull({ input: { write }, view })),
    push: () => run("sync", "Pushing", (write) => git.push({ input: { write }, view })),
    remove,
    /** Runs a write of a place, as the page's others: the conflicts' writes are the sync's. */
    run,
    stage,
    /** The boxes shown before their write answers, by `stagingKey`. */
    staging,
  };
}

export type GitWrites = ReturnType<typeof useGitWrites>;
