// The pages shown in place of a repository's, each a pane of the main stack, with the frame around
// it: the list is empty (the first run), the address names no listed repository, or the listed
// folder no longer holds one. The shell picks one before the route's own panes (`Frame.tsx`).
import { signal, View } from "nsh";
import { call, navigate, record } from "../../store";
import { Button, Heading, Text } from "../../ui/controls";
import { definePane, usePane } from "../../ui/layout";
import { TextField } from "../../ui/text";

/** The repository opened last whose folder is there. */
const recent = () => record("Repositories", null)()?.rows.find((row) => !row.missing)?.name;

/** A page's title and the words under it, as these pages say them. */
function Head(props: { title: string; words: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Heading level={1}>{props.title}</Heading>
      <Text tone="quiet">{props.words}</Text>
    </View>
  );
}

function FirstRun() {
  const pane = usePane();
  const folder = pane.remember<string>("folder", "");
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const add = async () => {
    const typed = folder().trim();
    if (typed === "" || pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      const added = await call("repositories.add", { folder: typed });
      navigate({ page: "home", repo: added.name });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ gap: 16, maxWidth: 560 }}>
      <Head
        title="Add your first repository"
        words="Uraeda shows the specs and runs agents in git repositories on this machine. Name the folder of one: its whole repository joins the list."
      />
      <TextField
        autoFocus
        label="Folder"
        lines="one"
        onChange={(value) => {
          folder.set(value);
          refusal.set(null);
        }}
        onEnter={() => void add()}
        placeholder="~/code/my-project"
        refusal={refusal()}
        value={folder()}
      />
      <View style={{ alignItems: "flex-start" }}>
        <Button
          icon="folder-plus"
          label="Add"
          onPress={() => void add()}
          pending={pending()}
          variant="main"
        />
      </View>
    </View>
  );
}

export const firstRun = definePane({
  icon: "folder-plus",
  kind: "repository-first-run",
  stack: "main",
  title: "Uraeda",
  view: () => <FirstRun />,
});

export const unknownRepository = definePane<{ name: string }>({
  icon: "folder-git-2",
  kind: "repository-unknown",
  stack: "main",
  title: "No such repository",
  view: (props) => {
    return (
      <View style={{ gap: 16, maxWidth: 560 }}>
        <Head
          title={`No repository named “${props.args.name}”`}
          words="It is not in Uraeda's list: it was removed, or the address was typed by hand."
        />
        <If when={recent()}>
          {(name) => (
            <View style={{ alignItems: "flex-start" }}>
              <Button
                icon="house"
                label={`Open ${name()}`}
                onPress={() => navigate({ page: "home", repo: name() })}
                variant="main"
              />
            </View>
          )}
        </If>
      </View>
    );
  },
});

function MissingFolder(props: { name: string; path: string }) {
  const repositories = record("Repositories", null);
  const refusal = signal<string | null>(null);
  const pending = signal(false);
  const remove = async () => {
    pending.set(true);
    refusal.set(null);
    try {
      await call("repositories.remove", { name: props.name });
      const next = repositories()?.rows.find((row) => row.name !== props.name);
      navigate({ page: "home", repo: next?.name });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ gap: 16, maxWidth: 560 }}>
      <Head
        title="Folder not found"
        words={`${props.name} was at ${props.path}, which no longer holds a git repository. Move it back and this page opens again, or remove it from Uraeda: its folder and its sessions stay as they are.`}
      />
      <View style={{ alignItems: "flex-start", gap: 6 }}>
        <Button
          icon="trash-2"
          label="Remove from Uraeda"
          onPress={() => void remove()}
          pending={pending()}
        />
        <If when={refusal()}>{(words) => <Text tone="danger">{words()}</Text>}</If>
      </View>
    </View>
  );
}

export const missingFolder = definePane<{ name: string; path: string }>({
  icon: "folder-git-2",
  kind: "repository-missing",
  stack: "main",
  title: "Folder not found",
  view: (props) => <MissingFolder name={props.args.name} path={props.args.path} />,
});
