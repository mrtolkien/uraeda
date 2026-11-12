// The Diff pane, the page's main one, lazygit's main panel: what the lists picked, at the room it
// needs. A changed file's diff, with Stage or Unstage; a commit's message and every file's change,
// one under the other; a conflicted text file in the editor, saved with `Ctrl+Enter` once its
// markers are gone, or a side taken whole. Each state says what it is, and why there is nothing.
import { cleanup, computed, signal, untracked, View } from "nsh";
import { gitPage } from "./Sync";
import { discardWords, isListed } from "./Changes";
import { type Picked, picked } from "./picked";
import { ago } from "./when";
import { isPending, refusalAt, write } from "./writes";
import { record } from "../../store";
import type { GitCommitFile, GitDiff, GitFile, GitGroup, GitPage } from "../../store/protocol";
import { Button, Confirm, Heading, Refusal, Spinner, Text } from "../../ui/controls";
import { Diff } from "../../ui/document";
import { Empty } from "../../ui/lists";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import type { WidthClass } from "../../ui/width";
import { ConflictEditor } from "../conflict";
import { plural } from "../../ui/words";

/** A binary side's size, in words. */
const sizeWords = (bytes: number | null) =>
  bytes === null ? "nothing" : `${Math.max(1, Math.round(Number(bytes) / 1024))} KB`;

/** "+12 −3", or what a binary file's sizes did. */
function countWords(diff: GitDiff): string {
  if (diff.binaryBefore !== null || diff.binaryAfter !== null) {
    const size = sizeWords;
    return `binary · ${size(diff.binaryBefore)} → ${size(diff.binaryAfter)}`;
  }
  return `+${diff.added} −${diff.removed}`;
}

/** The body of a diff record: its text, or why it shows none, and the way to the whole. */
function DiffBody(props: { diff: GitDiff; onWhole: () => void; wrap: boolean }) {
  return (
    <If
      when={props.diff.text}
      else={
        <If
          when={props.diff.isCapped}
          else={
            <Empty
              icon="file-text"
              title="A binary file"
              words={`Its bytes changed: ${countWords(props.diff)}. Git shows no lines of it.`}
            />
          }
        >
          <Empty
            action={{ icon: "chevrons-down", label: "Show the whole diff", run: props.onWhole }}
            icon="file-text"
            title={`${props.diff.added + props.diff.removed} lines changed`}
            words="A diff past 1,000 lines is not read until asked: it may take a moment."
          />
        </If>
      }
    >
      {(text) => (
        <Diff keys patch={text()} path={props.diff.path} testID="git-diff" wrap={props.wrap} />
      )}
    </If>
  );
}

/**
 * The Stage of the file the pane shows, which its `s` runs: one binding for the pane, filled by
 * each file's view. A file's view is made before the one it replaces goes, so a binding of each
 * would hold the key twice for a moment, which the registry refuses.
 */
const staging = signal<{ run: () => boolean } | null>(null);

/** A changed file of a checkout: its path, counts, Stage or Unstage, and its diff. */
function FileDiff(props: { folder: string | null; path: string; repo: string; width: WidthClass }) {
  const pane = usePane();
  const whole = pane.remember<string>("whole", "");
  const key = () => `${props.folder ?? "."}:${props.path}`;
  const page = gitPage(props.repo);
  const diff = record("GitDiff", {
    commit: null,
    folder: props.folder,
    path: props.path,
    repo: props.repo,
    whole: whole() === key(),
    branch: false,
  });
  const group = (): GitGroup | undefined =>
    page()?.groups.find((one) => one.folder === props.folder);
  const file = (): GitFile | undefined => group()?.files.find((one) => one.path === props.path);
  const where = () => `${props.repo}/commit:${props.folder ?? "."}`;
  const stage = () => {
    const shown = file();
    const target = group();
    if (shown === undefined || target === undefined) return;
    const unstage = shown.staged === "yes";
    void write(
      where(),
      unstage ? "git.unstage" : "git.stage",
      { folder: props.folder, paths: [props.path], repo: props.repo },
      `${unstage ? "Unstaging" : "Staging"} ${props.path} in ${target.name}`,
    );
  };
  // Discard, the Changes row's `d`, as a button too: the pointer's way, asked first.
  const discarding = signal(false);
  const discard = () =>
    void write(
      where(),
      "git.discard",
      { folder: props.folder, path: props.path, repo: props.repo },
      `Discarding ${props.path}`,
    );
  // Its Stage under the same key as the Changes' row: the file read is the one staged. The pane
  // holds the key; the file shown fills it.
  const mine = {
    run: () => {
      if (file() === undefined || pageHeld(page(), props.folder)) return false;
      stage();
      return true;
    },
  };
  staging.set(mine);
  cleanup(() => {
    if (untracked(staging) === mine) staging.set(null);
  });
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 160 }}>
          <Text font="code" testID="git-diff-path">
            {props.path}
          </Text>
          <Text size="under" tone="faint">
            {[
              file()?.state ?? "",
              diff() === undefined || diff() === null ? "" : countWords(diff()!),
              file()?.staged === "yes"
                ? "staged"
                : file()?.staged === "partly"
                  ? "partly staged"
                  : "not staged",
              group()?.folder === null ? "" : `in ${group()?.name}`,
            ]
              .filter((part) => part !== "")
              .join(" · ")}
          </Text>
        </View>
        <If when={file()}>
          {(shown) => (
            <Button
              disabled={pageHeld(page(), props.folder)}
              icon={shown().staged === "yes" ? "minus" : "check"}
              label={shown().staged === "yes" ? "Unstage" : "Stage"}
              onPress={stage}
              pending={isPending(where())}
            />
          )}
        </If>
        <If when={file()}>
          {(shown) => (
            <>
              <Button
                disabled={pageHeld(page(), props.folder)}
                icon="trash-2"
                label="Discard…"
                onPress={() => discarding.set(true)}
                testID="git-discard"
                variant="danger"
              />
              <Confirm
                loses
                icon="trash-2"
                keep="Keep them"
                label="Discard the changes"
                onClose={() => discarding.set(false)}
                onConfirm={discard}
                open={discarding()}
                title={`Discard the changes to ${props.path}?`}
                words={discardWords(shown().state === "new")}
              />
            </>
          )}
        </If>
      </View>
      <If when={refusalAt(where())}>{(words) => <Refusal words={words()} />}</If>
      <If
        when={diff()}
        else={
          <If when={diff.error()} else={<Spinner label={`Reading the diff of ${props.path}`} />}>
            {(error) => <Refusal words={error().message} />}
          </If>
        }
      >
        {(shown) => (
          <DiffBody
            diff={shown()}
            onWhole={() => whole.set(key())}
            wrap={props.width === "narrow"}
          />
        )}
      </If>
    </View>
  );
}

/**
 * Whether an agent works in the checkout of a group, which refuses its writes: of the page as its
 * component read it, since a key's `run` asks, where no record may be read.
 */
function pageHeld(page: GitPage | null | undefined, folder: string | null): boolean {
  if (page === undefined || page === null) return true;
  if (folder === null) return page.agentWorking;
  return page.groups.find((one) => one.folder === folder)?.isWorking === true;
}

/** A commit: its subject, when, its message's body, and each file's change, one patch. */
function CommitDiff(props: { id: string; repo: string; width: WidthClass }) {
  const commit = record("GitCommit", { id: props.id, repo: props.repo });
  const row = () => gitPage(props.repo)()?.history.find((one) => one.id === props.id);
  // Each file's diff in the commit, read together, joined as one patch of several files.
  const patch = computed(() => {
    const files = commit()?.files ?? [];
    const texts = files.map((file) => {
      const diff = record("GitDiff", {
        commit: props.id,
        folder: null,
        path: file.path,
        repo: props.repo,
        whole: false,
        branch: false,
      })();
      if (diff === undefined) return undefined;
      return diff?.text ?? `--- a/${file.path}\n+++ b/${file.path}\n`;
    });
    return texts.some((text) => text === undefined) ? undefined : texts.join("");
  });
  return (
    <If
      when={commit()}
      else={
        <If when={commit() === null} else={<Spinner label="Reading the commit" />}>
          <Empty
            icon="git-commit-horizontal"
            title="No such commit"
            words="It is no longer in the branch's history: a pull may have replaced it."
          />
        </If>
      }
    >
      {(shown) => (
        <View style={{ flex: 1, gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Heading level={2}>{shown().subject}</Heading>
            <Text size="under" tone="faint">
              {[
                ago(shown().authored),
                plural(shown().files.length, "file"),
                row()?.mark === "pull"
                  ? "only on origin: pull to take it"
                  : row()?.mark === "push"
                    ? "not pushed yet"
                    : "",
                shown().id.slice(0, 7),
              ]
                .filter((part) => part !== "")
                .join(" · ")}
            </Text>
            <If when={shown().body !== ""}>
              <Text tone="quiet">{shown().body}</Text>
            </If>
          </View>
          <View testID="git-commit-files">
            <Each key={(file: GitCommitFile) => file.path} of={shown().files}>
              {(file) => (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Text font="code" style={{ flex: 1, minWidth: 0 }}>
                    {file().path}
                  </Text>
                  <Text size="under" tone="faint">
                    {file().added === null ? "binary" : `+${file().added} −${file().removed}`}
                  </Text>
                </View>
              )}
            </Each>
          </View>
          <If when={patch()} else={<Spinner label="Reading its changes" />}>
            {(text) => (
              <Diff
                keys
                patch={text()}
                path=""
                testID="git-commit-diff"
                wrap={props.width === "narrow"}
              />
            )}
          </If>
        </View>
      )}
    </If>
  );
}

/** What the pane shows for `shown`. */
function Shown(props: { picked: Picked; repo: string; width: WidthClass }) {
  const page = gitPage(props.repo);
  const listed = () => {
    const now = page();
    return now === undefined || now === null || isListed(now);
  };
  return (
    <If
      when={listed()}
      else={
        <Empty
          icon="check"
          title={`${"path" in props.picked ? props.picked.path : "It"} has no changes now`}
          words="It was committed or discarded: the History has the commit, and Changes the files left."
        />
      }
    >
      {props.picked.kind === "file" ? (
        <FileDiff
          folder={props.picked.folder}
          path={props.picked.path}
          repo={props.repo}
          width={props.width}
        />
      ) : props.picked.kind === "conflict" ? (
        <ConflictEditor path={props.picked.path} repo={props.repo} />
      ) : (
        <CommitDiff id={props.picked.id} repo={props.repo} width={props.width} />
      )}
    </If>
  );
}

export function Detail(props: { repo: string; width: WidthClass }) {
  registerKey({
    hint: "s",
    hintLabel: "stage",
    keys: "s",
    label: "Stage or unstage the file",
    run: () => (untracked(staging)?.run() === true ? undefined : false),
    when: () => staging() !== null,
  });
  // Keyed by what is shown, so a file's view is made anew for another file.
  const shown = computed(() => picked(), {
    equals: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });
  return (
    <If
      when={shown()}
      else={
        <Empty
          icon="git-compare"
          title="Nothing picked"
          words="Pick a changed file in Changes, or a commit in History, and its diff shows here."
        />
      }
    >
      {(now) => (
        <Each key={(one: Picked) => JSON.stringify(one)} of={[now()]}>
          {(one) => (
            <View style={{ flex: 1 }}>
              <Shown picked={one()} repo={props.repo} width={props.width} />
            </View>
          )}
        </Each>
      )}
    </If>
  );
}
