// A story of a checkout's Storybook, live: `/f/<folder>/storybook?story=<path>#<export>`, and
// `/storybook?story=..` for the main checkout. The human tries a design before its code exists,
// at a phone's or a desktop's width. The main pane is the story, as its record says: the page once
// ready, else what runs, why it failed, or how to set a preview. The side pane is the story's
// facts and the other stories its feature's files link, which switch the main pane in place.
//
// `StoryEmbed` is the same story, drawn where a workflow file links it alone in its paragraph.
import { computed, View } from "nsh";
import { device, MAIN_CHECKOUT, navigate, record } from "../../store";
import type { Story, StoryLink } from "../../store/protocol";
import { Button, Spinner, Text } from "../../ui/controls";
import { definePane } from "../../ui/layout";
import { Card, type CardState, Empty } from "../../ui/lists";
import { isNarrow } from "../../ui/width";
import { LiveFrame, served, type Width } from "./LiveFrame";
import { type EmbedComment, type Picked, storyAbout } from "./pick";
import { useSpecComment } from "./specComment";
import { type Sibling, Siblings, show } from "./Siblings";
import { shortCommand } from "./command";
import { type Checkout, PreviewWords, Restart } from "./states";

/** A story as a page names it, `<path>#<export>`, in its checkout. */
type Of = Checkout & { story: string };

/** The export a story names: what a person calls it. */
export const exportOf = (story: string) => story.slice(story.lastIndexOf("#") + 1);

/** The stories file a story is in, from the repository's top level. */
const fileOf = (story: string) => story.slice(0, story.lastIndexOf("#"));

/** The story's record, by its id as the server takes it, `<folder>:<path>#<export>`. */
const storyOf = (of: Of) => record("Story", { id: `${of.folder}:${of.story}`, repo: of.repo });

/** The width picked for stories on this device, else the window's: a phone's on a phone. */
function storyWidth(): Width {
  return device.get("preview.width")?.story ?? (isNarrow() ? "phone" : "desktop");
}

const pickWidth = (story: Width) =>
  device.set("preview.width", { ...device.get("preview.width"), story });

/** A story that is not in its file on this branch, with the way out. */
function Missing(props: Of & { keys?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Empty
        icon="swatch-book"
        title={`No story “${exportOf(props.story)}” in ${fileOf(props.story)}`}
        words="Its stories file has no such export on this branch now: the story was renamed or removed. Pick another, or restart the preview if the file just changed."
      />
      <View style={{ paddingHorizontal: 8 }}>
        <Restart folder={props.folder} keys={props.keys} repo={props.repo} />
      </View>
    </View>
  );
}

/** The story, as its record says. `height` is an embed's; the page's fills its pane. */
export function StoryLive(
  props: Of & { comment?: (picked?: Picked) => void; height?: number; keys?: boolean },
) {
  const read = storyOf(props);
  const ready = () => {
    const shown = read();
    return shown?.state === "ready" ? shown.frame : null;
  };
  return (
    <If when={read() !== undefined} else={<Spinner label="Reading the story" />}>
      <If
        when={ready()}
        else={
          <If when={read()?.state === "missing"} else={<Words {...props} story={read()!} />}>
            <Missing {...props} />
          </If>
        }
      >
        {(frame) => (
          <LiveFrame
            actions={<Restart folder={props.folder} icon keys={props.keys} repo={props.repo} />}
            comment={props.comment}
            height={props.height}
            keys={props.keys}
            onWidth={pickWidth}
            src={served(frame())}
            testID="story-frame"
            title={`the story ${exportOf(props.story)}`}
            width={storyWidth()}
          />
        )}
      </If>
    </If>
  );
}

function Words(props: Checkout & { keys?: boolean; story: Story }) {
  return (
    <PreviewWords
      error={props.story.error}
      folder={props.folder}
      keys={props.keys}
      repo={props.repo}
      state={props.story.state}
    />
  );
}

/** The story `story` names, `<path>#<export>`, as a link to it says it. */
const linkOf = (story: string) => ({ export: exportOf(story), path: fileOf(story) });

/**
 * The page's story, live. While the spec waits for review and shows it, a comment on it (`c`), or
 * on an element picked in it (`p`), opens the spec beside it, the field under the block that shows
 * it.
 */
function StoryPageLive(props: Of) {
  const comment = useSpecComment(
    props.repo,
    props.folder,
    (version) => version.stories.find((one) => `${one.path}#${one.export}` === props.story)?.block,
  );
  return (
    <StoryLive
      {...props}
      comment={
        comment() === undefined
          ? undefined
          : (picked) => comment()?.(storyAbout(linkOf(props.story), picked))
      }
      keys
    />
  );
}

export const storyPane = definePane<Of>({
  icon: "swatch-book",
  kind: "preview-story",
  mark: (of) => ({ running: storyOf(of)()?.state === "starting" }),
  stack: "main",
  title: ({ story }) => exportOf(story),
  view: (props) => (
    <View style={{ flex: 1, gap: 8 }}>
      <Text tone="quiet">{fileOf(props.args.story)}</Text>
      <StoryPageLive {...props.args} />
    </View>
  ),
});

/** The stories the feature's files link, in their order, each once, the one shown among them. */
function linked(of: Of): ReadonlyArray<Sibling> {
  const found = new Map<string, Sibling>();
  const feature =
    of.folder === MAIN_CHECKOUT ? null : record("Feature", { id: of.folder, repo: of.repo })();
  for (const file of feature?.files ?? []) {
    const view = record("WorkflowFile", { id: `${of.folder}/${file.name}`, repo: of.repo })();
    for (const story of view?.current.stories ?? []) {
      const id = `${story.path}#${story.export}`;
      if (!found.has(id)) found.set(id, { id, label: story.label, meta: file.name });
    }
  }
  if (!found.has(of.story)) {
    found.set(of.story, { id: of.story, label: exportOf(of.story) });
  }
  return [...found.values()];
}

/** The preview's state, as a card says it. */
function stateOf(state: string | undefined): CardState | undefined {
  switch (state) {
    case "ready":
      return { label: "Running", tone: "done" };
    case "starting":
      return { label: "Starting", running: true, tone: "live" };
    case "failed":
      return { label: "Did not start", tone: "danger" };
    default:
      return undefined;
  }
}

/** What runs the stories: the checkout, its command, its folder. */
function PreviewCard(props: Of) {
  const preview = record("Preview", { folder: props.folder, repo: props.repo });
  const feature = () =>
    props.folder === MAIN_CHECKOUT
      ? null
      : record("Feature", { id: props.folder, repo: props.repo })();
  // The checkout's top level: the main checkout's, or a feature's worktree, from the main one.
  const root = () => {
    const main = record("Repositories", null)()?.rows.find((row) => row.name === props.repo)?.path;
    const worktree = feature()?.worktree;
    if (worktree == null || worktree.startsWith("/")) return worktree ?? main;
    return main === undefined ? undefined : `${main}/${worktree}`;
  };
  const facts = () => {
    const shown = preview();
    return [
      ...(shown?.command
        ? [
            {
              icon: "square-terminal" as const,
              label: shortCommand(shown.command, root()),
              tip: shown.command,
            },
          ]
        : []),
      ...(shown?.folder ? [{ icon: "folder" as const, label: `Runs in ${shown.folder}` }] : []),
      ...(feature()?.worktree
        ? [{ icon: "git-branch" as const, label: `In the worktree ${feature()!.worktree}` }]
        : []),
    ];
  };
  return (
    <Card
      facts={facts()}
      icon="swatch-book"
      state={stateOf(preview()?.state)}
      title={exportOf(props.story)}
      who={
        props.folder === MAIN_CHECKOUT
          ? `The main checkout's Storybook · ${fileOf(props.story)}`
          : `${feature()?.title ?? props.folder} · ${fileOf(props.story)}`
      }
    />
  );
}

export const storiesPane = definePane<Of>({
  icon: "list",
  kind: "preview-stories",
  stack: "side",
  title: "Stories",
  view: (props) => {
    const rows = computed(() => linked(props.args));
    return (
      <Siblings
        card={<PreviewCard {...props.args} />}
        empty={<Empty title="No stories" words="No file of this feature links a story." />}
        heading="The stories its files link"
        icon="swatch-book"
        open={(story) =>
          show(
            { folder: props.args.folder, page: "storybook", story },
            storyPane({ ...props.args, story }),
          )
        }
        rows={rows}
        shown={props.args.story}
      />
    );
  },
});

/**
 * A story linked alone in its paragraph of a workflow file, live in place: `link` is the
 * paragraph's `StoryLink`, of the file's checkout, `folder`, `main` for the main checkout. Its
 * button opens its page, where its keys are.
 */
export function StoryEmbed(props: Checkout & { comment?: EmbedComment; link: StoryLink }) {
  const story = () => `${props.link.path}#${props.link.export}`;
  return (
    <View style={{ gap: 6 }} testID="story-embed">
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text bold style={{ flex: 1 }}>
          {props.link.label}
        </Text>
        <Button
          icon="maximize-2"
          label="Open its page"
          onPress={() => navigate({ folder: props.folder, page: "storybook", story: story() })}
        />
      </View>
      <StoryLive
        comment={
          props.comment?.on() === true
            ? (picked) => props.comment?.open(storyAbout(props.link, picked))
            : undefined
        }
        folder={props.folder}
        height={isNarrow() ? 640 : 520}
        repo={props.repo}
        story={story()}
      />
    </View>
  );
}
