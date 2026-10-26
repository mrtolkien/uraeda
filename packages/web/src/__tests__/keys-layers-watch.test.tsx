// `useLayerOpen` watches the whole document, so a streaming transcript's burst of mutations must
// cost one check of the layer rule per frame, however many subscribers and mutations there are.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { useLayerOpen } from "../keys/layers.ts";

/** The frames the fake `requestAnimationFrame` holds, run by `frame()`. */
let frames: Array<FrameRequestCallback> = [];

beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => frames.push(callback));
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Runs the frames asked for so far, as the browser's next frame does. */
const frame = () =>
  act(() => {
    const due = frames;
    frames = [];
    due.forEach((callback) => callback(0));
  });

/** Lets the mutation observers deliver their records. */
const mutations = () => act(async () => void (await Promise.resolve()));

function Watcher({ name }: { name: string }) {
  return <p>{`${name}: ${useLayerOpen() ? "layer" : "page"}`}</p>;
}

test("a burst of mutations runs the layer check once per frame, and the layer state updates", async () => {
  render(
    <>
      <Watcher name="a" />
      <Watcher name="b" />
    </>,
  );
  expect(screen.getByText("a: page")).toBeTruthy();
  const spy = vi.spyOn(document, "querySelector");
  // Each run of the rule starts by looking for an expanded popup: one such query is one check.
  const checks = () => spy.mock.calls.filter(([selector]) => selector.includes("haspopup")).length;

  for (let line = 0; line < 20; line++) {
    document.body.append(document.createElement("p"));
    await mutations();
  }
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  document.body.append(dialog);
  await mutations();
  expect(checks()).toBe(0);

  frame();
  expect(checks()).toBe(1);
  expect(screen.getByText("a: layer")).toBeTruthy();
  expect(screen.getByText("b: layer")).toBeTruthy();

  dialog.remove();
  await mutations();
  frame();
  expect(checks()).toBe(2);
  expect(screen.getByText("a: page")).toBeTruthy();
  expect(screen.getByText("b: page")).toBeTruthy();
});
