// T3, on an iPhone from the home screen: what is typed, and the button that sends it, stay above
// the keyboard; the phone hints no key; the priorities are one column there; its sidebar copies no
// tab; and a card is a head line over its text.
import { LayerProvider } from "@astryxdesign/core/Layer";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { scrollAboveKeyboard, useAboveKeyboard } from "../layout/useAboveKeyboard.ts";
import { useUndoToast } from "../layout/useUndoToast.ts";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

/** A visual viewport the test moves, as a phone's keyboard does as it opens. */
class Viewport extends EventTarget {
  height = window.innerHeight;
  offsetTop = 0;
}

afterEach(() => {
  Reflect.deleteProperty(window, "visualViewport");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  atWidth(1440);
});

test("a box's end scrolls above the keyboard, and only while a keyboard shows", () => {
  const screenHeight = 844;
  // No keyboard: the visual viewport is the window.
  expect(scrollAboveKeyboard(900, { height: 844, offsetTop: 0 }, screenHeight)).toBe(0);
  // A keyboard 336 tall: a Send at 610 rises above it, with a little room.
  expect(scrollAboveKeyboard(610, { height: 508, offsetTop: 0 }, screenHeight)).toBe(110);
  // Already above it: nothing moves.
  expect(scrollAboveKeyboard(400, { height: 508, offsetTop: 0 }, screenHeight)).toBe(0);
  // The visual viewport scrolled down by iOS: what it shows starts lower.
  expect(scrollAboveKeyboard(610, { height: 508, offsetTop: 100 }, screenHeight)).toBe(10);
});

/** A field in a box whose end, its Send, sits at `bottom`, kept above the keyboard. */
function Box({ bottom }: { bottom: number }) {
  const box = useRef<HTMLDivElement>(null);
  useAboveKeyboard(box, true);
  useEffect(() => {
    vi.spyOn(box.current!, "getBoundingClientRect").mockReturnValue({ bottom } as DOMRect);
  }, [bottom]);
  return (
    <div ref={box}>
      {/* oxlint-disable-next-line react/forbid-elements -- a bare field stands for a composer's */}
      <textarea aria-label="Message" />
      {/* oxlint-disable-next-line react/forbid-elements -- a bare button stands for its Send */}
      <button type="button">Send</button>
    </div>
  );
}

// Break: a composer whose Send stayed under the keyboard, as iOS scrolls only the caret into view.
test("while a field of the box is typed in, the keyboard opening scrolls its Send above it", async () => {
  const viewport = new Viewport();
  Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      disconnect() {}
      observe() {}
    },
  );
  const scroll = vi.spyOn(window, "scrollBy").mockImplementation(() => {});
  render(<Box bottom={window.innerHeight - 40} />);
  act(() => screen.getByRole("textbox", { name: "Message" }).focus());
  await act(async () => {
    viewport.height = window.innerHeight - 336;
    viewport.dispatchEvent(new Event("resize"));
    await new Promise((done) => requestAnimationFrame(done));
  });
  await waitFor(() => expect(scroll).toHaveBeenCalledWith({ top: 336 - 40 + 8 }));
});

/** A toast with an Undo, as a change the page does not show. */
function Toasting() {
  const toast = useUndoToast();
  useEffect(() => {
    toast("Moved to Later", () => Promise.resolve(undefined));
  }, [toast]);
  return null;
}

/** The toast's Undo, once shown. */
function undo() {
  return waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>("[data-undo] button");
    expect(button).not.toBeNull();
    return button!;
  });
}

// Break: "Undo u" on a touch screen, where no key is hinted.
test("on the phone, the toast's Undo shows no key; on a wide screen it shows `u`", async () => {
  atWidth(402);
  const phone = render(
    <LayerProvider>
      <Toasting />
    </LayerProvider>,
  );
  expect((await undo()).textContent?.trim()).toBe("Undo");
  phone.unmount();

  atWidth(1440);
  render(
    <LayerProvider>
      <Toasting />
    </LayerProvider>,
  );
  await waitFor(async () => expect((await undo()).textContent).toMatch(/Undo\s*u/));
});

// Break: four columns on a phone, scrolled sideways, Next and Later past the screen's edge.
test("on the phone, the priorities are one column until the columns are picked", async () => {
  window.localStorage.removeItem("uraeda:priorities:layout");
  atWidth(402);
  await renderPage("/priorities", fixtureRepo());
  await screen.findByRole("heading", { name: "Priorities" });
  const list = await screen.findByRole("radio", { name: "List" });
  expect(list.getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("region", { name: "Columns" })).toBeNull();

  await act(async () => {
    fireEvent.click(screen.getByRole("radio", { name: "Columns" }));
  });
  await waitFor(() =>
    expect(screen.getByRole("radio", { name: "Columns" }).getAttribute("aria-checked")).toBe(
      "true",
    ),
  );
  await screen.findByRole("region", { name: "Columns" });
  expect(window.localStorage.getItem("uraeda:priorities:layout")).toBe("columns");
  window.localStorage.removeItem("uraeda:priorities:layout");
});

// Break: Git and ＋ New back in the phone's sidebar, a copy of the tabs' Commit and New; or gone
// from the wide column, which has no tabs.
test("the phone's sidebar holds no Git and no New, which the tabs have; the wide column keeps them", async () => {
  const repo = fixtureRepo();
  atWidth(375);
  await renderPage("/", repo);
  await screen.findByRole("navigation", { name: "Tabs" });
  await act(async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Sidebar" }));
  });
  const phone = within(await screen.findByRole("navigation", { name: "Navigation" }));
  await phone.findByRole("group", { name: "Needs you" });
  expect(phone.queryByRole("link", { name: /^Git/ })).toBeNull();
  expect(phone.queryByRole("link", { name: /^New/ })).toBeNull();
  expect(
    within(screen.getByRole("navigation", { name: "Tabs" })).getByRole("link", { name: /^New/ }),
  ).toBeTruthy();

  atWidth(1440);
  await renderPage("/", repo);
  const wide = within(await screen.findByRole("navigation", { name: "Navigation" }));
  expect(await wide.findByRole("link", { name: /^Git/ })).toBeTruthy();
  expect(wide.getByRole("link", { name: /^New/ })).toBeTruthy();
});

/** The links of home's Needs you cards, outside the sidebar, which has its own. */
async function homeNeedsYou() {
  const main = await screen.findByRole("main");
  const group = await within(main).findByRole("region", { name: /^Needs you/ });
  await waitFor(() => expect(group.querySelector("[data-card]")).not.toBeNull());
  return [...group.querySelectorAll<HTMLElement>("[data-card]")].map((card) =>
    card.querySelector("a")!,
  );
}

// Break: the ＞ back beside a Needs you card's text on the phone, which squeezed it into a column
// between the icon and the button; its detail beside the icon again; or the card, once the ＞ is
// gone, leading to the feature's page rather than to the step that waits on the human.
test("on the phone, a Needs you card is a head line over its text, and leads to the step", async () => {
  const repo = fixtureRepo();
  atWidth(375);
  await renderPage("/", repo);
  const phone = await homeNeedsYou();
  expect(phone.length).toBeGreaterThan(0);
  const steps = phone.map((link) => link.getAttribute("href")!);
  for (const link of phone) {
    expect(link.querySelector("[data-card-status]")).toBeNull();
    // The head line holds the icon and the name; the text follows it, a line of its own.
    const [head, text] = [...link.children];
    expect(head!.querySelector("svg")).not.toBeNull();
    expect(text!.textContent!.trim()).not.toBe("");
    expect(head!.textContent).not.toContain(text!.textContent!.trim());
  }

  atWidth(1440);
  await renderPage("/", repo);
  const wide = await homeNeedsYou();
  expect(wide).toHaveLength(phone.length);
  wide.forEach((link, i) => {
    // The ＞ on a wide screen, the card leading to the feature's page, the step under it.
    expect(link.querySelector("[data-card-status]")).not.toBeNull();
    expect(steps[i]!.startsWith(`${link.getAttribute("href")}/`)).toBe(true);
  });
});
