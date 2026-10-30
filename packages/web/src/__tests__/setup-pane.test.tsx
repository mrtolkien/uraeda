// The Setup pane's title counts the required files left to write: as the pane closes, its last
// file written, it has none, and shows no count rather than "Setup · 0".
import { render, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import type { SetupItem } from "uraeda-binding";
import { SetupPane } from "../home/Setup.tsx";

const item = (key: string, state: string): SetupItem =>
  ({ key, name: key, required: true, state }) as SetupItem;

test("a pane with no required file left shows no count", () => {
  render(
    <SetupPane
      hasAgent
      items={[item("constitution", "written"), item("testing", "written")]}
      message="Set up"
      onSetUp={() => {}}
    />,
  );

  expect(screen.queryByText("· 0")).toBeNull();
});

test("a pane with required files left counts them", () => {
  render(
    <SetupPane
      hasAgent
      items={[item("constitution", "missing"), item("testing", "written")]}
      message="Set up"
      onSetUp={() => {}}
    />,
  );

  expect(screen.getByText("· 1")).toBeTruthy();
});
