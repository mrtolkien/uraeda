// The main checkout's branch against `origin`, and what moves it: "main · 3 to pull · 6 to push ·
// fetched 4 min ago", with Fetch, Pull, Push, and Merge, and lazygit's keys for them, `f` `p` `P`
// `M`, on in every pane of the page. A push leaves this machine, so `P` and its button ask first,
// naming what goes where, and `P` again or Enter pushes; so do a stopped merge's Continue, which
// commits it, and its Abort, which drops what was resolved. What holds them back says so, in a
// banner with its way out: an agent at work, the last fetch's failure, a stopped pull or merge.
import { signal, View } from "nsh";
import { record } from "../../store";
import type { GitPage } from "../../store/protocol";
import { Banner, Button, Confirm, Refusal, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys/registry";
import { Dialog } from "../../ui/surfaces";
import { Line, List, createCursor } from "../../ui/lists";
import { ago } from "./when";
import { isPending, refusalAt, write } from "./writes";

/** The repository whose merge picker is open, drawn by its Changes pane. */
const merging = signal<string | null>(null);

/** The repository whose push is asked about, drawn by its Changes pane. */
const pushing = signal<string | null>(null);

/**
 * The page's record, as every pane of it reads it: called as a component renders, which holds it.
 * A guard, a key's `run`, or a listener reads the accessor it gave, and never calls this.
 */
export const gitPage = (repo: string) => record("GitPage", { repo });

/** The control the sync's writes come from, and their refusals show under. */
const syncAt = (repo: string) => `${repo}/sync`;

/** "1 commit", "3 commits". */
const commits = (count: number) => `${count} ${count === 1 ? "commit" : "commits"}`;

/** Whether a pull or a merge stopped, which holds the others back until it goes on or aborts. */
const stuck = (page: GitPage) => page.stopped !== null;

/** The branch's words: its name, what waits each way, and when `origin` was read. */
function syncWords(page: GitPage): string {
  const branch = page.branch ?? (page.detached === null ? "no branch" : `at ${page.detached}`);
  if (!page.hasRemote) return `${branch} · no origin`;
  const parts = [branch];
  if (page.behind > 0) parts.push(`${page.behind} to pull`);
  if (page.ahead > 0) parts.push(`${page.ahead} to push`);
  if (page.behind === 0 && page.ahead === 0) parts.push("up to date");
  if (page.stopped !== null) parts.push(`${page.stopped.kind} stopped`);
  parts.push(page.fetchedAt === null ? "never fetched" : `fetched ${ago(page.fetchedAt)}`);
  return parts.join(" · ");
}

/**
 * The sync's actions, each `false` where it cannot run now, as its key's guard reads it. Called
 * as a component renders: it holds the page's record once, for its guards and its actions, which
 * the keyboard runs outside anything that would let a record go.
 */
export function syncActions(repo: string, toChanges: () => void = () => undefined) {
  const page = gitPage(repo);
  const can = (also: (page: GitPage) => boolean) => () => {
    const now = page();
    return now !== undefined && now !== null && now.hasRemote && also(now);
  };
  const branch = () => page()?.branch ?? "the branch";
  return {
    canFetch: can(() => true),
    canMerge: () => {
      const now = page();
      return now !== undefined && now !== null && !stuck(now) && now.branches.length > 0;
    },
    canPull: can((now) => !stuck(now)),
    canPush: can((now) => !stuck(now) && now.branch !== null),
    fetch: () => void write(syncAt(repo), "git.fetch", { quiet: false, repo }, "Fetching origin"),
    // The picker is the Changes pane's: from another pane, the focus goes there first.
    merge: () => {
      toChanges();
      merging.set(repo);
    },
    pull: () => void write(syncAt(repo), "git.pull", { repo }, `Pulling ${branch()} from origin`),
    // Asked first, in the Changes pane: a push leaves this machine.
    push: () => {
      toChanges();
      pushing.set(repo);
    },
    pushNow: () => void write(syncAt(repo), "git.push", { repo }, `Pushing ${branch()} to origin`),
  };
}

/**
 * The sync's keys, in the scope of the pane that mounts them: each pane of the page does, and
 * names how the focus goes to Changes, whose merge picker `M` opens.
 */
export function SyncKeys(props: { repo: string; toChanges?: () => void }) {
  const act = syncActions(props.repo, props.toChanges);
  registerKey([
    { keys: "f", label: "fetch", run: act.fetch, when: act.canFetch },
    { hint: "p", keys: "p", label: "pull", run: act.pull, when: act.canPull },
    { hint: "P", keys: "P", label: "push", run: act.push, when: act.canPush },
    { keys: "M", label: "merge a branch", run: act.merge, when: act.canMerge },
  ]);
  return null;
}

/** The branch line, its buttons, and what holds the page back, at the top of Changes. */
export function Sync(props: { narrow: boolean; repo: string }) {
  const act = syncActions(props.repo);
  const at = syncAt(props.repo);
  const read = gitPage(props.repo);
  return (
    <If when={read()}>
      {(page) => (
        <View style={{ gap: 10 }}>
          <Text testID="git-sync" tone="quiet">
            {syncWords(page())}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Button
              disabled={!act.canFetch()}
              icon="refresh-cw"
              label="Fetch"
              onPress={act.fetch}
              pending={isPending(at)}
            />
            <Button
              disabled={!act.canPull()}
              icon="arrow-down"
              label={page().behind > 0 ? `Pull ${page().behind}` : "Pull"}
              onPress={act.pull}
            />
            <Button
              disabled={!act.canPush()}
              icon="arrow-up"
              label={`Push to origin${page().ahead > 0 ? ` · ${page().ahead}` : ""}…`}
              onPress={act.push}
            />
            <If when={!props.narrow}>
              <Button
                disabled={!act.canMerge()}
                icon="git-merge"
                label="Merge…"
                onPress={act.merge}
              />
            </If>
          </View>
          <If when={refusalAt(at)}>
            {(words) => <Refusal testID="git-sync-refusal" words={words()} />}
          </If>
          <Holds page={page()} repo={props.repo} />
          <MergePicker
            merging={merging() === props.repo}
            onClose={() => merging.set(null)}
            repo={props.repo}
          />
          <Confirm
            icon="arrow-up"
            keys="P"
            label={page().ahead > 0 ? `Push ${commits(page().ahead)}` : "Push"}
            onClose={() => pushing.set(null)}
            onConfirm={act.pushNow}
            open={pushing() === props.repo}
            testID="git-push"
            title={
              page().ahead > 0
                ? `Push ${commits(page().ahead)} to origin/${page().branch ?? ""}?`
                : `Push ${page().branch ?? "the branch"} to origin?`
            }
            words={
              page().ahead > 0
                ? "They leave this machine for origin, where others pull them: a push is not taken back from here."
                : "Nothing waits to be pushed, as far as the last fetch says: it pushes what origin lacks, if anything."
            }
          />
        </View>
      )}
    </If>
  );
}

/** What holds the page's writes back, each with its cause and its way out. */
function Holds(props: { page: GitPage; repo: string }) {
  const at = `${props.repo}/stopped`;
  const left = () => props.page.conflicts.filter((one) => !one.isResolved).length;
  const goOn = () => void write(at, "git.continue", { repo: props.repo }, "Continuing");
  const abort = () => void write(at, "git.abort", { repo: props.repo }, "Aborting");
  // Either asks first: one commits the merge, the other drops what was resolved.
  const asking = signal<"continue" | "abort" | null>(null);
  const kind = () => props.page.stopped?.kind ?? "merge";
  const files = () => props.page.conflicts.length;
  return (
    <>
      <If when={props.page.agentWorking}>
        <Banner title="An agent works in this checkout">
          Pull, push, merge, staging, and commits here come back once its turn ends.
        </Banner>
      </If>
      <If when={props.page.fetchFailure}>
        {(why) => (
          <Banner title="The last fetch failed" tone="caution">
            {why()}
          </Banner>
        )}
      </If>
      <If when={props.page.stopped}>
        {(stopped) => (
          <Banner
            action={
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Button
                  disabled={left() > 0}
                  keys="m"
                  label="Continue…"
                  onPress={() => asking.set("continue")}
                  pending={isPending(at)}
                  variant="main"
                />
                <Button
                  keys="A"
                  label="Abort…"
                  onPress={() => asking.set("abort")}
                  variant="danger"
                />
              </View>
            }
            title={`The ${stopped().kind} stopped: ${left() === 0 ? "every conflict is resolved." : `${left()} ${left() === 1 ? "file conflicts" : "files conflict"}.`}`}
            tone="needs"
          >
            {left() === 0
              ? "Continue goes on with it; Abort puts the branch back as it was."
              : `Take ${stopped().ours} or ${stopped().theirs} for each file, or edit it, then Continue. Abort puts the branch back as it was.`}
          </Banner>
        )}
      </If>
      <If when={refusalAt(at)}>{(words) => <Refusal words={words()} />}</If>
      <Confirm
        icon="git-merge"
        keys="m"
        label={`Continue the ${kind()}`}
        onClose={() => asking.set(null)}
        onConfirm={goOn}
        open={asking() === "continue"}
        title={`Continue the ${kind()}?`}
        words={`Every conflict is resolved: it commits the ${kind()} on ${props.page.branch ?? "the branch"}, with ${files() === 1 ? "the file" : `the ${files()} files`} as resolved here.`}
      />
      <Confirm
        loses
        keep="Keep resolving"
        keys="A"
        label={`Abort the ${kind()}`}
        onClose={() => asking.set(null)}
        onConfirm={abort}
        open={asking() === "abort"}
        title={`Abort the ${kind()}?`}
        words={`The branch goes back as it was before the ${kind()}, and what you resolved here is dropped. Nothing brings it back.`}
      />
    </>
  );
}

/** "Merge into main…": the branches a merge may take, in a dialog; Enter or a press merges one. */
function MergePicker(props: { merging: boolean; onClose: () => void; repo: string }) {
  const page = gitPage(props.repo);
  const branches = () => page()?.branches ?? [];
  const rows = () => branches().map((name) => ({ id: name }));
  const cursor = createCursor(rows);
  const into = () => page()?.branch ?? "the branch";
  const merge = (branch: string) => {
    props.onClose();
    void write(
      syncAt(props.repo),
      "git.merge",
      { branch, repo: props.repo },
      `Merging ${branch} into ${into()}`,
    );
  };
  return (
    <Dialog
      icon="git-merge"
      onClose={props.onClose}
      open={props.merging}
      title={`Merge into ${into()}`}
    >
      <List
        cursor={cursor}
        onOpen={merge}
        openLabel="merge"
        row={(id) => <Line icon="git-branch" label={id()} />}
      />
    </Dialog>
  );
}
