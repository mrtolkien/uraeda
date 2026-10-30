// The sidebar's ＋ New, and the phone's tab, open the New page at once: its cards and entries say
// more than a menu of three words.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atRepo, atWidth, click, renderPage } from "./helpers.tsx";

test.each([
  { what: "the sidebar's", width: 1440 },
  { what: "the phone's", width: 402 },
])("$what New opens the New page, with no menu", async ({ width }) => {
  atWidth(width);
  await renderPage("/inbox");
  await screen.findByRole("heading", { level: 1, name: "Inbox" });

  await click(screen.getByRole("link", { name: "New" }));

  expect(screen.queryByRole("menu")).toBeNull();
  expect(window.location.pathname).toBe(atRepo("/new"));
});
