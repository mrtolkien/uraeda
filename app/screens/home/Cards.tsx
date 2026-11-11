// Home's cards, as a list: one cursor over them, `j` `k` and `Enter` in the pane's scope, a press
// opens one. Each pane of Home that lists things of several facts draws them here.
import { type Accessor, computed, type JSX, View } from "nsh";
import { Card, type CardProps, createCursor, Empty, listKeys } from "../../ui/lists";
import { usePane } from "../../ui/layout";

/** A card of Home: its key among the pane's, where it goes, and what it shows. */
export type HomeCard = Omit<CardProps, "onPress" | "selected"> & { id: string; open: () => void };

export function Cards(props: {
  cards: Accessor<ReadonlyArray<HomeCard>>;
  /** Shown while there is none: says why, never an empty space. */
  empty: JSX.Element;
}) {
  const pane = usePane();
  const at = pane.remember<string | null>("at", null);
  const items = computed(() => props.cards().map((card) => ({ id: card.id })));
  const cursor = createCursor(items, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  const byId = computed(() => new Map(props.cards().map((card) => [card.id, card] as const)));
  listKeys(cursor, { onOpen: (id) => byId().get(id)?.open() });
  return (
    <If when={props.cards().length > 0} else={props.empty}>
      <View style={{ gap: 8 }}>
        <Each key={(card: HomeCard) => card.id} of={props.cards()}>
          {(card) => (
            <Card
              body={card().body}
              facts={card().facts}
              hue={card().hue}
              icon={card().icon}
              onPress={() => {
                cursor.set(card().id);
                card().open();
              }}
              selected={cursor.holds(card().id)}
              state={card().state}
              testID={`card-${card().id}`}
              time={card().time}
              title={card().title}
              who={card().who}
            />
          )}
        </Each>
      </View>
    </If>
  );
}

/** "Nothing waits on you.", with what brings one. */
export const Nothing = (props: { title: string; words?: string }) => (
  <Empty icon="circle-check" title={props.title} words={props.words} />
);
