// The Wiki's page: the place "Wiki", `Space k`, with the count of its pages in the rail, listing
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
  // A folder there with no page in it: its own words, never a spinner waiting for a page.
  const empty = () => {
    const value = wiki().value;
    return value !== undefined && !value.isMissing && value.pages.length === 0
      ? value.folder
      : undefined;
  };
  // A spinner only while something is on its way: the record, or the page picked.
  const reading = () =>
    wiki().error === undefined &&
    refused() === undefined &&
    (wiki().value === undefined || (shown() !== undefined && text() === undefined));
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
              title={`No folder “${folder()}” in this repository`}
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
        <If when={empty()}>
          {(folder) => (
            <Empty
              icon="book-open"
              title={`No pages in ${folder()}`}
              words="The wiki lists the Markdown files of this folder, .md, and none is there yet. Add one, or name another folder in Settings, Extensions, Wiki."
            />
          )}
        </If>
        <If when={refused()}>{(words) => <Banner title={words()} tone="caution" />}</If>
        <If when={reading()}>
          <Spinner label={wiki().value === undefined ? "Reading the wiki" : "Reading the page"} />
        </If>
        <If when={text()}>{(page) => <Text font="code">{page()}</Text>}</If>
      </View>
    </Scroll>
  );
}

/** The pane of Home: the first pages, each opening the place. */
function WikiHome() {
  const { missing, pages, wiki } = usePages();
  const repo = useRepository();
  // What the count means: the pages, else why there are none.
  const heading = () => {
    if (wiki().error !== undefined) return "The wiki cannot be read";
    if (missing() !== undefined) return `No folder “${missing()}” in this repository`;
    if (wiki().value === undefined) return "Reading the wiki…";
    return pages().length === 0 ? `No pages in ${wiki().value?.folder}` : `${pages().length} pages`;
  };
  return (
    <View style={{ gap: 4 }}>
      <Heading level={3}>{heading()}</Heading>
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

place({ count: "count", icon: "book-open", id: "wiki", key: "k", title: "Wiki", view: WikiPlace });
homePane({ column: 1, icon: "book-open", id: "wiki", title: "Wiki", view: WikiHome });
