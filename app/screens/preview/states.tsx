// What a preview says while it shows no page, each state with its words and its way out: starting
// (what runs, and where), failed (the command's own words, whole, and Restart), none (how to set a
// preview command, or why this checkout cannot run one). `preview.restart` is one button, `r`
// where the page's own pane shows it.
import { signal, View } from "nsh";
import { call, MAIN_CHECKOUT, record } from "../../store";
import type { Preview } from "../../store/protocol";
import { Banner, Button, IconButton, Refusal, Spinner, Text } from "../../ui/controls";
import { Empty } from "../../ui/lists";

/** The checkout a preview runs in: a repository, and a feature's folder or `main`. */
export type Checkout = { folder: string; repo: string };

/**
 * Restarts the checkout's preview command: its refusal under it. `icon` draws it as an icon, in a
 * frame's row of buttons.
 */
export function Restart(props: Checkout & { icon?: boolean; keys?: boolean; main?: boolean }) {
  const pending = signal(false);
  const refusal = signal<string | null>(null);
  const press = async () => {
    if (pending()) return;
    pending.set(true);
    refusal.set(null);
    try {
      await call("preview.restart", { folder: props.folder, repo: props.repo });
    } catch (error) {
      refusal.set((error as Error).message);
    }
    pending.set(false);
  };
  return (
    <View style={{ alignItems: "flex-start", gap: 4 }}>
      <If
        when={props.icon === true}
        else={
          <Button
            icon="power"
            keys={props.keys === true ? "r" : undefined}
            label="Restart the preview"
            onPress={() => void press()}
            pending={pending()}
            variant={props.main === true ? "main" : "tube"}
          />
        }
      >
        <IconButton
          disabled={pending()}
          icon="power"
          keys={props.keys === true ? "r" : undefined}
          label="Restart the preview"
          onPress={() => void press()}
        />
      </If>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
    </View>
  );
}

/** Whether the checkout has an active preview decision. */
function hasPreview(checkout: Checkout): boolean | undefined {
  if (checkout.folder === MAIN_CHECKOUT) {
    return record("Workspace", { repo: checkout.repo })()?.preview;
  }
  const feature = record("Feature", { id: checkout.folder, repo: checkout.repo })();
  return feature === undefined ? undefined : (feature?.preview ?? false);
}

/** No preview runs for the checkout: how to set one, or why it cannot run here. */
function NoPreview(props: Checkout) {
  return (
    <If
      when={hasPreview(props) === true}
      else={
        <Empty
          icon="square-terminal"
          title="No preview command"
          words="This project runs no preview. To see its stories here, add “preview-folder” and “preview-command” to an active specs/decisions/preview.md: the command runs in that folder, and “{port}” in it is the port it listens on."
        />
      }
    >
      <Empty
        icon="git-branch"
        title="This feature has no worktree"
        words="Its preview runs in its worktree, which starting work on it makes. Start its work to see its stories here."
      />
    </If>
  );
}

/** The command that starts, and where: "node serve.mjs --port {port}, in packages/web". */
function Starting(props: { preview: Preview | null | undefined }) {
  return (
    <View style={{ gap: 6, paddingVertical: 12 }}>
      <Spinner label="Starting the preview" />
      <If when={props.preview?.command}>
        {(command) => (
          <Text tone="quiet">
            {`It runs “${command()}”, in ${props.preview?.folder ?? "its folder"}. A preview stops after 30 minutes unseen, or when its code changes, and starts again when shown.`}
          </Text>
        )}
      </If>
    </View>
  );
}

/**
 * The preview's state when no page shows: `state` and `error` are the shown record's, a
 * `Preview`'s or a `Story`'s. `keys` gives Restart its key, on the page's own pane.
 */
export function PreviewWords(
  props: Checkout & { error: string | null; keys?: boolean; state: string },
) {
  const preview = record("Preview", { folder: props.folder, repo: props.repo });
  return (
    <View style={{ gap: 8 }}>
      <If when={props.state === "starting"}>
        <Starting preview={preview()} />
      </If>
      <If when={props.state === "failed"}>
        <Banner
          action={<Restart folder={props.folder} keys={props.keys} main repo={props.repo} />}
          title="The preview did not start"
          tone="danger"
        >
          {props.error ?? "Its command ended without saying why."}
        </Banner>
      </If>
      <If when={props.state === "none"}>
        <NoPreview folder={props.folder} repo={props.repo} />
      </If>
    </View>
  );
}
