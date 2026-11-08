// An extension's page in the app (US1): its place, registered from its `page.tsx`, opens with its
// key and reads its record through fate; a saved change redraws it without a page reload, its old
// version gone; and a page that throws while registering leaves every other place drawn, its
// problem on the settings page.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routeHistory.ts";
import { atRepo, fixtureRepo, quiet, refreshUntil, renderPage } from "./helpers.tsx";

/** Writes the extension `name`'s `files` into the config folder's extensions folder. */
function extension(config: string, name: string, files: Record<string, string>) {
  const folder = join(config, "extensions", name);
  mkdirSync(folder, { recursive: true });
  for (const [file, text] of Object.entries(files)) {
    writeFileSync(join(folder, file), text);
  }
}

const manifest = (name: string, title: string, server: boolean) =>
  `name = "${name}"\ntitle = "${title}"\napi = 1\npage = "page.tsx"\n${server ? 'server = "server.ts"\n' : ""}`;

/** Wiki's page: a place, `Space w`, whose heading is `heading`, drawing its record's text. */
const wikiPage = (heading: string) => `import { Text } from "@astryxdesign/core/Text";
import { useRecord } from "uraeda/page";
import { Heading } from "./heading";

function Wiki() {
  const pages = useRecord<{ text: string }>("pages");
  return (
    <>
      <Heading text="${heading}" />
      <Text>{pages.text}</Text>
    </>
  );
}

export default function page(api) {
  api.place({ component: Wiki, icon: "uraeda:globe", id: "wiki", key: "w", title: "Wiki" });
}
`;

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The navigation column's links named `name`. */
const links = (name: string) =>
  within(screen.getByRole("navigation", { name: "Navigation" })).queryAllByRole("link", {
    name: new RegExp(`^${name}`),
  });

// Break: the old version's place left registered beside the new one, or a throwing page blanking
// the shell.
test("an extension page registers a place and reloads", async () => {
  const config = temporaryFolder("uraeda-config");
  writeFileSync(join(config, "config.toml"), "");
  extension(config, "wiki", {
    "extension.toml": manifest("wiki", "Wiki", true),
    "heading.tsx": `export function Heading({ text }: { text: string }) {\n  return <h1>{text}</h1>;\n}\n`,
    "page.tsx": wikiPage("Wiki, first"),
    "server.ts": `export default function activate(api) {\n  api.record("pages", () => ({ text: "Every page of the wiki" }));\n}\n`,
  });
  extension(config, "oops", {
    "extension.toml": manifest("oops", "Oops", false),
    "page.tsx": `export default function page() {\n  throw new Error("the page fell over");\n}\n`,
  });
  await renderPage("/", fixtureRepo(), { config, extensions: true });
  await screen.findByRole("navigation", { name: "Navigation" });
  await waitFor(() => expect(links("Wiki")).toHaveLength(1));

  await act(async () => {
    press(" ");
    press("w");
  });
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/e/wiki/wiki")));
  await quiet();
  expect(await screen.findByRole("heading", { name: "Wiki, first" })).toBeTruthy();
  expect(await screen.findByText("Every page of the wiki")).toBeTruthy();

  // A saved change: the place redraws, in the same page, with one Wiki.
  writeFileSync(join(config, "extensions", "wiki", "page.tsx"), wikiPage("Wiki, second"));
  await refreshUntil(() =>
    expect(screen.getByRole("heading", { name: "Wiki, second" })).toBeTruthy(),
  );
  expect(screen.queryByRole("heading", { name: "Wiki, first" })).toBeNull();
  expect(screen.getByText("Every page of the wiki")).toBeTruthy();
  expect(links("Wiki")).toHaveLength(1);

  // The page that threw left Wiki and the inbox drawn, and the settings page names its problem.
  expect(links("Inbox")).toHaveLength(1);
  await act(async () => navigate(atRepo("/settings/extensions")));
  await quiet();
  await refreshUntil(() => expect(screen.getByText(/the page fell over/)).toBeTruthy());
  expect(links("Wiki")).toHaveLength(1);
});
