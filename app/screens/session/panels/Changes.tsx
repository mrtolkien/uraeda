// The session's Changes: the files its agent edited with a tool, each with its edits, then, for a
// feature's or a change's session, the files its branch changed outside its folder, each with its
// lines. `Enter` or a press opens a file's diff in the pane, the Git page's `Diff`: for a branch,
// from where it left the default branch to the file on disk, so what the agent writes now shows
// too; for a chat, the main checkout's change. `Escape` or "Files" goes back to the list.
// `shift+Enter`, a long press, or the pane's menu opens the diff beside, in the main stack, as a
// tab of its own: the diff beside the transcript.
import { View } from "nsh";
import { FileDiff, sessionDiff } from "./FileDiff";
import { record } from "../../../store";
import type { Session } from "../../../store/protocol";
import { Refusal } from "../../../ui/controls";
import { usePane } from "../../../ui/layout";
import { createCursor, Empty, Line, List } from "../../../ui/lists";
import type { SessionArgs } from "../place";
import { Padded, WithSession } from "./read";
import { plural } from "../../../ui/words";

/** A row of the list: a part's title, or a file of it. */
type Row = { id: string; label: string; meta?: string; file?: string; head: boolean };

export function ChangesPane(props: { args: SessionArgs }) {
  return (
    <WithSession
      args={props.args}
      none={
        <Padded>
          <Empty
            icon="git-compare"
            title="Nothing changed yet"
            words="The session starts with its first message: the files its agent edits, and its branch's, show here."
          />
        </Padded>
      }
    >
      {(session) => <Changes repo={props.args.repo} session={session} />}
    </WithSession>
  );
}

function Changes(props: { repo: string; session: () => Session }) {
  const pane = usePane();
  const picked = pane.remember<string | null>("file", null);
  const folder = () => props.session().folder;
  return (
    <If when={picked()} else={<Files folder={folder()} {...props} onPick={picked.set} />}>
      {(path) => (
        <FileDiff
          folder={folder()}
          onBack={() => picked.set(null)}
          path={path()}
          repo={props.repo}
        />
      )}
    </If>
  );
}

function Files(props: {
  folder: string | null;
  onPick: (path: string) => void;
  repo: string;
  session: () => Session;
}) {
  const pane = usePane();
  const kept = pane.remember<string | null>("at", null);
  const branch = () =>
    props.folder === null
      ? undefined
      : record("BranchChanges", { id: props.folder, repo: props.repo })();
  const rows = (): Array<Row> => {
    const edited = props.session().edited;
    const out: Array<Row> = [];
    if (edited.length > 0) {
      out.push({
        head: true,
        id: "head:session",
        label: `This session · ${plural(edited.length, "file")}`,
      });
      for (const file of edited) {
        out.push({
          file: file.id,
          head: false,
          id: `s:${file.id}`,
          label: file.id,
          meta: plural(file.edits, "edit"),
        });
      }
    }
    const changes = branch()?.changes;
    if (changes != null && changes.count > 0) {
      const left = changes.count - changes.files.length;
      out.push({
        head: true,
        id: "head:branch",
        label: `On the branch · ${plural(changes.count, "file")}`,
        meta: `+${changes.added} −${changes.removed}`,
      });
      for (const file of changes.files) {
        out.push({
          file: file.path,
          head: false,
          id: `b:${file.path}`,
          label: file.path,
          meta: file.added === null ? "binary" : `+${file.added} −${file.removed}`,
        });
      }
      if (left > 0) {
        out.push({
          head: true,
          id: "head:more",
          label: `and ${plural(left, "more file")}, on the Git page`,
        });
      }
    }
    return out;
  };
  const byId = () => new Map(rows().map((row) => [row.id, row]));
  const cursor = createCursor(rows, {
    initial: kept() ?? undefined,
    onChange: (id) => kept.set(id ?? null),
  });
  return (
    <View style={{ flex: 1 }}>
      <If when={branch()?.failed === true}>
        <Padded>
          <Refusal words="The branch's changes could not be read: git failed. The Git page may say why." />
        </Padded>
      </If>
      <List
        beside={(id) => {
          const file = byId().get(id)?.file;
          return file === undefined
            ? undefined
            : sessionDiff({ folder: props.folder ?? "", path: file, repo: props.repo });
        }}
        cursor={cursor}
        empty={
          <Padded>
            <Empty
              icon="git-compare"
              title="No file edited"
              words={
                props.folder === null
                  ? "Its agent edited no file with a tool. Files written by shell commands are not listed: the Git page shows every change."
                  : "Its agent edited no file with a tool, and its branch changed nothing outside its folder yet."
              }
            />
          </Padded>
        }
        onOpen={(id) => {
          const file = byId().get(id)?.file;
          if (file !== undefined) props.onPick(file);
        }}
        openLabel="show its diff"
        row={(id) => {
          const row = () => byId().get(id());
          return (
            <Line
              icon={
                row()?.head === true
                  ? undefined
                  : row()?.id.startsWith("s:")
                    ? "file-pen-line"
                    : "file-text"
              }
              label={row()?.label ?? ""}
              meta={row()?.meta}
              quiet={row()?.head === true}
            />
          );
        }}
        testID="session-changes"
      />
    </View>
  );
}
