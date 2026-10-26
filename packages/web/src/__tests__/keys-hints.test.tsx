// The status line's hints, from the registry (US6 1, 2, 3): a binding with a hint is named, one
// without is not, a dialog removes them but for what its owner keeps, and the phone shows none. The
// real status line is rendered over the registry, without a server: its counts are not under test.
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { KeysProvider, useKeys } from "../keys/registry.tsx";
import { useListKeys } from "../lists/useListKeys.ts";
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

/** A list, as the pages draw one: its keys are the registry's, and its hints the status line's. */
function List({ columns, escape }: { columns?: boolean; escape?: string | null }) {
  const { ref } = useListKeys({
    ...(columns === true ? { columns: [[0]] } : {}),
    ...(escape === undefined ? {} : { escapeLabel: escape }),
    onClose: () => false,
    onEdit: () => false,
    onSelect: () => {},
    selected: -1,
  });
  return <div ref={ref} />;
}

function showList(props: { columns?: boolean; escape?: string | null }) {
  return render(
    <KeysProvider>
      <List {...props} />
      <StatusLine isNarrow={false} slot={null} />
    </KeysProvider>,
  );
}

// R20, kept from `status-hints.test.tsx` and re-pointed to the registry: a list's Escape hint names
// what Escape does, and is left out where it does nothing; `h l` is named only with columns.
test("a list's Escape hint names what Escape does, and is left out where it does nothing", () => {
  const { rerender } = showList({});
  expect(line()).toContain("j k move");
  expect(line()).toContain("⏎ open");
  expect(line()).toContain("esc close");
  expect(line()).not.toContain("h l");
  expect(line().indexOf("j k move")).toBeLessThan(line().indexOf("esc close"));

  rerender(
    <KeysProvider>
      <List escape="constitution" />
      <StatusLine isNarrow={false} slot={null} />
    </KeysProvider>,
  );
  expect(line()).toContain("esc constitution");

  rerender(
    <KeysProvider>
      <List escape={null} />
      <StatusLine isNarrow={false} slot={null} />
    </KeysProvider>,
  );
  expect(line()).not.toContain("esc");
  expect(line()).toContain("j k move");
});

test("a list in columns names h l, and its other keys have no hint of their own", () => {
  showList({ columns: true });
  expect(line()).toContain("h l column");
  // `+ -`, the arrows, Home and End work, and are not named: `j k` stands for them.
  expect(line()).not.toContain("next row");
  expect(line()).not.toContain("Home");
});
