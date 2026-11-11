// The Wiki's page: the place "Wiki", `Space w`, with the count of its pages in the rail, listing
// the pages of the record `pages` and drawing the one picked, which the action `read` gives; and a
// pane of Home, "Wiki", with the first pages, each opening the place. Drawn with the app's own
// components, in the app's theme.
import { effect, Scroll, signal, View } from "nsh";
import { homePane, navigate, place, useAction, useRecord, useRepository } from "uraeda/page";
import { Banner, Empty, Heading, Line, Row, Spinner, Text } from "uraeda/ui";
import type { Wiki, WikiPage } from "./server";

/** The wiki's pages, or why they cannot be shown: the record's error, or its folder missing. */
function usePages() {
  const wiki = useRecord<Wiki>("pages");
  const missing = () => {
    const value = wiki().value;
    return value?.isMissing === true ? value.folder : undefined;
  };
  return { missing, pages: () => wiki().value?.pages ?? [], wiki };
}

/** The place: the pages, a row each, and the one picked under them. */
function WikiPlace() {
  const { missing, pages, wiki } = usePages();
  const read = useAction<{ path: string }, string>("read");
  const picked = signal<string | undefined>(undefined);
  const text = signal<string | undefined>(undefined);
  const refused = signal<string | undefined>(undefined);
  // The first page until another is picked; each pick reads it.
  effect(() => {
    const path = picked() ?? pages()[0]?.path;
    if (path === undefined) return;
    refused.set(undefined);
    read({ path }).then(
      (page) => text.set(page),
      (error: unknown) => refused.set(error instanceof Error ? error.message : String(error)),
    );
  });
  const shown = () => picked() ?? pages()[0]?.path;
  return (
    <Scroll style={{ flex: 1 }}>
      <View style={{ gap: 12 }}>
        <If when={wiki().error}>
          {(error) => <Banner title={`The wiki cannot be read: ${error()}`} tone="danger" />}
        </If>
        <If when={missing()}>
          {(folder) => (
            <Empty
              icon="book-open"
              title={`No folder ${folder()}`}
              words="The wiki reads the Markdown files of this folder of the repository. Name another in Settings, Extensions, Wiki."
            />
          )}
        </If>
        <Each key={(page: WikiPage) => page.path} of={pages()}>
          {(page) => (
            <Row onPress={() => picked.set(page().path)} selected={shown() === page().path}>
              <Line icon="file-text" label={page().title} meta={page().path} />
            </Row>
          )}
        </Each>
        <If when={refused()}>{(words) => <Banner title={words()} tone="caution" />}</If>
        <If when={text()} else={<Spinner label="Reading the page" />}>
          {(page) => <Text font="code">{page()}</Text>}
        </If>
      </View>
    </Scroll>
  );
}

/** The pane of Home: the first pages, each opening the place. */
function WikiHome() {
  const { pages } = usePages();
  const repo = useRepository();
  return (
    <View style={{ gap: 4 }}>
      <Heading level={3}>{`${pages().length} pages`}</Heading>
      <Each key={(page: WikiPage) => page.path} of={pages().slice(0, 5)}>
        {(page) => (
          <Row onPress={() => navigate(`/r/${repo}/e/wiki/wiki`)}>
            <Line icon="file-text" label={page().title} />
          </Row>
        )}
      </Each>
    </View>
  );
}

place({ count: "count", icon: "book-open", id: "wiki", key: "w", title: "Wiki", view: WikiPlace });
homePane({ column: 1, icon: "book-open", id: "wiki", title: "Wiki", view: WikiHome });
