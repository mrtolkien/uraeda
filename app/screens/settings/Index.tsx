// The settings' index: the search across every setting, then the categories, each with what it
// holds. While the search holds text, it lists the settings found, by category, and Enter on one
// opens its category. The search's text is kept in the visit, so Back returns to it.
import { View } from "nsh";
import { CATEGORIES, type Found, search, type Words } from "./categories";
import { navigate, record, route } from "../../store";
import { Icon, Kbd, Text } from "../../ui/controls";
import { registerKey } from "../../ui/keys";
import { usePane } from "../../ui/layout";
import { createCursor, Empty, List } from "../../ui/lists";
import { TextField, type TextFieldRef } from "../../ui/text";

/** The extensions as the search reads them: their title, description, and settings' names. */
function extensionWords(): ReadonlyArray<Words> {
  const rows = record("Extensions", { repo: null })()?.extensions ?? [];
  return rows.map((row) => ({
    help: row.description,
    label: row.title,
    terms: [row.name, ...row.settings.map((one) => one.label)],
  }));
}

/** A category's line: its icon, its name, and what it holds. */
function CategoryLine(props: { id: string }) {
  const category = () => CATEGORIES.find((one) => one.id === props.id)!;
  const shown = () => {
    const now = route();
    return now.page === "settings" && now.category === props.id;
  };
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 10, paddingVertical: 6 }}>
      <Icon name={category().icon} style={{ marginTop: 3 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text bold tone={shown() ? "accent" : "ink"}>
          {category().label}
        </Text>
        <Text tone="quiet">{category().about}</Text>
      </View>
    </View>
  );
}

/** A setting the search found: its name, then its category and what it does. */
function FoundLine(props: { found: Found }) {
  return (
    <View style={{ flex: 1, flexDirection: "row", gap: 10, paddingVertical: 6 }}>
      <Icon name={props.found.category.icon} style={{ marginTop: 3 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text bold>{props.found.words.label}</Text>
        <Text tone="quiet" lines={2}>
          {`${props.found.category.label} · ${props.found.words.help}`}
        </Text>
      </View>
    </View>
  );
}

export function Index() {
  const pane = usePane();
  const text = pane.remember<string>("search", "");
  let field: TextFieldRef | undefined;
  const found = () => search(text(), extensionWords());
  const rows = (): ReadonlyArray<{ id: string }> =>
    text().trim() === ""
      ? CATEGORIES.map((one) => ({ id: one.id }))
      : found().map((_, at) => ({ id: `${at}` }));
  const cursor = createCursor(rows);
  const open = (id: string) => {
    const hit = found()[Number(id)];
    const category = text().trim() === "" ? id : hit?.category.id;
    if (category !== undefined) navigate({ category, page: "settings" });
  };
  registerKey({
    hint: "/",
    icon: "search",
    keys: "/",
    label: "Search the settings",
    // A new search, as Vim's `/`: the last one's words do not stay in front of the new ones.
    run: () => {
      text.set("");
      field?.focus();
    },
  });
  return (
    <View style={{ gap: 10 }}>
      <TextField
        label="Search the settings"
        lines="one"
        onChange={(value) => text.set(value)}
        onEnter={() => {
          const first = rows()[0];
          if (first !== undefined) open(first.id);
        }}
        placeholder="Search the settings"
        ref={(made) => (field = made)}
        value={text()}
      />
      <List
        cursor={cursor}
        empty={
          <Empty
            icon="search"
            title={`No setting holds “${text().trim()}”`}
            words="The search reads each setting's name and what it does."
          />
        }
        onOpen={open}
        openLabel="open"
        row={(id) => (
          <If
            when={text().trim() === ""}
            else={<FoundLine found={found()[Number(id())] ?? found()[0]!} />}
          >
            <CategoryLine id={id()} />
          </If>
        )}
      />
      <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
        <Kbd keys="/" />
        <Text size="under" tone="faint">
          searches, Enter opens the first found
        </Text>
      </View>
    </View>
  );
}
