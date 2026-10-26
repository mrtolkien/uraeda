// The status line's hints, from the registry (US6 1, 2, 3): a binding with a hint is named, one
// without is not, a dialog removes them but for what its owner keeps, and the phone shows none. The
// real status line is rendered over the registry, without a server: its counts are not under test.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { StatusLine } from "../shell/StatusLine.tsx";

vi.mock("../sessionData.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../sessionData.ts")>()),
  useNavigation: () => ({ sessionList: null, workspace: null }),
}));

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A page with a list, whose `k` has no hint, and the Escape its dialog's owner keeps named. */
function Declarer() {
  useKeys([
    { hint: "j k", keys: "j", label: "move", run: () => {} },
    { keys: "k", label: "previous", run: () => {} },
    { hint: "esc", hintInLayer: true, keys: "Escape", label: "close", run: () => {} },
  ]);
  return null;
}

function show(isNarrow = false) {
  render(
    <KeysProvider>
      <Declarer />
      <StatusLine isNarrow={isNarrow} slot={null} />
    </KeysProvider>,
  );
}

/** The status line's text. */
const line = () => screen.getByRole("contentinfo", { name: "Status line" }).textContent ?? "";

test("a binding with a hint is named, and one without is not", () => {
  show();
  expect(line()).toContain("j k move");
  expect(line()).toContain("esc close");
  expect(line()).not.toContain("previous");
});

// Break: hints that outlive the layer, naming keys that do nothing under it.
test("a dialog opening removes the hints, but for a key its owner keeps", async () => {
  show();
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  await act(async () => {
    document.body.append(dialog);
  });
  await waitFor(() => expect(line()).not.toContain("j k move"));
  expect(line()).toContain("esc close");
  await act(async () => {
    dialog.remove();
  });
  await waitFor(() => expect(line()).toContain("j k move"));
});

test("on a phone, no hint shows", () => {
  show(true);
  expect(line()).not.toContain("move");
  expect(line()).not.toContain("close");
});
