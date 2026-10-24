// US3, more scenarios 4 and 5, and SC-002 for the tabs: the document's column keeps one width
// whatever its open tab, a third of the window until dragged, the dragged width kept for every
// document; its tabs follow WAI-ARIA's pattern, the arrows moving between them. Drawn over a small
// page of three tabs, the column's own behaviour apart from any document's.
import { Theme } from "@astryxdesign/core/theme";
import { cleanup, render, screen, within } from "@testing-library/react";
import { userEvent } from "vite-plus/test/browser";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { type ColumnTab, DocumentColumn } from "../layout/DocumentColumn.tsx";
import { COLUMN_KEY } from "../layout/documentColumnWidth.ts";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { atSize, drawn } from "./helpers.tsx";

/** Three tabs, their panels of unlike widths: a sentence, a path wider than the column, a line. */
const TABS: ReadonlyArray<ColumnTab> = [
  {
    icon: "uraeda:list",
    key: "outline",
    label: "Outline",
    panel: (
      <p>Verdict and summary, Goal, Today, Scope, Sources, and every question of the round.</p>
    ),
  },
  {
    icon: "uraeda:pencil",
    key: "notes",
    label: "Notes",
    panel: (
      <p>specs/2026-10-20-merge-chats/clarifications-01.md#settled-without-the-human-and-more</p>
    ),
  },
  { icon: "uraeda:comment", key: "session", label: "Session", panel: <p>No session yet.</p> },
];

/** A document beside the column, `title` in it. */
function Page({ title }: { title: string }) {
  return (
    <Theme mode="light" theme={uraedaTheme}>
      <DocumentColumn
        content={
          <section aria-label="The document">
            <h1>{title}</h1>
          </section>
        }
        label="The round's column"
        tabs={TABS}
      />
    </Theme>
  );
}

/** The column, as drawn. */
const column = () => screen.getByRole("complementary", { name: "The round's column" });

/** The column's width, as drawn. */
const width = () => Math.round(column().getBoundingClientRect().width);

/** The document's left edge and width, as drawn. */
const documentBox = () => {
  const { width: wide, x } = screen
    .getByRole("region", { name: "The document" })
    .getBoundingClientRect();
  return [Math.round(x), Math.round(wide)];
};

/** Draws the page, the address's tab open, and waits for it to settle. */
async function open(title = "Merge chats, round 01") {
  render(<Page title={title} />);
  await screen.findByRole("heading", { name: title });
  await drawn();
}

beforeEach(() => {
  window.localStorage.removeItem(COLUMN_KEY);
  // The address holds no tab: the first one opens.
  window.history.pushState(null, "", window.location.pathname);
});

describe("on a desktop", () => {
  atSize("desktop");

  test("the column is a third of the window, and switching tabs moves nothing", async () => {
    await open();
    const tabs = within(column()).getByRole("tablist", { name: "The round's column" });
    expect(within(tabs).getByRole("tab", { name: "Outline" }).getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(width()).toBe(480);
    const before = documentBox();

    for (const name of ["Notes", "Session", "Outline", "Session"]) {
      await userEvent.click(within(tabs).getByRole("tab", { name }));
      await expect
        .poll(() => new URLSearchParams(window.location.search).get("tab"))
        .toBe(name.toLowerCase());
      expect(within(column()).getByRole("tabpanel", { name })).toBeTruthy();
      await drawn();
      expect(width()).toBe(480);
      expect(documentBox()).toEqual(before);
    }
  });

  test("the arrows move between the tabs, and Enter opens one", async () => {
    await open();
    const outline = screen.getByRole("tab", { name: "Outline" });
    outline.focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Notes" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Session" }));
    await userEvent.keyboard("{ArrowLeft}");
    await userEvent.keyboard("{Enter}");

    await expect.poll(() => screen.queryByRole("tabpanel", { name: "Notes" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Notes" }).getAttribute("aria-selected")).toBe("true");
  });

  test("dragged to 560 px, the column stays 560 px on another document", async () => {
    await open();
    const handle = screen.getByRole("separator", { name: "Resize the round's column" });
    handle.focus();
    for (let step = 0; step < 8; step++) {
      await userEvent.keyboard("{ArrowLeft}");
    }
    await expect.poll(() => width()).toBe(560);

    cleanup();
    await open("Layout look, round 01");

    await expect.poll(() => width()).toBe(560);
  });
});

describe("semi-wide", () => {
  atSize("semi");

  test("at 1205 px the column is 402 px, beside the document", async () => {
    await open();
    expect(width()).toBe(402);
    const [left, wide] = documentBox();
    expect(left + wide).toBeLessThanOrEqual(Math.round(column().getBoundingClientRect().x));
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("the document alone, without the column", async () => {
    await open();
    expect(screen.queryByRole("complementary", { name: "The round's column" })).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});
