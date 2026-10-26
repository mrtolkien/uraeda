// Space on what a real browser focuses (US1 more 2 to 6; review focus 5): the leader takes it from a
// button, a link, and a row without pressing them, a checkbox and a radio card keep it, and the
// menu is a sheet across the window on a phone. A small page declaring a few leader keys: the
// browser's own handling of Space is what is under test, and the real pages' keys are the leader
// tree's (Task 10). Both sizes run.
import "@astryxdesign/core/reset.css";
import "@astryxdesign/core/astryx.css";
import "../theme/built/uraeda.css";
import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "@astryxdesign/core/Button";
import { Switch } from "@astryxdesign/core/Switch";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { LeaderMenuHost } from "../keys/LeaderMenuHost.tsx";
import { KeysProvider, useKeys } from "../keys/registry.tsx";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const pressed = vi.fn();
const ticked = vi.fn();
const picked = vi.fn();

function Controls() {
  const [isChecked, setIsChecked] = useState(false);
  useKeys([
    { icon: "uraeda:pencil", keys: "space n n", label: "Note", run: () => void pressed("note") },
    {
      icon: "uraeda:plus",
      keys: "space n s",
      label: "Session",
      run: () => void pressed("session"),
    },
    { icon: "uraeda:home", keys: "space h", label: "Home", run: () => void pressed("home") },
  ]);
  return (
    <main>
      <Button label="Note" onClick={() => pressed("button")} />
      <div data-row>
        <a href="#row">A row</a>
      </div>
      <a href="#link">A link</a>
      <Switch
        label="Remember"
        onChange={(value: boolean) => (setIsChecked(value), ticked())}
        value={isChecked}
      />
      <div
        aria-checked="false"
        onKeyDown={(event) => event.key === " " && picked()}
        role="radio"
        tabIndex={0}
      >
        Card
      </div>
    </main>
  );
}

function show() {
  pressed.mockClear();
  ticked.mockClear();
  picked.mockClear();
  render(
    <KeysProvider>
      <Controls />
      <LeaderMenuHost />
    </KeysProvider>,
  );
}

const menu = () => screen.findByRole("group", { name: "Space" });

test("Space on a button opens the menu and does not press it, Enter still presses it", async () => {
  show();
  const button = screen.getByRole("button", { name: "Note" });
  button.focus();
  await userEvent.keyboard(" ");
  await menu();
  expect(pressed).not.toHaveBeenCalled();
  await userEvent.keyboard("{Escape}");
  await userEvent.keyboard("{Enter}");
  expect(pressed).toHaveBeenCalledWith("button");
});

test("Space on a link and on a row opens the menu and follows nothing", async () => {
  show();
  for (const name of ["A link", "A row"]) {
    screen.getByRole("link", { name }).focus();
    await userEvent.keyboard(" ");
    await menu();
    await userEvent.keyboard("{Escape}");
  }
  expect(window.location.hash).toBe("");
  expect(window.scrollY).toBe(0);
});

test("Space on a switch ticks it and on a radio card is the card's, with no menu", async () => {
  show();
  screen.getByRole("switch", { name: "Remember" }).focus();
  await userEvent.keyboard(" ");
  expect(ticked).toHaveBeenCalledOnce();
  screen.getByRole("radio", { name: "Card" }).focus();
  await userEvent.keyboard(" ");
  expect(picked).toHaveBeenCalledOnce();
  // The menu shows half a second after Space: 700 ms is long enough to see it absent.
  await new Promise((resolve) => setTimeout(resolve, 700));
  expect(screen.queryByRole("group", { name: "Space" })).toBeNull();
});

test("the menu is a sheet across the window on a phone, in one column, a box on a desktop", async () => {
  show();
  await userEvent.keyboard(" ");
  const box = (await menu()).getBoundingClientRect();
  if (window.innerWidth < 768) {
    expect(box.left).toBeLessThan(24);
    expect(window.innerWidth - box.right).toBeLessThan(24);
    const lefts = screen.getAllByRole("listitem").map((item) => item.getBoundingClientRect().left);
    expect(new Set(lefts).size).toBe(1);
  } else {
    expect(box.width).toBeLessThan(window.innerWidth / 2);
  }
});
