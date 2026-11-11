// A feature's HTML mockup, live: `/f/<folder>/mockups/<name>`, a page of its `mockups/` folder that
// an agent wrote to show a layout before the code exists. The main pane is the page, at its room's
// width unless another is picked; the side pane is its facts and the feature's other mockups,
// which switch the main pane in place. The server gives the page's address, with the frame
// secret: a web view sends no cookie.
//
// `MockupEmbed` is the same page, drawn where a workflow file links it alone in its paragraph.
import { computed, View } from "nsh";
import { device, navigate, record } from "../../store";
import type { MockupEmbed as Embedded } from "../../store/protocol";
import { Banner, Button, Spinner, Text } from "../../ui/controls";
import { definePane } from "../../ui/layout";
import { Card, Empty } from "../../ui/lists";
import { LiveFrame, served, type Width } from "./LiveFrame";
import { type Sibling, Siblings, show } from "./Siblings";
import type { Checkout } from "./states";

/** A mockup by its file's name in its feature's `mockups/` folder. */
type Of = Checkout & { name: string };

/** The mockup's file, from the repository's top level. */
const pathOf = (of: Of) => `specs/${of.folder}/mockups/${of.name}`;

/** The width picked for mockups on this device: their room's until one is. */
const mockupWidth = (): Width => device.get("preview.width")?.mockup ?? "fit";

const pickWidth = (mockup: Width) =>
  device.set("preview.width", { ...device.get("preview.width"), mockup });

/** A mockup's file that is not there, with the way out. */
function Gone(props: { path: string }) {
  return (
    <Empty
      icon="layout-template"
      title="No such mockup"
      words={`${props.path} is not on this feature's branch: it was renamed or removed. Its other mockups are listed beside it.`}
    />
  );
}

/**
 * The mockup's page, as its record says: `path` from the repository's top level, then the link's
 * query and anchor, `after`. `width` is the link's; the page's own pane picks one.
 */
function MockupLive(props: {
  after?: string;
  height?: number;
  keys?: boolean;
  path: string;
  repo: string;
  title: string;
  width?: number;
}) {
  const read = record("Mockup", { path: props.path, repo: props.repo });
  return (
    <If
      when={read.error()}
      else={
        <If when={read() !== undefined} else={<Spinner label="Finding the mockup" />}>
          <If when={read()?.frame} else={<Gone path={props.path} />}>
            {(frame) => (
              <LiveFrame
                height={props.height}
                keys={props.keys}
                onWidth={props.width === undefined ? pickWidth : undefined}
                src={served(`${frame()}${props.after ?? ""}`)}
                testID="mockup-frame"
                title={props.title}
                width={props.width ?? mockupWidth()}
              />
            )}
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner title="The mockup could not be read" tone="danger">
          {error().message}
        </Banner>
      )}
    </If>
  );
}

export const mockupPane = definePane<Of>({
  icon: "layout-template",
  kind: "preview-mockup",
  stack: "main",
  title: ({ name }) => name,
  view: (props) => (
    <View style={{ flex: 1, gap: 8 }}>
      <Text tone="quiet">{pathOf(props.args)}</Text>
      {/* TASK 42: a comment on the spec's line that links the mockup, while the spec waits. */}
      <MockupLive
        keys
        path={pathOf(props.args)}
        repo={props.args.repo}
        title={`the mockup ${props.args.name}`}
      />
    </View>
  ),
});

/** The feature's mockups, its `mockups/` folder's pages, the one shown among them. */
function mockupsOf(of: Of): ReadonlyArray<Sibling> {
  const names = record("Feature", { id: of.folder, repo: of.repo })()?.mockups ?? [];
  const all = names.includes(of.name) ? names : [of.name, ...names];
  return all.map((name) => ({ id: name, label: name }));
}

export const mockupsPane = definePane<Of>({
  icon: "list",
  kind: "preview-mockups",
  stack: "side",
  title: "Mockups",
  view: (props) => {
    const rows = computed(() => mockupsOf(props.args));
    const feature = () => record("Feature", { id: props.args.folder, repo: props.args.repo })();
    return (
      <Siblings
        card={
          <Card
            facts={[{ icon: "file-text", label: pathOf(props.args) }]}
            icon="layout-template"
            title={props.args.name}
            who={`A mockup of ${feature()?.title ?? props.args.folder}`}
          />
        }
        empty={<Empty title="No mockups" words="This feature's mockups/ folder holds no page." />}
        heading="Its feature's mockups"
        icon="layout-template"
        open={(name) =>
          show(
            { folder: props.args.folder, name, page: "mockup" },
            mockupPane({ ...props.args, name }),
          )
        }
        rows={rows}
        shown={props.args.name}
      />
    );
  },
});

/**
 * An HTML mockup linked alone in its paragraph of a workflow file, live in place, at the width its
 * link's `?w=` names: `mockup` is the paragraph's `MockupEmbed`, of the file's feature, `folder`.
 * Its button opens the mockup's page, for one of the feature's own `mockups/` folder.
 */
export function MockupEmbed(props: Checkout & { mockup: Embedded }) {
  const own = `specs/${props.folder}/mockups/`;
  const after = () =>
    `${props.mockup.query ? `?${props.mockup.query}` : ""}${props.mockup.anchor ? `#${props.mockup.anchor}` : ""}`;
  return (
    <View style={{ gap: 6 }} testID="mockup-embed">
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text bold style={{ flex: 1 }}>
          {props.mockup.label}
        </Text>
        <If
          when={
            props.mockup.path.startsWith(own) && !props.mockup.path.slice(own.length).includes("/")
          }
        >
          <Button
            icon="maximize-2"
            label="Open its page"
            onPress={() =>
              navigate({
                folder: props.folder,
                name: props.mockup.path.slice(own.length),
                page: "mockup",
              })
            }
          />
        </If>
      </View>
      <MockupLive
        after={after()}
        height={560}
        path={props.mockup.path}
        repo={props.repo}
        title={props.mockup.label}
        width={props.mockup.width}
      />
    </View>
  );
}
