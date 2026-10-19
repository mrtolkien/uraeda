// Flow: workflow files shown as documents. A link goes where the kind of file it names says, a
// text an agent wrote is never run as HTML, an image of the feature shows in place and opens full
// screen with its own history entry, and a file or a feature that is not there settles at once.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { commitOnBranch } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { click, fixtureRepo, startApp } from "./harness.tsx";

const FEATURE = "2026-10-11-web-ui";
const LINKS = `specs/${FEATURE}/discovery-02.md`;
const IMAGES = `specs/${FEATURE}/discovery-03.md`;

const LINKED = `# Links

[a spec](spec.md#data), [the decision](/specs/decisions/git.md#rules), [the code](/crates/core/src/git.rs),
[a draft](/specs/drafts/git-listener.md), [a mockup](/specs/${FEATURE}/mockups/ui.html),
[the web](https://vite.dev).

<div>raw</div> <img src=x onerror=alert(1)> <script>alert(1)</script>
`;

const PICTURES = `# Pictures

![Login](images/my%20shot%20%231.webp)

See ![Logo](/crates/logo.png) and ![Banner](https://example.com/banner.png).
`;

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    commitOnBranch(repo, FEATURE, { [IMAGES]: PICTURES, [LINKS]: LINKED });
    return repo;
  },
});

/** The link of the page with an accessible name. */
const link = (name: string | RegExp) => screen.findByRole("link", { name });

test("a link goes where the kind of file it names says", async () => {
  await app.open(`/f/${FEATURE}/discovery-02.md`);

  // A workflow file opens in the app, a decision as the feature's branch has it, a draft in its
  // editor.
  expect((await link("a spec")).getAttribute("href")).toBe(app.path(`/f/${FEATURE}/spec.md#data`));
  expect(screen.getByRole("link", { name: "the decision" }).getAttribute("href")).toBe(
    app.path(`/f/${FEATURE}/decisions/git#rules`),
  );
  expect(screen.getByRole("link", { name: "a draft" }).getAttribute("href")).toBe(
    app.path("/edit/specs/drafts/git-listener.md"),
  );
  // Code is text, a mockup its own page, and both leave the app in a tab of their own.
  const code = screen.getByRole("link", { name: "the code" });
  expect(code.getAttribute("href")).toBe(app.path("/raw/crates/core/src/git.rs"));
  expect(code.getAttribute("target")).toBe("_blank");
  expect(screen.getByRole("link", { name: "a mockup" }).getAttribute("href")).toBe(
    app.path(`/mockups/specs/${FEATURE}/mockups/ui.html`),
  );
  // The web opens in a tab that cannot reach back to the app.
  const web = screen.getByRole("link", { name: "the web" });
  expect(web.getAttribute("target")).toBe("_blank");
  expect(web.getAttribute("rel")).toMatch(/noopener/);

  await click(screen.getByRole("link", { name: "a spec" }));
  expect(window.location.pathname).toBe(app.path(`/f/${FEATURE}/spec.md`));
});

test("a text the agent wrote is shown as text and never run as HTML", async () => {
  await app.open(`/f/${FEATURE}/discovery-02.md`);

  await link("a spec");
  expect(screen.getByText(/<div>raw<\/div>/)).toBeTruthy();
  expect(document.querySelector("main script, main div > img[onerror]")).toBeNull();
  for (const element of document.querySelectorAll("main *")) {
    expect(element.getAttributeNames().filter((name) => name.startsWith("on"))).toEqual([]);
  }
});

test("an image of the feature shows in place, opens full screen, and Back closes it", async () => {
  await app.open(`/f/${FEATURE}/discovery-03.md`);

  const image = await screen.findByRole("img", { name: "Login" });
  // Its address is its path, each part encoded.
  expect(image.getAttribute("src")).toBe(
    app.path(`/images/specs/${FEATURE}/images/my%20shot%20%231.webp`),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
  const opener = screen.getByRole("link", { name: "Login" });
  await act(async () => {
    fireEvent.click(opener);
  });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("img")).toBeTruthy();
  // The page stays where it is: the image is no page.
  expect(window.location.pathname).toBe(app.path(`/f/${FEATURE}/discovery-03.md`));

  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("an image outside the feature, or off the web, is a link, and one that fails shows its alt text", async () => {
  await app.open(`/f/${FEATURE}/discovery-03.md`);

  expect((await link("Logo")).getAttribute("href")).toBe(app.path("/raw/crates/logo.png"));
  const banner = screen.getByRole("link", { name: "Banner" });
  expect(banner.getAttribute("href")).toBe("https://example.com/banner.png");
  expect(banner.getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("img", { name: "Logo" })).toBeNull();

  // A feature's image the server cannot give: the alt text says what is missing.
  const image = screen.getByRole("img", { name: "Login" });
  await act(async () => {
    fireEvent.error(image);
  });
  expect(screen.queryByRole("img", { name: "Login" })).toBeNull();
  expect(screen.getAllByText(/Login/).length).toBeGreaterThan(0);
});

test("a file, a folder, or a feature that is not there settles at once, with a way back", async () => {
  await app.open(`/f/${FEATURE}/nope.md`);
  expect(
    (await screen.findAllByRole("link")).some(
      (l) => l.getAttribute("href") === app.path(`/f/${FEATURE}`),
    ),
  ).toBe(true);
  expect(screen.queryByRole("progressbar")).toBeNull();

  cleanup();
  await app.open("/f/2026-10-11-nope/spec.md");
  await screen.findByRole("main");
  expect(screen.queryByRole("progressbar")).toBeNull();
  expect((await screen.findAllByRole("link")).length).toBeGreaterThan(0);

  cleanup();
  await app.open("/f/2026-10-11-nope");
  await screen.findByRole("main");
  expect(screen.queryByRole("progressbar")).toBeNull();
});
