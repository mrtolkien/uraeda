// A proposal of the priorities, as its line reads: its words, its nested lines, where it stands,
// and the ways on, its feature or its file, and to another section, which a touch screen has no
// other way to. The proposal's own pane, where its text is written and its work started, is task
// 38's: it takes this one's place once it is declared (`index.ts`).
import { View } from "nsh";
import { createOrder } from "./moves";
import { byKey } from "./order";
import { plain, stepWords } from "./Section";
import { navigate, record } from "../../store";
import { Banner, Button, Heading, Spinner, Text } from "../../ui/controls";
import { Empty } from "../../ui/lists";

const toList = () => navigate({ page: "priorities" });

/** The words of the sections, as a button says them. */
const titleOf = (sections: ReadonlyArray<{ section: string; title: string }>, id: string) =>
  sections.find((one) => one.section === id)?.title ?? id;

export function Proposal(props: { repo: string; id: string }) {
  const priorities = record("Priorities", { repo: props.repo });
  const order = createOrder(() => props.repo, priorities);
  const proposal = () => {
    const now = priorities();
    return now ? byKey(now).get(props.id) : undefined;
  };
  const sections = () => priorities()?.sections ?? [];
  /** The section it shows in now: the one a move just sent it to. */
  const where = () =>
    Object.entries(order.order()).find(([, keys]) => keys.includes(props.id))?.[0];

  return (
    <If when={priorities() !== undefined} else={<Spinner label="Reading the priorities" />}>
      <If
        when={proposal()}
        else={
          <Empty
            action={{ icon: "list", label: "Back to the priorities", run: toList }}
            icon="list"
            title="That proposal is gone"
            words="Its line was removed or rewritten since this address was made: the priorities show what is there now."
          />
        }
      >
        {(shown) => (
          <View style={{ gap: 14, maxWidth: 720 }}>
            <View style={{ gap: 6 }}>
              <Text size="under" tone="quiet">
                {shown().running
                  ? `Started · ${stepWords(shown())}`
                  : shown().merged
                    ? "Merged"
                    : `In ${titleOf(sections(), where() ?? "")}`}
              </Text>
              <Heading level={2}>{plain(shown())}</Heading>
              <If when={shown().file}>
                {(file) => (
                  <Text font="code" size="under" tone="faint">
                    {file().path}
                  </Text>
                )}
              </If>
            </View>
            <If when={shown().children.length > 0}>
              <View style={{ gap: 4 }}>
                <Each of={shown().children}>
                  {(child) => (
                    <Text style={{ paddingLeft: (child().depth - 1) * 16 }} tone="ink">
                      {`• ${child()
                        .spans.map((span) => span.text)
                        .join("")}`}
                    </Text>
                  )}
                </Each>
              </View>
            </If>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <If when={shown().running ?? shown().merged}>
                {(feature) => (
                  <Button
                    icon="flag"
                    label="Open its feature"
                    onPress={() => navigate({ folder: feature().folder, page: "feature" })}
                    variant="main"
                  />
                )}
              </If>
              <If when={!shown().running && !shown().merged ? shown().file : undefined}>
                {(file) => (
                  <Button
                    icon="file-text"
                    label="Open its file"
                    onPress={() => navigate({ page: "edit", path: file().path })}
                    variant="main"
                  />
                )}
              </If>
            </View>
            <If when={!shown().running}>
              <View style={{ gap: 6 }}>
                <Text size="under" tone="quiet">
                  Move it to the top of
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Each of={sections().filter((one) => one.section !== where())}>
                    {(one) => (
                      <Button
                        label={one().title}
                        onPress={() =>
                          order.move({ index: 0, key: props.id, section: one().section })
                        }
                        pending={order.pending()}
                      />
                    )}
                  </Each>
                </View>
                <If when={order.refusal()}>
                  {(refused) => (
                    <Banner tone="danger" title="Not moved">
                      {refused().words}
                    </Banner>
                  )}
                </If>
              </View>
            </If>
          </View>
        )}
      </If>
    </If>
  );
}
