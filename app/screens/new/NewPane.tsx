// The New page's subject: what to start, a session, a change, or a feature, each a card that says
// what it makes, then the one composer the three share. A session starts with its first message,
// Enter in the composer as in any chat, on the default agent, named under it (rule 10). A change and
// a feature start with Ctrl+Enter or the Start button, which open the start dialog: Enter adds a
// line, as a start makes a branch and commits (rule 2). After a feature's start, the pane shows its
// steps landing and the way to its page; a change's start answers once landed, and opens its page;
// a new session opens its page (rule 9).
import { Clipboard, View } from "nsh";
import { call, navigate, record, redirect } from "../../store";
import type { NewKind } from "../../store";
import { Button, IconButton, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { PaneScroll, usePane } from "../../ui/layout";
import { SelectableCard } from "../../ui/lists";
import { Composer, type TextFieldRef } from "../../ui/text";
import { droppedImages, pastedImage, pickImages } from "../images";
import { HeldImages } from "../inbox/AddNote";
import { agentsOf } from "../runs/options";
import { draftOf, forgetLine, heldFor, hold, lineOf, release, sentImages } from "./draft";
import { Landing, rememberStarted } from "./Landing";
import { type StartAnswer, StartDialog } from "./StartDialog";

/** The three kinds, each as its card says it. */
const KINDS: ReadonlyArray<{
  kind: NewKind;
  icon: "message-square" | "wrench" | "flag";
  key: string;
  title: string;
  words: string;
}> = [
  {
    icon: "message-square",
    key: "s",
    kind: "session",
    title: "Session",
    words: "A chat with an agent in the main checkout: no branch, nothing committed.",
  },
  {
    icon: "wrench",
    key: "c",
    kind: "change",
    title: "Change",
    words: "A small fix on a branch of its own: the agent fixes, its reviewers review.",
  },
  {
    icon: "flag",
    key: "f",
    kind: "feature",
    title: "Feature",
    words:
      "The whole workflow: discovery, spec, plan, build, and review, each step yours to approve.",
  },
];

/** Which agent a new session runs on, and why, in words. */
function AgentWords(props: { repo: string }) {
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  const words = () => {
    const picked = agentsOf(agents()?.runtimes ?? [], settings()?.runs?.defaultAgent ?? null);
    if (agents() === undefined) return "Reading the agents…";
    if (picked.fallback === undefined)
      return "No agent is on in this repository: Settings › Extensions turns one on.";
    return picked.fallbackIsSet
      ? `It runs on ${picked.fallback.name}, the default agent of Settings › Runs.`
      : `It runs on ${picked.fallback.name}, the first agent on: Settings › Runs names a default agent.`;
  };
  return (
    <Text size="under" tone="quiet">
      {words()}
    </Text>
  );
}

export function NewView(props: { repo: string; kind: NewKind }) {
  const pane = usePane();
  const kind = () => props.kind;
  const draft = draftOf(() => props.repo);
  const started = rememberStarted(pane);
  const asking = pane.remember<boolean>("asking", false);
  const refusal = pane.remember<string | null>("refusal", null);
  const pending = pane.remember<boolean>("pending", false);
  const settings = record("Settings", null);
  const agents = record("Agent", { repo: props.repo });
  let field: TextFieldRef | undefined;
  const pick = (to: NewKind) => {
    redirect({ kind: to, page: "new", repo: props.repo });
    field?.focus();
  };
  const said = (run: () => Promise<unknown>) => {
    refusal.set(null);
    run().catch((error: Error) => refusal.set(error.message));
  };
  /** A new session, with the draft as its first message, on the default agent. */
  const sendSession = () =>
    said(async () => {
      if (pending()) return;
      pending.set(true);
      try {
        const runtime = agentsOf(
          agents()?.runtimes ?? [],
          settings()?.runs?.defaultAgent ?? null,
        ).fallback;
        const made = await call("session.newChat", {
          repo: props.repo,
          runtime: runtime?.id ?? null,
        });
        const images = await sentImages(props.repo);
        await call("session.send", {
          images,
          repo: props.repo,
          session: made.session,
          text: draft.text(),
        });
        draft.discard();
        release(props.repo);
        navigate({ id: made.session, page: "session-id", repo: props.repo });
      } finally {
        pending.set(false);
      }
    });
  /** A typed start, from the dialog: its refusal's words, or `null` once it started. */
  const start = async (answer: StartAnswer): Promise<string | null> => {
    try {
      const images = await sentImages(props.repo);
      const common = {
        images,
        line: lineOf(props.repo),
        options: answer.options,
        repo: props.repo,
        slug: answer.slug,
        text: draft.text(),
      };
      if (kind() === "change") {
        const made = await call("change.start", common);
        draft.discard();
        release(props.repo);
        forgetLine(props.repo);
        asking.set(false);
        navigate({ folder: made.folder, page: "feature", repo: props.repo });
        return null;
      }
      const plan = await call("feature.startText", {
        ...common,
        discovery: answer.discovery,
        write: {
          href: `/r/${props.repo}/new?kind=feature`,
          label: `Starting the feature ${answer.slug}`,
        },
      });
      draft.discard();
      release(props.repo);
      forgetLine(props.repo);
      asking.set(false);
      started.set({ folder: plan.folder, kind: "feature", title: plan.title });
      return null;
    } catch (error) {
      return (error as Error).message;
    }
  };
  const attach = (images: Promise<ReadonlyArray<Parameters<typeof hold>[1][number]>>) =>
    said(async () => hold(props.repo, await images));

  registerKey([
    ...KINDS.map((one) => ({
      keys: one.key,
      label: `New ${one.title.toLowerCase()}`,
      run: () => pick(one.kind),
    })),
    {
      inField: true,
      keys: "mod+v",
      label: "Paste, an image into the draft",
      run: () =>
        said(async () => {
          const image = await pastedImage();
          if (image !== undefined) hold(props.repo, [image]);
          else field?.insert(await Clipboard.readText());
        }),
    },
  ]);

  return (
    <View onFileDrop={(event) => attach(droppedImages(event.uris))} style={{ flex: 1 }}>
      <PaneScroll style={{ flex: 1 }}>
        <View style={{ gap: 16, maxWidth: 880, paddingBottom: 24 }}>
          <If
            when={started()}
            else={
              <>
                <View
                  style={{ flexDirection: pane.width() === "narrow" ? "column" : "row", gap: 8 }}
                >
                  <Each key={(one: (typeof KINDS)[number]) => one.kind} of={KINDS}>
                    {(one) => (
                      <View
                        style={
                          pane.width() === "narrow" ? undefined : { flexBasis: 0, flexGrow: 1 }
                        }
                      >
                        <SelectableCard
                          icon={one().icon}
                          onSelect={() => pick(one().kind)}
                          selected={kind() === one().kind}
                          testID={`new-${one().kind}`}
                          title={
                            pane.width() === "narrow"
                              ? one().title
                              : `${one().title} · ${one().key}`
                          }
                          words={one().words}
                        />
                      </View>
                    )}
                  </Each>
                </View>
                <Composer
                  attached={heldFor(props.repo).length}
                  attachments={
                    <HeldImages
                      images={heldFor(props.repo)}
                      onRemove={(image) => release(props.repo, (one) => one !== image)}
                    />
                  }
                  autoFocus
                  label={kind() === "session" ? "The first message" : `What the ${kind()} is about`}
                  onChange={(value) => {
                    draft.change(value);
                    refusal.set(null);
                  }}
                  onSend={() => (kind() === "session" ? sendSession() : asking.set(true))}
                  placeholder={
                    kind() === "session"
                      ? "Ask the agent anything about this repository"
                      : kind() === "change"
                        ? "What to fix, and how you know it is fixed"
                        : "What the feature is, and why"
                  }
                  ref={(made) => {
                    field = made;
                  }}
                  refusal={refusal()}
                  sendOn={kind() === "session" ? "enter" : "mod+enter"}
                  testID="new-composer"
                  value={draft.text()}
                />
                <View
                  style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                >
                  <If when={kind() !== "session"}>
                    <Button
                      disabled={draft.text().trim() === ""}
                      icon="play"
                      label={kind() === "change" ? "Start a change…" : "Start a feature…"}
                      onPress={() => asking.set(true)}
                      testID="new-start"
                      variant="main"
                    />
                  </If>
                  <IconButton
                    icon="image-plus"
                    label="Add images"
                    onPress={() => attach(pickImages())}
                  />
                  <If when={kind() === "session"}>
                    <AgentWords repo={props.repo} />
                  </If>
                  <If when={kind() !== "session" && lineOf(props.repo) !== null}>
                    <Text size="under" tone="quiet">
                      {`From the priorities' line "${lineOf(props.repo)}": its start links it.`}
                    </Text>
                  </If>
                </View>
                <If when={kind() !== "session"}>
                  <StartDialog
                    kind={kind() as "feature" | "change"}
                    onClose={() => asking.set(false)}
                    onStart={start}
                    open={asking()}
                    repo={props.repo}
                    text={draft.text()}
                  />
                </If>
              </>
            }
          >
            {(shown) => (
              <Landing
                againLabel="Start something else"
                onAgain={() => started.set(null)}
                repo={props.repo}
                started={shown()}
              />
            )}
          </If>
        </View>
      </PaneScroll>
    </View>
  );
}
