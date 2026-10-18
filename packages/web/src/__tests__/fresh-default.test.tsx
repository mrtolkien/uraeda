// The agents decision: the settings read for an inserted message's fresh session default, which a
// failed read leaves unread, the server then following the setting, without crashing the composer.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { FreshDefault } from "../HandOver.tsx";

vi.mock(import("../data.ts"), async (original) => ({
  ...(await original()),
  useSettings: () => {
    throw new Error("Could not read the settings.");
  },
}));

test("a settings read that fails leaves the default unread, and what is around it drawn", () => {
  const onRead = vi.fn();
  // React reports the error caught by the boundary.
  vi.spyOn(console, "error").mockImplementation(() => {});

  render(
    <div>
      <p>The composer</p>
      <FreshDefault onRead={onRead} step="plan" />
    </div>,
  );

  expect(screen.getByText("The composer")).toBeTruthy();
  expect(onRead).not.toHaveBeenCalled();
});
