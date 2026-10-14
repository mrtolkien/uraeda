import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { ImageView } from "../ImageView.tsx";
import { navigate } from "../routes.tsx";
import { atRepo, fixtureRepo, git, renderPage } from "./helpers.tsx";

const TEXT = `# Web UI

> [!WARNING]
> Mind the gap.

- [pro] fast
- [con] slow

<div>raw</div>

See [the spec](spec.md#data), [the code](/crates/core/src/git.rs), and [Vite](https://vite.dev).
`;

/** A repository whose web UI proposal holds TEXT, on the checkout. */
function repo() {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/proposal.md"), TEXT);
  return repo;
}

test("draws callouts, typed bullets, and raw HTML as text", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", repo());

  expect(await screen.findByText("Warning")).toBeTruthy();
  expect(screen.getByText("Mind the gap.")).toBeTruthy();
  const fast = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes("fast")) as HTMLElement;
  expect(within(fast).getByText("+")).toBeTruthy();
  expect(screen.getByText("<div>raw</div>")).toBeTruthy();
  expect(screen.queryByText("raw", { exact: true })).toBeNull();
});

test("opens workflow files in the UI, code as text, and the web in a new tab", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", repo());

  const code = await screen.findByRole("link", { name: "the code" });
  expect(code.getAttribute("href")).toBe(atRepo("/raw/crates/core/src/git.rs"));
  expect(code.getAttribute("target")).toBe("_blank");
  expect(screen.getByRole("link", { name: "Vite" }).getAttribute("target")).toBe("_blank");
  fireEvent.click(screen.getByRole("link", { name: "the spec" }));
  expect(window.location.pathname).toBe(atRepo("/f/2026-10-11-web-ui/spec.md"));
});

/** US1.6 */
test("an approved spec shows the same folds", async () => {
  await renderPage("/f/2026-10-13-plan-review/spec.md");

  const details = await screen.findByRole("button", { name: "Details" });
  const scenarios = screen.getAllByRole("button", { name: /^Scenarios \(\d\)$/ });
  expect(scenarios.map((trigger) => trigger.textContent)).toEqual([
    "Scenarios (3)",
    "Scenarios (4)",
    "Scenarios (3)",
    "Scenarios (4)",
  ]);
  for (const trigger of [...scenarios, details]) {
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  }

  fireEvent.click(details);
  await waitFor(() => expect(details.getAttribute("aria-expanded")).toBe("true"));
  expect(screen.getByRole("heading", { name: "Data" })).toBeTruthy();
});

const IMAGES = `# Login banner

The banner covers the login button:

![Login](images/login.webp)

See ![Logo](/crates/logo.png), ![Banner](https://example.com/banner.png), and ![[shot.png]].
`;

/** A repository whose web UI proposal holds IMAGES, on the checkout. */
function imagesRepo() {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/proposal.md"), IMAGES);
  return repo;
}

test("US1.4: a proposal's image shows with its alt text, and opens full screen", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", imagesRepo());

  const image = await screen.findByRole("img", { name: "Login" });
  expect(image.getAttribute("src")).toBe(atRepo("/images/specs/2026-10-11-web-ui/images/login.webp"));
  // Its lightbox is a dialog, which a paragraph cannot hold.
  expect(image.closest("p")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  // The image is a link to itself, which opens it in place. happy-dom follows a link clicked
  // through its child before React sees the click, which a browser does not: the click goes to
  // the link that holds the image.
  const link = screen.getByRole("link", { name: "Login" });
  expect(link.contains(image)).toBe(true);
  await act(async () => {
    fireEvent.click(link);
  });
  const dialog = screen.getByRole("dialog", { name: "Login" });
  expect(within(dialog).getByRole("img", { name: "Login" })).toBeTruthy();
  expect(within(dialog).getByRole("button", { name: "Close" })).toBeTruthy();
  expect(window.location.pathname).toBe(atRepo("/f/2026-10-11-web-ui/proposal.md"));

  await act(async () => window.history.back());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(window.location.pathname).toBe(atRepo("/f/2026-10-11-web-ui/proposal.md"));
});

test("an image outside specs, or a URL, is a link", async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", imagesRepo());

  const logo = await screen.findByRole("link", { name: "Logo" });
  expect(logo.getAttribute("href")).toBe(atRepo("/raw/crates/logo.png"));
  const banner = screen.getByRole("link", { name: "Banner" });
  expect(banner.getAttribute("href")).toBe("https://example.com/banner.png");
  expect(banner.getAttribute("target")).toBe("_blank");
  expect(screen.queryByRole("img", { name: "Logo" })).toBeNull();
  expect(screen.queryByRole("img", { name: "Banner" })).toBeNull();
  // Obsidian's embed is text, as wikilinks are.
  expect(screen.getByText(/shot\.png/)).toBeTruthy();
  // The lightbox, closed, holds its own copy of each image drawn.
  const images = [...document.querySelectorAll("img")]
    .filter((image) => !image.closest("dialog"))
    .map((image) => image.getAttribute("alt"));
  expect(images).toEqual(["Login"]);
});

test('a missing image shows "Image missing"', async () => {
  await renderPage("/f/2026-10-11-web-ui/proposal.md", imagesRepo());

  const image = await screen.findByRole("img", { name: "Login" });
  await act(async () => {
    fireEvent.error(image);
  });
  // The alt text says which image is missing.
  expect(screen.getByText("Image missing: Login")).toBeTruthy();
  expect(screen.queryByRole("img", { name: "Login" })).toBeNull();
});

/** A repository whose web UI proposal holds a text, on the checkout. */
function holding(text: string) {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/proposal.md"), text);
  return repo;
}

const PROPOSAL = "/f/2026-10-11-web-ui/proposal.md";

/** Opens the proposal from its feature's page, so Back has a page to go back to. */
async function openProposal(text = IMAGES) {
  await renderPage("/f/2026-10-11-web-ui", holding(text));
  await act(async () => navigate(PROPOSAL));
  await screen.findByRole("img", { name: "Login" });
}

const overlayEntry = () => (window.history.state as { overlay?: string } | null)?.overlay;

test.each([
  [
    "Close",
    (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "Close" })),
  ],
  ["Escape", (dialog: HTMLElement) => fireEvent.keyDown(dialog, { key: "Escape" })],
])(
  "the UI behaviour decision: %s closes the image, takes its history entry back, and focuses its link",
  async (_, close) => {
    await openProposal();
    const link = screen.getByRole("link", { name: "Login" });
    await act(async () => {
      fireEvent.click(link);
    });
    const dialog = screen.getByRole("dialog", { name: "Login" });
    expect(overlayEntry()).toBeDefined();

    await act(async () => close(dialog));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(overlayEntry()).toBeUndefined());
    expect(window.location.pathname).toBe(atRepo(PROPOSAL));
    expect(document.activeElement).toBe(link);
    // The next Back leaves the proposal, not an image already closed.
    await act(async () => window.history.back());
    await waitFor(() => expect(window.location.pathname).toBe(atRepo("/f/2026-10-11-web-ui")));
  },
);

test("an image's path is encoded part by part in its address", async () => {
  await renderPage(
    PROPOSAL,
    holding("# Login banner\n\n![Login](images/my%20shot%20%231%20100%25.webp)\n"),
  );

  const image = await screen.findByRole("img", { name: "Login" });
  expect(image.getAttribute("src")).toBe(
    atRepo("/images/specs/2026-10-11-web-ui/images/my%20shot%20%231%20100%25.webp"),
  );
});

test("an image whose address changes after it failed shows again", async () => {
  // The editor's preview redraws an image as its link is typed.
  const { rerender } = render(<ImageView alt="Login" src="/images/specs/x/images/a" />);
  await act(async () => {
    fireEvent.error(screen.getByRole("img", { name: "Login" }));
  });
  expect(screen.getByText("Image missing: Login")).toBeTruthy();

  rerender(<ImageView alt="Login" src="/images/specs/x/images/a.webp" />);

  expect(screen.getByRole("img", { name: "Login" }).getAttribute("src")).toBe(
    "/images/specs/x/images/a.webp",
  );
  expect(screen.queryByText(/Image missing/)).toBeNull();
});

test('an image without alt text is a link named "Image", and "Image missing" when it fails', async () => {
  await renderPage(PROPOSAL, holding("# Login banner\n\n![](images/login.webp)\n"));

  const link = await screen.findByRole("link", { name: "Image" });
  await act(async () => {
    fireEvent.error(link.querySelector("img")!);
  });
  expect(screen.getByText("Image missing")).toBeTruthy();
});

test("an image inside a link is drawn in the link, which it does not open", async () => {
  await renderPage(
    PROPOSAL,
    holding(
      "# Login banner\n\n[![build](images/build.webp)](https://ci.example.com) and [![badge](https://e.com/b.png)](https://ci.example.com/b)\n",
    ),
  );

  const build = await screen.findByRole("link", { name: "build" });
  expect(build.getAttribute("href")).toBe("https://ci.example.com");
  expect(within(build).getByRole("img", { name: "build" }).getAttribute("src")).toBe(
    atRepo("/images/specs/2026-10-11-web-ui/images/build.webp"),
  );
  expect(build.getAttribute("aria-haspopup")).toBeNull();
  // An image off the web is its alt text, in the link.
  const badge = screen.getByRole("link", { name: "badge" });
  expect(badge.getAttribute("href")).toBe("https://ci.example.com/b");
  expect(within(badge).queryByRole("img")).toBeNull();
});
